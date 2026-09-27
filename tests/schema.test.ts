import { describe, it, expect } from 'vitest';
import { parsePortfolio, PortfolioValidationError } from '@/schemas/portfolio';
import { migrate } from '@/schemas/migrations';
import { createPortfolio } from '@/lib/portfolio-factory';
import { SCHEMA_VERSION } from '@/config/brand';

describe('schema validation & migration', () => {
  it('rejects corrupted input with readable issues', () => {
    expect(() => parsePortfolio({ foo: 1 })).toThrow(PortfolioValidationError);
    try {
      parsePortfolio({ id: 'x', version: '2.0.0', metadata: {}, theme: {}, settings: {}, sections: 'nope' });
    } catch (e) {
      expect((e as PortfolioValidationError).issues.join(' ')).toMatch(/sections/);
    }
  });

  it('fills missing fields with defaults and drops unknown sections', () => {
    const raw = {
      id: 'pf1',
      version: '2.0.0',
      metadata: { title: 'T' },
      theme: { id: 'editorial' },
      settings: {},
      sections: [
        { id: 'a', type: 'hero', data: { name: 'N' } },
        { id: 'b', type: 'nonsense', data: {} },
        { id: 'c', type: 'projects', data: { items: [{ title: 'P' }, { title: 'Q', technologies: 'bad' }] } },
      ],
    };
    const { portfolio, warnings } = parsePortfolio(raw);
    expect(portfolio.sections.map((s) => s.type)).toEqual(['hero', 'projects']);
    expect(warnings[0]).toMatch(/nonsense/);
    const prj = portfolio.sections[1]!;
    if (prj.type !== 'projects') throw new Error('type');
    expect(prj.data.items).toHaveLength(2);
    expect(prj.data.items[0]!.id).toBeTruthy();
    expect(prj.data.items[1]!.technologies).toEqual([]);
    expect(prj.data.layout).toBe('grid');
    expect(portfolio.theme.id).toBe('editorial');
    expect(portfolio.theme.palettes.light.primary).toMatch(/^#/);
  });

  it('migrates v1 projects to the current schema', () => {
    const v1 = {
      version: '1.2.0',
      title: 'Old',
      theme: 'cyberpunk',
      profile: { name: 'Legacy Person', headline: 'Dev', bio: 'Hi', email: 'l@example.com' },
      sections: [{ id: 's1', type: 'about', visible: true, content: { heading: 'Me', body: 'Text' } }, { id: 's2', type: 'skills', visible: false, content: {} }],
    };
    const m = migrate(v1);
    expect(m.from).toBe('1.2.0');
    const { portfolio, migratedFrom } = parsePortfolio(v1);
    expect(migratedFrom).toBe('1.2.0');
    expect(portfolio.version).toBe(SCHEMA_VERSION);
    expect(portfolio.theme.id).toBe('cyberpunk');
    expect(portfolio.sections.map((s) => s.type)).toEqual(['hero', 'about', 'skills', 'contact']);
    expect(portfolio.sections.find((s) => s.type === 'skills')!.enabled).toBe(false);
    const hero = portfolio.sections[0]!;
    if (hero.type === 'hero') expect(hero.data.name).toBe('Legacy Person');
  });

  it('refuses projects from a newer major version', () => {
    const p = { ...createPortfolio(), version: '9.0.0' };
    expect(() => parsePortfolio(p)).toThrow(/newer version/);
  });

  it('de-duplicates ids and anchors', () => {
    const p = createPortfolio({ sections: ['about', 'about'] });
    p.sections[1]!.id = p.sections[0]!.id;
    p.sections[1]!.style.anchor = p.sections[0]!.style.anchor;
    const { portfolio } = parsePortfolio(JSON.parse(JSON.stringify(p)));
    expect(new Set(portfolio.sections.map((s) => s.id)).size).toBe(2);
    expect(new Set(portfolio.sections.map((s) => s.style.anchor)).size).toBe(2);
  });
});
