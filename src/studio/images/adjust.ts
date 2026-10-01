/**
 * Pure pixel operations (no DOM). Work on any ImageData-like object so they run on the
 * main thread, in workers and in tests.
 */
import type { ImageAdjustments, ImageEdit } from '@/studio/model/types';

export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex ?? '').trim());
  if (!m) return [0, 0, 0];
  const h = m[1]!.length === 3 ? m[1]!.split('').map((c) => c + c).join('') : m[1]!;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function isNeutral(a: ImageAdjustments): boolean {
  return !a.brightness && !a.contrast && !a.saturation && !a.exposure && !a.blur && !a.sharpness;
}

/** Brightness, contrast, saturation and exposure in one pass (all −100…100). */
export function applyTone(px: Pixels, a: Pick<ImageAdjustments, 'brightness' | 'contrast' | 'saturation' | 'exposure'>): Pixels {
  const d = px.data;
  const bright = (a.brightness / 100) * 255 * 0.5;
  const c = (a.contrast / 100) * 255;
  const cf = (259 * (c + 255)) / (255 * (259 - c));
  const sat = 1 + a.saturation / 100;
  const exp = Math.pow(2, a.exposure / 50);
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i]! * exp + bright;
    let g = d[i + 1]! * exp + bright;
    let b = d[i + 2]! * exp + bright;
    r = cf * (r - 128) + 128;
    g = cf * (g - 128) + 128;
    b = cf * (b - 128) + 128;
    if (sat !== 1) {
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = l + (r - l) * sat;
      g = l + (g - l) * sat;
      b = l + (b - l) * sat;
    }
    d[i] = clamp(r);
    d[i + 1] = clamp(g);
    d[i + 2] = clamp(b);
  }
  return px;
}

/** One horizontal + vertical box pass (running sums, O(n) per radius). */
function boxPass(src: Float32Array, dst: Float32Array, w: number, h: number, r: number): void {
  const tmp = new Float32Array(src.length);
  const win = r * 2 + 1;
  for (let y = 0; y < h; y++) {
    for (let ch = 0; ch < 4; ch++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += src[(y * w + Math.min(w - 1, Math.max(0, k))) * 4 + ch]!;
      for (let x = 0; x < w; x++) {
        tmp[(y * w + x) * 4 + ch] = acc / win;
        const add = Math.min(w - 1, x + r + 1);
        const sub = Math.max(0, x - r);
        acc += src[(y * w + add) * 4 + ch]! - src[(y * w + sub) * 4 + ch]!;
      }
    }
  }
  for (let x = 0; x < w; x++) {
    for (let ch = 0; ch < 4; ch++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += tmp[(Math.min(h - 1, Math.max(0, k)) * w + x) * 4 + ch]!;
      for (let y = 0; y < h; y++) {
        dst[(y * w + x) * 4 + ch] = acc / win;
        const add = Math.min(h - 1, y + r + 1);
        const sub = Math.max(0, y - r);
        acc += tmp[(add * w + x) * 4 + ch]! - tmp[(sub * w + x) * 4 + ch]!;
      }
    }
  }
}

/** Approximate gaussian: three separable box passes. */
export function blurred(px: Pixels, radius: number): Float32Array {
  const f = Float32Array.from(px.data);
  const r = Math.max(0, Math.round(radius));
  if (!r) return f;
  const out = new Float32Array(f.length);
  boxPass(f, out, px.width, px.height, r);
  boxPass(out, f, px.width, px.height, r);
  boxPass(f, out, px.width, px.height, r);
  return out;
}

/** 0…100 → radius relative to the image's long edge (max ≈ 2.5%). */
export function blurRadius(amount: number, w: number, h: number): number {
  return Math.round((Math.max(0, Math.min(100, amount)) / 100) * Math.max(w, h) * 0.025);
}

export function applyBlur(px: Pixels, amount: number): Pixels {
  const r = blurRadius(amount, px.width, px.height);
  if (!r) return px;
  const b = blurred(px, r);
  for (let i = 0; i < px.data.length; i++) px.data[i] = clamp(b[i]!);
  return px;
}

/** Unsharp mask: original + k·(original − blur). */
export function applySharpen(px: Pixels, amount: number): Pixels {
  if (amount <= 0) return px;
  const r = Math.max(1, Math.round(Math.max(px.width, px.height) / 600));
  const b = blurred(px, r);
  const k = (Math.min(100, amount) / 100) * 1.6;
  const d = px.data;
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) d[i + c] = clamp(d[i + c]! + k * (d[i + c]! - b[i + c]!));
  }
  return px;
}

export function applyFilter(px: Pixels, filter: ImageEdit['filter'], duotone: [string, string]): Pixels {
  if (filter === 'none') return px;
  const d = px.data;
  const [dr, dg, db] = hexToRgb(duotone[0]);
  const [lr, lg, lb] = hexToRgb(duotone[1]);
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]!;
    const g = d[i + 1]!;
    const b = d[i + 2]!;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (filter === 'mono') {
      d[i] = d[i + 1] = d[i + 2] = clamp(l);
    } else if (filter === 'sepia') {
      d[i] = clamp(0.393 * r + 0.769 * g + 0.189 * b);
      d[i + 1] = clamp(0.349 * r + 0.686 * g + 0.168 * b);
      d[i + 2] = clamp(0.272 * r + 0.534 * g + 0.131 * b);
    } else {
      const t = l / 255;
      d[i] = clamp(dr + (lr - dr) * t);
      d[i + 1] = clamp(dg + (lg - dg) * t);
      d[i + 2] = clamp(db + (lb - db) * t);
    }
  }
  return px;
}

/** Full adjustment chain in a fixed order: tone → filter → blur → sharpen. Mutates and returns `px`. */
export function processPixels<T extends Pixels>(px: T, edit: Pick<ImageEdit, 'adjustments' | 'filter' | 'duotone'>): T {
  const a = edit.adjustments;
  if (a.brightness || a.contrast || a.saturation || a.exposure) applyTone(px, a);
  applyFilter(px, edit.filter, edit.duotone);
  if (a.blur) applyBlur(px, a.blur);
  if (a.sharpness) applySharpen(px, a.sharpness);
  return px;
}

export function needsPixels(edit: Pick<ImageEdit, 'adjustments' | 'filter'>): boolean {
  return !isNeutral(edit.adjustments) || edit.filter !== 'none';
}
