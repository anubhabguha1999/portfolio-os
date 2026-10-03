import { describe, it, expect } from 'vitest';
import { resolveResume } from '@/studio/model/resolve';
import { createResume } from '@/studio/model/defaults';
import { sampleLibrary, sampleProfile } from '@/studio/model/sample';
import {
  answerWords,
  countWords,
  emptyAnswer,
  extractMetrics,
  formatDuration,
  generateQuestions,
  mentionedTerms,
  shuffle,
  skillQuestions,
  speakingSeconds,
  startsWithActionVerb,
} from '@/lib/interview/questions';
import { loadAnswers, normalizeAnswers, saveAnswers } from '@/lib/interview/answers';

const resolved = () => resolveResume(createResume('Sample'), sampleLibrary(), sampleProfile());

describe('interview question generation', () => {
  it('builds STAR prompts from experience bullets, with metrics as tags', () => {
    const qs = generateQuestions(resolved());
    const exp = qs.filter((q) => q.category === 'experience');
    const cut = exp.find((q) => q.text.startsWith('Tell me about a time you cut median page load'));
    expect(cut).toBeTruthy();
    expect(cut!.text).toContain('at Northwind Health');
    expect(cut!.tags).toEqual(expect.arrayContaining(['3.8s', '1.1s', '60%']));
    expect(cut!.hint).toMatch(/measured/);
    expect(exp.some((q) => q.text.includes('Why are you looking to leave Northwind Health'))).toBe(true);
    expect(exp.some((q) => q.text.includes('TypeScript, React and Node.js'))).toBe(true);
  });

  it('covers projects, skills and the general bank', () => {
    const qs = generateQuestions(resolved());
    expect(qs.some((q) => q.category === 'project' && q.text.startsWith('Walk me through DHMS'))).toBe(true);
    expect(qs.some((q) => q.category === 'project' && q.text.includes('50k events/s'))).toBe(true);
    const skill = qs.filter((q) => q.category === 'skill');
    expect(skill.some((q) => q.source.startsWith('TypeScript'))).toBe(true);
    expect(qs.some((q) => q.category === 'general' && q.text === 'Tell me about yourself.')).toBe(true);
    expect(qs.some((q) => q.category === 'company')).toBe(false);
  });

  it('is deterministic with unique, stable ids', () => {
    const a = generateQuestions(resolved());
    const b = generateQuestions(resolved());
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
    expect(new Set(a.map((q) => q.id)).size).toBe(a.length);
  });

  it('adds company, role and job-description questions for an application', () => {
    const qs = generateQuestions(resolved(), { company: 'Globex', role: 'Staff Engineer', jobDescription: 'We use TypeScript, Kubernetes and PostgreSQL at scale.' });
    const co = qs.filter((q) => q.category === 'company');
    expect(co[0]!.text).toBe('Why do you want to work at Globex?');
    expect(co.some((q) => q.text.includes('Staff Engineer'))).toBe(true);
    expect(co.some((q) => q.text.startsWith('This role calls for TypeScript'))).toBe(true);
    expect(co.some((q) => q.text.includes('PostgreSQL'))).toBe(true);
    expect(co.some((q) => q.text.includes('mentions kubernetes'))).toBe(true);
  });

  it('works for an empty profile (general bank only)', () => {
    const empty = resolveResume(createResume('Empty'), { ...sampleLibrary(), experience: [], projects: [], skills: [], achievements: [] }, sampleProfile());
    const qs = generateQuestions(empty);
    expect(qs.length).toBeGreaterThan(5);
    expect(qs.every((q) => q.category === 'general')).toBe(true);
  });
});

describe('helpers', () => {
  it('detects action verbs and metrics', () => {
    expect(startsWithActionVerb('Designed an event-sourced service')).toBe(true);
    expect(startsWithActionVerb('Led a team')).toBe(true);
    expect(startsWithActionVerb('Processes 50k events/s')).toBe(false);
    expect(extractMetrics('Grew revenue by $1.2m and 35% with 9 engineers')).toEqual(['$1.2m', '35%', '9 engineers']);
  });

  it('skill bank with category fallback', () => {
    expect(skillQuestions('React', 'Frontend')[0]).toMatch(/state/);
    expect(skillQuestions('Svelte', 'Frontend')[0]).toContain('Svelte');
    expect(skillQuestions('Cobol', '')[0]).toContain('Cobol');
  });

  it('matches whole terms in text', () => {
    expect(mentionedTerms('Experience with Go and Node.js required', ['Go', 'Node.js', 'Rust', 'Google'])).toEqual(['Go', 'Node.js']);
    expect(mentionedTerms('good communication', ['Go'])).toEqual([]);
  });

  it('counts words and estimates speaking time', () => {
    expect(countWords('  one two\nthree ')).toBe(3);
    expect(answerWords({ ...emptyAnswer(), situation: 'a b', result: 'c' })).toBe(3);
    expect(speakingSeconds(300)).toBe(120);
    expect(formatDuration(125)).toBe('2:05');
  });

  it('shuffles deterministically by seed', () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(shuffle(xs, 42)).toEqual(shuffle(xs, 42));
    expect([...shuffle(xs, 7)].sort()).toEqual(xs);
  });
});

describe('answer storage', () => {
  it('round-trips and normalises answers in meta', async () => {
    await saveAnswers({ q1: { ...emptyAnswer(), situation: 'S', confidence: 3, updatedAt: 'now' } });
    const back = await loadAnswers();
    expect(back.q1!.situation).toBe('S');
    expect(back.q1!.confidence).toBe(3);
    expect(normalizeAnswers({ a: { confidence: 9, task: 5 }, b: 'x' })).toEqual({ a: { ...emptyAnswer() } });
  });
});
