/**
 * Any resume file → the same import a .json gives, read entirely in the browser.
 *
 *   .json              → parseResumeJson (JSON Resume, Portfolio OS, Extract Your Data exports)
 *   .pdf               → PDF.js text + layout → resume rules
 *   .docx              → document.xml paragraphs → resume rules
 *   .txt / .md         → resume rules
 *
 * Scanned PDFs need OCR, which lives in Extract Your Data; this path only reads real text.
 */
import { unzipSync, strFromU8 } from 'fflate';
import { importFromSemanticResume, parseResumeJson, ResumeJsonError, type ResumeJsonImport } from '@/studio/import/resume-json';
import { embeddedFromXmp } from '@/studio/export/embedded';
import { DEFAULT_EXTRACTION_OPTIONS, type ExtractionOptions, type RawPage } from '../types';

export const RESUME_FILE_ACCEPT = '.json,.pdf,.docx,.txt,.md,.markdown,application/json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown';

const MAX_BYTES = 25 * 1024 * 1024;

/** Resume rules only: no tables, images or link annotations needed to fill a resume. */
const OPTIONS: ExtractionOptions = { ...DEFAULT_EXTRACTION_OPTIONS, semantic: 'resume', ocr: 'never', images: false };

export type ResumeFileKind = 'json' | 'pdf' | 'docx' | 'text';

export function resumeFileKind(file: { name: string; type: string }): ResumeFileKind | null {
  const n = file.name.toLowerCase();
  if (n.endsWith('.json') || file.type === 'application/json') return 'json';
  if (n.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  if (n.endsWith('.docx') || file.type.includes('wordprocessingml')) return 'docx';
  if (/\.(txt|md|markdown)$/.test(n) || file.type.startsWith('text/')) return 'text';
  return null;
}

/** Paragraph text of a .docx (tabs and line breaks kept); throws when the file is not a Word document. */
export function docxText(bytes: Uint8Array): string {
  let xml: string;
  try {
    const files = unzipSync(bytes, { filter: (f) => f.name === 'word/document.xml' });
    const doc = files['word/document.xml'];
    if (!doc) throw new Error('missing');
    xml = strFromU8(doc);
  } catch {
    throw new ResumeJsonError('This is not a readable Word (.docx) file. Older .doc files are not supported: save it as .docx or PDF.');
  }
  const decode = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const paras: Array<{ text: string; size: number }> = [];
  for (const p of xml.split(/<\/w:p>/)) {
    let line = '';
    for (const m of p.matchAll(/<w:(t)(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:(tab)\/>|<w:(br)\/>|<w:(numPr)>/g)) {
      if (m[1]) line += decode(m[2] ?? '');
      else if (m[3]) line += '\t';
      else if (m[4]) line += '\n';
      // List paragraphs: <w:numPr> comes before the runs, so the bullet leads the line.
      else if (m[5]) line = `• ${line}`;
    }
    // Largest run size in half-points (w:sz); 0 when the paragraph only uses the style default.
    const size = Math.max(0, ...[...p.matchAll(/<w:sz w:val="(\d+)"/g)].map((m) => Number(m[1])));
    paras.push({ text: line, size });
  }
  return promoteDocxName(paras)
    .map((p) => p.text)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const NAME_LIKE = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'.-]*(\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'.-]*){1,3}$/;

/**
 * Two-column Word resumes keep the sidebar (Contact, Skills…) before the main column, so the
 * name is not the first line. The name is the largest name-like text: move it, and a short
 * headline right under it, to the top — as the PDF reader does with positions.
 */
function promoteDocxName(paras: Array<{ text: string; size: number }>): Array<{ text: string; size: number }> {
  const sized = paras.filter((p) => p.text.trim() && p.size).map((p) => p.size).sort((a, b) => a - b);
  const median = sized[Math.floor(sized.length / 2)] ?? 0;
  let at = -1;
  paras.forEach((p, i) => {
    if (median && p.size >= median * 1.5 && NAME_LIKE.test(p.text.trim()) && (at < 0 || p.size > paras[at]!.size)) at = i;
  });
  if (at <= 0 || paras.slice(0, at).some((p) => p.text.trim() && NAME_LIKE.test(p.text.trim()) && p.size >= paras[at]!.size)) return paras;
  const moved = [paras[at]!];
  const next = paras.slice(at + 1).find((p) => p.text.trim());
  if (next && next.text.length <= 80 && !/@|\d{3}|https?:/.test(next.text) && next.size > median) moved.push(next);
  return [...moved, ...paras.filter((p) => !moved.includes(p))];
}

async function analyseRaw(raw: RawPage[], fileName: string) {
  const { analyse } = await import('../analysis/pipeline');
  return analyse({ docId: 'import', docName: fileName, raw, metadata: null, options: OPTIONS, forcedType: 'resume' });
}

async function fromText(text: string, fileName: string, kind: 'txt' | 'md'): Promise<ResumeJsonImport> {
  if (!text.trim()) throw new ResumeJsonError('This file has no text to read.');
  const { textToRawPages } = await import('../analysis/pipeline');
  const out = await analyseRaw(textToRawPages(text, kind), fileName);
  if (!out.semantic.resume) throw new ResumeJsonError('No resume content was recognised in this file.');
  return importFromSemanticResume(out.semantic.resume, fileName);
}

/** Read a resume file of any supported kind. Throws ResumeJsonError with a message for the user. */
export async function readResumeFile(file: File): Promise<ResumeJsonImport> {
  const kind = resumeFileKind(file);
  if (!kind) throw new ResumeJsonError(`“${file.name}” is not a supported resume file. Use PDF, Word (.docx), text, Markdown or JSON.`);
  if (file.size > MAX_BYTES) throw new ResumeJsonError('This file is larger than 25 MB.');
  if (kind === 'json') return parseResumeJson(await file.text());
  if (kind === 'text') return fromText(await file.text(), file.name, /\.(md|markdown)$/i.test(file.name) ? 'md' : 'txt');
  if (kind === 'docx') return fromText(docxText(new Uint8Array(await file.arrayBuffer())), file.name, 'txt');

  const { readPdf, PdfPasswordError } = await import('../engine/service');
  let read;
  try {
    read = await readPdf(await file.arrayBuffer(), OPTIONS);
  } catch (err) {
    if (err instanceof PdfPasswordError) throw new ResumeJsonError('This PDF is password-protected. Open it in Extract Your Data, which can unlock it on this device, or upload an unlocked copy.');
    throw new ResumeJsonError('This PDF could not be read. It may be damaged; try exporting it again.');
  }
  // Made with Portfolio OS: the PDF carries an exact copy of its content.
  const embedded = embeddedFromXmp(read.xmp);
  if (embedded) {
    try {
      const data = parseResumeJson(embedded);
      return { ...data, warnings: data.warnings.filter((w) => !/^No /.test(w)) };
    } catch {
      /* fall back to reading the layout */
    }
  }
  if (read.scanned.length === read.raw.length) throw new ResumeJsonError('This PDF is a scan with no selectable text. Open it in Extract Your Data to run OCR (text recognition) on this device, then import from there.');
  const out = await analyseRaw(read.raw, file.name);
  if (!out.semantic.resume) throw new ResumeJsonError('No resume content was recognised in this PDF.');
  const data = importFromSemanticResume(out.semantic.resume, file.name);
  if (read.scanned.length) data.warnings.push(`${read.scanned.length} scanned page${read.scanned.length === 1 ? ' was' : 's were'} skipped. Use Extract Your Data to OCR them.`);
  return data;
}
