/**
 * Image keys → pixels, for previews (object URLs) and exports (RasterImage bytes).
 *
 *   profile:<variantId>:<mode>   the profile photo variant rendered for a placement
 *   simg:<imageId>               a studio image as uploaded (document image blocks)
 *
 * Renders are cached in memory by a content hash, and derived variant renders are
 * persisted in IndexedDB so reopening the app does not recompute them.
 */
import { useEffect, useMemo, useState } from 'react';
import type { RasterImage } from '@/lib/export/assets';
import { defaultImageDecoder } from '@/lib/export/assets';
import { useWorkspace } from '@/studio/store/workspace';
import type { ImageVariant, Profile, ProfileImage } from '@/studio/model/types';
import { getImage, getRender, putRender } from '@/studio/storage/repo';
import { aspectOf, renderVariantBlob, smartFit, type Placement, type RenderTarget } from './pipeline';

export type RasterMap = Record<string, RasterImage>;

/** Placement modes a template or system can request. */
export type PlacementMode = 'variant' | 'circle' | 'square' | 'rounded' | 'small-portrait' | 'large-portrait' | 'hero' | 'avatar' | 'portrait';

export function targetFor(mode: string, variant: ImageVariant): RenderTarget {
  switch (mode) {
    case 'circle':
    case 'avatar':
      return { aspect: 1, shape: 'circle', px: 720 };
    case 'square':
      return { aspect: 1, shape: 'square', px: 720 };
    case 'rounded':
      return { aspect: 1, shape: 'rounded', px: 720 };
    case 'small-portrait':
      return { aspect: 22 / 28, shape: 'square', px: 820 };
    case 'large-portrait':
    case 'portrait':
      return { aspect: 32 / 42, shape: 'square', px: 1100 };
    case 'hero':
      return { aspect: 16 / 9, shape: 'none', px: 1600 };
    default:
      return { aspect: aspectOf(variant.edit), shape: variant.edit.shape === 'portrait' ? 'square' : variant.edit.shape, px: 1024 };
  }
}

/** Crop for a placement: the variant's own framing when aspects match, else a manual override, else smart fit. */
export function placementFor(img: ProfileImage, variant: ImageVariant, target: RenderTarget): Placement {
  const key = target.aspect.toFixed(3);
  const own = aspectOf(variant.edit);
  if (Math.abs(own - target.aspect) < 0.01) return { zoom: variant.edit.zoom, panX: variant.edit.panX, panY: variant.edit.panY };
  const override = variant.placements[key];
  if (override) return override;
  const fit = smartFit(img.asset, target.aspect, target.shape);
  return { ...fit, zoom: fit.zoom * Math.max(1, variant.edit.zoom * 0.5 + 0.5) };
}

export function parseKey(key: string): { kind: 'profile'; variantId: string; mode: string } | { kind: 'simg'; imageId: string } | null {
  const p = /^profile:([^:]+):([\w-]+)$/.exec(key);
  if (p) return { kind: 'profile', variantId: p[1]!, mode: p[2]! };
  const s = /^simg:([\w-]+)$/.exec(key);
  if (s) return { kind: 'simg', imageId: s[1]! };
  return null;
}

function hashOf(value: unknown): string {
  const s = JSON.stringify(value);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

interface CacheEntry {
  hash: string;
  blob: Blob;
  url: string | null;
  raster: RasterImage | null;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<CacheEntry | null>>();

function variantOf(profile: Profile, id: string): { img: ProfileImage; variant: ImageVariant } | null {
  const img = profile.profileImage;
  if (!img) return null;
  const variant = img.variants.find((v) => v.id === id) ?? img.variants.find((v) => v.id === img.usage.resume) ?? img.variants[0];
  return variant ? { img, variant } : null;
}

async function produce(key: string, profile: Profile): Promise<CacheEntry | null> {
  const parsed = parseKey(key);
  if (!parsed) return null;
  if (parsed.kind === 'simg') {
    const hit = cache.get(key);
    if (hit) return hit;
    const rec = await getImage(parsed.imageId);
    if (!rec) return null;
    const entry: CacheEntry = { hash: rec.id, blob: rec.blob, url: null, raster: null };
    cache.set(key, entry);
    return entry;
  }
  const found = variantOf(profile, parsed.variantId);
  if (!found) return null;
  const target = targetFor(parsed.mode, found.variant);
  const placement = placementFor(found.img, found.variant, target);
  const hash = hashOf([found.img.asset.id, found.variant.edit, target, placement]);
  const hit = cache.get(key);
  if (hit && hit.hash === hash) return hit;
  const stored = await getRender(key).catch(() => undefined);
  if (stored && stored.hash === hash) {
    const entry: CacheEntry = { hash, blob: stored.blob, url: null, raster: null };
    replace(key, entry);
    return entry;
  }
  const original = await getImage(found.img.asset.id);
  if (!original) return null;
  const blob = await renderVariantBlob(original.blob, found.variant.edit, target, placement).catch(() => null);
  if (!blob) return null;
  const entry: CacheEntry = { hash, blob, url: null, raster: null };
  replace(key, entry);
  void putRender({ key, hash, blob, width: 0, height: 0, updatedAt: new Date().toISOString() }).catch(() => undefined);
  return entry;
}

function replace(key: string, entry: CacheEntry): void {
  const old = cache.get(key);
  if (old?.url) URL.revokeObjectURL(old.url);
  cache.set(key, entry);
}

export async function entryFor(key: string): Promise<CacheEntry | null> {
  const profile = useWorkspace.getState().profile;
  const flightKey = `${key}|${hashOf(profile.profileImage ?? null)}`;
  let p = inflight.get(flightKey);
  if (!p) {
    p = produce(key, profile).finally(() => inflight.delete(flightKey));
    inflight.set(flightKey, p);
  }
  return p;
}

export async function blobForKey(key: string): Promise<Blob | null> {
  return (await entryFor(key))?.blob ?? null;
}

export async function rasterForKey(key: string): Promise<RasterImage | null> {
  const e = await entryFor(key);
  if (!e) return null;
  if (!e.raster) e.raster = await defaultImageDecoder(e.blob).catch(() => null);
  return e.raster ? { ...e.raster, data: e.raster.data.slice() } : null;
}

export async function rastersForKeys(keys: string[]): Promise<{ images: RasterMap; missing: string[] }> {
  const images: RasterMap = {};
  const missing: string[] = [];
  for (const k of [...new Set(keys)]) {
    const r = await rasterForKey(k).catch(() => null);
    if (r) images[k] = r;
    else missing.push(k);
  }
  return { images, missing };
}

export async function urlForKey(key: string): Promise<string | null> {
  const e = await entryFor(key);
  if (!e) return null;
  if (!e.url) e.url = URL.createObjectURL(e.blob);
  return e.url;
}

/** Object URLs for a set of keys; re-resolves when the profile image changes. */
export function useImageUrls(keys: string[]): (key: string) => string | undefined {
  const profileImage = useWorkspace((s) => s.profile.profileImage);
  const sig = keys.slice().sort().join('|');
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      for (const k of sig ? sig.split('|') : []) {
        const u = await urlForKey(k).catch(() => null);
        if (u) next[k] = u;
      }
      if (!cancelled) setUrls(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [sig, profileImage]);
  return useMemo(() => (key: string) => urls[key], [urls]);
}

/** Every image key a laid-out or flow document references. */
export function collectImageKeys(prims: Array<{ k: string; src?: string }>): string[] {
  return [...new Set(prims.filter((p) => p.k === 'image' && p.src).map((p) => p.src!))];
}

export function clearImageCache(): void {
  for (const e of cache.values()) if (e.url) URL.revokeObjectURL(e.url);
  cache.clear();
}
