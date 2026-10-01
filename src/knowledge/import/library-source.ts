/**
 * Local Knowledge as a content source for every editor ("Insert from Library", drag into builder).
 *
 *   Shared library (approved) ─┐
 *   Resume.pdf (extracted)  ───┼─→ candidates ─→ adoptCandidates() ─→ library ids ─→ resume / document / portfolio
 *   CV.pdf (extracted)      ───┘
 *
 *  - Candidates from a document are the same detections the review panel shows, with duplicate
 *    detection against the library: inserting one that already exists reuses that item instead
 *    of creating a copy.
 *  - Adopting a document candidate adds it to the shared library (single source of truth) and
 *    records provenance, so editors can show "Source: Resume.pdf — Page 1" and "Modified locally".
 */
import type { Library, LibraryKind, Profile } from '@/studio/model/types';
import { uid } from '@/utils/id';
import { currentExtraction, listDocs, provenanceKey } from '../storage/repo';
import type { ExtractedBlock, Provenance, ProvenanceRecord } from '../types';
import { buildReview } from './review';

export const LIBRARY_KINDS: LibraryKind[] = ['experience', 'projects', 'education', 'skills', 'certifications', 'achievements'];

export const KIND_LABELS: Record<LibraryKind, string> = {
  experience: 'Experience',
  projects: 'Projects',
  education: 'Education',
  skills: 'Skills',
  certifications: 'Certifications',
  achievements: 'Achievements',
};

export interface Candidate {
  /** Stable within one load: `lib:<id>` or `<docId>:<n>`. */
  key: string;
  kind: LibraryKind;
  value: Record<string, unknown>;
  label: string;
  sublabel: string;
  /** 1 for approved library items. */
  confidence: number;
  source: Provenance | null;
  /** Library item this is (library source) or looks like (document source). */
  libraryId: string | null;
}

export interface TextCandidate {
  key: string;
  type: 'heading' | 'paragraph' | 'list' | 'table';
  text: string;
  items?: string[];
  rows?: string[][];
  page: number;
  source: Provenance;
}

export interface KnowledgeSource {
  id: string;
  /** 'library' = the approved shared library; 'doc' = one extracted document. */
  type: 'library' | 'doc';
  name: string;
  docType?: string;
  items: Candidate[];
  text: TextCandidate[];
}

export function describe(kind: LibraryKind, v: Record<string, unknown>): { label: string; sublabel: string } {
  const s = (k: string) => String(v[k] ?? '').trim();
  switch (kind) {
    case 'experience':
      return { label: s('role') || 'Role', sublabel: [s('company'), [s('start'), v.current ? 'Present' : s('end')].filter(Boolean).join(' – ')].filter(Boolean).join(' · ') };
    case 'projects':
      return { label: s('title') || 'Project', sublabel: ((v.technologies as string[] | undefined) ?? []).slice(0, 5).join(' · ') };
    case 'education':
      return { label: [s('degree'), s('field')].filter(Boolean).join(', ') || 'Education', sublabel: s('institution') };
    case 'skills':
      return { label: s('name'), sublabel: s('category') };
    case 'certifications':
      return { label: s('name'), sublabel: s('issuer') };
    case 'achievements':
      return { label: s('title'), sublabel: s('date') };
  }
}

const textOf = (b: ExtractedBlock): TextCandidate['type'] | null => {
  if (b.type === 'title' || b.type === 'heading' || b.type === 'subheading') return 'heading';
  if (b.type === 'paragraph' || b.type === 'list' || b.type === 'table') return b.type;
  return null;
};

/** The approved library plus every extracted document, restricted to the given kinds. */
export async function loadKnowledgeSources(kinds: LibraryKind[], profile: Profile, library: Library, opts: { text?: boolean } = {}): Promise<KnowledgeSource[]> {
  const out: KnowledgeSource[] = [];
  const libItems: Candidate[] = [];
  for (const kind of kinds) {
    for (const it of library[kind] as unknown as Array<Record<string, unknown> & { id: string }>) {
      libItems.push({ key: `lib:${it.id}`, kind, value: it, ...describe(kind, it), confidence: 1, source: null, libraryId: it.id });
    }
  }
  out.push({ id: 'library', type: 'library', name: 'Shared library', items: libItems, text: [] });

  const docs = (await listDocs().catch(() => [])).filter((d) => d.currentVersion && d.status !== 'processing');
  for (const doc of docs) {
    const ex = await currentExtraction(doc).catch(() => null);
    if (!ex) continue;
    const items: Candidate[] = [];
    if (ex.semantic.resume) {
      const review = buildReview(ex.semantic.resume, doc.id, doc.name, profile, library);
      review.items
        .filter((it) => kinds.includes(it.kind))
        .forEach((it, n) => {
          const { original: _o, ...value } = it.value as unknown as Record<string, unknown> & { original?: string };
          items.push({ key: `${doc.id}:${n}`, kind: it.kind, value, ...describe(it.kind, value), confidence: it.confidence, source: it.source ?? { docId: doc.id, docName: doc.name, page: 1, blockId: null }, libraryId: it.duplicateOf });
        });
    }
    const text: TextCandidate[] = [];
    if (opts.text) {
      for (const page of ex.pages) {
        for (const b of page.blocks) {
          const type = textOf(b);
          if (!type || !b.text.trim()) continue;
          text.push({ key: `${doc.id}:${b.id}`, type, text: b.text.trim(), items: b.items, rows: b.rows, page: b.page, source: { docId: doc.id, docName: doc.name, page: b.page, blockId: b.id } });
        }
      }
    }
    if (items.length || text.length) out.push({ id: doc.id, type: 'doc', name: doc.name, docType: doc.docType, items, text });
  }
  return out;
}

export interface Adopted {
  library: Library;
  /** Library id per picked candidate, in pick order. */
  picks: Array<{ kind: LibraryKind; id: string }>;
  provenance: ProvenanceRecord[];
  added: number;
}

const blank = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/**
 * Make the picked candidates library items. Library items and detected duplicates are reused
 * as they are (the library value wins: it may hold the user's edits). New detections are added.
 */
export function adoptCandidates(library: Library, picked: Candidate[]): Adopted {
  const next: Library = { ...library };
  const picks: Adopted['picks'] = [];
  const provenance: ProvenanceRecord[] = [];
  const at = new Date().toISOString();
  let added = 0;
  for (const c of picked) {
    const list = next[c.kind] as unknown as Array<{ id: string }>;
    if (c.libraryId && list.some((x) => x.id === c.libraryId)) {
      picks.push({ kind: c.kind, id: c.libraryId });
      continue;
    }
    const id = uid(c.kind.slice(0, 3));
    (next as unknown as Record<LibraryKind, unknown[]>)[c.kind] = [...list, { ...c.value, id }];
    picks.push({ kind: c.kind, id });
    added++;
    if (!c.source) continue;
    for (const [field, v] of Object.entries(c.value)) {
      if (field === 'id' || blank(v)) continue;
      provenance.push({ key: provenanceKey(c.kind, id, field), kind: c.kind, itemId: id, field, original: v, source: c.source, importedAt: at });
    }
  }
  return { library: next, picks, provenance, added };
}

/** Drag payload from a Knowledge panel (builder canvas, document outline). */
export const KNOWLEDGE_MIME = 'application/x-portfolio-knowledge';
