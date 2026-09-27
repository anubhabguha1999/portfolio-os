/**
 * Runs PDF/DOCX generation in the export Web Worker, falling back to the main thread
 * when workers are unavailable or the worker fails to start.
 */
import type { DocModel } from '@/types/document';
import type { ImageMap, PdfRenderOptions, PdfRenderResult } from '@/lib/pdf/types';
import type { DocxRenderOptions } from '@/lib/docx/render';
import type { ExportJob, ExportWorkerMessage } from '@/workers/export.protocol';

/** The worker itself is unusable (not a rendering error) — callers fall back. */
export class WorkerUnavailableError extends Error {
  constructor(message = 'Export worker unavailable') {
    super(message);
    this.name = 'WorkerUnavailableError';
  }
}

type Stage = (stage: string, progress: number) => void;

interface Pending {
  resolve: (msg: ExportWorkerMessage) => void;
  reject: (err: Error) => void;
  onProgress?: Stage;
}

let worker: Worker | null = null;
let workerBroken = false;
let nextId = 1;
const pending = new Map<number, Pending>();

function failAll(reason: string): void {
  workerBroken = true;
  worker?.terminate();
  worker = null;
  for (const [, p] of pending) p.reject(new WorkerUnavailableError(reason));
  pending.clear();
}

function getWorker(): Worker | null {
  if (workerBroken || typeof Worker === 'undefined') return null;
  if (worker) return worker;
  try {
    const w = new Worker(new URL('../../workers/export.worker.ts', import.meta.url), { type: 'module', name: 'portfolio-export' });
    w.onmessage = (e: MessageEvent<ExportWorkerMessage>) => {
      const msg = e.data;
      const p = pending.get(msg.id);
      if (!p) return;
      if (msg.type === 'progress') {
        p.onProgress?.(msg.stage, msg.progress);
        return;
      }
      pending.delete(msg.id);
      if (msg.type === 'error') p.reject(new Error(msg.message));
      else p.resolve(msg);
    };
    w.onerror = (e) => {
      e.preventDefault();
      failAll(e.message || 'Export worker crashed');
    };
    w.onmessageerror = () => failAll('Export worker message could not be decoded');
    worker = w;
    return w;
  } catch {
    workerBroken = true;
    return null;
  }
}

export function workersSupported(): boolean {
  return !workerBroken && typeof Worker !== 'undefined';
}

function transferList(images: ImageMap): ArrayBuffer[] {
  const set = new Set<ArrayBuffer>();
  for (const img of Object.values(images)) {
    const buf = img.data.buffer;
    // Only transfer buffers the view owns entirely; shared/partial views are copied.
    if (buf instanceof ArrayBuffer && img.data.byteOffset === 0 && img.data.byteLength === buf.byteLength) set.add(buf);
  }
  return [...set];
}

/** True when image bytes were transferred to a worker and are no longer readable here. */
export function imagesDetached(images: ImageMap): boolean {
  return Object.values(images).some((img) => img.data.byteLength === 0 && img.width > 0);
}

type JobInput = { kind: 'pdf'; model: DocModel; images: ImageMap; options: PdfRenderOptions } | { kind: 'docx'; model: DocModel; images: ImageMap; options: DocxRenderOptions };

function post(input: JobInput, onProgress?: Stage): Promise<ExportWorkerMessage> {
  const w = getWorker();
  if (!w) return Promise.reject(new WorkerUnavailableError());
  const id = nextId++;
  const job: ExportJob = { id, ...input } as ExportJob;
  return new Promise<ExportWorkerMessage>((resolve, reject) => {
    pending.set(id, { resolve, reject, ...(onProgress ? { onProgress } : {}) });
    try {
      w.postMessage(job, transferList(input.images));
    } catch (err) {
      pending.delete(id);
      reject(new WorkerUnavailableError(err instanceof Error ? err.message : 'postMessage failed'));
    }
  });
}

export async function pdfInWorker(model: DocModel, images: ImageMap, options: PdfRenderOptions, onProgress?: Stage): Promise<PdfRenderResult> {
  const msg = await post({ kind: 'pdf', model, images, options }, onProgress);
  if (msg.type !== 'pdf') throw new WorkerUnavailableError('Unexpected worker response');
  return { buffer: msg.buffer, pageCount: msg.pageCount, scale: msg.scale, overflow: msg.overflow };
}

export async function docxInWorker(model: DocModel, images: ImageMap, options: DocxRenderOptions, onProgress?: Stage): Promise<ArrayBuffer> {
  const msg = await post({ kind: 'docx', model, images, options }, onProgress);
  if (msg.type !== 'docx') throw new WorkerUnavailableError('Unexpected worker response');
  return msg.buffer;
}
