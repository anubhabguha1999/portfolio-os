import type { ImageRef, Portfolio, PortfolioSection } from '@/types/portfolio';
import { withBase } from '@/utils/base';
import { encodePayload, decodePayload } from '@/lib/compression';
import { parsePortfolio } from '@/schemas/portfolio';
import { defaultSectionStyle, getDefinition } from '@/sections/registry';
import { defaultSettings } from '@/lib/portfolio-factory';
import { getTheme } from '@/lib/theme/themes';
import { assetIdOf, isAssetRef } from '@/lib/engine/assets';
import { collectLinks } from '@/lib/engine/collect';

/** Largest inlined image (data URL characters) when "include images" is on. */
export const SHARE_IMAGE_MAX_CHARS = 14_000;
/** Budget for all inlined images together. */
export const SHARE_IMAGES_TOTAL_CHARS = 60_000;
/** Longest edge of downscaled share images. */
export const SHARE_IMAGE_MAX_EDGE = 360;
/** Byte-mode capacity of a version-40 QR code at error-correction level L. */
export const QR_MAX_CHARS = 2953;

export interface ShareOptions {
  includeImages: boolean;
  assetBlobs?: Record<string, Blob>;
}

export interface ShareResult {
  url: string;
  bytes: number;
  removedImages: number;
  containsContactInfo: boolean;
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Keep only the keys that differ from the defaults; the schema parser restores the rest. */
function diff(value: Json, defaults: Json): Json {
  const out: Json = {};
  for (const [k, v] of Object.entries(value)) {
    if (k in defaults && same(v, defaults[k])) continue;
    out[k] = v;
  }
  return out;
}

function isImageRef(v: unknown): v is ImageRef {
  return isObj(v) && typeof v.src === 'string' && typeof v.alt === 'string' && Object.keys(v).length === 2;
}

/** Visit every ImageRef in a JSON tree (replacing it with the callback's result). */
async function mapImages(value: unknown, fn: (ref: ImageRef) => Promise<ImageRef>): Promise<unknown> {
  if (Array.isArray(value)) return Promise.all(value.map((v) => mapImages(v, fn)));
  if (isImageRef(value)) return fn(value);
  if (isObj(value)) {
    const out: Json = {};
    for (const [k, v] of Object.entries(value)) out[k] = await mapImages(v, fn);
    return out;
  }
  return value;
}

/** Downscale an image blob to a small JPEG data URL using the browser's canvas. Returns null when unavailable. */
export async function downscaleToDataUrl(blob: Blob, maxEdge = SHARE_IMAGE_MAX_EDGE, maxChars = SHARE_IMAGE_MAX_CHARS): Promise<string | null> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return null;
  }
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    for (const q of [0.72, 0.6, 0.48, 0.36]) {
      const url = canvas.toDataURL('image/jpeg', q);
      if (url.startsWith('data:image/jpeg') && url.length <= maxChars) return url;
    }
    return null;
  } finally {
    bitmap.close();
  }
}

export function shareBaseUrl(): string {
  if (typeof location === 'undefined') return '';
  const origin = location.origin && location.origin !== 'null' ? location.origin : `${location.protocol}//${location.host}`;
  return `${origin}${withBase('/view')}`;
}

export function containsContactInfo(p: Portfolio): boolean {
  const contact = p.sections.find((s) => s.type === 'contact' && s.enabled);
  if (contact && contact.type === 'contact' && (contact.data.email.trim() || contact.data.phone.trim())) return true;
  return collectLinks(p).some((l) => /^(mailto|tel):/i.test(l.url.trim()));
}

/** Minimal JSON for a share link: only visible content, defaults stripped, heavy assets removed or shrunk. */
export async function buildSharePayload(p: Portfolio, opts: ShareOptions): Promise<{ payload: unknown; removedImages: number }> {
  let removedImages = 0;
  let budget = SHARE_IMAGES_TOTAL_CHARS;
  const cache = new Map<string, string | null>();
  const shrink = async (ref: ImageRef): Promise<ImageRef> => {
    if (!ref.src) return ref;
    if (isAssetRef(ref.src)) {
      const id = assetIdOf(ref.src);
      const blob = opts.includeImages ? opts.assetBlobs?.[id] : undefined;
      if (blob && /^image\//.test(blob.type) && blob.type !== 'image/svg+xml') {
        if (!cache.has(id)) {
          const url = await downscaleToDataUrl(blob);
          cache.set(id, url && url.length <= budget ? url : null);
          if (url && url.length <= budget) budget -= url.length;
        }
        const url = cache.get(id);
        if (url) return { src: url, alt: ref.alt };
      }
      removedImages++;
      return { src: '', alt: ref.alt };
    }
    if (ref.src.startsWith('data:') && (!opts.includeImages || ref.src.length > SHARE_IMAGE_MAX_CHARS || ref.src.length > budget)) {
      removedImages++;
      return { src: '', alt: ref.alt };
    }
    if (ref.src.startsWith('data:')) budget -= ref.src.length;
    return ref;
  };

  const sections: Json[] = [];
  for (const s of [...p.sections].sort((a, b) => a.order - b.order)) {
    if (!s.enabled) continue;
    sections.push(await sectionPayload(s, shrink));
  }

  const theme = p.theme;
  const builtin = getTheme(theme.id);
  const themePayload = builtin.id === theme.id && same(builtin, theme) ? { id: theme.id } : theme;
  const m = p.metadata;
  const metadata = diff(
    {
      title: m.title,
      description: m.description,
      keywords: m.keywords,
      author: m.author,
      siteUrl: m.siteUrl,
      language: m.language,
      favicon: isAssetRef(m.favicon) ? '' : m.favicon,
      twitterHandle: m.twitterHandle,
      ogImage: (await shrink(m.ogImage)) as unknown,
    },
    { description: '', keywords: [], author: '', siteUrl: '', language: 'en', favicon: '✦', twitterHandle: '', ogImage: { src: '', alt: '' } },
  );
  // Uploaded fonts are not shared (they would dwarf the link); the theme falls back to its font stacks.
  return {
    payload: {
      id: 'shared',
      version: p.version,
      metadata,
      theme: themePayload,
      sections,
      settings: diff(p.settings as unknown as Json, defaultSettings() as unknown as Json),
    },
    removedImages,
  };
}

async function sectionPayload(s: PortfolioSection, shrink: (ref: ImageRef) => Promise<ImageRef>): Promise<Json> {
  const def = getDefinition(s.type);
  const data = (await mapImages(s.data, shrink)) as Json;
  const defaults = def.createData() as unknown as Json;
  // Never drop arrays: an absent list would be replaced by the definition's starter items.
  const slim: Json = {};
  for (const [k, v] of Object.entries(data)) {
    if (!Array.isArray(v) && k in defaults && same(v, defaults[k])) continue;
    slim[k] = Array.isArray(v) ? v.map((item) => (isObj(item) ? stripItemIds(item) : item)) : v;
  }
  const out: Json = { id: s.id, type: s.type, data: slim };
  if (s.name !== def.label) out.name = s.name;
  const style = diff(s.style as unknown as Json, defaultSectionStyle(s.type) as unknown as Json);
  if (Object.keys(style).length) out.style = style;
  return out;
}

/** Item ids are regenerated on load; they are not needed in a view-only link. */
function stripItemIds(item: Json): Json {
  const { id: _id, ...rest } = item;
  void _id;
  return rest;
}

export async function buildShareUrl(p: Portfolio, opts: ShareOptions): Promise<ShareResult> {
  const { payload, removedImages } = await buildSharePayload(p, opts);
  const encoded = encodePayload(payload);
  // The payload lives in the URL fragment, which browsers never send to a server.
  const url = `${shareBaseUrl()}#p=${encoded}`;
  return { url, bytes: encoded.length, removedImages, containsContactInfo: containsContactInfo(p) };
}

export class ShareDecodeError extends Error {
  readonly issues: string[];
  constructor(message: string, issues: string[] = []) {
    super(message);
    this.name = 'ShareDecodeError';
    this.issues = issues;
  }
}

/** Decode a share payload back into a validated portfolio. */
export function decodeShare(payload: string): Portfolio {
  const trimmed = payload.trim();
  if (!trimmed) throw new ShareDecodeError('This link does not contain a portfolio.');
  let raw: unknown;
  try {
    raw = decodePayload(trimmed);
  } catch {
    throw new ShareDecodeError('This link is incomplete or corrupted. Ask the sender to copy it again.');
  }
  try {
    return parsePortfolio(raw).portfolio;
  } catch (err) {
    const issues = err && typeof err === 'object' && 'issues' in err && Array.isArray((err as { issues: unknown }).issues) ? ((err as { issues: string[] }).issues ?? []) : [];
    throw new ShareDecodeError(err instanceof Error ? err.message : 'The shared portfolio could not be read.', issues);
  }
}
