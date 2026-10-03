import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { RESUME_TEMPLATE_COUNT } from '@/studio/templates/count';
import { DOC_TEMPLATES } from '@/studio/templates/document';
import { LETTER_TEMPLATES } from '@/studio/templates/letter';
import config from '@/config/seo-routes.json';

const text = (path: string) => readFileSync(path, 'utf8');
const SOURCES = { 'seo-routes.json': JSON.stringify(config), 'guides.mjs': text('scripts/seo-content/guides.mjs'), 'README.md': text('README.md') };

/** Every "<n> … templates" claim about resumes must match the registry. */
function resumeCounts(s: string): number[] {
  return [...s.matchAll(/(\d+)\s+(?:print-grade\s+|ATS-friendly\s+)?(?:resume\s+)?templates/gi)]
    .filter((m) => /resume|ats|print-grade/i.test(s.slice(Math.max(0, m.index! - 120), m.index! + m[0].length + 40)))
    // Skip counts that belong to another studio ("Cover letters with 4 templates", "10 document templates").
    .filter((m) => !/(document|cover letter|portfolio)/i.test(s.slice(Math.max(0, m.index! - 40), m.index! + m[0].length)))
    .map((m) => Number(m[1]));
}

describe('SEO copy stays in sync with the template registries', () => {
  for (const [name, s] of Object.entries(SOURCES)) {
    it(`${name}: resume template counts`, () => {
      const counts = resumeCounts(s);
      expect(counts.length, 'no resume template count found').toBeGreaterThan(0);
      expect(counts.every((n) => n === RESUME_TEMPLATE_COUNT), `found ${counts.join(', ')}`).toBe(true);
    });
  }

  it('document and cover letter counts match', () => {
    const s = JSON.stringify(config);
    expect(s).toContain(`${LETTER_TEMPLATES.length} cover letter templates and ${DOC_TEMPLATES.length} document templates`);
  });

  it('the new-resume page is private and every route is either indexed or disallowed', () => {
    const route = config.routes.find((r) => r.path === '/resumes/new');
    expect(route?.index).toBe(false);
    expect(config.routes.some((r) => r.path === '/runner')).toBe(false);
  });

  it('index.html uses the same canonical host as seo-routes.json', () => {
    // prerender.mjs swaps cfg.siteUrl inside index.html, so both must spell the host the same way.
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain(`<link rel="canonical" href="${config.siteUrl}/" />`);
    expect(config.siteUrl).toBe('https://www.portfolioos.online');
  });
});
