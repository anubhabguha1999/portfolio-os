import { describe, it, expect } from 'vitest';
import { createPortfolio } from '@/lib/portfolio-factory';
import { renderPortfolio } from '@/lib/engine/render';
import { breakpointOf } from '@/features/builder/Canvas';

describe('responsive output', () => {
  it('emits a viewport meta tag and breakpoint media queries', () => {
    const { html, css } = renderPortfolio(createPortfolio(), { mode: 'export' });
    expect(html).toContain('name="viewport" content="width=device-width, initial-scale=1"');
    expect(css).toMatch(/@media \(max-width:640px\)/);
    expect(css).toMatch(/@media \(min-width:641px\) and \(max-width:1024px\)/);
    expect(css).toMatch(/prefers-reduced-motion:reduce/);
    expect(css).toMatch(/@media print/);
  });

  it('applies per-device visibility classes', () => {
    const p = createPortfolio({ sections: ['hero', 'about'] });
    p.sections[1]!.style.hideOn.mobile = true;
    const { body } = renderPortfolio(p, { mode: 'export' });
    expect(body).toMatch(/class="[^"]*s-about[^"]*hide-mobile/);
  });

  it('classifies preview widths into breakpoints', () => {
    expect(breakpointOf(390).name).toBe('Mobile');
    expect(breakpointOf(820).name).toBe('Tablet');
    expect(breakpointOf(1440).name).toBe('Desktop');
  });
});
