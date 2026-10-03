import { describe, it, expect } from 'vitest';
import {
  LINKEDIN_LIMITS,
  aboutVariants,
  experienceDescription,
  featuredSuggestions,
  generateLinkedIn,
  headlineVariants,
  linkedinSkills,
  sourceFromProfile,
  sourceFromResume,
  truncateAtWord,
  yearsOfExperience,
  type LinkedInSource,
} from '@/lib/linkedin';
import { createLibSkill } from '@/studio/model/defaults';
import { createRef, createResume } from '@/studio/model/defaults';
import { resolveResume } from '@/studio/model/resolve';
import { sampleLibrary, sampleProfile, SAMPLE_PERSONAS } from '@/studio/model/sample';

const TODAY = new Date('2026-10-01T00:00:00Z');
const src = () => sourceFromProfile(sampleProfile(), sampleLibrary());

describe('truncateAtWord', () => {
  it('leaves short text alone', () => {
    expect(truncateAtWord('hello world', 20)).toBe('hello world');
  });
  it('cuts at a word boundary and adds an ellipsis within the limit', () => {
    const out = truncateAtWord('The quick brown fox jumps over the lazy dog', 20);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out).toBe('The quick brown fox…');
  });
  it('never leaves dangling punctuation before the ellipsis', () => {
    expect(truncateAtWord('alpha, beta, gamma, delta', 14)).toBe('alpha, beta…');
  });
  it('hard-cuts a single long word', () => {
    const out = truncateAtWord('x'.repeat(50), 10);
    expect(out).toBe(`${'x'.repeat(9)}…`);
  });
});

describe('generateLinkedIn — limits', () => {
  it('every block respects LinkedIn limits, for every sample persona', () => {
    for (const p of SAMPLE_PERSONAS) {
      const b = generateLinkedIn(sourceFromProfile(p.profile(), p.library()), TODAY);
      expect(b.headlines.length).toBeGreaterThanOrEqual(3);
      for (const h of b.headlines) expect(h.text.length).toBeLessThanOrEqual(LINKEDIN_LIMITS.headline);
      expect(b.about.map((a) => a.id)).toEqual(['story', 'concise', 'skills']);
      for (const a of b.about) expect(a.text.length).toBeLessThanOrEqual(LINKEDIN_LIMITS.about);
      for (const e of b.experience) expect(e.description.length).toBeLessThanOrEqual(LINKEDIN_LIMITS.experienceDescription);
      expect(b.skills.length).toBeLessThanOrEqual(LINKEDIN_LIMITS.skills);
    }
  });

  it('stays within limits on oversized input', () => {
    const s: LinkedInSource = {
      ...src(),
      headline: 'Principal Distributed Systems Engineer and Technical Lead for Platform Reliability '.repeat(5),
      summary: 'I build reliable platforms that scale to millions of users every single day. '.repeat(80),
    };
    s.roles = s.roles.map((r) => ({ ...r, bullets: Array.from({ length: 40 }, (_, i) => `Delivered improvement number ${i} that reduced costs by ${i}% across many teams and services worldwide.`) }));
    const b = generateLinkedIn(s, TODAY);
    for (const h of b.headlines) expect(h.text.length).toBeLessThanOrEqual(LINKEDIN_LIMITS.headline);
    for (const a of b.about) {
      expect(a.text.length).toBeLessThanOrEqual(LINKEDIN_LIMITS.about);
      expect(a.text).toMatch(/alex\.morgan@example\.com/); // call to action survives truncation
    }
    for (const e of b.experience) {
      expect(e.description.length).toBeLessThanOrEqual(LINKEDIN_LIMITS.experienceDescription);
      // Cut at whole bullets: every bullet line is complete.
      for (const line of e.description.split('\n').filter((l) => l.startsWith('• '))) expect(line).toMatch(/\.$/);
    }
  });

  it('caps skills at 50', () => {
    const lib = sampleLibrary();
    lib.skills = Array.from({ length: 80 }, (_, i) => createLibSkill({ name: `Skill ${i}` }));
    expect(linkedinSkills(sourceFromProfile(sampleProfile(), lib))).toHaveLength(50);
  });
});

describe('content', () => {
  it('formats experience with LinkedIn-safe bullets', () => {
    const d = experienceDescription({ description: 'Lead engineer.', bullets: ['Shipped A', 'Shipped B.'], tags: ['Go'] });
    expect(d).toBe('Lead engineer.\n\n• Shipped A.\n• Shipped B.\n\nSkills: Go');
  });

  it('dedupes skills case-insensitively and keeps listed skills first', () => {
    const s = src();
    s.skills = [
      { name: 'React', level: 3, category: '' },
      { name: 'react', level: 5, category: '' },
      { name: ' TypeScript ', level: 5, category: '' },
    ];
    const skills = linkedinSkills(s);
    expect(skills.filter((n) => n.toLowerCase() === 'react')).toHaveLength(1);
    expect(skills.slice(0, 2)).toEqual(['React', 'TypeScript']);
    // Technologies from roles/projects that were not listed are appended once.
    expect(skills).toContain('Node.js');
    expect(new Set(skills.map((n) => n.toLowerCase())).size).toBe(skills.length);
  });

  it('builds headlines from role, skills and experience', () => {
    const h = headlineVariants(src(), TODAY);
    expect(h[0]!.text.startsWith('Senior Full-Stack Engineer | ')).toBe(true);
    expect(h.find((v) => v.id === 'role-company')!.text).toContain('Senior Full-Stack Engineer at Northwind Health');
    expect(new Set(h.map((v) => v.text)).size).toBe(h.length);
  });

  it('about includes highlights with metrics and a call to action', () => {
    const story = aboutVariants(src(), TODAY).find((a) => a.id === 'story')!.text;
    expect(story).toContain('• Cut median page load from 3.8s to 1.1s');
    expect(story).toContain("Let's connect — reach me at alex.morgan@example.com or alexmorgan.dev.");
  });

  it('counts merged years of experience', () => {
    expect(yearsOfExperience(src(), TODAY)).toBe(10);
  });

  it('suggests featured links without duplicates', () => {
    const f = featuredSuggestions(src());
    expect(f.map((l) => l.kind)).toEqual(['project', 'project', 'website']);
  });

  it('is deterministic', () => {
    expect(generateLinkedIn(src(), TODAY)).toEqual(generateLinkedIn(src(), TODAY));
  });

  it('can source from a resume (its headline, entries and detached copy)', () => {
    const lib = sampleLibrary();
    const profile = sampleProfile();
    const r = createResume('Backend');
    r.headline = 'Backend Engineer';
    const exp = r.sections.find((s) => s.kind === 'experience')!;
    exp.autoInclude = false;
    const ref = createRef('exp_sample_1');
    ref.detached = ['achievements'];
    ref.overrides = { achievements: ['Scaled the booking service to 5M appointments a month.'] };
    exp.refs = [ref];
    const s = sourceFromResume(resolveResume(r, lib, profile), profile);
    expect(s.headline).toBe('Backend Engineer');
    expect(s.roles).toHaveLength(1);
    expect(s.roles[0]!.bullets).toEqual(['Scaled the booking service to 5M appointments a month.']);
    expect(generateLinkedIn(s, TODAY).headlines[0]!.text.startsWith('Backend Engineer')).toBe(true);
  });
});
