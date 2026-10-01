/**
 * LocalDocumentService: import → parse → (OCR) → analyse → store, entirely in this browser.
 *
 *   PDF   ─ PDF.js (own worker), page by page, pages released after reading
 *   scan  ─ Tesseract.js (own worker) on rendered pages, cancellable
 *   text  ─ .txt / .md / .json read directly
 *   then  ─ layout + semantic analysis in the knowledge worker → a stored extraction version
 */
import { parseResumeJson, ResumeJsonError } from '@/studio/import/resume-json';
import type { AnalyseOutput } from '../analysis/pipeline';
import { textToRawPages } from '../analysis/pipeline';
import { OcrCancelled, OcrSession, OCR_SCALE } from '../ocr/ocr';
import { closePdf, looksScanned, openPdf, PdfOpenError, PdfPasswordError, readMetadata, readPage, renderPage } from '../pdf/pdf';
import { createDoc, currentExtraction, findByHash, getDoc, getOriginal, listDocs, patchDoc, saveExtraction } from '../storage/repo';
import { DEFAULT_EXTRACTION_OPTIONS, type DocumentType, type Extraction, type ExtractionOptions, type KnowledgeDoc, type PdfMetadata, type RawPage, type SemanticData, type SemanticResume } from '../types';
import { analyseInWorker, indexInWorker, searchInWorker } from './worker-client';
import { exportJson, exportText } from '../export/formats';

export { PdfPasswordError, PdfOpenError, OcrCancelled };

export interface Progress {
  stage: string;
  page?: number;
  total?: number;
  /** 0–1 overall */
  value: number;
}

export interface RunControl {
  onProgress?: (p: Progress) => void;
  signal?: AbortSignal;
}

export class ExtractionCancelled extends Error {
  constructor() {
    super('Extraction was cancelled.');
  }
}

const check = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new ExtractionCancelled();
};

/* -------------------------------- import ----------------------------- */

export type ImportOutcome =
  | { status: 'created'; doc: KnowledgeDoc }
  /** Exactly the same bytes are already in the library. */
  | { status: 'duplicate'; existing: KnowledgeDoc }
  /** A file with the same name but different content: newer version? Caller asks the user. */
  | { status: 'new-version'; existing: KnowledgeDoc; file: File; bytes: ArrayBuffer };

export const MAX_FILE_BYTES = 200 * 1024 * 1024;

export async function importFile(file: File, opts: { force?: boolean; previousOf?: string | null } = {}): Promise<ImportOutcome> {
  if (file.size > MAX_FILE_BYTES) throw new Error(`“${file.name}” is larger than 200 MB.`);
  const bytes = await file.arrayBuffer();
  if (!opts.force) {
    const { sha256 } = await import('../storage/repo');
    const same = await findByHash(await sha256(bytes));
    if (same[0]) return { status: 'duplicate', existing: same[0] };
    const byName = (await listDocs()).find((d) => d.name.toLowerCase() === file.name.toLowerCase());
    if (byName) return { status: 'new-version', existing: byName, file, bytes };
  }
  const doc = await createDoc(file, bytes, opts.previousOf ? { previousOf: opts.previousOf, folder: (await getDoc(opts.previousOf))?.folder ?? 'Documents' } : {});
  return { status: 'created', doc };
}

/* ------------------------------ PDF reading -------------------------- */

export interface PdfRead {
  raw: RawPage[];
  metadata: PdfMetadata;
  /** Selected pages that look like scans (no real text). */
  scanned: number[];
}

/** Read the selected pages of a PDF. Throws PdfPasswordError when a password is needed. */
export async function readPdf(bytes: ArrayBuffer, options: ExtractionOptions, ctl: RunControl = {}): Promise<PdfRead> {
  ctl.onProgress?.({ stage: 'Opening PDF…', value: 0.02 });
  const pdf = await openPdf(bytes, options.password);
  try {
    const metadata = await readMetadata(pdf);
    const pages = (options.pages?.length ? options.pages : Array.from({ length: pdf.numPages }, (_, i) => i + 1)).filter((n) => n >= 1 && n <= pdf.numPages);
    const raw: RawPage[] = [];
    for (let i = 0; i < pages.length; i++) {
      check(ctl.signal);
      const n = pages[i]!;
      ctl.onProgress?.({ stage: 'Extracting text', page: i + 1, total: pages.length, value: 0.05 + 0.75 * (i / pages.length) });
      raw.push(await readPage(pdf, n, { images: options.images, links: options.links }));
    }
    return { raw, metadata, scanned: raw.filter(looksScanned).map((p) => p.page) };
  } finally {
    closePdf(pdf);
  }
}

/** OCR the given pages (rendered locally) and return them as raw pages with word confidences. */
export async function ocrPages(bytes: ArrayBuffer, pageNumbers: number[], password: string | undefined, ctl: RunControl & { session?: OcrSession } = {}): Promise<RawPage[]> {
  const session = ctl.session ?? new OcrSession();
  const abort = () => void session.stop();
  ctl.signal?.addEventListener('abort', abort);
  let current = 0;
  try {
    ctl.onProgress?.({ stage: 'Loading OCR engine…', value: 0.02 });
    await session.start((p) => {
      if (p.status === 'recognizing text') ctl.onProgress?.({ stage: 'OCR processing', page: current + 1, total: pageNumbers.length, value: (current + p.progress) / pageNumbers.length });
    });
    const pdf = await openPdf(bytes, password);
    const out: RawPage[] = [];
    try {
      for (current = 0; current < pageNumbers.length; current++) {
        check(ctl.signal);
        const n = pageNumbers[current]!;
        ctl.onProgress?.({ stage: 'OCR processing', page: current + 1, total: pageNumbers.length, value: current / pageNumbers.length });
        const page = await pdf.getPage(n);
        const vp = page.getViewport({ scale: 1 });
        page.cleanup();
        const canvas = await renderPage(pdf, n, OCR_SCALE, undefined, { background: true });
        out.push(await session.recognize(canvas, n, vp.width, vp.height));
        canvas.width = canvas.height = 0;
      }
    } finally {
      closePdf(pdf);
    }
    return out;
  } catch (err) {
    if (err instanceof OcrCancelled || ctl.signal?.aborted) throw new ExtractionCancelled();
    throw err;
  } finally {
    ctl.signal?.removeEventListener('abort', abort);
    await session.stop();
  }
}

/* ---------------------------- JSON documents ------------------------- */

const f = (value: string, confidence = 1) => ({ value, confidence: value ? confidence : 0, source: null });

/** A JSON Resume / Portfolio OS export is already structured: map it with full confidence. */
function semanticFromJson(text: string): SemanticResume | null {
  try {
    const i = parseResumeJson(text);
    const p = i.profile;
    const link = (re: RegExp) => p.socialLinks.find((s) => re.test(s.url))?.url ?? '';
    return {
      profile: { name: f(p.name), headline: f(p.headline), email: f(p.email), phone: f(p.phone ?? ''), location: f(p.location ?? ''), website: f(p.website ?? ''), github: f(link(/github\.com/i)), linkedin: f(link(/linkedin\.com/i)), summary: f(p.bio) },
      socialLinks: p.socialLinks.map((s) => ({ platform: s.platform, url: s.url, source: null })),
      experience: i.library.experience.map((e) => ({ company: f(e.company), role: f(e.role), location: f(e.location), startDate: { value: e.start || null, confidence: e.start ? 1 : 0, source: null }, endDate: { value: e.current ? null : e.end || null, confidence: 1, source: null }, current: e.current, description: f(e.description), achievements: e.achievements, technologies: e.technologies })),
      education: i.library.education.map((e) => ({ institution: f(e.institution), degree: f(e.degree), field: e.field, startDate: e.start || null, endDate: e.end || null, grade: e.grade })),
      projects: i.library.projects.map((x) => ({ title: f(x.title), description: f(x.description), technologies: x.technologies, url: x.live || x.github, features: x.features })),
      skills: i.library.skills.map((s) => ({ name: s.name, original: s.name, category: s.category, confidence: 1, source: null })),
      certifications: i.library.certifications.map((c) => ({ name: f(c.name), issuer: c.issuer, date: c.date, url: c.url })),
      achievements: i.library.achievements.map((a) => ({ title: a.title, description: a.description, date: a.date })),
      languages: (i.entries.languages ?? []).map((l) => ({ language: l.title ?? '', fluency: l.subtitle ?? '' })),
    };
  } catch (err) {
    if (err instanceof ResumeJsonError) return null;
    throw err;
  }
}

/* -------------------------------- process ---------------------------- */

export interface ProcessResult {
  extraction: Extraction;
  /** Pages that look scanned and were not OCR'd (offer "Run OCR"). */
  scanned: number[];
}

/** Extract (or re-extract) a stored document with the given options. */
export async function processDoc(docId: string, options: ExtractionOptions = DEFAULT_EXTRACTION_OPTIONS, ctl: RunControl & { label?: string; forcedType?: DocumentType; ocrOnly?: number[] } = {}): Promise<ProcessResult> {
  const doc = await getDoc(docId);
  if (!doc) throw new Error('Document not found.');
  const blob = await getOriginal(docId);
  if (!blob) throw new Error('The original file was deleted, so it cannot be extracted again. The saved extraction is still available.');
  await patchDoc(docId, { status: 'processing', error: null });
  try {
    const bytes = await blob.arrayBuffer();
    let raw: RawPage[];
    let metadata: PdfMetadata | null = null;
    let scanned: number[] = [];
    let jsonSemantic: SemanticResume | null = null;
    const warnings: string[] = [];

    if (doc.kind === 'pdf') {
      const read = await readPdf(bytes, options, ctl);
      raw = read.raw;
      metadata = read.metadata;
      scanned = read.scanned;
      // OCR: 'always' → every selected page (or ctl.ocrOnly); 'auto' → only when the whole selection is scanned.
      // A partly scanned document is extracted as-is and the scanned pages are offered for OCR.
      const targets = options.ocr === 'always' ? (ctl.ocrOnly?.length ? ctl.ocrOnly : raw.map((p) => p.page)) : options.ocr === 'auto' && scanned.length && scanned.length === raw.length ? scanned : [];
      if (targets.length) {
        const ocred = await ocrPages(bytes, targets, options.password, {
          ...ctl,
          onProgress: (p) => ctl.onProgress?.({ ...p, value: 0.5 + 0.4 * p.value }),
        });
        const byPage = new Map(ocred.map((p) => [p.page, p]));
        raw = raw.map((p) => {
          const o = byPage.get(p.page);
          return o ? { ...o, links: p.links, images: p.images } : p;
        });
        scanned = scanned.filter((n) => !byPage.has(n));
      }
    } else {
      const text = new TextDecoder().decode(bytes);
      if (doc.kind === 'json') {
        jsonSemantic = semanticFromJson(text);
        let pretty = text;
        try {
          pretty = JSON.stringify(JSON.parse(text), null, 2);
        } catch {
          warnings.push('This file is not valid JSON; it was read as plain text.');
        }
        raw = textToRawPages(pretty, 'txt');
      } else raw = textToRawPages(text, doc.kind);
    }

    check(ctl.signal);
    ctl.onProgress?.({ stage: 'Detecting structure…', value: 0.92 });
    const forced = ctl.forcedType ?? (doc.docTypeLocked ? doc.docType : undefined);
    let out: AnalyseOutput = await analyseInWorker({ docId, docName: doc.name, raw, metadata, options, ...(forced ? { forcedType: forced } : {}), warnings });
    if (jsonSemantic) {
      const semantic: SemanticData = { docType: forced ?? 'resume', docTypeConfidence: 1, resume: jsonSemantic };
      out = { ...out, semantic };
    }
    if (scanned.length) out = { ...out, warnings: [...out.warnings, `${scanned.length === 1 ? 'Page' : 'Pages'} ${scanned.join(', ')} appear${scanned.length === 1 ? 's' : ''} to contain scanned images. Run OCR to read them.`] };

    const label = ctl.label ?? (raw.some((p) => p.ocr) ? 'Extraction with OCR' : 'Extraction');
    lastRaw.set(docId, raw);
    const extraction = await saveExtraction(docId, out, label);
    const resumeLike = !!out.semantic.resume;
    await patchDoc(docId, {
      status: scanned.length && scanned.length === raw.length ? 'needs-ocr' : resumeLike ? 'needs-review' : 'completed',
      docType: forced ?? out.semantic.docType,
      pageCount: metadata?.pageCount ?? raw.length,
      error: null,
    });
    ctl.onProgress?.({ stage: 'Done', value: 1 });
    void refreshIndex();
    return { extraction, scanned };
  } catch (err) {
    if (err instanceof ExtractionCancelled) await patchDoc(docId, { status: doc.currentVersion ? doc.status : 'new' });
    else if (!(err instanceof PdfPasswordError)) await patchDoc(docId, { status: 'failed', error: err instanceof Error ? err.message : String(err) });
    else await patchDoc(docId, { status: 'new' });
    throw err;
  }
}

/** Raw parser output of the most recent run per document (kept in memory for the Raw JSON export). */
const lastRaw = new Map<string, RawPage[]>();

/** Raw level: positioned text runs, fonts, link rectangles and image boxes exactly as parsed. */
export async function exportDocRawJson(docId: string, options: ExtractionOptions = DEFAULT_EXTRACTION_OPTIONS, password?: string): Promise<Blob> {
  const doc = await getDoc(docId);
  if (!doc) throw new Error('Document not found.');
  let raw = lastRaw.get(docId);
  let metadata: PdfMetadata | null = null;
  if (!raw) {
    const blob = await getOriginal(docId);
    if (!blob) throw new Error('The original file was deleted, so raw parser data is no longer available. Structured and semantic JSON still are.');
    const bytes = await blob.arrayBuffer();
    if (doc.kind === 'pdf') {
      const read = await readPdf(bytes, { ...options, ...(password ? { password } : {}) });
      raw = read.raw;
      metadata = read.metadata;
    } else raw = textToRawPages(new TextDecoder().decode(bytes), doc.kind === 'md' ? 'md' : 'txt');
  }
  const ext = await currentExtraction(doc);
  const body = { format: 'portfolio-os-pdf-raw', version: 1, document: { name: doc.name, kind: doc.kind, size: doc.size, sha256: doc.hash, pages: raw.length }, metadata: metadata ?? ext?.metadata ?? null, pages: raw };
  return new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' });
}

/** OCR specific pages of an already-extracted PDF and store the merged result as a new version. */
export async function runOcr(docId: string, pages: number[], options: ExtractionOptions, ctl: RunControl = {}): Promise<Extraction> {
  return (await processDoc(docId, { ...options, ocr: 'always' }, { ...ctl, label: 'OCR', ocrOnly: pages })).extraction;
}

/** Keep user corrections as a new version on top of the current one (the original file is never modified). */
export async function saveCorrections(docId: string, edited: Extraction, label = 'User corrections'): Promise<Extraction> {
  const { id: _id, docId: _d, version: _v, label: _l, origin: _o, createdAt: _c, ...rest } = edited;
  return saveExtraction(docId, rest, label, 'corrections');
}

/* -------------------------------- search ----------------------------- */

let indexing: Promise<void> | null = null;

export function refreshIndex(): Promise<void> {
  indexing = (async () => {
    const docs = await listDocs();
    const pairs = await Promise.all(docs.map(async (doc) => ({ doc, extraction: await currentExtraction(doc) })));
    await indexInWorker(pairs);
  })();
  return indexing;
}

export async function search(query: string, limit = 50) {
  if (!indexing) void refreshIndex();
  await indexing;
  return searchInWorker(query, limit);
}

/* -------------------------------- exports ---------------------------- */

export async function exportDocText(docId: string, opts: { pageBreaks: boolean } = { pageBreaks: true }): Promise<Blob> {
  const doc = await getDoc(docId);
  const ext = doc && (await currentExtraction(doc));
  if (!doc || !ext) throw new Error('Extract the document first.');
  return new Blob([exportText(ext, opts)], { type: 'text/plain;charset=utf-8' });
}

export async function exportDocJson(docId: string, level: 'structured' | 'semantic' = 'structured'): Promise<Blob> {
  const doc = await getDoc(docId);
  const ext = doc && (await currentExtraction(doc));
  if (!doc || !ext) throw new Error('Extract the document first.');
  return new Blob([JSON.stringify(exportJson(doc, ext, level), null, 2)], { type: 'application/json' });
}
