/**
 * Non-destructive image pipeline (runs locally, never uploads):
 *   original blob + ImageEdit + RenderTarget → processed Blob
 *
 * Geometry: the output frame has the target aspect. The source is drawn "cover"-fit,
 * then zoomed, panned (fractions of the frame), rotated and flipped. Uncovered areas
 * show the chosen background. The shape mask is applied last, so circles/hexagons
 * become transparent PNGs that work in HTML, PDF and DOCX alike.
 */
import type { AspectKey, ImageAsset, ImageEdit, ProfileShape } from '@/studio/model/types';
import { needsPixels, processPixels } from './adjust';

export interface RenderTarget {
  /** width / height */
  aspect: number;
  shape: ProfileShape | 'none';
  /** Long edge in pixels. */
  px: number;
}

export interface Placement {
  zoom: number;
  panX: number;
  panY: number;
}

export const ASPECTS: Record<Exclude<AspectKey, 'custom'>, number> = { '1:1': 1, '4:5': 4 / 5, '3:4': 3 / 4, '16:9': 16 / 9 };

export function aspectOf(edit: Pick<ImageEdit, 'aspect' | 'customRatio'>): number {
  return edit.aspect === 'custom' ? Math.min(4, Math.max(0.25, edit.customRatio || 1)) : ASPECTS[edit.aspect];
}

/** Shapes that need an alpha channel. */
export function needsAlpha(shape: RenderTarget['shape'], edit: ImageEdit): boolean {
  return shape === 'circle' || shape === 'hexagon' || shape === 'diamond' || shape === 'rounded' || shape === 'custom' || edit.background.kind === 'transparent';
}

/**
 * Smart fit: zoom/pan that centres the focal point (face when known) for an aspect,
 * keeping the frame covered. Circular crops zoom in slightly on faces.
 */
export function smartFit(asset: Pick<ImageAsset, 'width' | 'height' | 'focal' | 'face'>, aspect: number, shape: RenderTarget['shape'] = 'none'): Placement {
  const iw = Math.max(1, asset.width);
  const ih = Math.max(1, asset.height);
  const face = asset.face ?? null;
  const fx = face ? face.x + face.w / 2 : asset.focal?.x ?? 0.5;
  const fy = face ? face.y + face.h / 2 : asset.focal?.y ?? 0.4;
  // Cover scale: frame (aspect × 1) fully covered by the image.
  const cover = Math.max(aspect / iw, 1 / ih);
  let zoom = 1;
  if (face && face.h > 0) {
    // Face should occupy ~45% of the frame height (60% for circles).
    const target = shape === 'circle' ? 0.6 : aspect >= 1.4 ? 0.34 : 0.45;
    const faceFrame = face.h * ih * cover;
    zoom = Math.min(4, Math.max(1, target / Math.max(0.01, faceFrame)));
  }
  const s = cover * zoom;
  const dw = iw * s;
  const dh = ih * s;
  // Offset (frame units) that moves the focal point to the frame centre, clamped to coverage.
  const maxX = Math.max(0, (dw - aspect) / 2);
  const maxY = Math.max(0, (dh - 1) / 2);
  const ox = Math.min(maxX, Math.max(-maxX, (0.5 - fx) * dw));
  const oy = Math.min(maxY, Math.max(-maxY, (0.5 - fy) * dh));
  return { zoom, panX: ox / aspect, panY: oy };
}

function makeCanvas(w: number, h: number): OffscreenCanvas | HTMLCanvasElement | null {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return typeof c.getContext === 'function' ? c : null;
}

export type Ctx2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

export function shapePath(ctx: Ctx2D, shape: RenderTarget['shape'], w: number, h: number, radius: number): void {
  ctx.beginPath();
  const r = Math.min(w, h);
  switch (shape) {
    case 'circle':
      ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;
    case 'hexagon': {
      const cx = w / 2;
      const cy = h / 2;
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        const x = cx + (w / 2) * Math.cos(a);
        const y = cy + (h / 2) * Math.sin(a);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    }
    case 'diamond':
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w, h / 2);
      ctx.lineTo(w / 2, h);
      ctx.lineTo(0, h / 2);
      ctx.closePath();
      break;
    case 'rounded':
    case 'custom': {
      const rr = Math.max(0, Math.min(0.5, radius)) * r;
      ctx.moveTo(rr, 0);
      ctx.arcTo(w, 0, w, h, rr);
      ctx.arcTo(w, h, 0, h, rr);
      ctx.arcTo(0, h, 0, 0, rr);
      ctx.arcTo(0, 0, w, 0, rr);
      ctx.closePath();
      break;
    }
    default:
      ctx.rect(0, 0, w, h);
  }
}

async function decode(blob: Blob): Promise<ImageBitmap | HTMLImageElement | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob);
    } catch {
      /* fall back */
    }
  }
  if (typeof Image === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function toBlob(c: OffscreenCanvas | HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  if ('convertToBlob' in c) return c.convertToBlob({ type, quality });
  return new Promise((resolve) => (c as HTMLCanvasElement).toBlob(resolve, type, quality));
}

/** Draw the edited image into a context of size w×h (no shape mask). */
export function drawEdited(ctx: Ctx2D, src: CanvasImageSource & { width: number; height: number }, edit: ImageEdit, w: number, h: number, placement?: Placement): void {
  const iw = (src as ImageBitmap).width || 1;
  const ih = (src as ImageBitmap).height || 1;
  const bg = edit.background;
  if (bg.kind === 'white' || bg.kind === 'black' || bg.kind === 'color' || bg.kind === 'original') {
    ctx.fillStyle = bg.kind === 'white' ? '#ffffff' : bg.kind === 'black' ? '#000000' : bg.kind === 'color' ? bg.color : '#ffffff';
    if (bg.kind !== 'original') ctx.fillRect(0, 0, w, h);
  } else if (bg.kind === 'gradient') {
    const a = (bg.angle * Math.PI) / 180;
    const g = ctx.createLinearGradient(w / 2 - (Math.cos(a) * w) / 2, h / 2 - (Math.sin(a) * h) / 2, w / 2 + (Math.cos(a) * w) / 2, h / 2 + (Math.sin(a) * h) / 2);
    g.addColorStop(0, bg.gradient[0]);
    g.addColorStop(1, bg.gradient[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else if (bg.kind === 'blurred') {
    const cover = Math.max(w / iw, h / ih) * 1.15;
    ctx.save();
    try {
      ctx.filter = `blur(${Math.round(Math.max(w, h) / 28)}px)`;
    } catch {
      /* unsupported */
    }
    ctx.drawImage(src, (w - iw * cover) / 2, (h - ih * cover) / 2, iw * cover, ih * cover);
    ctx.restore();
  }
  const p = placement ?? { zoom: edit.zoom, panX: edit.panX, panY: edit.panY };
  const cover = Math.max(w / iw, h / ih) * Math.max(0.2, p.zoom);
  ctx.save();
  ctx.translate(w / 2 + p.panX * w, h / 2 + p.panY * h);
  ctx.rotate((edit.rotation * Math.PI) / 180);
  ctx.scale(edit.flipH ? -1 : 1, edit.flipV ? -1 : 1);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, (-iw * cover) / 2, (-ih * cover) / 2, iw * cover, ih * cover);
  ctx.restore();
}

/** Pixel adjustments (brightness, contrast, blur…). Defaults to the pure implementation in adjust.ts. */
export type PixelProcessor = (data: ImageData, edit: ImageEdit) => ImageData | Promise<ImageData>;
const defaultProcessor: PixelProcessor = (data, edit) => (needsPixels(edit) ? processPixels(data, edit) : data);
let pixelProcessor: PixelProcessor | null = defaultProcessor;
export function setPixelProcessor(fn: PixelProcessor | null): void {
  pixelProcessor = fn;
}

export function outputSize(target: RenderTarget): { w: number; h: number } {
  return { w: Math.max(1, Math.round(target.aspect >= 1 ? target.px : target.px * target.aspect)), h: Math.max(1, Math.round(target.aspect >= 1 ? target.px / target.aspect : target.px)) };
}

type Source = CanvasImageSource & { width: number; height: number };

/**
 * Paint a fully processed variant into `ctx` (w×h): background, geometry, pixel
 * adjustments, shape mask and ring. Synchronous so live previews stay smooth.
 */
export function paintVariant(ctx: Ctx2D, src: Source, edit: ImageEdit, target: RenderTarget, w: number, h: number, placement?: Placement): void {
  ctx.clearRect(0, 0, w, h);
  if (!needsAlpha(target.shape, edit)) {
    // JPEG output has no alpha: anything uncovered becomes white, not black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  }
  drawEdited(ctx, src, edit, w, h, placement);
  if (needsPixels(edit)) {
    const data = ctx.getImageData(0, 0, w, h);
    processPixels(data, edit);
    ctx.putImageData(data, 0, 0);
  }
  const shape = target.shape;
  if (shape !== 'none' && shape !== 'square' && shape !== 'portrait') {
    ctx.globalCompositeOperation = 'destination-in';
    shapePath(ctx, shape, w, h, edit.radius);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  if (edit.ring > 0) {
    const ringShape = shape === 'none' || shape === 'portrait' ? 'square' : shape;
    ctx.save();
    shapePath(ctx, ringShape, w, h, edit.radius);
    ctx.clip();
    ctx.lineWidth = (edit.ring / 1024) * Math.max(w, h) * 2;
    ctx.strokeStyle = edit.ringColor;
    shapePath(ctx, ringShape, w, h, edit.radius);
    ctx.stroke();
    ctx.restore();
  }
}

export { decode as decodeImage };

export async function renderVariantBlob(source: Blob, edit: ImageEdit, target: RenderTarget, placement?: Placement): Promise<Blob | null> {
  const img = await decode(source);
  if (!img) return null;
  const { w, h } = outputSize(target);
  const canvas = makeCanvas(w, h);
  const ctx = canvas?.getContext('2d') as Ctx2D | null;
  if (!canvas || !ctx) return null;
  if (pixelProcessor && pixelProcessor !== defaultProcessor) {
    // A custom processor (e.g. worker-backed) replaces the built-in synchronous one.
    drawEdited(ctx, img as Source, edit, w, h, placement);
    const data = ctx.getImageData(0, 0, w, h);
    ctx.putImageData(await pixelProcessor(data, edit), 0, 0);
  } else paintVariant(ctx, img as Source, edit, target, w, h, placement);
  if ('close' in img && typeof img.close === 'function') img.close();
  return toBlob(canvas, needsAlpha(target.shape, edit) ? 'image/png' : 'image/jpeg', 0.92);
}
