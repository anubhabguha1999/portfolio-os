import { describe, it, expect } from 'vitest';
import { compareResumes, diffLines, hasContentChanges } from '@/lib/diff/resume';
import { createEntry, createRef, createResume, createResumeSection } from '@/studio/model/defaults';
import { sampleLibrary, sampleProfile } from '@/studio/model/sample';
import type { ResumeDoc } from '@/studio/model/types';

function base(): ResumeDoc {
  const r = createResume('Base');
  const langs = createResumeSection('languages', { entries: [createEntry({ title: 'English', subtitle: 'Native' }), createEntry({ title: 'German', subtitle: 'C1' })] });
  r.sections.push(langs);
  return r;
}

/** Same layout with fresh section ids, as `duplicateResume` produces. */
function variant(src: ResumeDoc): ResumeDoc {
  const copy = structuredClone(src);
  copy.id = 'res_b';
  copy.sections = copy.sections.map((s, i) => ({ ...s, id: `rs_b_${i}`, entries: s.entries.map((e, k) => ({ ...e, id: `ent_b_${i}_${k}` })) }));
  return copy;
}

const lib = sampleLibrary();
const profile = sampleProfile();
const cmp = (a: ResumeDoc, b: ResumeDoc) => compareResumes({ a, b, library: lib, profile });
const section = (c: ReturnType<typeof cmp>, kind: string) => c.sections.find((s) => s.kind === kind)!;

describe('compareResumes', () => {
  it('two copies of the same resume have no differences', () => {
    const a = base();
    const c = cmp(a, variant(a));
    expect(hasContentChanges(c)).toBe(false);
    expect(c.summary.totalContent).toBe(0);
    expect(c.summary.designChanges).toBe(0);
    expect(c.sections.every((s) => s.status === 'same')).toBe(true);
  });

  it('detects a resume-only summary as a word-level change', () => {
    const a = base();
    const b = variant(a);
    b.sections.find((s) => s.kind === 'summary')!.text = profile.bio.replace('8 years', '9 years').replace('small teams', 'platform teams');
    const s = section(cmp(a, b), 'summary');
    expect(s.status).toBe('changed');
    expect(s.text!.ops.filter((o) => o.type === 'delete').map((o) => o.value)).toEqual(['8', 'small']);
    expect(s.text!.ops.filter((o) => o.type === 'insert').map((o) => o.value)).toEqual(['9', 'platform']);
  });

  it('honours detached fields: an override shows up as a changed bullet', () => {
    const a = base();
    const b = variant(a);
    const exp = b.sections.find((s) => s.kind === 'experience')!;
    const ref = createRef('exp_sample_1');
    ref.detached = ['achievements'];
    const bullets = [...lib.experience[0]!.achievements];
    bullets[0] = bullets[0]!.replace('3.8s to 1.1s', '3.8s to 0.9s');
    ref.overrides = { achievements: bullets };
    exp.refs = [ref];
    const c = cmp(a, b);
    const item = section(c, 'experience').items.find((i) => i.key === 'lib:exp_sample_1')!;
    expect(item.status).toBe('changed');
    const changed = item.bullets.filter((l) => l.status === 'changed');
    expect(changed).toHaveLength(1);
    expect(changed[0]!.ops.some((o) => o.type === 'insert' && o.value.includes('0.9s'))).toBe(true);
    expect(c.summary.entriesChanged).toBe(1);
  });

  it('reports hidden sections, hidden entries, reordering and added sections', () => {
    const a = base();
    const b = variant(a);
    b.sections.find((s) => s.kind === 'certifications')!.hidden = true;
    const proj = b.sections.find((s) => s.kind === 'projects')!;
    proj.autoInclude = false;
    proj.refs = [createRef('prj_sample_2'), createRef('prj_sample_1')];
    proj.refs[1]!.hidden = true;
    // Move education above experience.
    const eduIdx = b.sections.findIndex((s) => s.kind === 'education');
    const [edu] = b.sections.splice(eduIdx, 1);
    b.sections.splice(2, 0, edu!);
    b.sections.push(createResumeSection('interests', { entries: [createEntry({ title: 'Climbing' })] }));

    const c = cmp(a, b);
    const certs = section(c, 'certifications');
    expect(certs.status).toBe('removed');
    expect(certs.presence.b).toBe('hidden');
    expect(c.summary.sectionsHidden).toBe(1);

    const projects = section(c, 'projects');
    expect(projects.items.find((i) => i.key === 'lib:prj_sample_1')!.status).toBe('removed');
    expect(projects.items.find((i) => i.key === 'lib:prj_sample_2')!.status).toBe('same');

    expect(c.summary.sectionsMoved).toBeGreaterThanOrEqual(1);
    expect(c.sections.filter((s) => s.moved).some((s) => s.kind === 'education' || s.kind === 'experience')).toBe(true);
    expect(section(c, 'interests').status).toBe('added');
    expect(c.summary.sectionsAdded).toBe(1);
    // Printed order follows B.
    const order = c.sections.filter((s) => s.status !== 'removed').map((s) => s.kind);
    expect(order.indexOf('education')).toBeLessThan(order.indexOf('experience'));
  });

  it('compares skills as a set and design settings', () => {
    const a = base();
    const b = variant(a);
    const skills = b.sections.find((s) => s.kind === 'technical-skills')!;
    skills.skillIds = lib.skills.filter((s) => s.name !== 'Kafka').map((s) => s.id);
    b.templateId = 'slate-banner';
    b.style = { ...b.style, paper: 'letter', accent: '#0f766e' };
    const c = compareResumes({ a, b, library: lib, profile, templateName: (id) => id.toUpperCase() });
    const s = section(c, 'technical-skills');
    expect(s.skills!.removed).toEqual(['Kafka']);
    expect(s.skills!.added).toEqual([]);
    const changed = c.design.filter((d) => d.changed).map((d) => d.label);
    expect(changed).toEqual(expect.arrayContaining(['Template', 'Page size', 'Accent colour']));
    expect(c.design.find((d) => d.key === 'templateId')!.b).toBe('SLATE-BANNER');
    expect(c.design.find((d) => d.key === 'paper')!.b).toBe('US Letter');
  });

  it('pairs a renamed local entry as changed instead of removed + added', () => {
    const a = base();
    const b = variant(a);
    b.sections.find((s) => s.kind === 'languages')!.entries[1]!.subtitle = 'C2';
    const langs = section(cmp(a, b), 'languages');
    expect(langs.items.map((i) => i.status)).toEqual(['same', 'changed']);
  });
});

describe('diffLines', () => {
  it('keeps equal lines, pairs similar ones and flags the rest', () => {
    const d = diffLines(['Alpha beta gamma delta', 'Removed line entirely', 'Same'], ['Alpha beta gamma epsilon', 'Same', 'Brand new point']);
    expect(d.map((l) => l.status)).toEqual(['removed', 'changed', 'same', 'added']);
  });
});
