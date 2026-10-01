import { describe, it, expect } from 'vitest';
import { resolveResume } from '@/studio/model/resolve';
import { createRef, createResume, createResumeSection } from '@/studio/model/defaults';
import { sampleLibrary, sampleProfile } from '@/studio/model/sample';
import { duplicateResume, getResume, saveResume } from '@/studio/storage/repo';

function withProjects(refs: ReturnType<typeof createRef>[], autoInclude = false) {
  const r = createResume('R');
  r.sections = [createResumeSection('projects', { refs, autoInclude })];
  return r;
}

describe('resolveResume', () => {
  it('detached overrides win over the library, re-linking restores it', () => {
    const lib = sampleLibrary();
    const ref = createRef('prj_sample_1');
    ref.detached = ['resumeSummary'];
    ref.overrides = { resumeSummary: 'Resume-only summary.' };
    const resolved = resolveResume(withProjects([ref]), lib, sampleProfile());
    const item = resolved.sections[0]!.items[0]!;
    expect(item.description).toBe('Resume-only summary.');
    expect(item.title).toBe(lib.projects[0]!.title);
    const relinked = resolveResume(withProjects([{ ...ref, detached: [] }]), lib, sampleProfile());
    expect(relinked.sections[0]!.items[0]!.description).toBe(lib.projects[0]!.resumeSummary);
  });

  it('autoInclude appends unreferenced items; hidden refs are removed', () => {
    const lib = sampleLibrary();
    const hidden = { ...createRef('prj_sample_1'), hidden: true };
    const r = resolveResume(withProjects([hidden], true), lib, sampleProfile());
    const ids = r.sections[0]!.items.map((i) => i.libId);
    expect(ids).toEqual(['prj_sample_2']);
    const none = resolveResume(withProjects([createRef('prj_sample_2')], false), lib, sampleProfile());
    expect(none.sections[0]!.items.map((i) => i.libId)).toEqual(['prj_sample_2']);
  });

  it('library edits flow into every resume', () => {
    const lib = sampleLibrary();
    const a = withProjects([createRef('prj_sample_1')]);
    const b = withProjects([createRef('prj_sample_1')]);
    lib.projects[0]!.title = 'DHMS v2';
    expect(resolveResume(a, lib, sampleProfile()).sections[0]!.items[0]!.title).toBe('DHMS v2');
    expect(resolveResume(b, lib, sampleProfile()).sections[0]!.items[0]!.title).toBe('DHMS v2');
  });

  it('profile name changes update the header', () => {
    const p = { ...sampleProfile(), name: 'Anubhab' };
    expect(resolveResume(createResume('R'), sampleLibrary(), p).name).toBe('Anubhab');
  });

  it('duplicates are independent of the original', async () => {
    const ref = createRef('prj_sample_1');
    ref.detached = ['resumeSummary'];
    ref.overrides = { resumeSummary: 'Original' };
    const orig = await saveResume(withProjects([ref]));
    const copy = await duplicateResume(orig.id);
    expect(copy.id).not.toBe(orig.id);
    expect(copy.sections[0]!.id).not.toBe(orig.sections[0]!.id);
    expect(copy.sections[0]!.refs[0]!.id).not.toBe(ref.id);
    copy.sections[0]!.refs[0]!.overrides.resumeSummary = 'Backend focus';
    await saveResume(copy);
    const again = await getResume(orig.id);
    expect(again!.sections[0]!.refs[0]!.overrides.resumeSummary).toBe('Original');
  });
});
