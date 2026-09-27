import { describe, it, expect } from 'vitest';
import { generateTheme, mulberry32 } from '@/lib/theme/randomizer';
import { getTheme } from '@/lib/theme/themes';
import { getFont } from '@/lib/theme/fonts';
import { contrastRatio } from '@/utils/color';
import { createPortfolio } from '@/lib/portfolio-factory';
import { parsePortfolio } from '@/schemas/portfolio';
import { runAccessibilityAudit } from '@/lib/analysis';

const base = getTheme('minimal-developer');

describe('design randomizer', () => {
  it('is deterministic for a seed', () => {
    expect(generateTheme(base, 42)).toEqual(generateTheme(base, 42));
    expect(generateTheme(base, 42)).not.toEqual(generateTheme(base, 43));
    const r = mulberry32(7);
    const s = mulberry32(7);
    expect([r(), r(), r()]).toEqual([s(), s(), s()]);
  });

  it('names and ids the theme from the seed', () => {
    const t = generateTheme(base, 1234);
    expect(t.id).toBe('generated-1234');
    expect(t.name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
  });

  it('guarantees accessible contrast in both palettes over many seeds', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const t = generateTheme(base, seed * 7919);
      for (const scheme of ['light', 'dark'] as const) {
        const p = t.palettes[scheme];
        const ctx = `seed ${seed} ${scheme}`;
        expect(contrastRatio(p.text, p.background), ctx).toBeGreaterThanOrEqual(7);
        expect(contrastRatio(p.text, p.surface), ctx).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(p.muted, p.background), ctx).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(p.muted, p.surface), ctx).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(p.primaryContrast, p.primary), ctx).toBeGreaterThanOrEqual(4.5);
      }
      expect(getFont(t.typography.headingFont)).toBeDefined();
      expect(getFont(t.typography.bodyFont)?.category).not.toBe('display');
      expect(getFont(t.typography.monoFont)?.category).toBe('mono');
    }
  });

  it('never touches content and survives the schema parser', () => {
    const p = createPortfolio();
    const before = JSON.stringify(p.sections);
    const themed = { ...p, theme: generateTheme(p.theme, 99) };
    expect(JSON.stringify(themed.sections)).toBe(before);
    const parsed = parsePortfolio(JSON.parse(JSON.stringify(themed))).portfolio;
    expect(parsed.theme).toEqual(themed.theme);
    const contrast = runAccessibilityAudit(themed, {}).checks.find((c) => c.id === 'a11y-contrast');
    expect(contrast?.status).not.toBe('fail');
  });
});
