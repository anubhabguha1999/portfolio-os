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
