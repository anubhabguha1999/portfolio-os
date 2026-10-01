import { describe, it, expect } from 'vitest';
import { fitToPages, fitLabel } from '@/studio/engine/fit';
import { layoutFlow } from '@/studio/engine/layout';
import { getResumeTemplate } from '@/studio/templates/resume';
import { resolveResume } from '@/studio/model/resolve';
import { createResume } from '@/studio/model/defaults';
import { sampleLibrary, sampleProfile } from '@/studio/model/sample';
import { effectiveStyle } from '@/studio/templates/kit';
import type { FitAdjust } from '@/studio/model/types';

function composer(extraBullets: number, templateId = 'ats-minimal') {
  const lib = sampleLibrary();
  lib.experience = lib.experience.map((e) => ({ ...e, achievements: [...e.achievements, ...Array.from({ length: extraBullets }, (_, i) => `Delivered improvement number ${i + 1} across several teams, raising throughput by ${i + 3}% within a quarter.`)] }));
  const t = getResumeTemplate(templateId);
  const resume = createResume('R', { templateId });
  const compose = (fit: FitAdjust | null) => t.compose(resolveResume({ ...resume, style: { ...resume.style, ...t.defaults, fit } }, lib, sampleProfile()));
  return { compose, style: { ...resume.style, ...t.defaults } };
}

describe('fitToPages', () => {
  it('returns the natural layout when it already fits', () => {
    const { compose } = composer(0);
    const r = fitToPages(compose, 3);
    expect(r.fit).toBeNull();
    expect(r.level).toBe('natural');
    expect(r.fits).toBe(true);
    expect(fitLabel(r)).toMatch(/Fits/);
  });

  it('tightens a slightly long resume onto one page', () => {
    const { compose } = composer(0);
    const natural = layoutFlow(compose(null)).pages.length;
    expect(natural).toBeGreaterThan(1);
    const r = fitToPages(compose, 1);
    expect(r.pages).toBeLessThanOrEqual(natural);
    expect(r.fits || r.level === 'limit').toBe(true);
    expect(r.tried).toBeLessThanOrEqual(24);
    if (r.fits) expect(r.pages).toBe(1);
  });

  it('gives up gracefully and never goes below readable sizes', () => {
    const { compose, style } = composer(25);
    const natural = layoutFlow(compose(null)).pages.length;
    const r = fitToPages(compose, 1);
    expect(r.fits).toBe(false);
    expect(r.level).toBe('limit');
    expect(r.pages).toBeLessThanOrEqual(natural);
    expect(effectiveStyle({ ...style, fit: r.fit }).size).toBeGreaterThanOrEqual(8);
    expect(fitLabel(r)).toMatch(/Still needs/);
  });
});
