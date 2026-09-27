/**
 * Asset resolution for every export format.
 *
 * Blobs come from the in-memory asset store when it holds the same project, otherwise
 * straight from IndexedDB. Nothing here ever throws for a missing or undecodable image:
 * problems become human-readable warnings and the export carries on without it.
 */
import type { Portfolio } from '@/types/portfolio';
import { useAssets } from '@/stores/assets';
import { getAsset, extensionForMime } from '@/lib/storage/assets';
import { isAssetRef, assetIdOf } from '@/lib/engine/assets';

/* ------------------------------------------------------------------ */
/* Blob loading                                                        */
/* ------------------------------------------------------------------ */

export interface LoadedAsset {
  id: string;
  blob: Blob;
  mime: string;
  name: string;
}

export type AssetLoader = (portfolioId: string, assetId: string) => Promise<LoadedAsset | null>;

/** Default loader: live asset store first (same project), then IndexedDB. */
export const defaultAssetLoader: AssetLoader = async (portfolioId, assetId) => {
  const store = useAssets.getState();
  if (store.projectId === portfolioId) {
    const blob = store.blobs[assetId];
    if (blob) {
      const meta = store.meta[assetId];
      return { id: assetId, blob, mime: meta?.mime || blob.type || 'application/octet-stream', name: meta?.name ?? assetId };
    }
  }
  try {
    const rec = await getAsset(portfolioId, assetId);
    if (!rec) return null;
    return { id: assetId, blob: rec.blob, mime: rec.mime || rec.blob.type || 'application/octet-stream', name: rec.name };
  } catch {
    return null;
  }
};

export interface AssetLoadResult {
  assets: Map<string, LoadedAsset>;
  missing: string[];
}

export async function loadAssets(portfolio: Portfolio, ids: readonly string[], loader: AssetLoader = defaultAssetLoader): Promise<AssetLoadResult> {
  const assets = new Map<string, LoadedAsset>();
  const missing: string[] = [];
  await Promise.all(
    [...new Set(ids)].map(async (id) => {
      const a = await loader(portfolio.id, id).catch(() => null);
      if (a) assets.set(id, a);
      else missing.push(id);
    }),
  );
  return { assets, missing };
}

export function missingAssetWarning(count: number): string {
  return count === 1 ? '1 image or font is missing from local storage and was skipped.' : `${count} images or fonts are missing from local storage and were skipped.`;
}

/* ------------------------------------------------------------------ */
/* Binary helpers (work on the main thread, in workers and in Node)    */
/* ------------------------------------------------------------------ */

export async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') return new Uint8Array(await blob.arrayBuffer());
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(new Uint8Array(r.result as ArrayBuffer));
    r.onerror = () => reject(r.error ?? new Error('read failed'));
    r.readAsArrayBuffer(blob);
  });
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  return `data:${mime || 'application/octet-stream'};base64,${bytesToBase64(bytes)}`;
}

export async function blobToDataUrl(blob: Blob, mime?: string): Promise<string> {
  return bytesToDataUrl(await blobToBytes(blob), mime || blob.type);
}

export interface ParsedDataUrl {
  mime: string;
  bytes: Uint8Array;
}

export function parseDataUrl(url: string): ParsedDataUrl | null {
  const m = /^data:([^;,]*)((?:;[^;,]*)*?)(;base64)?,(.*)$/s.exec(url);
  if (!m) return null;
  const mime = (m[1] || 'text/plain').toLowerCase();
  const payload = m[4] ?? '';
  try {
    if (m[3]) return { mime, bytes: base64ToBytes(payload.replace(/\s+/g, '')) };
    return { mime, bytes: new TextEncoder().encode(decodeURIComponent(payload)) };
  } catch {
    return null;
  }
}

export function extensionFor(mime: string, fallbackName = ''): string {
  if (mime && mime !== 'application/octet-stream') return extensionForMime(mime);
  const ext = /\.([a-z0-9]{2,5})$/i.exec(fallbackName)?.[1];
  return ext ? ext.toLowerCase() : 'bin';
}

/* ------------------------------------------------------------------ */
/* External images                                                     */
/* ------------------------------------------------------------------ */

export type ExternalFetcher = (url: string) => Promise<Blob | null>;

/** Best-effort fetch of a remote image. Offline / CORS failures return null. */
export const defaultExternalFetcher: ExternalFetcher = async (url) => {
  if (typeof fetch !== 'function') return null;
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'force-cache' });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.size) return null;
    const type = blob.type || res.headers.get('content-type') || '';
    return type.startsWith('image/') ? blob : null;
  } catch {
    return null;
  }
};

export function isExternalImage(src: string): boolean {
  return /^https?:\/\//i.test(src.trim());
}

/**
 * Fetch any image source into a Blob: `asset:<id>`, data URLs, blob: URLs and http(s).
 * Returns null when it cannot be obtained.
 */
export async function sourceToBlob(
  portfolio: Portfolio,
  src: string,
  env: { loader?: AssetLoader; fetcher?: ExternalFetcher } = {},
): Promise<Blob | null> {
  const s = src.trim();
  if (!s) return null;
  if (isAssetRef(s)) {
    const a = await (env.loader ?? defaultAssetLoader)(portfolio.id, assetIdOf(s)).catch(() => null);
    return a ? (a.blob.type ? a.blob : new Blob([a.blob], { type: a.mime })) : null;
  }
  if (s.startsWith('data:')) {
    const parsed = parseDataUrl(s);
    return parsed ? new Blob([toArrayBuffer(parsed.bytes)], { type: parsed.mime }) : null;
  }
  if (/^blob:/i.test(s) || isExternalImage(s)) return (env.fetcher ?? defaultExternalFetcher)(s);
  return null;
}

/** Copy bytes into a standalone ArrayBuffer (safe to transfer / wrap in a Blob). */
export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

/* ------------------------------------------------------------------ */
/* Raster decoding for PDF / DOCX                                      */
/* ------------------------------------------------------------------ */

/** Pixels ready for jsPDF (PNG/JPEG) and docx ImageRun (png/jpg). */
export interface RasterImage {
  format: 'png' | 'jpeg';
  data: Uint8Array;
  width: number;
  height: number;
}

export type ImageDecodeFn = (blob: Blob) => Promise<RasterImage | null>;

/** Longest edge kept in documents; larger images are downscaled when a canvas is available. */
export const MAX_DOC_IMAGE_EDGE = 2400;

export function sniffImageType(bytes: Uint8Array): 'png' | 'jpeg' | 'gif' | 'webp' | 'svg' | 'bmp' | 'avif' | null {
  const b = bytes;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'gif';
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
  if (b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d) return 'bmp';
  if (b.length >= 12 && String.fromCharCode(b[4] ?? 0, b[5] ?? 0, b[6] ?? 0, b[7] ?? 0) === 'ftyp') return 'avif';
  const head = new TextDecoder().decode(b.subarray(0, Math.min(b.length, 512))).trimStart();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'svg';
  return null;
}

/** Intrinsic size from a PNG IHDR chunk. */
export function pngSize(b: Uint8Array): { width: number; height: number } | null {
  if (b.length < 24) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const width = dv.getUint32(16);
  const height = dv.getUint32(20);
  return width > 0 && height > 0 ? { width, height } : null;
}

/** Intrinsic size from the first JPEG SOFn marker. */
export function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = b[i + 1] ?? 0;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0xff) {
      i += marker === 0xff ? 1 : 2;
      continue;
    }
    const len = ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0);
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      const height = ((b[i + 5] ?? 0) << 8) | (b[i + 6] ?? 0);
      const width = ((b[i + 7] ?? 0) << 8) | (b[i + 8] ?? 0);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    if (len < 2) return null;
    i += 2 + len;
  }
  return null;
}

/** PNG/JPEG pass straight through (no canvas needed — works in jsdom and workers). */
export function decodeKnownRaster(bytes: Uint8Array): RasterImage | null {
  const type = sniffImageType(bytes);
  if (type === 'png') {
    const size = pngSize(bytes);
    return size ? { format: 'png', data: bytes, ...size } : null;
  }
  if (type === 'jpeg') {
    const size = jpegSize(bytes);
    return size ? { format: 'jpeg', data: bytes, ...size } : null;
  }
  return null;
}

function canvasAvailable(): boolean {
  return typeof OffscreenCanvas !== 'undefined' || (typeof document !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' && !!document.createElement('canvas').getContext);
}

type Drawable = ImageBitmap | HTMLImageElement;

async function loadDrawable(blob: Blob, isSvg: boolean): Promise<{ source: Drawable; width: number; height: number; close(): void } | null> {
  if (!isSvg && typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob);
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      /* fall through to <img> decoding */
    }
  }
  if (typeof Image === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
  const url = URL.createObjectURL(isSvg ? new Blob([blob], { type: 'image/svg+xml' }) : blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    let width = img.naturalWidth;
    let height = img.naturalHeight;
    if (!width || !height) {
      width = 600;
      height = 400;
    }
    if (isSvg) {
      // Rasterise vectors crisply: at least 1200px on the long edge.
      const scale = Math.max(1, 1200 / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    return { source: img, width, height, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

async function rasterize(source: Drawable, width: number, height: number, format: 'png' | 'jpeg'): Promise<Uint8Array | null> {
  const type = format === 'png' ? 'image/png' : 'image/jpeg';
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(width, height);
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    if (format === 'jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(source, 0, 0, width, height);
    const blob = await c.convertToBlob({ type, quality: 0.9 });
    return blobToBytes(blob);
  }
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  if (format === 'jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(source, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, type, 0.9));
  return blob ? blobToBytes(blob) : null;
}

/**
 * Default decoder: PNG/JPEG are parsed directly; everything else (webp, avif, gif, bmp,
 * svg) is drawn to a canvas and re-encoded as PNG. Oversized rasters are downscaled.
 */
export const defaultImageDecoder: ImageDecodeFn = async (blob) => {
  const bytes = await blobToBytes(blob);
  const known = decodeKnownRaster(bytes);
  if (known && Math.max(known.width, known.height) <= MAX_DOC_IMAGE_EDGE) return known;
  if (!canvasAvailable()) return known;
  const isSvg = sniffImageType(bytes) === 'svg' || blob.type === 'image/svg+xml';
  const drawable = await loadDrawable(blob, isSvg);
  if (!drawable) return known;
  try {
    const scale = Math.min(1, MAX_DOC_IMAGE_EDGE / Math.max(drawable.width, drawable.height));
    const width = Math.max(1, Math.round(drawable.width * scale));
    const height = Math.max(1, Math.round(drawable.height * scale));
    const format = known?.format === 'jpeg' ? 'jpeg' : 'png';
    const data = await rasterize(drawable.source, width, height, format);
    if (!data) return known;
    return { format, data, width, height };
  } catch {
    return known;
  } finally {
    drawable.close();
  }
};

export interface ResolvedImages {
  images: Record<string, RasterImage>;
  warnings: string[];
}

export interface ImageEnv {
  loader?: AssetLoader;
  fetcher?: ExternalFetcher;
  decodeImage?: ImageDecodeFn;
}

/** Load + decode every image a document uses. Keys are the original `src` strings. */
export async function resolveRasterImages(
  portfolio: Portfolio,
  sources: readonly string[],
  env: ImageEnv = {},
  onEach?: (done: number, total: number) => void,
): Promise<ResolvedImages> {
  const images: Record<string, RasterImage> = {};
  let missing = 0;
  let external = 0;
  let undecodable = 0;
  const decode = env.decodeImage ?? defaultImageDecoder;
  let done = 0;
  for (const src of sources) {
    const blob = await sourceToBlob(portfolio, src, env).catch(() => null);
    if (!blob) {
      if (isExternalImage(src)) external++;
      else missing++;
    } else {
      const raster = await decode(blob).catch(() => null);
      if (raster) images[src] = raster;
      else undecodable++;
    }
    done++;
    onEach?.(done, sources.length);
  }
  const warnings: string[] = [];
  if (missing) warnings.push(`${missing} image${missing === 1 ? ' is' : 's are'} missing from local storage and ${missing === 1 ? 'was' : 'were'} left out.`);
  if (external) warnings.push(`${external} external image${external === 1 ? '' : 's'} could not be downloaded (offline or blocked by CORS) and ${external === 1 ? 'was' : 'were'} left out.`);
  if (undecodable) warnings.push(`${undecodable} image${undecodable === 1 ? '' : 's'} could not be converted for this format and ${undecodable === 1 ? 'was' : 'were'} left out.`);
  return { images, warnings };
}
