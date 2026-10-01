import { describe, it, expect } from 'vitest';
import { atsCheck, ATS_DISCLAIMER } from '@/studio/analysis/ats';
import { analyzeContent } from '@/studio/analysis/content';
import { layoutFlow } from '@/studio/engine/layout';
import { renderFlowText } from '@/studio/engine/render-text';
import { getResumeTemplate } from '@/studio/templates/resume';
import { resolveResume } from '@/studio/model/resolve';
import { createLibExperience, createLibSkill, createResume, createResumeSection } from '@/studio/model/defaults';
import { sampleLibrary, sampleProfile } from '@/studio/model/sample';
import type { Library, Profile, ResumeDoc } from '@/studio/model/types';

function run(resume: ResumeDoc, lib: Library = sampleLibrary(), profile: Profile = sampleProfile()) {
  const resolved = resolveResume(resume, lib, profile);
  const flow = getResumeTemplate(resume.templateId).compose(resolved);
  const laid = layoutFlow(flow);
  const text = renderFlowText(flow);
  return { resolved, laid, text, ats: atsCheck({ resolved, templateId: resume.templateId, laid, text }), content: analyzeContent(resolved, resume, lib) };
}
const status = (checks: ReturnType<typeof atsCheck>, id: string) => checks.find((c) => c.id === id)?.status;

describe('ATS checker', () => {
  it('clean sample data on ATS Minimal has no failures', () => {
    const { ats } = run(createResume('R'));
    expect(ats.filter((c) => c.status === 'fail')).toEqual([]);
    for (const id of ['selectable', 'headings', 'contact', 'graphics', 'font-size', 'text-images', 'columns', 'order', 'dates', 'links']) expect(status(ats, id)).toBe('pass');
  });

  it('never claims a guaranteed pass', () => {
    expect(ATS_DISCLAIMER.toLowerCase()).not.toMatch(/will pass/);
    expect(ATS_DISCLAIMER).toMatch(/not a guarantee/);
  });

  it('flags non-standard headings, missing contact, two columns and icons', () => {
    const r = createResume('R', { templateId: 'modern-professional' });
    r.sections.find((s) => s.kind === 'experience')!.title = 'My Journey';
    r.style.iconStyle = 'glyph';
    const profile = { ...sampleProfile(), email: '', phone: '' };
    const { ats } = run(r, sampleLibrary(), profile);
    expect(status(ats, 'headings')).toBe('warn');
    expect(ats.find((c) => c.id === 'headings')!.detail).toContain('My Journey');
    expect(status(ats, 'contact')).toBe('fail');
    expect(status(ats, 'columns')).toBe('warn');
    expect(status(ats, 'icons')).toBe('warn');
  });

  it('ATS-safe mode removes the two-column warning', () => {
    const r = createResume('R', { templateId: 'modern-professional' });
    r.style.atsSafe = true;
    expect(status(run(r).ats, 'columns')).toBe('pass');
  });

  it('checks font size, photo, characters, reading order and dates', () => {
    const base = run(createResume('R'));
    const tiny = atsCheck({ resolved: base.resolved, templateId: 'ats-minimal', laid: { ...base.laid, stats: { ...base.laid.stats, minFontSize: 7 } }, text: base.text });
    expect(status(tiny, 'font-size')).toBe('fail');
    const small = atsCheck({ resolved: base.resolved, templateId: 'ats-minimal', laid: { ...base.laid, stats: { ...base.laid.stats, minFontSize: 8.4, unsupportedChars: ['😀'] } }, text: base.text });
    expect(status(small, 'font-size')).toBe('warn');
    expect(status(small, 'chars')).toBe('warn');
    const photo = atsCheck({ resolved: { ...base.resolved, photo: 'profile:v:circle' }, templateId: 'ats-minimal', laid: base.laid, text: base.text });
    expect(status(photo, 'photo')).toBe('warn');
    const order = atsCheck({ resolved: base.resolved, templateId: 'ats-minimal', laid: base.laid, text: 'EXPERIENCE\nSomething\nElse\nMore\nAlex Morgan' });
    expect(status(order, 'order')).toBe('warn');
    const lib = sampleLibrary();
    lib.experience.push(createLibExperience({ company: 'Undated Co', role: 'Dev' }));
    expect(status(run(createResume('R'), lib).ats, 'dates')).toBe('warn');
    const shapes = atsCheck({ resolved: base.resolved, templateId: 'ats-minimal', laid: { ...base.laid, stats: { ...base.laid.stats, decorativeShapes: 80 } }, text: base.text });
    expect(status(shapes, 'graphics')).toBe('warn');
  });
});

describe('content analyzer', () => {
  it('finds no errors in clean sample data', () => {
    const { content } = run(createResume('R'));
    expect(content.filter((f) => f.level === 'error')).toEqual([]);
    expect(content.some((f) => f.id === 'missing-email' || f.id === 'missing-phone' || f.id === 'date-formats' || f.id === 'punctuation')).toBe(false);
  });

  it('applies every rule deterministically', () => {
    const lib = sampleLibrary();
    const bad = createLibExperience({
      id: 'exp_bad',
      company: 'Acme',
      role: 'Engineer',
      start: '2020',
      end: 'Summer 2019',
      achievements: ['Responsible for the build pipeline', 'I improved my team process', 'Responsible for the build pipeline', `Wrote ${'very '.repeat(0)}long ${'text '.repeat(50)}`],
    });
    const future = createLibExperience({ id: 'exp_future', company: 'Later', role: 'Lead', start: '2024-01', end: '2999-01', achievements: ['Grew revenue 10%.'] });
    const undated = createLibExperience({ id: 'exp_nodate', company: 'Nodate', role: 'Dev', achievements: ['Did 5 things.'] });
    const backwards = createLibExperience({ id: 'exp_back', company: 'Back', role: 'Dev', start: '2022-05', end: '2021-01', achievements: ['Cut costs 20%.'] });
    lib.experience = [bad, future, undated, backwards];
    lib.skills = Array.from({ length: 35 }, (_, i) => createLibSkill({ name: `Skill ${i}` }));
    const profile = { ...sampleProfile(), email: '', phone: '', headline: '', bio: Array.from({ length: 100 }, () => 'word').join(' ') };
    const r = createResume('R');
    r.sections.push(createResumeSection('publications'));
    const { content } = run(r, lib, profile);
    const ids = content.map((f) => f.id);
    const has = (prefix: string) => ids.some((id) => id.startsWith(prefix));
    for (const p of ['missing-email', 'missing-phone', 'missing-headline', 'exp-dates-', 'exp-metrics-', 'too-many-skills', 'long-summary', 'date-formats', 'future-', 'order-', 'punctuation', 'dup-', 'long-', 'weak-', 'pronoun-', 'empty-']) expect(has(p), p).toBe(true);
    const metric = content.find((f) => f.id.startsWith('exp-metrics-'));
    expect(metric?.ref).toBeTruthy();
  });
});
