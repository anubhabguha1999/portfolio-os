import type { DocBlock, DocModel, DocRun, DocSection, DocTheme } from '@/types/document';
import type { Portfolio } from '@/types/portfolio';
import type { DocContext } from '@/sections/types';
import { withDefinition } from '@/sections/registry';
import { markdownToPlain } from '@/lib/sanitize';
import { markdownToBlocks } from './markdown';
import { visibleSections, heroOf, contactOf, socialLinksOf } from '@/lib/engine/collect';
import { activePalette } from '@/lib/theme/tokens';
import { contrastRatio } from '@/utils/color';
import { getFont } from '@/lib/theme/fonts';
import { safeHref, hostnameOf } from '@/utils/url';

export function docContext(portfolio: Portfolio): DocContext {
  return { portfolio, markdownBlocks: markdownToBlocks, plain: markdownToPlain };
}

/** Print themes always use a light page; pick an accent readable on white. */
export function docTheme(p: Portfolio): DocTheme {
  const light = p.theme.palettes.light;
  const active = activePalette(p);
  const candidates = [light.primary, active.primary, light.secondary, '#1f2937'];
  const primary = candidates.find((c) => contrastRatio(c, '#ffffff') >= 3.5) ?? '#1f2937';
  const cat = getFont(p.theme.typography.bodyFont)?.category;
  return {
    primary,
    text: '#111827',
    muted: '#4b5563',
    border: '#d1d5db',
    font: cat === 'serif' ? 'times' : cat === 'mono' ? 'courier' : 'helvetica',
  };
}

export function contactRuns(p: Portfolio): DocRun[] {
  const c = contactOf(p);
  const runs: DocRun[] = [];
  const push = (r: DocRun) => {
    if (runs.length) runs.push({ text: '  ·  ' });
    runs.push(r);
  };
  if (c?.email) push({ text: c.email, link: `mailto:${c.email}` });
  if (c?.phone) push({ text: c.phone });
  if (c?.location) push({ text: c.location });
  if (p.metadata.siteUrl && safeHref(p.metadata.siteUrl)) push({ text: hostnameOf(p.metadata.siteUrl), link: safeHref(p.metadata.siteUrl) });
  for (const s of socialLinksOf(p)) {
    const href = safeHref(s.url);
    if (href && /^https?:/.test(href)) push({ text: s.label || s.platform || hostnameOf(href), link: href });
  }
  return runs;
}

/** Portfolio → full document (every enabled section, in order). */
export function buildPortfolioDocument(p: Portfolio, opts: { includeImages?: boolean } = {}): DocModel {
  const ctx = docContext(p);
  const hero = heroOf(p);
  const includeImages = opts.includeImages ?? true;
  const sections: DocSection[] = [];
  for (const s of visibleSections(p)) {
    if (s.type === 'hero' || s.type === 'social') continue;
    let blocks: DocBlock[] = [];
    try {
      blocks = withDefinition(s, (def, sec) => def.toDocument(sec.data, ctx));
    } catch (err) {
      blocks = [{ kind: 'paragraph', runs: [{ text: `This section could not be converted (${err instanceof Error ? err.message : 'unknown error'}).`, italic: true }] }];
    }
    if (!includeImages) blocks = stripImages(blocks);
    if (!blocks.length) continue;
    const heading = withDefinition(s, (def, sec) => def.heading(sec.data)) || s.name;
    sections.push({ id: s.id, title: s.type === 'contact' ? heading || 'Contact' : heading, blocks });
  }
  const heroBlocks = hero ? withDefinition(p.sections.find((s) => s.type === 'hero')!, (def, sec) => def.toDocument(sec.data, ctx)) : [];
  if (heroBlocks.length) sections.unshift({ id: 'intro', title: '', blocks: heroBlocks });
  return {
    kind: 'portfolio',
    title: p.metadata.title || hero?.name || 'Portfolio',
    author: hero?.name || p.metadata.author,
    subject: p.metadata.description || hero?.title || '',
    keywords: p.metadata.keywords,
    header: hero
      ? {
          name: hero.name,
          headline: hero.title,
          contact: contactRuns(p),
          ...(includeImages && hero.image.src ? { photo: hero.image.src } : {}),
        }
      : null,
    sections,
    theme: docTheme(p),
  };
}

export function stripImages(blocks: DocBlock[]): DocBlock[] {
  return blocks
    .filter((b) => b.kind !== 'image')
    .map((b) => (b.kind === 'entry' ? { ...b, body: stripImages(b.body) } : b));
}

/** Every image src referenced by a document (for preloading before PDF/DOCX render). */
export function documentImageSources(doc: DocModel): string[] {
  const out = new Set<string>();
  const walk = (blocks: DocBlock[]) => {
    for (const b of blocks) {
      if (b.kind === 'image' && b.src) out.add(b.src);
      if (b.kind === 'entry') walk(b.body);
    }
  };
  if (doc.header?.photo) out.add(doc.header.photo);
  doc.sections.forEach((s) => walk(s.blocks));
  return [...out];
}
