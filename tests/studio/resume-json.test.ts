import { describe, expect, it } from 'vitest';
import { ensureSectionsFor, importCounts, isoMonth, mergeLibrary, mergeProfile, parseResumeJson, personaToJsonResume, ResumeJsonError } from '@/studio/import/resume-json';
import { createResume, createResumeSection } from '@/studio/model/defaults';
import { getPersona, sampleLibrary, sampleProfile } from '@/studio/model/sample';
import { resolveResume } from '@/studio/model/resolve';
import { getResumeTemplate } from '@/studio/templates/resume';
import { renderFlowText } from '@/studio/engine/render-text';

const jsonResume = {
  basics: {
    name: 'Riya Kapoor',
    label: 'Product Designer',
    email: 'riya@example.com',
    summary: 'Designer who ships.',
    location: { city: 'Mumbai', countryCode: 'IN' },
    profiles: [
      { network: 'LinkedIn', username: 'riya-k', url: 'https://linkedin.com/in/riya-k' },
      { network: 'Evil', url: 'javascript:alert(1)' },
    ],
  },
  work: [
    { name: 'Acme', position: 'Senior Designer', startDate: '2022-03-01', highlights: ['Led the design system', ' '], location: 'Remote' },
    { name: 'Beta Labs', position: 'Designer', startDate: '2019-07', endDate: '2022-02' },
  ],
  education: [{ institution: 'Design School', studyType: 'B.Des', area: 'Interaction', startDate: '2015', endDate: '2019', score: '8.9 GPA' }],
  skills: [{ name: 'Design', keywords: ['Figma', 'Prototyping'] }, { name: 'Research', level: 'Advanced' }],
  projects: [{ name: 'Atlas', description: 'A **map** app', highlights: ['10k users'], keywords: ['React'], url: 'https://github.com/riya/atlas' }],
  languages: [{ language: 'English', fluency: 'Fluent' }],
  volunteer: [{ organization: 'Code Club', position: 'Mentor', startDate: '2020-01' }],
};

describe('resume JSON import', () => {
  it('maps JSON Resume into profile, library and resume-only entries', () => {
    const r = parseResumeJson(JSON.stringify(jsonResume));
    expect(r.source).toBe('json-resume');
    expect(r.profile).toMatchObject({ name: 'Riya Kapoor', headline: 'Product Designer', location: 'Mumbai, IN' });
    expect(r.profile.socialLinks.map((s) => s.url)).toEqual(['https://linkedin.com/in/riya-k']);
    expect(r.library.experience[0]).toMatchObject({ company: 'Acme', role: 'Senior Designer', start: '2022-03', current: true, achievements: ['Led the design system'] });
    expect(r.library.experience[1]).toMatchObject({ start: '2019-07', end: '2022-02', current: false });
    expect(r.library.education[0]).toMatchObject({ degree: 'B.Des', field: 'Interaction', grade: '8.9 GPA', start: '2015' });
    expect(r.library.skills.map((s) => [s.name, s.category])).toEqual([
      ['Figma', 'Design'],
      ['Prototyping', 'Design'],
      ['Research', ''],
    ]);
    expect(r.library.skills[2]!.level).toBe(4);
    expect(r.library.projects[0]).toMatchObject({ title: 'Atlas', resumeSummary: 'A **map** app', github: 'https://github.com/riya/atlas' });
    expect(r.entries.languages).toEqual([{ title: 'English', subtitle: 'Fluent' }]);
    expect(r.entries.volunteer?.[0]).toMatchObject({ title: 'Mentor', subtitle: 'Code Club' });
    expect(importCounts(r)).toMatchObject({ experience: 2, education: 1, projects: 1, skills: 3, languages: 1, other: 1 });
  });

  it('gives clear errors for bad input', () => {
    expect(() => parseResumeJson('{ nope')).toThrow(ResumeJsonError);
    expect(() => parseResumeJson('[1,2]')).toThrow(/JSON object/);
    expect(() => parseResumeJson('{"hello":"world"}')).toThrow(/No resume fields/);
    expect(() => parseResumeJson(' '.repeat(2 * 1024 * 1024 + 1))).toThrow(/2 MB/);
  });

  it('warns when the name is missing', () => {
    expect(parseResumeJson(JSON.stringify({ work: [{ name: 'X', position: 'Y' }] })).warnings.join(' ')).toMatch(/No name/);
  });

  it('ignores ids and non-string junk in the file', () => {
    const r = parseResumeJson(JSON.stringify({ basics: { name: { evil: true }, label: 42 }, work: [{ id: 'exp_fixed', name: 'A', position: 'B', highlights: [1, null, 'ok'] }] }));
    expect(r.profile.name).toBe('');
    expect(r.profile.headline).toBe('42');
    expect(r.library.experience[0]!.id).not.toBe('exp_fixed');
    expect(r.library.experience[0]!.achievements).toEqual(['1', 'ok']);
  });

  it('the downloadable sample round-trips through the importer', () => {
    const persona = getPersona('engineer-lead');
    const r = parseResumeJson(JSON.stringify(personaToJsonResume(persona)));
    const lib = persona.library();
    expect(r.profile.name).toBe(persona.profile().name);
    expect(r.library.experience.map((e) => e.company)).toEqual(lib.experience.map((e) => e.company));
    expect(r.library.experience[0]!.current).toBe(true);
    expect(r.library.education.map((e) => e.grade)).toEqual(lib.education.map((e) => e.grade));
    expect(r.library.skills.length).toBe(lib.skills.length);
    expect(r.entries.languages?.length).toBe(3);
  });

  it('reads a Portfolio OS resume export, including local sections', () => {
    const resume = createResume('R');
    resume.sections.push(createResumeSection('languages', { entries: [{ id: 'e1', title: 'French', subtitle: 'B2', date: '', location: '', url: '', description: '', bullets: [], hidden: false }] }));
    resume.sections.push(createResumeSection('custom', { title: 'Strengths', entries: [{ id: 'e2', title: 'Focus', subtitle: '', date: '', location: '', url: '', description: '', bullets: [], hidden: false }] }));
    const file = { format: 'portfolio-os-resume', version: 1, resume, profile: sampleProfile(), library: sampleLibrary() };
    const r = parseResumeJson(JSON.stringify(file));
    expect(r.source).toBe('portfolio-os');
    expect(r.library.experience.length).toBe(3);
    expect(r.entries.languages?.[0]).toMatchObject({ title: 'French', subtitle: 'B2' });
    expect(r.entries.Strengths?.[0]?.title).toBe('Focus');
  });

  it('merges without duplicates and only fills empty profile fields', () => {
    const r = parseResumeJson(JSON.stringify(personaToJsonResume(getPersona('classic'))));
    const merged = mergeLibrary(sampleLibrary(), r.library);
    expect(merged.experience.length).toBe(3);
    expect(merged.skills.length).toBe(sampleLibrary().skills.length);
    const p = mergeProfile({ ...sampleProfile(), headline: '' }, { ...r.profile, name: 'Someone Else', headline: 'New headline' });
    expect(p.name).toBe('Alex Morgan');
    expect(p.headline).toBe('New headline');
  });

  it('adds sections for imported content the template starter left out', () => {
    const r = parseResumeJson(JSON.stringify(jsonResume));
    const t = getResumeTemplate('navy-sidebar');
    const base = createResume('R', { templateId: t.id, sections: [createResumeSection('profile'), createResumeSection('experience')] });
    const out = ensureSectionsFor(base, r.library, r.entries, (kind, title) => createResumeSection(kind, title ? { title } : {}));
    const kinds = out.sections.map((s) => s.kind);
    expect(kinds).toEqual(expect.arrayContaining(['education', 'projects', 'technical-skills', 'languages', 'volunteer']));
    expect(kinds.filter((k) => k === 'experience').length).toBe(1);
    const txt = renderFlowText(t.compose(resolveResume({ ...out, style: { ...out.style, ...t.defaults } }, r.library, r.profile)));
    expect(txt).toContain('Code Club');
    expect(txt).toContain('Figma');
  });

  it('normalises ISO dates to months', () => {
    expect(isoMonth('2021-3-14')).toBe('2021-03');
    expect(isoMonth('2021')).toBe('2021');
    expect(isoMonth('Summer 2020')).toBe('Summer 2020');
  });
});
