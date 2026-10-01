import { describe, it, expect } from 'vitest';
import { createDocument, createResume } from '@/studio/model/defaults';
import { deleteAllStudioData, deleteDocument, deleteResume, getDocument, getResume, listDocuments, listResumes, loadLibrary, loadProfile, normalizeResume, saveDocument, saveLibrary, saveProfile, saveResume } from '@/studio/storage/repo';
import { sampleLibrary, sampleProfile } from '@/studio/model/sample';

describe('studio repo', () => {
  it('saves, lists and deletes resumes and documents', async () => {
    const r = await saveResume(createResume('Frontend Resume'));
    const d = await saveDocument(createDocument('cover-letter', 'Letter'));
    expect((await listResumes()).some((x) => x.id === r.id && x.name === 'Frontend Resume')).toBe(true);
    expect((await listDocuments()).some((x) => x.id === d.id && x.kind === 'cover-letter')).toBe(true);
    expect((await getResume(r.id))!.name).toBe('Frontend Resume');
    expect((await getDocument(d.id))!.letter).not.toBeNull();
    await deleteResume(r.id);
    await deleteDocument(d.id);
    expect(await getResume(r.id)).toBeNull();
    expect(await getDocument(d.id)).toBeNull();
  });

  it('fills defaults for records saved by older versions', () => {
    const r = normalizeResume({ id: 'old', name: 'Old', sections: [{ kind: 'experience' }], style: { baseSize: 11 } })!;
    expect(r.style.baseSize).toBe(11);
    expect(r.style.pageLimit).toBe(0);
    expect(r.style.repeatHeadings).toBe(true);
    expect(r.sections[0]!.refs).toEqual([]);
    expect(r.sections[0]!.autoInclude).toBe(true);
    expect(r.contact.email).toBe(true);
    expect(normalizeResume(null)).toBeNull();
  });

  it('persists profile and library, and deleteAllStudioData clears everything', async () => {
    await saveProfile(sampleProfile());
    await saveLibrary(sampleLibrary());
    await saveResume(createResume('X'));
    expect((await loadProfile()).name).toBe('Alex Morgan');
    expect((await loadLibrary()).experience.length).toBe(3);
    await deleteAllStudioData();
    expect((await loadProfile()).name).toBe('');
    expect((await loadLibrary()).experience).toEqual([]);
    expect(await listResumes()).toEqual([]);
  });
});
