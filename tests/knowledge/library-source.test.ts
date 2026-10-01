import { describe, expect, it } from 'vitest';
import { adoptCandidates, describe as describeItem, type Candidate } from '@/knowledge/import/library-source';
import { insertIntoPortfolio } from '@/features/builder/knowledge';
import { createLibExperience, createLibProject, emptyLibrary } from '@/studio/model/defaults';
import { createPortfolio } from '@/lib/portfolio-factory';

const src = { docId: 'kdoc1', docName: 'Resume.pdf', page: 1, blockId: 'b4' };

function cand(kind: Candidate['kind'], value: object, libraryId: string | null = null): Candidate {
  return { key: `k${Math.random()}`, kind, value: value as Record<string, unknown>, ...describeItem(kind, value as Record<string, unknown>), confidence: 0.9, source: libraryId ? null : src, libraryId };
}

describe('adoptCandidates', () => {
  it('adds new detections to the library with provenance', () => {
    const lib = emptyLibrary();
    const project = createLibProject({ title: 'Vehicle Management System', technologies: ['React', 'Node.js'] });
    const res = adoptCandidates(lib, [cand('projects', project)]);
    expect(res.added).toBe(1);
    expect(res.library.projects).toHaveLength(1);
    const id = res.picks[0]!.id;
    expect(res.library.projects[0]!.id).toBe(id);
    expect(id).not.toBe(project.id);
    const title = res.provenance.find((p) => p.field === 'title');
    expect(title).toMatchObject({ kind: 'projects', itemId: id, original: 'Vehicle Management System', source: src });
    expect(lib.projects).toHaveLength(0);
  });

  it('reuses library items and detected duplicates instead of copying them', () => {
    const existing = createLibExperience({ role: 'Senior Software Developer', company: 'SoftSensor AI' });
    const lib = { ...emptyLibrary(), experience: [existing] };
    const res = adoptCandidates(lib, [cand('experience', { ...existing }, existing.id), cand('experience', { ...existing, role: 'Edited elsewhere' }, existing.id)]);
    expect(res.added).toBe(0);
    expect(res.library.experience).toEqual([existing]);
    expect(res.picks.map((p) => p.id)).toEqual([existing.id, existing.id]);
    expect(res.provenance).toEqual([]);
  });

  it('adds the item when its duplicate was deleted from the library meanwhile', () => {
    const res = adoptCandidates(emptyLibrary(), [cand('experience', createLibExperience({ role: 'Dev' }), 'exp_gone')]);
    expect(res.added).toBe(1);
  });
});

describe('insertIntoPortfolio', () => {
  it('appends to the matching section, keeping library ids and skipping items already there', () => {
    const p = createPortfolio({ sections: ['hero', 'projects', 'contact'] });
    const sec = p.sections.find((s) => s.type === 'projects')!;
    const project = createLibProject({ title: 'Vehicle Management System', technologies: ['React'], description: 'Fleet tracking' });
    const lib = { ...emptyLibrary(), projects: [project] };
    const before = (sec.data as unknown as { items: unknown[] }).items.length;
    const res = insertIntoPortfolio(p, lib, [{ kind: 'projects', id: project.id }]);
    const items = (res.portfolio.sections.find((s) => s.id === sec.id)!.data as unknown as { items: Array<Record<string, unknown>> }).items;
    expect(items).toHaveLength(before + 1);
    expect(items.at(-1)).toMatchObject({ id: project.id, title: 'Vehicle Management System', technologies: ['React'], description: 'Fleet tracking' });
    expect(res.sections.projects).toBe(sec.id);
    const again = insertIntoPortfolio(res.portfolio, lib, [{ kind: 'projects', id: project.id }]);
    expect(again.added).toBe(0);
  });

  it('creates a missing section before Contact', () => {
    const p = createPortfolio({ sections: ['hero', 'contact'] });
    const exp = createLibExperience({ role: 'Senior Software Developer', company: 'SoftSensor AI' });
    const res = insertIntoPortfolio(p, { ...emptyLibrary(), experience: [exp] }, [{ kind: 'experience', id: exp.id }]);
    const order = [...res.portfolio.sections].sort((a, b) => a.order - b.order).map((s) => s.type);
    expect(order).toEqual(['hero', 'experience', 'contact']);
    const items = (res.portfolio.sections.find((s) => s.type === 'experience')!.data as unknown as { items: Array<{ id: string }> }).items;
    expect(items.map((i) => i.id)).toEqual([exp.id]);
  });

  it('does not touch locked sections', () => {
    const p = createPortfolio({ sections: ['projects'] });
    p.sections[0]!.locked = true;
    const project = createLibProject({ title: 'X' });
    const res = insertIntoPortfolio(p, { ...emptyLibrary(), projects: [project] }, [{ kind: 'projects', id: project.id }]);
    expect(res.added).toBe(0);
    expect(res.locked).toEqual([p.sections[0]!.name]);
  });
});
