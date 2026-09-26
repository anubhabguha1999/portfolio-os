import type { ImageRef, Portfolio, PortfolioSection, SocialItem } from '@/types/portfolio';
import { withDefinition } from '@/sections/registry';
import { isAssetRef, assetIdOf } from './assets';

export function sortedSections(p: Portfolio): PortfolioSection[] {
  return [...p.sections].sort((a, b) => a.order - b.order);
}

export function visibleSections(p: Portfolio): PortfolioSection[] {
  return sortedSections(p).filter((s) => s.enabled);
}

export interface CollectedImage {
  ref: ImageRef;
  label: string;
  sectionId: string | null;
  sectionName: string;
}

/** Every image used by the portfolio (enabled sections + metadata). */
export function collectImages(p: Portfolio, includeDisabled = false): CollectedImage[] {
  const out: CollectedImage[] = [];
  for (const s of sortedSections(p)) {
    if (!includeDisabled && !s.enabled) continue;
    const imgs = withDefinition(s, (def, sec) => def.images(sec.data));
    for (const i of imgs) if (i.ref && i.ref.src) out.push({ ...i, sectionId: s.id, sectionName: s.name });
  }
  if (p.metadata.ogImage.src) out.push({ ref: p.metadata.ogImage, label: 'Social share image', sectionId: null, sectionName: 'SEO' });
  if (isAssetRef(p.metadata.favicon)) out.push({ ref: { src: p.metadata.favicon, alt: '' }, label: 'Favicon', sectionId: null, sectionName: 'SEO' });
  return out;
}

export function collectAssetIds(p: Portfolio, includeDisabled = true): string[] {
  const ids = new Set<string>();
  for (const i of collectImages(p, includeDisabled)) if (isAssetRef(i.ref.src)) ids.add(assetIdOf(i.ref.src));
  for (const f of p.metadata.customFonts) ids.add(f.assetId);
  return [...ids];
}

export interface CollectedLink {
  url: string;
  label: string;
  sectionId: string;
  sectionName: string;
}

export function collectLinks(p: Portfolio): CollectedLink[] {
  const out: CollectedLink[] = [];
  for (const s of visibleSections(p)) {
    const links = withDefinition(s, (def, sec) => def.links(sec.data));
    for (const l of links) out.push({ ...l, sectionId: s.id, sectionName: s.name });
  }
  return out;
}

export function socialLinksOf(p: Portfolio): SocialItem[] {
  const social = p.sections.find((s) => s.type === 'social' && s.enabled);
  return social && social.type === 'social' ? social.data.items : [];
}

export function heroOf(p: Portfolio) {
  const hero = p.sections.find((s) => s.type === 'hero');
  return hero && hero.type === 'hero' ? hero.data : null;
}

export function contactOf(p: Portfolio) {
  const c = p.sections.find((s) => s.type === 'contact');
  return c && c.type === 'contact' ? c.data : null;
}
