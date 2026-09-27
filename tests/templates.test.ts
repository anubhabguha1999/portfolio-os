import { describe, it, expect } from 'vitest';
import { TEMPLATES, getTemplate } from '@/templates';
import { renderPortfolio } from '@/lib/engine/render';
import { parsePortfolio } from '@/schemas/portfolio';
import { collectImages } from '@/lib/engine/collect';
import { THEMES } from '@/lib/theme/themes';
import type { Portfolio } from '@/types/portfolio';

const built = TEMPLATES.map((t) => ({ t, p: t.create() }));
const signature = (p: Portfolio) => `${p.theme.id}|${[...p.sections].sort((a, b) => a.order - b.order).map((s) => s.type).join(',')}`;

describe('templates', () => {
  it('ships at least eight templates with unique ids', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(8);
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
    for (const t of TEMPLATES) expect(getTemplate(t.id)).toBe(t);
  });

  it.each(built.map(({ t, p }) => [t.id, t, p] as const))('%s builds a valid, complete portfolio', (_id, t, p) => {
    expect(t.name.trim()).not.toBe('');
    expect(t.tags.length).toBeGreaterThan(0);
    expect(THEMES.some((th) => th.id === t.themeId)).toBe(true);
    expect(p.theme.id).toBe(t.themeId);

    // SEO metadata
    expect(p.metadata.title.trim()).not.toBe('');
    expect(p.metadata.description.length).toBeGreaterThanOrEqual(50);
    expect(p.metadata.description.length).toBeLessThanOrEqual(160);
    expect(p.metadata.keywords.length).toBeGreaterThan(0);
    expect(p.metadata.author.trim()).not.toBe('');
    expect(p.metadata.favicon.trim()).not.toBe('');

    // Enough content
    expect(p.sections.filter((s) => s.enabled).length).toBeGreaterThanOrEqual(6);

    // Unique ids and anchors
    expect(new Set(p.sections.map((s) => s.id)).size).toBe(p.sections.length);
    expect(new Set(p.sections.map((s) => s.style.anchor)).size).toBe(p.sections.length);
  });

  it.each(built.map(({ t, p }) => [t.id, p] as const))('%s survives a JSON round trip through the schema parser', (_id, p) => {
    const { portfolio, warnings } = parsePortfolio(JSON.parse(JSON.stringify(p)));
    expect(warnings).toEqual([]);
    expect(portfolio.sections.length).toBe(p.sections.length);
    expect(portfolio.sections.map((s) => s.type)).toEqual([...p.sections].sort((a, b) => a.order - b.order).map((s) => s.type));
    expect(portfolio.theme.id).toBe(p.theme.id);
  });

  it.each(built.map(({ t, p }) => [t.id, p] as const))('%s renders to a complete export document', (_id, p) => {
    const out = renderPortfolio(p, { mode: 'export' });
    expect(out.html).toMatch(/^<!doctype html>/);
    for (const s of p.sections.filter((x) => x.enabled)) expect(out.html).toContain(`data-section-id="${s.id}"`);
    expect(out.body).not.toContain('undefined');
    expect(out.body).not.toContain('[object Object]');
    // Offline-safe: no hot-linked remote images.
    expect(out.body).not.toMatch(/<img[^>]+src="https?:/);
  });

  it.each(built.map(({ t, p }) => [t.id, p] as const))('%s gives every image alt text', (_id, p) => {
    const images = collectImages(p, true).filter((i) => i.ref.src);
    expect(images.length).toBeGreaterThan(0);
    for (const img of images) expect(img.ref.alt.trim(), img.label).not.toBe('');
    if (p.metadata.ogImage.src) expect(p.metadata.ogImage.alt.trim()).not.toBe('');
    const { body } = renderPortfolio(p, { mode: 'export' });
    for (const tag of body.match(/<img\b[^>]*>/g) ?? []) {
      // Either meaningful alt text or explicitly decorative.
      expect(tag).toMatch(/\balt="/);
    }
  });

  it('templates are pairwise different', () => {
    const sigs = built.map(({ p }) => signature(p));
    expect(new Set(sigs).size).toBe(sigs.length);
    expect(new Set(built.map(({ p }) => p.theme.id)).size).toBe(built.length);
    const orders = built.map(({ p }) => p.sections.map((s) => s.type).join(','));
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('artwork is deterministic across builds', () => {
    for (const t of TEMPLATES) {
      const a = collectImages(t.create(), true).map((i) => i.ref.src);
      const b = collectImages(t.create(), true).map((i) => i.ref.src);
      expect(a).toEqual(b);
    }
  });
});
