import { describe, it, expect } from 'vitest';
import { createPortfolio } from '@/lib/portfolio-factory';
import { renderPortfolio } from '@/lib/engine/render';
import { SECTION_TYPES, createSection } from '@/sections/registry';
import { parsePortfolio } from '@/schemas/portfolio';
import { buildPortfolioDocument } from '@/lib/document/build';
import { buildResumeDocument } from '@/lib/document/resume';

describe('portfolio engine', () => {
  it('renders every section type into a complete document', () => {
    const p = createPortfolio({ sections: [] });
    for (const t of SECTION_TYPES) p.sections.push(createSection(t, {}, p.sections));
    p.sections.forEach((s, i) => (s.order = i));
    const out = renderPortfolio(p, { mode: 'export' });
    expect(out.html).toMatch(/^<!doctype html>/);
    for (const s of p.sections) expect(out.html).toContain(`data-section-id="${s.id}"`);
    expect(out.html).toContain('application/ld+json');
    expect(out.body).not.toContain('undefined');
    expect(out.body).not.toContain('[object Object]');
  });

  it('escapes user content and strips scripts from custom html', () => {
    const p = createPortfolio({ sections: ['hero', 'custom'] });
    const hero = p.sections[0]!;
    if (hero.type === 'hero') hero.data.name = '<img src=x onerror=alert(1)>';
    const custom = p.sections[1]!;
    if (custom.type === 'custom') {
      custom.data.mode = 'html';
      custom.data.content = '<p>ok</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>';
    }
    const { body } = renderPortfolio(p, { mode: 'export' });
    expect(body).not.toContain('<img src=x');
    expect(body).not.toContain('<script>alert');
    expect(body).not.toContain('javascript:');
    expect(body).toContain('<p>ok</p>');
  });

  it('round-trips through the schema parser', () => {
    const p = createPortfolio();
    const { portfolio } = parsePortfolio(JSON.parse(JSON.stringify(p)));
    expect(portfolio.sections.map((s) => s.type)).toEqual(p.sections.map((s) => s.type));
    expect(portfolio.theme.id).toBe(p.theme.id);
  });

  it('builds document models', () => {
    const p = createPortfolio();
    expect(buildPortfolioDocument(p).sections.length).toBeGreaterThan(2);
    expect(buildResumeDocument(p).sections.map((s) => s.id)).toContain('experience');
  });
});
