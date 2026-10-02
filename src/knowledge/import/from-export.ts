/**
 * PDF Intelligence JSON exports → resume data, so a downloaded "structured" or "semantic" JSON
 * can be imported in Resume Studio / Profile like any resume JSON.
 *
 *  - semantic export: the detected resume is used as is.
 *  - structured export: the resume rules run again on its pages and blocks (all local).
 * Everything goes through the same review/apply rules as the Knowledge import, with every
 * detection accepted (the user reviews the result in the editor).
 */
import { emptyLibrary, emptyProfile } from '@/studio/model/defaults';
import type { Library, LocalEntry, Profile } from '@/studio/model/types';
import { extractResume } from '../analysis/semantic';
import type { BlockType, ExtractedBlock, ExtractedLine, ExtractedLink, ExtractedPage, SemanticResume } from '../types';
import { applyReview, buildReview } from './review';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown) => (typeof v === 'string' ? v : '');

export const KNOWLEDGE_EXPORT_FORMATS = ['portfolio-os-pdf-semantic', 'portfolio-os-pdf-structured'] as const;

export function isKnowledgeExport(data: unknown): boolean {
  return isObj(data) && (KNOWLEDGE_EXPORT_FORMATS as readonly string[]).includes(str(data.format));
}

const BLOCK_TYPES: BlockType[] = ['title', 'heading', 'subheading', 'paragraph', 'list', 'table', 'image', 'header', 'footer'];

/** Current exports keep each line with its size and box. */
function exportedLines(list: unknown[], boldDefault: boolean): ExtractedLine[] {
  return list.filter(isObj).map((l) => {
    const box = isObj(l.bbox) ? l.bbox : {};
    return { text: str(l.text), x: num(box.x), y: num(box.y), width: num(box.width), height: num(box.height, 10), fontSize: num(l.fontSize, 10), bold: l.bold === true || boldDefault };
  });
}

/**
 * Older exports kept only block text and box. Font size is estimated from width per character
 * (~0.5 em per glyph) so the name still stands out from body text; multi-line paragraphs get
 * a small size, which is what the reading-order rules need.
 */
function guessLines(text: string, x: number, y: number, width: number, height: number, bold: boolean): ExtractedLine[] {
  const rows = text.split('\n').filter((t) => t.trim());
  if (!rows.length) return [];
  const longest = Math.max(...rows.map((r) => r.length));
  const fontSize = Math.max(6, Math.min(height / rows.length / 1.15, width / Math.max(1, longest * 0.5)));
  const lh = height / rows.length;
  return rows.map((t, i) => ({ text: t, x, y: y + i * lh, width, height: lh, fontSize, bold }));
}

/** Rebuild pages from an exported structure. */
function pagesFromStructured(data: Obj): ExtractedPage[] {
  const pages = Array.isArray(data.pages) ? data.pages.filter(isObj) : [];
  return pages.map((p, pi) => {
    const page = num(p.page, pi + 1);
    const blocks: ExtractedBlock[] = (Array.isArray(p.blocks) ? p.blocks.filter(isObj) : []).map((b, bi) => {
      const box = isObj(b.bbox) ? b.bbox : {};
      const x = num(box.x);
      const y = num(box.y);
      const width = num(box.width, 400);
      const height = num(box.height, 12);
      const text = str(b.text);
      const type = (BLOCK_TYPES as string[]).includes(str(b.type)) ? (str(b.type) as BlockType) : 'paragraph';
      const bold = type === 'title' || type === 'heading' || type === 'subheading';
      const lines = Array.isArray(b.lines) && b.lines.length ? exportedLines(b.lines, bold) : guessLines(text, x, y, width, height, bold);
      return {
        id: str(b.id) || `b${page}-${bi}`,
        page,
        type,
        text,
        x,
        y,
        width,
        height,
        lines,
        ...(Array.isArray(b.items) ? { items: b.items.map(str) } : {}),
        ...(Array.isArray(b.rows) ? { rows: (b.rows as unknown[]).filter(Array.isArray).map((r) => (r as unknown[]).map(str)) } : {}),
        ...(b.level === 1 || b.level === 2 || b.level === 3 ? { level: b.level } : {}),
      };
    });
    return { page, width: num(p.width, 612), height: num(p.height, 792), ocr: p.ocr === true, blocks };
  });
}

function linksOf(data: Obj): ExtractedLink[] {
  return (Array.isArray(data.links) ? data.links.filter(isObj) : []).map((l) => ({ text: str(l.text), url: str(l.url), page: num(l.page, 1), origin: l.origin === 'annotation' ? 'annotation' : 'text' }));
}

export function resumeFromKnowledgeExport(data: Obj): { profile: Profile; library: Library; entries: Record<string, Array<Partial<LocalEntry>>> } | null {
  const doc = isObj(data.document) ? data.document : {};
  const name = str(doc.name) || 'Imported document';
  let resume: SemanticResume | null = null;
  if (data.format === 'portfolio-os-pdf-semantic') resume = isObj(data.resume) ? (data.resume as unknown as SemanticResume) : null;
  else {
    const pages = pagesFromStructured(data);
    if (pages.some((p) => p.blocks.length)) resume = extractResume(pages, linksOf(data), 'import', name);
  }
  if (!resume || !isObj(resume.profile)) return null;
  return resumeDataFromSemantic(resume, name);
}

/** Detected resume fields → profile, library and resume-only entries, every detection accepted. */
export function resumeDataFromSemantic(resume: SemanticResume, name: string): { profile: Profile; library: Library; entries: Record<string, Array<Partial<LocalEntry>>> } {
  // Older or hand-edited files may miss lists: default them so the review rules stay total.
  const r = { socialLinks: [], experience: [], education: [], projects: [], skills: [], certifications: [], achievements: [], languages: [], ...(resume as Partial<SemanticResume>) } as SemanticResume;
  const review = buildReview(r, 'import', name, emptyProfile(), emptyLibrary());
  for (const f of review.profile) f.decision = 'accept';
  for (const it of review.items) it.decision = 'accept';
  const res = applyReview(review, emptyProfile(), emptyLibrary());
  return { profile: res.profile, library: res.library, entries: res.entries };
}
