import { describe, it, expect } from 'vitest';
import { stem, tokenize, splitBullets } from '@/lib/writing/text';
import { canonicalTerm } from '@/lib/writing/dictionary';
import { corpusHas, corpusOf, extractJobKeywords, matchDictionary, weightOf, zoneLines } from '@/lib/writing/keywords';
import { analyzeJobMatch, experienceMonths, guessJobTitle, seniorityOf, titleAlignment, titleCore, yearsRequirements } from '@/lib/writing/match';
import { resolveResume } from '@/studio/model/resolve';
import { createLibExperience, createLibSkill, createRef, createResume, createResumeSection, emptyLibrary, emptyProfile } from '@/studio/model/defaults';

const JD = `Senior Frontend Engineer

About the role
You will build accessible web apps with React and TypeScript, working closely with design.

Requirements
- 5+ years of experience with JavaScript and React
- Strong knowledge of k8s and Docker
- Excellent communication skills
- Experience with design systems and design systems tooling

Nice to have
- GraphQL
- Experience with Retool

Benefits
- Free Python lessons and unlimited PTO`;

describe('text utilities', () => {
  it('tokenises tech words and marks boundaries', () => {
    const t = tokenize('Node.js, C++ and CI/CD. React');
    expect(t.map((x) => x.text)).toEqual(['node.js', 'c++', 'and', 'ci/cd', 'react']);
    expect(t.map((x) => x.boundary)).toEqual([true, true, false, false, true]);
  });
  it('stems common inflections', () => {
    expect(stem('developers')).toBe(stem('developer'));
    expect(stem('testing')).toBe('test');
    expect(stem('libraries')).toBe('library');
    expect(stem('running')).toBe('run');
    expect(stem('kubernetes')).toBe('kubernetes');
  });
  it('splits pasted bullets', () => {
    expect(splitBullets('• one\n- two\n\n3. three\n* four')).toEqual(['one', 'two', 'three', 'four']);
  });
});

describe('dictionary & synonyms', () => {
  it('normalises synonyms to one canonical name', () => {
    expect(canonicalTerm('k8s')?.canonical).toBe('Kubernetes');
    expect(canonicalTerm('JS')?.canonical).toBe('JavaScript');
    expect(canonicalTerm('javascript')?.canonical).toBe('JavaScript');
    expect(canonicalTerm('React.js')?.canonical).toBe('React');
    expect(canonicalTerm('Postgres')?.canonical).toBe('PostgreSQL');
    expect(canonicalTerm('golang')?.canonical).toBe('Go');
    expect(canonicalTerm('node')?.canonical).toBe('Node.js');
  });
  it('classifies kinds', () => {
    expect(canonicalTerm('Python')?.kind).toBe('hard');
    expect(canonicalTerm('Docker')?.kind).toBe('tool');
    expect(canonicalTerm('teamwork')?.kind).toBe('soft');
  });
  it('ignores ambiguous everyday words unless written as the technology', () => {
    const names = (s: string) => matchDictionary(tokenize(s)).map((m) => m.canonical);
    expect(names('ready to go to market and rest')).not.toContain('Go');
    expect(names('ready to go to market and rest')).not.toContain('REST APIs');
    expect(names('Services in Go and REST')).toEqual(expect.arrayContaining(['Go', 'REST APIs']));
    expect(names('express your ideas')).not.toContain('Express');
  });
  it('prefers the longest match (React Native over React)', () => {
    expect(matchDictionary(tokenize('React Native apps')).map((m) => m.canonical)).toEqual(['React Native']);
  });
});

describe('job keyword extraction', () => {
  it('assigns zones from headings and inline cues', () => {
    const z = zoneLines(JD);
    expect(z.find((l) => l.line.includes('JavaScript'))!.zone).toBe('required');
    expect(z.find((l) => l.line.includes('GraphQL'))!.zone).toBe('preferred');
    expect(z.find((l) => l.line.includes('Python'))!.zone).toBe('skip');
    expect(z.find((l) => l.line.includes('accessible'))!.zone).toBe('general');
  });

  it('extracts grouped keywords, skips benefits, weights requirements higher', () => {
    const ks = extractJobKeywords(JD, { title: 'Senior Frontend Engineer' });
    const by = (k: string) => ks.find((x) => x.key === k);
    expect(by('React')?.kind).toBe('tool');
    expect(by('JavaScript')?.kind).toBe('hard');
    expect(by('Kubernetes')?.zone).toBe('required');
    expect(by('Communication')?.kind).toBe('soft');
    expect(by('GraphQL')?.zone).toBe('preferred');
    expect(by('Python')).toBeUndefined();
    expect(by('Kubernetes')!.weight).toBeGreaterThan(by('GraphQL')!.weight);
    expect(by('Design Systems')?.count).toBe(2);
    // Product-like capitalised word not in the dictionary.
    expect(ks.some((k) => k.kind === 'other' && k.label === 'retool')).toBe(true);
  });

  it('weight formula', () => {
    expect(weightOf('hard', 'required', 1, false)).toBe(4.5);
    expect(weightOf('tool', 'preferred', 1, false)).toBe(1.2);
    expect(weightOf('soft', 'general', 3, false)).toBe(1.4);
    expect(weightOf('hard', 'general', 1, true)).toBe(3.9);
  });

  it('corpus matching uses canonicals for dictionary terms', () => {
    const c = corpusOf(['Shipped services on Kubernetes'], ['js']);
    expect(corpusHas(c, { key: 'Kubernetes', kind: 'tool', forms: ['k8s'] })).toBe(true);
    expect(corpusHas(c, { key: 'JavaScript', kind: 'hard', forms: [] })).toBe(true);
    expect(corpusHas(c, { key: 'Go', kind: 'hard', forms: ['go'] })).toBe(false);
    expect(corpusHas(c, { key: 'ship servic', kind: 'other', forms: [tokenize('shipping services').map((t) => t.stem).join(' ')] })).toBe(true);
  });
});

describe('title, seniority and years', () => {
  it('guesses a title from the first line', () => {
    expect(guessJobTitle(JD)).toBe('Senior Frontend Engineer');
    expect(guessJobTitle('Job title: Data Analyst\nWe are…')).toBe('Data Analyst');
  });
  it('normalises title words', () => {
    expect(titleCore('Senior Front-End Developer')).toEqual(['frontend', 'engineer']);
    expect(titleCore('Front end engineer')).toEqual(['frontend', 'engineer']);
    const a = titleAlignment('Senior Frontend Engineer', [{ text: 'Front-End Developer', source: 'Headline' }]);
    expect(a.score).toBe(100);
    expect(a.jobSeniority?.label).toBe('Senior');
  });
  it('detects seniority', () => {
    expect(seniorityOf('Staff Engineer')?.level).toBe(4);
    expect(seniorityOf('Junior Designer')?.level).toBe(1);
    expect(seniorityOf('Product Designer')).toBeNull();
  });
  it('reads years requirements, ignoring unrelated numbers', () => {
    expect(yearsRequirements('5+ years of experience with React').map((y) => y.min)).toEqual([5]);
    expect(yearsRequirements('3-5 years experience in sales')[0]).toMatchObject({ min: 3, max: 5 });
    expect(yearsRequirements('at least three years building APIs')[0]?.min).toBe(3);
    expect(yearsRequirements('Founded 10 years ago, we…')).toEqual([]);
  });
});

function fixture() {
  const lib = emptyLibrary();
  const now = createLibExperience({ id: 'e1', role: 'Front-End Developer', company: 'Acme', start: '2021-01', current: true, achievements: ['Built React and TypeScript apps used by 2M users'], technologies: ['React', 'TypeScript', 'js'] });
  const old = createLibExperience({ id: 'e2', role: 'Developer', company: 'Old Co', start: '2019-01', end: '2020-12', achievements: ['Containerised services with Docker'], technologies: [] });
  lib.experience = [now, old];
  lib.skills = [createLibSkill({ id: 's1', name: 'GraphQL' }), createLibSkill({ id: 's2', name: 'Communication' })];
  const resume = createResume('Main');
  resume.headline = 'Front-End Developer';
  resume.sections = [createResumeSection('experience', { refs: [createRef('e1')], autoInclude: false }), createResumeSection('skills', { skillIds: ['s2'] })];
  const profile = { ...emptyProfile(), name: 'Ada' };
  return { lib, resume, profile, resolved: resolveResume(resume, lib, profile) };
}

describe('analyzeJobMatch', () => {
  it('scores weighted coverage and finds library-only keywords', () => {
    const { lib, profile, resolved } = fixture();
    const r = analyzeJobMatch({ jd: JD, resolved, library: lib, profile, now: new Date('2026-01-15') });
    const k = (key: string) => r.keywords.find((x) => x.key === key)!;
    expect(k('React').matched).toBe(true);
    expect(k('JavaScript').matched).toBe(true); // from the "js" tag
    expect(k('Communication').matched).toBe(true);
    expect(k('Docker').matched).toBe(false);
    expect(k('Docker').inLibrary).toEqual(['Experience · Developer at Old Co']);
    expect(k('GraphQL').inLibrary).toEqual(['Skill · GraphQL']);
    expect(k('Kubernetes').inLibrary).toEqual([]);
    const total = r.groups.reduce((s, g) => s + g.weightTotal, 0);
    const got = r.groups.reduce((s, g) => s + g.weightMatched, 0);
    expect(r.score).toBe(Math.round((got / total) * 100));
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(100);
    expect(r.title?.score).toBe(100);
    expect(r.years.required?.min).toBe(5);
    expect(Math.round(r.years.resumeMonths / 12)).toBe(5);
    expect(r.suggestions.some((s) => s.text.includes('Docker'))).toBe(true);
    expect(r.suggestions.some((s) => s.text.includes('Kubernetes') && s.level === 'high')).toBe(true);
    expect(r.explanation).toMatch(/weighted points/);
  });

  it('merges overlapping experience ranges', () => {
    const { lib, profile, resume } = fixture();
    resume.sections = [createResumeSection('experience', { autoInclude: true })];
    const resolved = resolveResume(resume, lib, profile);
    // 2019-01..2020-12 (24) + 2021-01..2026-01 (61)
    expect(experienceMonths(resolved, new Date('2026-01-15')).months).toBe(85);
  });

  it('empty posting yields a zero score with an explanation', () => {
    const { resolved } = fixture();
    const r = analyzeJobMatch({ jd: '', resolved });
    expect(r.score).toBe(0);
    expect(r.keywords).toEqual([]);
  });
});

describe('JobMatchPage', () => {
  it('analyses a pasted posting, remembers it per resume and keeps updatedAt', async () => {
    const { render, screen, waitFor, fireEvent } = await import('@testing-library/react');
    const { createElement } = await import('react');
    const { MemoryRouter } = await import('react-router-dom');
    const { saveResume, saveLibrary, getResume } = await import('@/studio/storage/repo');
    const { useWorkspace } = await import('@/studio/store/workspace');
    const { default: JobMatchPage } = await import('@/features/match/JobMatchPage');
    const { readJobMatch } = await import('@/features/match/useResumeChoice');
    const { lib, resume } = fixture();
    await saveLibrary(lib);
    const saved = await saveResume(resume);
    useWorkspace.setState({ library: lib });
    render(createElement(MemoryRouter, { initialEntries: [`/match?resume=${saved.id}`] }, createElement(JobMatchPage)));
    const box = await screen.findByLabelText('Job description');
    fireEvent.change(box, { target: { value: JD } });
    await waitFor(() => expect(screen.getByText('Match score')).toBeTruthy());
    expect(screen.getByText(/Already in your profile/i)).toBeTruthy();
    await waitFor(async () => expect(readJobMatch(await getResume(saved.id))?.jd).toBe(JD), { timeout: 3000 });
    expect((await getResume(saved.id))!.updatedAt).toBe(saved.updatedAt);
  });
});
