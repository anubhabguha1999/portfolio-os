import { describe, expect, it } from 'vitest';
import { createPortfolio } from '@/lib/portfolio-factory';
import type { Portfolio } from '@/types/portfolio';
import { emptyLibrary, emptyProfile } from '@/studio/model/defaults';
import { sampleLibrary, sampleProfile } from '@/studio/model/sample';
import { linkPortfolio, projectPortfolio, pullIntoPortfolio, pushChanges } from '@/studio/sync/portfolio';

function withProject(p: Portfolio, title: string, id = 'prj_dhms'): Portfolio {
  return {
    ...p,
    sections: p.sections.map((s) =>
      s.type === 'projects' ? { ...s, data: { ...s.data, items: [{ ...s.data.items[0]!, id, title, technologies: ['Go'], caseStudy: 'Long write-up', gallery: [] }] } } : s,
    ),
  };
}

function projectTitle(p: Portfolio, id = 'prj_dhms'): string | undefined {
  const s = p.sections.find((x) => x.type === 'projects');
  return s && s.type === 'projects' ? s.data.items.find((i) => i.id === id)?.title : undefined;
}

describe('portfolio ⇄ library sync', () => {
  it('linking imports portfolio items into an empty library and fills an empty profile', () => {
    const p = withProject(createPortfolio({ title: 'Site' }), 'DHMS');
    const res = linkPortfolio(p, emptyLibrary(), emptyProfile());
    expect(res.library.projects.find((x) => x.id === 'prj_dhms')?.title).toBe('DHMS');
    // Resume-specific fields exist alongside the portfolio copy.
    expect(res.library.projects.find((x) => x.id === 'prj_dhms')?.resumeBullets).toEqual([]);
    const hero = p.sections.find((s) => s.type === 'hero');
    if (hero?.type === 'hero') expect(res.profile.name).toBe(hero.data.name);
  });

  it('library values win on link and profile edits flow into the portfolio', () => {
    const p = withProject(createPortfolio({ title: 'Site' }), 'Old title');
    const lib = { ...emptyLibrary(), projects: [{ ...sampleLibrary().projects[0]!, id: 'prj_dhms', title: 'DHMS' }] };
    const res = linkPortfolio(p, lib, { ...sampleProfile() });
    expect(projectTitle(res.portfolio)).toBe('DHMS');
    const hero = res.portfolio.sections.find((s) => s.type === 'hero');
    expect(hero?.type === 'hero' && hero.data.name).toBe('Alex Morgan');
  });

  it('pull never touches portfolio-only data', () => {
    const p = withProject(createPortfolio({ title: 'Site' }), 'DHMS');
    const lib = { ...emptyLibrary(), projects: [{ ...sampleLibrary().projects[0]!, id: 'prj_dhms', title: 'DHMS v2' }] };
    const pulled = pullIntoPortfolio(p, lib, emptyProfile());
    const s = pulled.sections.find((x) => x.type === 'projects');
    expect(s?.type === 'projects' && s.data.items[0]!.caseStudy).toBe('Long write-up');
    expect(projectTitle(pulled)).toBe('DHMS v2');
  });

  it('push writes only fields changed in the builder (no stale overwrite)', () => {
    const p = withProject(createPortfolio({ title: 'Site' }), 'DHMS');
    const linked = linkPortfolio(p, emptyLibrary(), emptyProfile());
    const before = projectPortfolio(linked.portfolio);
    // Resume Studio changes technologies in the library meanwhile.
    const lib = { ...linked.library, projects: linked.library.projects.map((x) => (x.id === 'prj_dhms' ? { ...x, technologies: ['Go', 'Kafka'] } : x)) };
    // The builder then renames the project.
    const edited = withProject(linked.portfolio, 'DHMS Platform');
    const res = pushChanges(before, projectPortfolio(edited), lib, linked.profile);
    const prj = res.library.projects.find((x) => x.id === 'prj_dhms')!;
    expect(prj.title).toBe('DHMS Platform');
    expect(prj.technologies).toEqual(['Go', 'Kafka']);
    expect(res.changed).toBe(true);
  });

  it('push adds new portfolio items and ignores deletions', () => {
    const p = withProject(createPortfolio({ title: 'Site' }), 'DHMS');
    const linked = linkPortfolio(p, emptyLibrary(), emptyProfile());
    const before = projectPortfolio(linked.portfolio);
    const withNew = withProject(linked.portfolio, 'Typeset', 'prj_new');
    const res = pushChanges(before, projectPortfolio(withNew), linked.library, linked.profile);
    expect(res.library.projects.map((x) => x.id).sort()).toEqual(['prj_dhms', 'prj_new']);
  });

  it('profile changes from the builder reach the shared profile', () => {
    const p = createPortfolio({ title: 'Site' });
    const linked = linkPortfolio(p, emptyLibrary(), sampleProfile());
    const before = projectPortfolio(linked.portfolio);
    const renamed: Portfolio = { ...linked.portfolio, sections: linked.portfolio.sections.map((s) => (s.type === 'hero' ? { ...s, data: { ...s.data, name: 'Anubhab' } } : s)) };
    const res = pushChanges(before, projectPortfolio(renamed), linked.library, linked.profile);
    expect(res.profile.name).toBe('Anubhab');
    expect(res.profile.email).toBe('alex.morgan@example.com');
  });
});
