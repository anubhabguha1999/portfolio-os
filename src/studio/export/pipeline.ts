/**
 * FlowDoc → files. One pipeline for every studio:
 *   collect image keys → render rasters (main thread, canvas) → worker (layout + PDF,
 *   DOCX, ZIP) with a main-thread fallback → Blob.
 */
import { zipSync } from 'fflate';
import type { FlowDoc, FlowNode } from '@/studio/engine/flow';
import { layoutFlow } from '@/studio/engine/layout';
import { laidPdfBytes, type RasterMap } from '@/studio/engine/render-pdf';
import { renderFlowDocx } from '@/studio/engine/render-docx';
import { renderFlowText } from '@/studio/engine/render-text';
import { rastersForKeys } from '@/studio/images/service';
import type { RasterImage } from '@/lib/export/assets';
import { blobToBytes } from '@/lib/export/assets';
import type { StudioJob, StudioWorkerMessage } from '@/workers/studio.protocol';

export const MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain;charset=utf-8',
  json: 'application/json',
  zip: 'application/zip',
  html: 'text/html;charset=utf-8',
} as const;

export type Progress = (stage: string, progress: number) => void;

export interface PdfExportSettings {
  quality: 'standard' | 'high';
  links: boolean;
  metadata: boolean;
  includeImages: boolean;
}

export const DEFAULT_PDF_SETTINGS: PdfExportSettings = { quality: 'high', links: true, metadata: true, includeImages: true };

/* ------------------------------ worker ------------------------------ */

class WorkerUnavailable extends Error {}

let worker: Worker | null = null;
let broken = false;
let seq = 1;
const pending = new Map<number, { resolve: (m: StudioWorkerMessage) => void; reject: (e: Error) => void; progress?: Progress }>();

function getWorker(): Worker | null {
  if (broken || typeof Worker === 'undefined') return null;
  if (worker) return worker;
  try {
    const w = new Worker(new URL('../../workers/studio.worker.ts', import.meta.url), { type: 'module', name: 'studio-export' });
    w.onmessage = (e: MessageEvent<StudioWorkerMessage>) => {
      const msg = e.data;
      const p = pending.get(msg.id);
      if (!p) return;
      if (msg.type === 'progress') return p.progress?.(msg.stage, msg.progress);
      pending.delete(msg.id);
      if (msg.type === 'error') p.reject(new Error(msg.message));
      else p.resolve(msg);
    };
    w.onerror = (e) => {
      e.preventDefault();
      broken = true;
      w.terminate();
      worker = null;
      for (const [, p] of pending) p.reject(new WorkerUnavailable(e.message || 'worker crashed'));
      pending.clear();
    };
    worker = w;
    return w;
  } catch {
    broken = true;
    return null;
  }
}

type JobInput = StudioJob extends infer J ? (J extends { id: number } ? Omit<J, 'id'> : never) : never;

function runInWorker(job: JobInput, progress?: Progress): Promise<StudioWorkerMessage> {
  const w = getWorker();
  if (!w) return Promise.reject(new WorkerUnavailable());
  const id = seq++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, ...(progress ? { progress } : {}) });
    try {
      // Images are copied (not transferred) so a fallback can reuse them.
      w.postMessage({ ...job, id } as StudioJob);
    } catch (err) {
      pending.delete(id);
      reject(new WorkerUnavailable(err instanceof Error ? err.message : 'postMessage failed'));
    }
  });
}

const yieldUi = () => new Promise((r) => setTimeout(r, 0));

/* ------------------------------ images ------------------------------ */

export function flowImageKeys(flow: FlowDoc): string[] {
  const keys = new Set<string>();
  const walk = (nodes: FlowNode[] | undefined) => {
    for (const n of nodes ?? []) {
      if (n.t === 'image' && n.src) keys.add(n.src);
      else if (n.t === 'box' || n.t === 'group') walk(n.nodes);
      else if (n.t === 'section') {
        walk(n.title);
        walk(n.nodes);
      } else if (n.t === 'row') n.cols.forEach((c) => walk(c.nodes));
    }
  };
  walk(flow.masthead);
  flow.columns.forEach((c) => walk(c.nodes));
  return [...keys];
}

async function downscale(r: RasterImage, maxEdge: number): Promise<RasterImage> {
  if (Math.max(r.width, r.height) <= maxEdge || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap !== 'function') return r;
  try {
    const bmp = await createImageBitmap(new Blob([r.data.slice().buffer], { type: r.format === 'png' ? 'image/png' : 'image/jpeg' }));
    const s = maxEdge / Math.max(r.width, r.height);
    const w = Math.round(r.width * s);
    const h = Math.round(r.height * s);
    const c = new OffscreenCanvas(w, h);
    const ctx = c.getContext('2d');
    if (!ctx) return r;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob = await c.convertToBlob({ type: r.format === 'png' ? 'image/png' : 'image/jpeg', quality: 0.82 });
    return { format: r.format, data: await blobToBytes(blob), width: w, height: h };
  } catch {
    return r;
  }
}

export async function resolveFlowImages(flow: FlowDoc, settings: Pick<PdfExportSettings, 'quality' | 'includeImages'>): Promise<{ images: RasterMap; warnings: string[] }> {
  if (!settings.includeImages) return { images: {}, warnings: [] };
  const keys = flowImageKeys(flow);
  const { images, missing } = await rastersForKeys(keys);
  if (settings.quality === 'standard') for (const k of Object.keys(images)) images[k] = await downscale(images[k]!, 900);
  return { images, warnings: missing.length ? [`${missing.length} image${missing.length === 1 ? '' : 's'} could not be rendered and ${missing.length === 1 ? 'was' : 'were'} left out.`] : [] };
}

/** Remove image nodes (used when "Include profile image" is off). */
export function withoutImages(flow: FlowDoc): FlowDoc {
  const strip = (nodes: FlowNode[] | undefined): FlowNode[] =>
    (nodes ?? [])
      .filter((n) => n.t !== 'image')
      .map((n) => {
        if (n.t === 'box' || n.t === 'group') return { ...n, nodes: strip(n.nodes) };
        if (n.t === 'section') return { ...n, title: strip(n.title), nodes: strip(n.nodes) };
        if (n.t === 'row') return { ...n, cols: n.cols.map((c) => ({ ...c, nodes: strip(c.nodes) })) };
        return n;
      });
  return { ...flow, ...(flow.masthead ? { masthead: strip(flow.masthead) } : {}), columns: flow.columns.map((c) => ({ ...c, nodes: strip(c.nodes) })) };
}

/* ------------------------------ formats ----------------------------- */

export interface FileResult {
  blob: Blob;
  warnings: string[];
  pages?: number;
}

export async function flowToPdf(flow: FlowDoc, settings: PdfExportSettings = DEFAULT_PDF_SETTINGS, progress?: Progress): Promise<FileResult> {
  const input = settings.includeImages ? flow : withoutImages(flow);
  const { data, ...rest } = input;
  // "Document metadata" off: no title/author and no embedded content copy either.
  const f: FlowDoc = { ...rest, links: settings.links, meta: settings.metadata ? input.meta : { title: '', author: '', subject: '', keywords: [], creator: input.meta.creator }, ...(settings.metadata && data ? { data } : {}) };
  progress?.('Rendering images…', 0.15);
  const { images, warnings } = await resolveFlowImages(f, settings);
  progress?.('Laying out pages…', 0.4);
  const options = { links: settings.links, metadata: settings.metadata, compress: true };
  try {
    const msg = await runInWorker({ kind: 'pdf', flow: f, images, options }, progress);
    if (msg.type !== 'pdf') throw new WorkerUnavailable();
    return { blob: new Blob([msg.buffer], { type: MIME.pdf }), warnings, pages: msg.pages };
  } catch (err) {
    if (!(err instanceof WorkerUnavailable)) throw err;
    await yieldUi();
    const laid = layoutFlow(f);
    const buffer = laidPdfBytes(laid, images, options);
    return { blob: new Blob([buffer], { type: MIME.pdf }), warnings, pages: laid.pages.length };
  }
}

export async function flowToDocx(flow: FlowDoc, settings: Pick<PdfExportSettings, 'includeImages' | 'quality'> & Partial<Pick<PdfExportSettings, 'links' | 'metadata'>> = { includeImages: true, quality: 'high' }, progress?: Progress): Promise<FileResult> {
  // Same "Clickable links" and "Document metadata" switches as the PDF.
  const f: FlowDoc = { ...flow, links: settings.links ?? true, meta: settings.metadata === false ? { title: '', author: '', subject: '', keywords: [], creator: flow.meta.creator } : flow.meta };
  progress?.('Rendering images…', 0.15);
  const { images, warnings } = await resolveFlowImages(f, settings);
  try {
    const msg = await runInWorker({ kind: 'docx', flow: f, images, includeImages: settings.includeImages }, progress);
    if (msg.type !== 'docx') throw new WorkerUnavailable();
    return { blob: new Blob([msg.buffer], { type: MIME.docx }), warnings };
  } catch (err) {
    if (!(err instanceof WorkerUnavailable)) throw err;
    await yieldUi();
    const buffer = await renderFlowDocx(f, { images, includeImages: settings.includeImages });
    return { blob: new Blob([buffer], { type: MIME.docx }), warnings };
  }
}

export function flowToText(flow: FlowDoc): FileResult {
  return { blob: new Blob([renderFlowText(flow)], { type: MIME.txt }), warnings: [] };
}

export function jsonFile(value: unknown): FileResult {
  return { blob: new Blob([JSON.stringify(value, null, 2)], { type: MIME.json }), warnings: [] };
}

export async function zipFiles(files: Array<{ path: string; blob: Blob }>, progress?: Progress): Promise<Blob> {
  const entries = await Promise.all(files.map(async (f) => ({ path: f.path, bytes: await blobToBytes(f.blob) })));
  try {
    const msg = await runInWorker({ kind: 'zip', files: entries }, progress);
    if (msg.type !== 'zip') throw new WorkerUnavailable();
    return new Blob([msg.buffer], { type: MIME.zip });
  } catch (err) {
    if (!(err instanceof WorkerUnavailable)) throw err;
    const map: Record<string, Uint8Array> = {};
    for (const e of entries) map[e.path] = e.bytes;
    const out = zipSync(map, { level: 6 });
    return new Blob([out.slice().buffer], { type: MIME.zip });
  }
}

/* ----------------------------- filenames ---------------------------- */

/** Safe on Windows, macOS and Linux: no reserved characters, no trailing dots, bounded length. */
export function sanitizeFileName(name: string, fallback = 'document'): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f<>:"/\\|?*\u007f]+/g, ' ')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 120);
  const reserved = /^(con|prn|aux|nul|com\d|lpt\d)$/i;
  return !cleaned || reserved.test(cleaned) ? fallback : cleaned;
}

export type DocLabel = 'Resume' | 'CV' | 'Cover_Letter' | 'Portfolio' | 'Application_Pack' | string;

/** "Alex Morgan" + "Resume" + "pdf" → "Alex_Morgan_Resume.pdf" (custom base names win). */
export function documentFileName(personName: string, label: DocLabel, ext: string, custom?: string): string {
  const base = custom?.trim() ? sanitizeFileName(custom.replace(/\.[a-z0-9]{2,5}$/i, '')) : sanitizeFileName([personName.trim() || 'My', label].join(' '));
  return `${base}.${ext}`;
}
