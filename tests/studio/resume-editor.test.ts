import { beforeEach, describe, expect, it } from 'vitest';
import { createResume } from '@/studio/model/defaults';
import { sampleLibrary, sampleProfile } from '@/studio/model/sample';
import { resolveResume } from '@/studio/model/resolve';
import { saveResume, deleteAllStudioData } from '@/studio/storage/repo';
import { useResumeEditor } from '@/studio/store/resume-editor';
import { useWorkspace } from '@/studio/store/workspace';

async function setup() {
  await deleteAllStudioData();
  useWorkspace.getState().reset(sampleProfile(), sampleLibrary());
  const r = await saveResume(createResume('Test'));
  await useResumeEditor.getState().load(r.id);
  return r;
}

const ed = () => useResumeEditor.getState();
const expSection = () => ed().resume!.sections.find((s) => s.kind === 'experience')!;
const resolved = () => resolveResume(ed().resume!, useWorkspace.getState().library, useWorkspace.getState().profile);
const expItems = () => resolved().sections.find((s) => s.kind === 'experience')!.items;

describe('resume editor store', () => {
  beforeEach(async () => {
    useResumeEditor.setState({ resume: null, status: 'idle', past: [], future: [] });
    await setup();
  });

  it('shared field edits go to the library; detached edits stay on the resume', () => {
    const sec = expSection();
    const refId = `auto-exp_sample_1`;
    ed().setItemField(sec.id, refId, 'company', 'Northwind Group');
    expect(useWorkspace.getState().library.experience[0]!.company).toBe('Northwind Group');

    ed().toggleDetach(sec.id, refId, 'role', true);
    const ref = expSection().refs.find((r) => r.libId === 'exp_sample_1')!;
    expect(ref.detached).toContain('role');
    ed().setItemField(sec.id, ref.id, 'role', 'Staff Engineer');
    expect(useWorkspace.getState().library.experience[0]!.role).toBe('Senior Full-Stack Engineer');
    expect(expItems()[0]!.title).toBe('Staff Engineer');

    ed().toggleDetach(sec.id, ref.id, 'role', false);
    expect(expItems()[0]!.title).toBe('Senior Full-Stack Engineer');
  });

  it('undo reverts shared library edits too', () => {
    const sec = expSection();
    ed().setItemField(sec.id, 'auto-exp_sample_2', 'company', 'Changed');
    expect(useWorkspace.getState().library.experience[1]!.company).toBe('Changed');
    ed().undo();
    expect(useWorkspace.getState().library.experience[1]!.company).toBe('Brightline Studio');
    ed().redo();
    expect(useWorkspace.getState().library.experience[1]!.company).toBe('Changed');
  });

  it('hiding and reordering items materialises refs without touching the library', () => {
    const sec = expSection();
    ed().hideRef(sec.id, 'auto-exp_sample_2', true);
    expect(expItems().map((i) => i.libId)).toEqual(['exp_sample_1', 'exp_sample_3']);
    const first = expSection().refs.find((r) => r.libId === 'exp_sample_3')!;
    ed().moveRef(sec.id, first.id, 0);
    expect(expItems().map((i) => i.libId)).toEqual(['exp_sample_3', 'exp_sample_1']);
    expect(useWorkspace.getState().library.experience).toHaveLength(3);
  });

  it('sections can be added, duplicated, hidden, moved and removed', () => {
    const before = ed().resume!.sections.length;
    const id = ed().addSection('languages');
    ed().addEntry(id, { title: 'English', subtitle: 'Native' });
    ed().duplicateSection(id);
    expect(ed().resume!.sections.length).toBe(before + 2);
    ed().patchSection(id, { hidden: true });
    expect(resolved().sections.filter((s) => s.kind === 'languages')).toHaveLength(1);
    ed().moveSection(id, 1);
    expect(ed().resume!.sections[1]!.id).toBe(id);
    ed().removeSection(id);
    expect(ed().resume!.sections.some((s) => s.id === id)).toBe(false);
  });

  it('changing templates keeps content untouched', () => {
    const snapshot = JSON.stringify(ed().resume!.sections);
    ed().apply('Template', (r) => ({ ...r, templateId: 'creative' }));
    expect(JSON.stringify(ed().resume!.sections)).toBe(snapshot);
  });

  it('typography changes clear a previous fit result', () => {
    ed().setStyle({ fit: { font: 0.9, spacing: 0.6, margins: 0.7, lineHeight: -0.1 } });
    expect(ed().resume!.style.fit).not.toBeNull();
    ed().setStyle({ baseSize: 11 });
    expect(ed().resume!.style.fit).toBeNull();
  });
});
