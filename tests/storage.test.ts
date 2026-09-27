import { describe, it, expect } from 'vitest';
import { createPortfolio } from '@/lib/portfolio-factory';
import { createProject, getProject, saveProject, listProjects, duplicateProject, deleteProject, renameProject, createSnapshot, listSnapshots, loadSnapshot, buildBackup, importProjectJson } from '@/lib/storage/projects';
import { storeBlob, listAssets } from '@/lib/storage/assets';
import { assetRef } from '@/lib/engine/assets';
import { encodePayload, decodePayload } from '@/lib/compression';

describe('local storage (IndexedDB)', () => {
  it('creates, saves, lists, renames, duplicates and deletes projects', async () => {
    const p = createPortfolio({ title: 'Alpha' });
    const rec = await createProject(p);
    const hero = p.sections[0]!;
    if (hero.type === 'hero') hero.data.name = 'Persisted Name';
    await saveProject(p);
    const loaded = await getProject(rec.id);
    const h = loaded!.portfolio.sections[0]!;
    expect(h.type === 'hero' && h.data.name).toBe('Persisted Name');
    await renameProject(rec.id, 'Renamed');
    expect((await listProjects()).find((x) => x.id === rec.id)!.name).toBe('Renamed');
    await storeBlob(rec.id, new Blob(['x'], { type: 'image/png' }), { name: 'a.png', width: 1, height: 1 });
    const dup = await duplicateProject(rec.id);
    expect(dup.id).not.toBe(rec.id);
    expect(await listAssets(dup.id)).toHaveLength(1);
    await deleteProject(rec.id);
    expect(await getProject(rec.id)).toBeUndefined();
    expect(await listAssets(rec.id)).toHaveLength(0);
  });

  it('stores compressed version snapshots and restores them', async () => {
    const p = createPortfolio({ title: 'Versions' });
    await createProject(p);
    const s1 = await createSnapshot(p, 'manual', 'First');
    const changed = { ...p, metadata: { ...p.metadata, title: 'Changed' } };
    const s2 = await createSnapshot(changed, 'manual');
    expect(s2.version).toBe(s1.version + 1);
    const list = await listSnapshots(p.id);
    expect(list.map((s) => s.version)).toEqual([s2.version, s1.version]);
    expect((await loadSnapshot(s1.id)).metadata.title).toBe('Versions');
    expect(s1.size).toBeLessThan(JSON.stringify(p).length);
  });

  it('round-trips a full JSON backup including images', async () => {
    const p = createPortfolio({ title: 'Backup' });
    const rec = await createProject(p);
    const img = await storeBlob(rec.id, new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }), { name: 'me.png', width: 10, height: 10 });
    const hero = p.sections[0]!;
    if (hero.type === 'hero') hero.data.image = { src: assetRef(img.id), alt: 'Me' };
    await saveProject(p);
    const backup = JSON.parse(JSON.stringify(await buildBackup(p)));
    const { project, warnings } = await importProjectJson(backup);
    expect(project.id).not.toBe(rec.id);
    expect(warnings).toEqual([]);
    const assets = await listAssets(project.id);
    expect(assets.map((a) => a.id)).toEqual([img.id]);
    expect(assets[0]!.size).toBe(4);
    const h = project.portfolio.sections[0]!;
    expect(h.type === 'hero' && h.data.image.src).toBe(assetRef(img.id));
  });

  it('compresses share payloads reversibly', () => {
    const p = createPortfolio();
    const enc = encodePayload(p);
    expect(enc).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodePayload(enc)).toEqual(JSON.parse(JSON.stringify(p)));
  });
});
