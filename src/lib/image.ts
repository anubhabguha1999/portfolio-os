/**
 * Local image processing (never uploaded anywhere): read dimensions, crop,
 * resize, compress and convert with a canvas.
 */
export interface ImageInfo {
  width: number;
  height: number;
}

export const LARGE_IMAGE_BYTES = 800 * 1024;
export const LARGE_IMAGE_DIMENSION = 2560;
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml'];

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('This image could not be decoded.'));
    img.src = src;
  });
}

export async function readImageInfo(blob: Blob): Promise<ImageInfo> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImageElement(url);
    return { width: img.naturalWidth || 0, height: img.naturalHeight || 0 };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface CropRect {
  /** Fractions 0–1 of the source image. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ProcessOptions {
  crop?: CropRect | null;
  maxWidth?: number;
  format: 'image/webp' | 'image/jpeg' | 'image/png' | 'original';
  quality: number; // 0–1
}

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
}

/** Crop + resize + re-encode. SVG/GIF are passed through untouched unless cropping/resizing is requested. */
export async function processImage(source: Blob, opts: ProcessOptions): Promise<ProcessedImage> {
  const url = URL.createObjectURL(source);
  try {
    const img = await loadImageElement(url);
    const sw = img.naturalWidth;
    const sh = img.naturalHeight;
    const crop = opts.crop ?? { x: 0, y: 0, width: 1, height: 1 };
    const cx = Math.round(crop.x * sw);
    const cy = Math.round(crop.y * sh);
    const cw = Math.max(1, Math.round(crop.width * sw));
    const ch = Math.max(1, Math.round(crop.height * sh));
    const scale = opts.maxWidth && cw > opts.maxWidth ? opts.maxWidth / cw : 1;
    const outW = Math.max(1, Math.round(cw * scale));
    const outH = Math.max(1, Math.round(ch * scale));
    const noGeometryChange = cx === 0 && cy === 0 && cw === sw && ch === sh && scale === 1;
    if (noGeometryChange && opts.format === 'original') return { blob: source, width: sw, height: sh };

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available in this browser.');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, cx, cy, cw, ch, 0, 0, outW, outH);
    let type = opts.format === 'original' ? source.type : opts.format;
    if (type === 'image/svg+xml' || type === 'image/gif' || !type) type = 'image/png';
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, opts.quality));
    if (!blob) throw new Error('Image encoding failed.');
    // If WebP is unsupported the browser silently returns PNG; that's still valid.
    return { blob, width: outW, height: outH };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function imageWarnings(info: { size: number; width: number; height: number }): string[] {
  const w: string[] = [];
  if (info.size > LARGE_IMAGE_BYTES) w.push(`Large file (${Math.round(info.size / 1024)} KB) — compressing will speed up your site.`);
  if (Math.max(info.width, info.height) > LARGE_IMAGE_DIMENSION) w.push(`Very large dimensions (${info.width}×${info.height}) — resizing is recommended.`);
  return w;
}

/** Sensible automatic optimisation on upload: cap to 2400px and re-encode big rasters as WebP. */
export async function autoOptimize(file: Blob): Promise<ProcessedImage> {
  const info = await readImageInfo(file);
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return { blob: file, ...info };
  const tooBig = Math.max(info.width, info.height) > 2400 || file.size > 1024 * 1024;
  if (!tooBig) return { blob: file, ...info };
  const maxWidth = info.width >= info.height ? 2400 : Math.round(2400 * (info.width / info.height));
  const out = await processImage(file, { maxWidth, format: 'image/webp', quality: 0.86 });
  return out.blob.size < file.size ? out : { blob: file, ...info };
}
