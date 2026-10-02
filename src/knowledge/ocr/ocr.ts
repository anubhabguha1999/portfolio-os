/**
 * Local OCR with Tesseract.js. The worker, WASM core and English model are served from this
 * origin (see scripts/vite-local-assets.ts); every path is set explicitly because Tesseract.js
 * otherwise falls back to a CDN. Recognition runs in Tesseract's own Web Worker.
 */
import { withBase } from '@/utils/base';
import type { RawPage, RawTextItem } from '../types';

type TesseractWorker = import('tesseract.js').Worker;

export interface OcrProgress {
  status: string;
  /** 0–1 within the current page. */
  progress: number;
}

export class OcrCancelled extends Error {
  constructor() {
    super('OCR was cancelled.');
  }
}

/** Render scale for OCR: about 216 dpi for a US Letter page, which Tesseract reads well. */
export const OCR_SCALE = 3;

export class OcrSession {
  private worker: TesseractWorker | null = null;
  private cancelled = false;
  private onProgress: (p: OcrProgress) => void = () => {};

  async start(onProgress: (p: OcrProgress) => void): Promise<void> {
    this.onProgress = onProgress;
    const { createWorker, OEM } = await import('tesseract.js');
    const origin = window.location.origin;
    this.worker = await createWorker('eng', OEM.LSTM_ONLY, {
      workerPath: `${origin}${withBase('/ocr/worker.min.js')}`,
      corePath: `${origin}${withBase('/ocr/core')}`,
      langPath: `${origin}${withBase('/ocr/lang')}`,
      gzip: true,
      workerBlobURL: false,
      logger: (m) => this.onProgress({ status: m.status, progress: typeof m.progress === 'number' ? m.progress : 0 }),
      errorHandler: () => {},
    });
    if (this.cancelled) await this.stop();
  }

  /** Recognise one rendered page. Returns positioned words in PDF points (top-left origin). */
  async recognize(canvas: HTMLCanvasElement, pageNo: number, pageWidth: number, pageHeight: number): Promise<RawPage> {
    if (this.cancelled || !this.worker) throw new OcrCancelled();
    const scale = canvas.width / pageWidth;
    const { data } = await this.worker.recognize(canvas, {}, { blocks: true, text: false });
    if (this.cancelled) throw new OcrCancelled();
    const items: RawTextItem[] = [];
    for (const block of data.blocks ?? []) {
      for (const para of block.paragraphs) {
        for (const line of para.lines) {
          const lineH = (line.bbox.y1 - line.bbox.y0) / scale;
          for (const w of line.words) {
            const text = w.text.trim();
            if (!text) continue;
            items.push({
              text,
              x: w.bbox.x0 / scale,
              y: line.bbox.y0 / scale,
              width: (w.bbox.x1 - w.bbox.x0) / scale,
              height: lineH,
              // Cap height ≈ 0.7 of the line box.
              fontSize: Math.round(lineH * 0.85 * 10) / 10,
              fontName: w.font_name ?? '',
              bold: false,
              confidence: Math.max(0, Math.min(1, w.confidence / 100)),
            });
          }
        }
      }
    }
    return { page: pageNo, width: pageWidth, height: pageHeight, items, links: [], images: [], ocr: true };
  }

  async stop(): Promise<void> {
    this.cancelled = true;
    const w = this.worker;
    this.worker = null;
    await w?.terminate().catch(() => {});
  }

  get isCancelled(): boolean {
    return this.cancelled;
  }
}
