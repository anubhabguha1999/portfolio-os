/**
 * PDF.js wrapper. Parsing runs in PDF.js's own Web Worker; this module walks pages one at a
 * time, converts coordinates to top-left PDF points and releases each page when done.
 * The bytes never leave the browser. Passwords are passed straight to PDF.js and not kept.
 */
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { PdfMetadata, RawImage, RawLink, RawPage, RawTextItem } from '../types';

// The legacy build carries polyfills (e.g. Uint8Array#toHex), so PDFs open on browsers that are a
// few versions old, not only the newest ones.
type PdfJs = typeof import('pdfjs-dist');

let lib: Promise<PdfJs> | null = null;

/** Load PDF.js on first use (it is a large module). */
export function pdfjs(): Promise<PdfJs> {
  if (!lib) {
    lib = Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs') as Promise<PdfJs>, import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')]).then(([m, worker]) => {
      m.GlobalWorkerOptions.workerSrc = worker.default;
      return m;
    });
    lib.catch(() => (lib = null));
  }
  return lib;
}

export class PdfPasswordError extends Error {
  constructor(public readonly incorrect: boolean) {
    super(incorrect ? 'The password is incorrect.' : 'This PDF is password protected.');
  }
}

export class PdfOpenError extends Error {}

/** Free the parser and its worker-side resources for a document. */
export function closePdf(doc: PDFDocumentProxy): void {
  const task = tasks.get(doc);
  tasks.delete(doc);
  void task?.destroy().catch(() => {});
}

const tasks = new WeakMap<PDFDocumentProxy, { destroy(): Promise<void> }>();

export async function openPdf(data: ArrayBuffer, password?: string): Promise<PDFDocumentProxy> {
  const m = await pdfjs();
  const task = m.getDocument({
    // PDF.js may transfer the buffer to its worker; keep the caller's copy intact.
    data: new Uint8Array(data.slice(0)),
    ...(password ? { password } : {}),
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs/standard_fonts/',
    wasmUrl: '/pdfjs/wasm/',
    enableXfa: false,
    // Never fetch anything referenced by the file itself.
    disableAutoFetch: true,
    disableStream: true,
  });
  try {
    const doc = await task.promise;
    tasks.set(doc, task);
    return doc;
  } catch (err) {
    void task.destroy().catch(() => {});
    const e = err as { name?: string; code?: number; message?: string };
    if (e?.name === 'PasswordException') throw new PdfPasswordError(e.code === 2);
    if (e?.name === 'InvalidPDFException') throw new PdfOpenError('This file is not a valid PDF or is corrupted.');
    throw new PdfOpenError(e?.message ? `Unable to read this PDF: ${e.message}` : 'Unable to read this PDF.');
  }
}

/** "D:20240131093000+05'30'" → ISO 8601. */
export function pdfDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const m = /^(?:D:)?(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?([Zz+-])?(\d{2})?'?(\d{2})?/.exec(raw.trim());
  if (!m) return null;
  const [, y, mo = '01', d = '01', h = '00', mi = '00', s = '00', tz, th = '00', tm = '00'] = m;
  const zone = !tz || tz === 'Z' || tz === 'z' ? 'Z' : `${tz}${th}:${tm}`;
  const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}${zone}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function readMetadata(doc: PDFDocumentProxy): Promise<PdfMetadata> {
  let info: Record<string, unknown> = {};
  try {
    info = ((await doc.getMetadata()).info ?? {}) as Record<string, unknown>;
  } catch {
    /* metadata is optional */
  }
  const s = (k: string) => (typeof info[k] === 'string' ? (info[k] as string).trim().slice(0, 500) : '');
  return {
    title: s('Title'),
    author: s('Author'),
    subject: s('Subject'),
    keywords: s('Keywords'),
    creator: s('Creator'),
    producer: s('Producer'),
    creationDate: pdfDate(info.CreationDate),
    modificationDate: pdfDate(info.ModDate),
    pageCount: doc.numPages,
    pdfVersion: s('PDFFormatVersion'),
    encrypted: info.IsEncrypted === true || (typeof info.EncryptFilterName === 'string' && !!info.EncryptFilterName),
  };
}

/* ------------------------------ one page ----------------------------- */

type Matrix = [number, number, number, number, number, number];
const mul = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m: Matrix, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/** Image placements from the operator list: track the transform stack and map the unit square. */
async function imagesOf(m: PdfJs, page: PDFPageProxy, view: Matrix, pageW: number, pageH: number): Promise<RawImage[]> {
  const ops = await page.getOperatorList();
  const { OPS } = m;
  const paint = new Set<number>([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject, OPS.paintImageXObjectRepeat].filter((x) => typeof x === 'number'));
  const stack: Matrix[] = [];
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const out: RawImage[] = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i]!;
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.transform) ctm = mul(ctm, ops.argsArray[i] as Matrix);
    else if (paint.has(fn)) {
      const full = mul(view, ctm);
      const pts = [apply(full, 0, 0), apply(full, 1, 0), apply(full, 0, 1), apply(full, 1, 1)];
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      const x = Math.max(0, Math.min(...xs));
      const y = Math.max(0, Math.min(...ys));
      const w = Math.min(pageW, Math.max(...xs)) - x;
      const h = Math.min(pageH, Math.max(...ys)) - y;
      if (w > 8 && h > 8) out.push({ x, y, width: w, height: h });
    }
  }
  return out.slice(0, 200);
}

function fontInfo(page: PDFPageProxy, fontName: string): { name: string; bold: boolean } {
  try {
    const f = page.commonObjs.get(fontName) as { name?: string; bold?: boolean; black?: boolean } | undefined;
    const name = f?.name ?? fontName;
    return { name, bold: !!(f?.bold || f?.black) || /bold|black|heavy|semibold|demi/i.test(name) };
  } catch {
    return { name: fontName, bold: /bold/i.test(fontName) };
  }
}

export async function readPage(doc: PDFDocumentProxy, n: number, opts: { images: boolean; links: boolean }): Promise<RawPage> {
  const m = await pdfjs();
  const page = await doc.getPage(n);
  try {
    const vp = page.getViewport({ scale: 1 });
    const view = vp.transform as Matrix;
    // The operator list also loads fonts, which tells us which runs are bold.
    const images = opts.images ? await imagesOf(m, page, view, vp.width, vp.height).catch(() => []) : (await page.getOperatorList().catch(() => null), []);
    const content = await page.getTextContent({ includeMarkedContent: false, disableNormalization: false });
    const items: RawTextItem[] = [];
    for (const it of content.items) {
      if (!('str' in it) || !it.str) continue;
      const tx = m.Util.transform(view, it.transform) as Matrix;
      const size = Math.hypot(tx[2], tx[3]) || it.height || 10;
      const width = it.width * Math.hypot(view[0], view[1]) || it.str.length * size * 0.5;
      const f = fontInfo(page, it.fontName);
      items.push({ text: it.str, x: tx[4], y: tx[5] - size, width, height: size, fontSize: Math.round(size * 10) / 10, fontName: f.name, bold: f.bold });
    }
    const links: RawLink[] = [];
    if (opts.links) {
      const annots = (await page.getAnnotations().catch(() => [])) as Array<{ subtype?: string; url?: string; unsafeUrl?: string; rect?: number[] }>;
      for (const a of annots) {
        if (a.subtype !== 'Link' || !a.rect) continue;
        const url = a.url ?? a.unsafeUrl;
        if (!url) continue;
        const [x1, y1] = vp.convertToViewportPoint(a.rect[0]!, a.rect[1]!) as [number, number];
        const [x2, y2] = vp.convertToViewportPoint(a.rect[2]!, a.rect[3]!) as [number, number];
        links.push({ url, x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) });
      }
    }
    return { page: n, width: vp.width, height: vp.height, items, links, images, ocr: false };
  } finally {
    page.cleanup();
  }
}

/** A page with almost no text but a large image is probably a scan. */
export function looksScanned(p: RawPage): boolean {
  const chars = p.items.reduce((s, i) => s + i.text.trim().length, 0);
  if (chars >= 25) return false;
  const area = p.width * p.height;
  return p.images.some((im) => im.width * im.height > area * 0.4) || chars === 0;
}

/**
 * Render a page to a canvas (preview, OCR input).
 * `background`: use PDF.js's print intent, which does not schedule work with requestAnimationFrame —
 * the display intent stalls in background tabs, and OCR must keep going when the user switches tabs.
 */
export async function renderPage(doc: PDFDocumentProxy, n: number, scale: number, canvas?: HTMLCanvasElement, opts: { background?: boolean } = {}): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(n);
  try {
    const vp = page.getViewport({ scale });
    const c = canvas ?? document.createElement('canvas');
    c.width = Math.ceil(vp.width);
    c.height = Math.ceil(vp.height);
    await page.render({ canvas: c, viewport: vp, background: '#ffffff', ...(opts.background ? { intent: 'print' as const } : {}) }).promise;
    return c;
  } finally {
    page.cleanup();
  }
}
