import { describe, expect, it } from 'vitest';
import { RESUME_TEMPLATES, getResumeTemplate } from '@/studio/templates/resume';
import { RESUME_TEMPLATE_COUNT } from '@/studio/templates/count';
import { createResumeFromStarter } from '@/studio/model/defaults';
import { getPersona, SAMPLE_PERSONAS } from '@/studio/model/sample';
import { resolveResume } from '@/studio/model/resolve';
import { layoutFlow } from '@/studio/engine/layout';
import { renderFlowText } from '@/studio/engine/render-text';
import { renderFlowDocx } from '@/studio/engine/render-docx';

function build(id: string) {
  const t = getResumeTemplate(id);
  const persona = getPersona(t.starter?.persona);
  const resume = createResumeFromStarter('R', t.id, t.starter?.sections, persona.entries);
  resume.style = { ...resume.style, ...t.defaults };
  const flow = t.compose(resolveResume(resume, persona.library(), persona.profile()));
  return { t, persona, resume, flow, laid: layoutFlow(flow) };
}

describe('template starters', () => {
  it('marketing count matches the registry', () => {
    expect(RESUME_TEMPLATES.length).toBe(RESUME_TEMPLATE_COUNT);
  });

  it('every persona has a name, headline and experience', () => {
    for (const p of SAMPLE_PERSONAS) {
      expect(p.profile().name).toBeTruthy();
      expect(p.profile().headline).toBeTruthy();
      expect(p.library().experience.length).toBeGreaterThan(0);
    }
  });

  for (const id of ['slate-banner', 'navy-sidebar', 'corner-portrait', 'geometric-banner', 'teal-stripe']) {
    it(`${id} starter fits one clean page and exports`, async () => {
      const { t, persona, laid, flow } = build(id);
      expect(t.starter?.persona).toBe(persona.id);
      expect(laid.pages.length).toBe(1);
      expect(laid.issues).toEqual([]);
      const txt = renderFlowText(flow);
      expect(txt.toLowerCase()).toContain(persona.profile().name.toLowerCase());
      // The initials disc is decorative and never reaches text exports.
      expect(txt.split('\n')[0]).not.toMatch(/^[A-Z]{2}\s+\|/);
      expect((await renderFlowDocx(flow, { images: {} })).byteLength).toBeGreaterThan(1000);
    });
  }

  it('seeds resume-only entries by section kind and custom title', () => {
    const { resume } = build('navy-sidebar');
    const strengths = resume.sections.find((s) => s.title === 'Strengths');
    expect(strengths?.display).toBe('grid');
    expect(strengths?.placement).toBe('side');
    expect(strengths?.entries.length).toBeGreaterThan(5);
    const langs = build('slate-banner').resume.sections.find((s) => s.kind === 'languages');
    expect(langs?.entries.map((e) => e.title)).toContain('English');
  });

  it('falls back to a single-column grid when a word would not fit', () => {
    const { resume, persona, t } = build('navy-sidebar');
    const s = resume.sections.find((x) => x.title === 'Strengths')!;
    s.entries = [{ ...s.entries[0]!, title: 'Interdisciplinarycommunication' }];
    const laid = layoutFlow(t.compose(resolveResume(resume, persona.library(), persona.profile())));
    expect(laid.issues.some((i) => i.kind === 'clipped-word')).toBe(false);
  });

  it('ATS-safe mode collapses signature templates to a single column', () => {
    const { resume, persona, t } = build('slate-banner');
    resume.style.atsSafe = true;
    const flow = t.compose(resolveResume(resume, persona.library(), persona.profile()));
    expect(flow.columns.length).toBe(1);
  });
});
