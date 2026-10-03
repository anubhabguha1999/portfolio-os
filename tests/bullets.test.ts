import { describe, it, expect } from 'vitest';
import { analyzeBullets, checkBullet, openingVerb, resumeBullets, tenseOf, verbLemma, type BulletRule } from '@/lib/writing/bullets';
import { resolveResume } from '@/studio/model/resolve';
import { createLibExperience, createRef, createResume, createResumeSection, emptyLibrary, emptyProfile } from '@/studio/model/defaults';

const rules = (t: string): BulletRule[] => checkBullet(t).map((f) => f.rule);
const GOOD = 'Cut checkout latency by 40% by caching pricing data in Redis across 12 services';

describe('single-bullet rules', () => {
  it('a strong bullet has no findings', () => {
    expect(checkBullet(GOOD)).toEqual([]);
  });

  it('weak openers come with stronger verbs', () => {
    for (const t of ['Responsible for the billing service used by 3 teams', 'Worked on the mobile app for 2 years', 'Helped migrate 4 services to AWS', 'Assisted with onboarding 10 new hires each quarter']) {
      const f = checkBullet(t).find((x) => x.rule === 'weak-opener');
      expect(f, t).toBeDefined();
      expect(f!.suggestions!.length).toBeGreaterThan(0);
    }
  });

  it('flags missing metrics (digits, %, $, number words count)', () => {
    expect(rules('Built an internal dashboard for the sales organisation')).toContain('no-metric');
    expect(rules('Built an internal dashboard used by twelve sales managers')).not.toContain('no-metric');
    expect(rules('Grew revenue by $2M through a new pricing page experiment')).not.toContain('no-metric');
  });

  it('flags length', () => {
    const long = `Built ${'a very detailed thing '.repeat(10)}that shipped in 3 weeks`;
    expect(rules(long)).toContain('too-long');
    expect(rules('Built 3 APIs')).toContain('too-short');
    expect(rules(GOOD)).not.toContain('too-long');
  });

  it('flags first-person pronouns', () => {
    expect(rules('I built 3 dashboards for the finance team at Acme')).toContain('pronoun');
    expect(rules('Shipped our 3 core features ahead of the launch date')).toContain('pronoun');
    expect(rules(GOOD)).not.toContain('pronoun');
  });

  it('flags filler words', () => {
    const f = checkBullet('Successfully delivered various features in order to grow usage by 20%').find((x) => x.rule === 'filler');
    expect(f?.message).toMatch(/successfully/);
    expect(f?.message).toMatch(/in order to/);
  });

  it('flags passive voice but not "was promoted"', () => {
    expect(rules('The new API was designed and launched to 5 partners')).toContain('passive');
    expect(rules('Reports were written for 20 clients every week by the team')).toContain('passive');
    expect(rules('Was promoted to team lead after 18 months in the role')).not.toContain('passive');
  });

  it('flags bullets that do not start with a verb', () => {
    expect(rules('The team shipped 4 releases on time every quarter')).toContain('no-verb');
  });
});

describe('verb morphology', () => {
  it('detects tense', () => {
    expect(tenseOf('led')).toBe('past');
    expect(tenseOf('optimized')).toBe('past');
    expect(tenseOf('lead')).toBe('present');
    expect(tenseOf('manages')).toBe('present');
    expect(tenseOf('building')).toBe('present');
    expect(tenseOf('the')).toBe('unknown');
  });
  it('lemmatises opening verbs', () => {
    expect(verbLemma('Led'.toLowerCase())).toBe('lead');
    expect(verbLemma('managed')).toBe('manage');
    expect(verbLemma('shipped')).toBe('ship');
    expect(verbLemma('built')).toBe('build');
    expect(openingVerb('Successfully led the team')).toBe('led');
  });
});

describe('set rules', () => {
  it('flags verbs repeated 3+ times (keeping the first use)', () => {
    const s = analyzeBullets([
      { id: 'a', text: 'Led migration of 5 services to Kubernetes in two quarters' },
      { id: 'b', text: 'Led a team of 4 engineers to ship the new billing flow' },
      { id: 'c', text: 'Leading the 3-person platform guild and its weekly reviews' },
    ]);
    expect(s.repeatedVerbs).toEqual([{ verb: 'lead', count: 3 }]);
    expect(s.bullets[0]!.findings.map((f) => f.rule)).not.toContain('repeated-verb');
    expect(s.bullets[1]!.findings.find((f) => f.rule === 'repeated-verb')?.suggestions).toContain('Spearheaded');
  });

  it('flags a verb repeated twice within one entry', () => {
    const s = analyzeBullets([
      { id: 'a', groupId: 'x', text: 'Built 3 dashboards for the finance team in Looker' },
      { id: 'b', groupId: 'x', text: 'Built a CI pipeline that cut deploy time by 50%' },
      { id: 'c', groupId: 'y', text: 'Designed onboarding flow that lifted activation by 12%' },
    ]);
    expect(s.bullets[1]!.findings.map((f) => f.rule)).toContain('repeated-verb');
  });

  it('past roles must use past tense', () => {
    const s = analyzeBullets([{ id: 'a', groupId: 'old', current: false, text: 'Manage 3 vendors and a $2M annual budget for IT' }]);
    const f = s.bullets[0]!.findings.find((x) => x.rule === 'tense');
    expect(f?.level).toBe('warn');
    expect(f?.suggestions).toEqual(['Managed']);
  });

  it('current role: flags the minority tense when mixed', () => {
    const s = analyzeBullets([
      { id: 'a', groupId: 'now', current: true, text: 'Lead a team of 6 engineers across 2 time zones' },
      { id: 'b', groupId: 'now', current: true, text: 'Own the payments roadmap worth $4M in annual revenue' },
      { id: 'c', groupId: 'now', current: true, text: 'Reduced incident count by 30% with better alerting' },
    ]);
    expect(s.bullets[2]!.findings.map((f) => f.rule)).toContain('tense');
    expect(s.bullets[0]!.findings.map((f) => f.rule)).not.toContain('tense');
  });

  it('a current role in consistent past tense is fine', () => {
    const s = analyzeBullets([
      { id: 'a', groupId: 'now', current: true, text: 'Led a team of 6 engineers across 2 time zones' },
      { id: 'b', groupId: 'now', current: true, text: 'Reduced incident count by 30% with better alerting' },
    ]);
    expect(s.counts.tense).toBeUndefined();
  });

  it('scores bullets and the set', () => {
    const s = analyzeBullets([
      { id: 'a', text: GOOD },
      { id: 'b', text: 'Responsible for stuff' },
    ]);
    expect(s.bullets[0]!.score).toBe(100);
    expect(s.bullets[1]!.score).toBeLessThan(60);
    expect(s.score).toBe(Math.round((s.bullets[0]!.score + s.bullets[1]!.score) / 2));
  });
});

describe('resumeBullets', () => {
  it('collects printed bullets with role context', () => {
    const lib = emptyLibrary();
    lib.experience = [
      createLibExperience({ id: 'e1', role: 'Engineer', company: 'Now Inc', start: '2022-01', current: true, achievements: ['Lead 2 squads', ''] }),
      createLibExperience({ id: 'e2', role: 'Intern', company: 'Old Co', start: '2020-01', end: '2020-06', achievements: ['Built a tool', 'Wrote docs'] }),
    ];
    const r = createResume('R');
    r.sections = [createResumeSection('experience', { refs: [createRef('e1'), createRef('e2')], maxBullets: 1 })];
    const bullets = resumeBullets(resolveResume(r, lib, emptyProfile()));
    expect(bullets.map((b) => [b.text, b.current])).toEqual([
      ['Lead 2 squads', true],
      ['Built a tool', false],
    ]);
    expect(bullets[0]!.itemLabel).toBe('Engineer · Now Inc');
  });
});

describe('BulletHelperPage', () => {
  it('checks pasted text in free-text mode', async () => {
    const { render, screen, fireEvent, waitFor } = await import('@testing-library/react');
    const { createElement } = await import('react');
    const { MemoryRouter } = await import('react-router-dom');
    const { default: BulletHelperPage } = await import('@/features/bullets/BulletHelperPage');
    render(createElement(MemoryRouter, { initialEntries: ['/bullets?mode=text'] }, createElement(BulletHelperPage)));
    fireEvent.change(screen.getByLabelText('Bullets'), { target: { value: '• Responsible for the checkout page\n- Cut page load time by 40% by lazy-loading 300 images' } });
    await waitFor(() => expect(screen.getAllByText('Weak opener').length).toBeGreaterThan(0));
    expect(screen.getByText(/2 bullets/)).toBeTruthy();
  });
});
