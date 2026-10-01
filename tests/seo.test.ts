import { describe, expect, it } from 'vitest';
import config from '@/config/seo-routes.json';
import { applySeo, seoFor } from '@/app/seo';
import { legacyHashTarget } from '@/app/legacy-hash';

describe('SEO route table', () => {
  const indexable = config.routes.filter((r) => r.index);

  it('keeps titles and descriptions within search-result limits', () => {
    for (const r of indexable) {
      expect(r.title.length, r.path).toBeLessThanOrEqual(60);
      expect(r.description.length, r.path).toBeGreaterThanOrEqual(70);
      expect(r.description.length, r.path).toBeLessThanOrEqual(160);
      expect('h1' in r && r.h1, r.path).toBeTruthy();
    }
  });

  it('has unique titles and descriptions', () => {
    expect(new Set(indexable.map((r) => r.title)).size).toBe(indexable.length);
    expect(new Set(indexable.map((r) => r.description)).size).toBe(indexable.length);
  });

  it('never indexes private or per-user pages', () => {
    for (const p of ['/view', '/builder/abc', '/resume/res_1', '/document/doc_1', '/settings', '/profile', '/studio', '/projects', '/export/x', '/preview/x']) {
      expect(seoFor(p).index, p).toBe(false);
    }
    expect(seoFor('/resumes').index).toBe(true);
    expect(seoFor('/resumes/').path).toBe('/resumes');
  });

  it('writes head tags and leaves dynamic titles to the page', () => {
    document.title = 'My Resume — Resume Studio';
    applySeo('/resume/res_1');
    expect(document.title).toBe('My Resume — Resume Studio');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow');
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    applySeo('/templates');
    expect(document.title).toBe(seoFor('/templates').title);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://portfolioos.online/templates');
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe(seoFor('/templates').title);
  });
});

describe('legacy hash links', () => {
  it('maps old hash routes to clean paths', () => {
    expect(legacyHashTarget('#/resumes')).toBe('/resumes');
    expect(legacyHashTarget('#/templates?t=atlas')).toBe('/templates?t=atlas');
    expect(legacyHashTarget('#/')).toBe('/');
    expect(legacyHashTarget('#main')).toBeNull();
    expect(legacyHashTarget('')).toBeNull();
  });

  it('keeps share payloads in the fragment', () => {
    expect(legacyHashTarget('#/view?p=ABC_123-x')).toBe('/view#p=ABC_123-x');
  });
});

describe('static content pages', async () => {
  const sets = {
    '/resume-examples': (await import('../scripts/seo-content/resume-examples.mjs')).default,
    '/portfolio-examples': (await import('../scripts/seo-content/portfolio-examples.mjs')).default,
    '/guides': (await import('../scripts/seo-content/guides.mjs')).default,
  };
  const pages = Object.entries(sets).flatMap(([base, list]) => list.map((p) => ({ ...p, path: `${base}/${p.slug}` })));

  it('keeps titles and descriptions within search-result limits', () => {
    for (const p of pages) {
      expect(p.title.length, p.path).toBeLessThanOrEqual(60);
      expect(p.description.length, p.path).toBeGreaterThanOrEqual(70);
      expect(p.description.length, p.path).toBeLessThanOrEqual(160);
      expect(p.slug, p.path).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(p.sections.length, p.path).toBeGreaterThanOrEqual(4);
    }
  });

  it('has unique paths, titles and descriptions across the whole site', () => {
    const titles = [...pages.map((p) => p.title), ...config.routes.filter((r) => r.index).map((r) => r.title)];
    expect(new Set(pages.map((p) => p.path)).size).toBe(pages.length);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(pages.map((p) => p.description)).size).toBe(pages.length);
  });
});
