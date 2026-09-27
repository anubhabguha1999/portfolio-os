import { describe, it, expect, beforeEach } from 'vitest';
import { useEditor } from '@/stores/editor';
import { createPortfolio } from '@/lib/portfolio-factory';

const ed = () => useEditor.getState();

describe('editor store', () => {
  beforeEach(() => {
    const p = createPortfolio({ sections: ['hero', 'about', 'projects', 'contact'] });
    ed().load(p.id, 'Test', p);
  });

  it('applies edits immutably and supports undo/redo', () => {
    const before = ed().portfolio!;
    const hero = before.sections.find((s) => s.type === 'hero')!;
    ed().updateSectionData(hero.id, 'name', 'Grace');
    const after = ed().portfolio!;
    expect(after).not.toBe(before);
    expect(after.sections.find((s) => s.id === hero.id)!.data).toMatchObject({ name: 'Grace' });
    // untouched sections keep identity (structural sharing)
    expect(after.sections[1]).toBe(before.sections[1]);
    ed().undo();
    expect(ed().portfolio).toBe(before);
    ed().redo();
    expect(ed().portfolio!.sections.find((s) => s.id === hero.id)!.data).toMatchObject({ name: 'Grace' });
  });

  it('coalesces rapid typing into a single history entry', () => {
    const hero = ed().portfolio!.sections[0]!;
    ed().updateSectionData(hero.id, 'name', 'G');
    ed().updateSectionData(hero.id, 'name', 'Gr');
    ed().updateSectionData(hero.id, 'name', 'Gra');
    expect(ed().past.length).toBe(1);
  });

  it('adds, duplicates, moves and removes sections with contiguous order', () => {
    const id = ed().addSection('skills', 1)!;
    let list = [...ed().portfolio!.sections].sort((a, b) => a.order - b.order);
    expect(list[1]!.id).toBe(id);
    const copy = ed().duplicateSection(id)!;
    list = [...ed().portfolio!.sections].sort((a, b) => a.order - b.order);
    expect(list[2]!.id).toBe(copy);
    expect(list[2]!.style.anchor).not.toBe(list[1]!.style.anchor);
    ed().moveSection(copy, 0);
    list = [...ed().portfolio!.sections].sort((a, b) => a.order - b.order);
    expect(list[0]!.id).toBe(copy);
    expect(list.map((s) => s.order)).toEqual(list.map((_, i) => i));
    expect(ed().removeSection(copy)).toBe(true);
    expect(ed().portfolio!.sections.some((s) => s.id === copy)).toBe(false);
  });

  it('enforces singletons', () => {
    expect(ed().addSection('hero')).toBeNull();
    expect(ed().rejection?.message).toMatch(/Only one Hero/);
  });

  it('prevents editing, moving and deleting locked sections', () => {
    const about = ed().portfolio!.sections.find((s) => s.type === 'about')!;
    ed().toggleLocked(about.id);
    expect(ed().updateSectionData(about.id, 'heading', 'X')).toBe(false);
    expect(ed().moveSection(about.id, 0)).toBe(false);
    expect(ed().removeSection(about.id)).toBe(false);
    expect(ed().rejection?.message).toMatch(/locked/);
    ed().toggleLocked(about.id);
    expect(ed().updateSectionData(about.id, 'heading', 'X')).toBe(true);
  });

  it('hides sections and switches themes', () => {
    const about = ed().portfolio!.sections.find((s) => s.type === 'about')!;
    ed().toggleEnabled(about.id);
    expect(ed().portfolio!.sections.find((s) => s.id === about.id)!.enabled).toBe(false);
    ed().setTheme('brutalist');
    expect(ed().portfolio!.theme.id).toBe('brutalist');
    expect(ed().saveState).toBe('dirty');
  });
});
