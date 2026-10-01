/**
 * Local full-text search: documents → tokens → inverted index → ranked hits with snippets.
 * Searches file names, extracted text, structured JSON fields, metadata and tags. No service.
 */
import type { Extraction, KnowledgeDoc, SearchHit } from '../types';

export interface IndexEntry {
  docId: string;
  docName: string;
  page: number;
  blockId: string | null;
  field: SearchHit['field'];
  text: string;
}

export interface SearchIndex {
  entries: IndexEntry[];
  /** token → entry indexes */
  postings: Map<string, number[]>;
}

const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'are', 'was', 'were', 'has', 'have', 'into', 'its', 'our', 'you', 'your', 'of', 'to', 'in', 'on', 'a', 'an', 'at', 'by', 'or', 'as', 'is', 'it', 'be']);

/** Lower-case word tokens; keeps "node.js", "c++", "c#" and "ci/cd" intact. */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const m of text.toLowerCase().matchAll(/[a-z0-9À-ɏ]+(?:[.+#/-][a-z0-9+#]+)*[+#]*/g)) {
    const t = m[0].replace(/[.-]+$/, '');
    if (t.length < 2 && !/^[a-z0-9]$/.test(t)) continue;
    if (STOP.has(t)) continue;
    out.push(t);
    // "node.js" is also findable as "node" and "nodejs".
    if (/[.\-/]/.test(t)) {
      out.push(t.replace(/[.\-/]/g, ''));
      for (const part of t.split(/[.\-/]/)) if (part.length > 1 && !STOP.has(part)) out.push(part);
    }
  }
  return out;
}

function jsonStrings(v: unknown, path: string, out: Array<{ path: string; text: string }>, depth = 0): void {
  if (depth > 8 || out.length > 4000) return;
  if (typeof v === 'string') {
    if (v.trim()) out.push({ path, text: v });
  } else if (Array.isArray(v)) v.forEach((x, i) => jsonStrings(x, `${path}[${i}]`, out, depth + 1));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (k !== 'source' && k !== 'confidence') jsonStrings(x, path ? `${path}.${k}` : k, out, depth + 1);
}

export function buildIndex(docs: Array<{ doc: KnowledgeDoc; extraction: Extraction | null }>): SearchIndex {
  const entries: IndexEntry[] = [];
  for (const { doc, extraction } of docs) {
    entries.push({ docId: doc.id, docName: doc.name, page: 1, blockId: null, field: 'name', text: doc.name });
    if (doc.tags.length) entries.push({ docId: doc.id, docName: doc.name, page: 1, blockId: null, field: 'tag', text: doc.tags.map((t) => `#${t}`).join(' ') });
    if (!extraction) continue;
    for (const p of extraction.pages) for (const b of p.blocks) if (b.text.trim()) entries.push({ docId: doc.id, docName: doc.name, page: p.page, blockId: b.id, field: 'text', text: b.text });
    const m = extraction.metadata;
    if (m) {
      const meta = [m.title, m.author, m.subject, m.keywords, m.creator, m.producer].filter(Boolean).join(' · ');
      if (meta) entries.push({ docId: doc.id, docName: doc.name, page: 1, blockId: null, field: 'metadata', text: meta });
    }
    if (extraction.semantic.resume) {
      const strs: Array<{ path: string; text: string }> = [];
      jsonStrings(extraction.semantic.resume, '', strs);
      for (const s of strs) entries.push({ docId: doc.id, docName: doc.name, page: 1, blockId: null, field: 'json', text: `${s.path}: ${s.text}` });
    }
  }
  const postings = new Map<string, number[]>();
  entries.forEach((e, i) => {
    for (const t of new Set(tokenize(e.text))) {
      const list = postings.get(t);
      if (list) list.push(i);
      else postings.set(t, [i]);
    }
  });
  return { entries, postings };
}

function snippet(text: string, terms: string[], radius = 60): string {
  const low = text.toLowerCase();
  let at = -1;
  for (const t of terms) {
    at = low.indexOf(t);
    if (at >= 0) break;
  }
  const flat = text.replace(/\s+/g, ' ');
  if (at < 0) return flat.slice(0, radius * 2) + (flat.length > radius * 2 ? '…' : '');
  const start = Math.max(0, at - radius);
  const end = Math.min(flat.length, at + radius);
  return `${start > 0 ? '…' : ''}${flat.slice(start, end).trim()}${end < flat.length ? '…' : ''}`;
}

const FIELD_WEIGHT: Record<SearchHit['field'], number> = { name: 3, tag: 2.5, metadata: 1.5, json: 1.2, text: 1 };

/** All query tokens must match (prefix match on the last token, so results appear while typing). */
export function search(index: SearchIndex, query: string, limit = 50): SearchHit[] {
  const terms = tokenize(query);
  if (!terms.length) return [];
  const keys = [...index.postings.keys()];
  const sets = terms.map((t, i) => {
    const exact = index.postings.get(t) ?? [];
    if (i < terms.length - 1) return new Set(exact);
    const s = new Set(exact);
    if (t.length >= 2) for (const k of keys) if (k !== t && k.startsWith(t)) for (const x of index.postings.get(k)!) s.add(x);
    return s;
  });
  const [first, ...rest] = sets;
  const hits: SearchHit[] = [];
  for (const i of first ?? []) {
    if (!rest.every((s) => s.has(i))) continue;
    const e = index.entries[i]!;
    const low = e.text.toLowerCase();
    const phrase = low.includes(query.trim().toLowerCase()) ? 2 : 1;
    const tf = terms.reduce((n, t) => n + (low.split(t).length - 1), 0);
    hits.push({ docId: e.docId, docName: e.docName, page: e.page, blockId: e.blockId, field: e.field, snippet: snippet(e.text, terms), score: FIELD_WEIGHT[e.field] * phrase * (1 + Math.log(1 + tf)) });
  }
  hits.sort((a, b) => b.score - a.score || a.docName.localeCompare(b.docName) || a.page - b.page);
  // At most 5 hits per document so one long file does not drown the rest.
  const per = new Map<string, number>();
  return hits.filter((h) => {
    const n = per.get(h.docId) ?? 0;
    per.set(h.docId, n + 1);
    return n < 5;
  }).slice(0, limit);
}
