import { describe, it, expect } from 'vitest';
import { smartFit, aspectOf, needsAlpha } from '@/studio/images/pipeline';
import { applyBlur, applyFilter, applyTone, processPixels, type Pixels } from '@/studio/images/adjust';
import { defaultImageEdit } from '@/studio/model/defaults';
import { placementFor, targetFor, parseKey } from '@/studio/images/service';
import {
  addVariantFromPreset,
  createProfileImage,
  deleteVariant,
  duplicateVariant,
  placementKey,
  renameVariant,
  setFocal,
  setPlacement,
  setUsage,
  usageVariant,
  validateImageFile,
} from '@/studio/images/profile-image';
import type { ImageAsset } from '@/studio/model/types';
import { IMAGE_PRESETS, defaultVariantEdits } from '@/studio/images/presets';

const asset = (over: Partial<ImageAsset> = {}): ImageAsset => ({ id: 'simg_1', name: 'me.jpg', mime: 'image/jpeg', width: 1000, height: 1500, size: 1000, createdAt: '', focal: { x: 0.5, y: 0.4 }, face: null, ...over });

function pixels(w: number, h: number, fn: (i: number) => [number, number, number]): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const [r, g, b] = fn(i);
    data.set([r, g, b, 255], i * 4);
  }
  return { data, width: w, height: h };
}

describe('smartFit', () => {
  it('centred focal point needs no pan', () => {
    const p = smartFit(asset({ width: 1000, height: 1000, focal: { x: 0.5, y: 0.5 } }), 1);
    expect(p.zoom).toBe(1);
    expect(p.panX).toBeCloseTo(0);
    expect(p.panY).toBeCloseTo(0);
  });

  it('moves a high focal point towards the centre, clamped to keep the frame covered', () => {
    // Portrait image in a square frame: vertical slack exists.
    const p = smartFit(asset({ focal: { x: 0.5, y: 0.1 } }), 1);
    expect(p.panY).toBeGreaterThan(0);
    const cover = Math.max(1 / 1000, 1 / 1500);
    const maxY = (1500 * cover - 1) / 2;
    expect(p.panY).toBeLessThanOrEqual(maxY + 1e-9);
    // No horizontal slack for a portrait image in a square frame.
    expect(p.panX).toBeCloseTo(0);
  });

  it('zooms in on a small face, more for circles', () => {
    const face = { x: 0.45, y: 0.2, w: 0.1, h: 0.08 };
    const rect = smartFit(asset({ face }), 1, 'square');
    const circle = smartFit(asset({ face }), 1, 'circle');
    expect(rect.zoom).toBeGreaterThan(1);
    expect(circle.zoom).toBeGreaterThan(rect.zoom);
  });

  it('handles wide aspects', () => {
    const p = smartFit(asset(), 16 / 9);
    expect(Number.isFinite(p.panX) && Number.isFinite(p.panY)).toBe(true);
  });

  it('aspect helpers', () => {
    expect(aspectOf({ aspect: '4:5', customRatio: 1 })).toBeCloseTo(0.8);
    expect(aspectOf({ aspect: 'custom', customRatio: 9 })).toBe(4);
    const e = defaultImageEdit();
    expect(needsAlpha('circle', e)).toBe(true);
    expect(needsAlpha('square', { ...e, background: { ...e.background, kind: 'white' } })).toBe(false);
  });
});

describe('adjust', () => {
  it('neutral settings are the identity', () => {
    const px = pixels(4, 4, (i) => [i * 10, 100, 200 - i * 5]);
    const before = px.data.slice();
    processPixels(px, defaultImageEdit());
    expect([...px.data]).toEqual([...before]);
  });

  it('brightness raises values', () => {
    const px = pixels(2, 2, () => [100, 100, 100]);
    applyTone(px, { brightness: 40, contrast: 0, saturation: 0, exposure: 0 });
    expect(px.data[0]!).toBeGreaterThan(100);
  });

  it('negative saturation and mono reduce colour', () => {
    const px = pixels(1, 1, () => [200, 50, 50]);
    applyFilter(px, 'mono', ['#000000', '#ffffff']);
    expect(px.data[0]).toBe(px.data[1]);
    expect(px.data[1]).toBe(px.data[2]);
    const s = pixels(1, 1, () => [200, 50, 50]);
    applyTone(s, { brightness: 0, contrast: 0, saturation: -100, exposure: 0 });
    expect(Math.abs(s.data[0]! - s.data[1]!)).toBeLessThanOrEqual(1);
  });

  it('duotone maps black and white to the two colours', () => {
    const px = pixels(2, 1, (i) => (i === 0 ? [0, 0, 0] : [255, 255, 255]));
    applyFilter(px, 'duotone', ['#102030', '#f0e0d0']);
    expect([...px.data.slice(0, 3)]).toEqual([0x10, 0x20, 0x30]);
    expect([...px.data.slice(4, 7)]).toEqual([0xf0, 0xe0, 0xd0]);
  });

  it('blur roughly preserves the mean and smooths edges', () => {
    const w = 60;
    const px = pixels(w, w, (i) => ((i % w) < w / 2 ? [0, 0, 0] : [255, 255, 255]));
    const mean = (d: Uint8ClampedArray) => d.reduce((s, v, i) => (i % 4 === 0 ? s + v : s), 0) / (d.length / 4);
    const m0 = mean(px.data);
    applyBlur(px, 100);
    expect(Math.abs(mean(px.data) - m0)).toBeLessThan(6);
    const mid = (w * 10 + w / 2) * 4;
    expect(px.data[mid]!).toBeGreaterThan(20);
    expect(px.data[mid]!).toBeLessThan(235);
  });
});

describe('upload validation', () => {
  it('accepts supported types', () => {
    expect(validateImageFile({ name: 'a.jpg', type: 'image/jpeg', size: 10 }).ok).toBe(true);
    expect(validateImageFile({ name: 'a.JPEG', type: '', size: 10 }).ok).toBe(true);
    expect(validateImageFile({ name: 'a.webp', type: 'image/webp', size: 10 }).ok).toBe(true);
    const gif = validateImageFile({ name: 'a.gif', type: 'image/gif', size: 10 });
    expect(gif.ok && gif.note).toBeTruthy();
  });
  it('rejects other types, empty and huge files', () => {
    expect(validateImageFile({ name: 'a.svg', type: 'image/svg+xml', size: 10 }).ok).toBe(false);
    expect(validateImageFile({ name: 'a.pdf', type: 'application/pdf', size: 10 }).ok).toBe(false);
    expect(validateImageFile({ name: 'a.png', type: 'image/png', size: 0 }).ok).toBe(false);
    expect(validateImageFile({ name: 'a.png', type: 'image/png', size: 30 * 1024 * 1024 }).ok).toBe(false);
  });
});

describe('variants', () => {
  it('creates the default set with sensible usage', () => {
    const img = createProfileImage(asset());
    expect(img.variants.map((v) => v.purpose)).toEqual(defaultVariantEdits().map((v) => v.purpose));
    expect(usageVariant(img, 'resume').purpose).toBe('resume');
    expect(usageVariant(img, 'portfolio').purpose).toBe('portfolio');
  });

  it('duplicate, rename, preset', () => {
    let img = createProfileImage(asset());
    const src = img.variants[1]!;
    const d = duplicateVariant(img, src.id);
    img = d.img;
    expect(img.variants[2]!.id).toBe(d.id);
    expect(img.variants[2]!.edit).toEqual(src.edit);
    img = renameVariant(img, d.id, 'Headshot');
    expect(img.variants.find((v) => v.id === d.id)!.name).toBe('Headshot');
    const p = addVariantFromPreset(img, IMAGE_PRESETS[3]!.id);
    expect(p.img.variants.find((v) => v.id === p.id)!.edit.filter).toBe('mono');
  });

  it('delete keeps at least one variant and repairs usage', () => {
    let img = createProfileImage(asset());
    const resumeId = img.usage.resume;
    img = deleteVariant(img, resumeId);
    expect(img.variants.some((v) => v.id === resumeId)).toBe(false);
    expect(img.variants.some((v) => v.id === img.usage.resume)).toBe(true);
    while (img.variants.length > 1) img = deleteVariant(img, img.variants[0]!.id);
    expect(deleteVariant(img, img.variants[0]!.id).variants).toHaveLength(1);
  });

  it('setUsage ignores unknown ids', () => {
    const img = createProfileImage(asset());
    expect(setUsage(img, 'resume', 'nope')).toBe(img);
    expect(setUsage(img, 'resume', img.variants[0]!.id).usage.resume).toBe(img.variants[0]!.id);
  });

  it('placement overrides are honoured by the service', () => {
    let img = createProfileImage(asset());
    const v = usageVariant(img, 'portfolio');
    const target = targetFor('hero', v);
    img = setPlacement(img, v.id, target.aspect, { zoom: 2, panX: 0.1, panY: -0.1 });
    const v2 = img.variants.find((x) => x.id === v.id)!;
    expect(v2.placements[placementKey(target.aspect)]).toBeTruthy();
    expect(placementFor(img, v2, target)).toEqual({ zoom: 2, panX: 0.1, panY: -0.1 });
    img = setPlacement(img, v.id, target.aspect, null);
    expect(img.variants.find((x) => x.id === v.id)!.placements[placementKey(target.aspect)]).toBeUndefined();
  });

  it('manual focus point clears the detected face', () => {
    const img = setFocal(createProfileImage(asset({ face: { x: 0, y: 0, w: 0.1, h: 0.1 } })), { x: 2, y: -1 });
    expect(img.asset.face).toBeNull();
    expect(img.asset.focal).toEqual({ x: 1, y: 0 });
  });

  it('parses keys', () => {
    expect(parseKey('profile:var_1:large-portrait')).toEqual({ kind: 'profile', variantId: 'var_1', mode: 'large-portrait' });
    expect(parseKey('simg:simg_x')).toEqual({ kind: 'simg', imageId: 'simg_x' });
    expect(parseKey('nope')).toBeNull();
  });
});
