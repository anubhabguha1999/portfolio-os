import { describe, it, expect, beforeEach } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { getDb, getMeta, setMeta } from '@/lib/storage/db';
import {
  backupIsStale,
  BackupError,
  countLocalStores,
  createBackup,
  decryptBackup,
  encryptBackup,
  isBackupFileName,
  isEncryptedBackup,
  previewBackup,
  readBackup,
  restoreBackup,
  type BackupManifest,
} from '@/lib/backup';
import { decodeValue, encodeValue } from '@/lib/backup/codec';
import { render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import BackupPage from '@/features/backup/BackupPage';

async function wipe() {
  const db = await getDb();
  const names = Array.from(db.objectStoreNames);
  const tx = db.transaction(names, 'readwrite');
  await Promise.all(names.map((n) => tx.objectStore(n).clear()));
  await tx.done;
}

async function seed() {
  const db = await getDb();
  await db.put('projects', { id: 'p1', name: 'Alpha', portfolio: {} as never, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-02-01T00:00:00.000Z', versionCounter: 1 });
  await db.put('snapshots', { id: 's1', projectId: 'p1', version: 1, label: 'v1', kind: 'manual', createdAt: '2026-02-01T00:00:00.000Z', data: new Uint8Array([1, 2, 3, 250]), size: 4 });
  await db.put('assets', { projectId: 'p1', id: 'a1', name: 'me.png', mime: 'image/png', size: 4, width: 1, height: 1, blob: new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }), createdAt: '2026-01-01T00:00:00.000Z' } as never);
  await db.put('images', { id: 'i1', name: 'photo.jpg', mime: 'image/jpeg', width: 2, height: 2, size: 3, blob: new Blob([new Uint8Array([9, 8, 7])], { type: 'image/jpeg' }), createdAt: '2026-01-01T00:00:00.000Z' });
  await db.put('renders', { key: 'r1', hash: 'h', blob: new Blob(['cache']), width: 1, height: 1, updatedAt: '2026-01-01T00:00:00.000Z' });
  await db.put('studio', { name: 'Ada', updatedAt: '2026-02-01T00:00:00.000Z' }, 'profile');
  await db.put('resumes', { id: 'r1', name: 'CV', updatedAt: '2026-02-01T00:00:00.000Z', data: { when: new Date('2026-01-02T00:00:00.000Z') } });
  await setMeta('knowledge:tags', ['react']);
  await setMeta('deploy:tokens', { netlify: 'secret' });
  await setMeta('ai:apiKey', 'sk-test-secret');
  await setMeta('backup:last', { at: '2026-01-01T00:00:00.000Z' });
}

describe('backup codec', () => {
  it('round-trips structured-clone values and escapes the tag key', async () => {
    const bins: Uint8Array[] = [];
    const sink = { add: (b: Uint8Array) => (bins.push(b), `bin/${bins.length - 1}`) };
    const value = {
      a: 1,
      nan: NaN,
      d: new Date('2026-03-04T05:06:07.000Z'),
      u8: new Uint8Array([1, 2]),
      f32: new Float32Array([1.5]),
      ab: new Uint8Array([5]).buffer,
      blob: new Blob(['hi'], { type: 'text/plain' }),
      map: new Map([['k', 1]]),
      set: new Set([1, 2]),
      tricky: { $pobk: 'blob', p: 'nope' },
    };
    const json = JSON.parse(JSON.stringify(await encodeValue(value, sink)));
    const out = decodeValue(json, (p) => bins[Number(p.split('/')[1])]) as typeof value;
    expect(out.a).toBe(1);
    expect(Number.isNaN(out.nan)).toBe(true);
    expect(out.d.toISOString()).toBe('2026-03-04T05:06:07.000Z');
    expect(Array.from(out.u8)).toEqual([1, 2]);
    expect(Array.from(out.f32)).toEqual([1.5]);
    expect(Array.from(new Uint8Array(out.ab))).toEqual([5]);
    expect(await out.blob.text()).toBe('hi');
    expect(out.blob.type).toBe('text/plain');
    expect(out.map.get('k')).toBe(1);
    expect([...out.set]).toEqual([1, 2]);
    expect(out.tricky).toEqual({ $pobk: 'blob', p: 'nope' });
  });
});

describe('full backup & restore', () => {
  beforeEach(async () => {
    await wipe();
    await seed();
  });

  it('exports every store generically, excluding caches and device-local meta', async () => {
    const { bytes, manifest } = await createBackup();
    const db = await getDb();
    const names = manifest.stores.map((s) => s.name);
    for (const n of Array.from(db.objectStoreNames)) if (n !== 'renders') expect(names).toContain(n);
    expect(names).not.toContain('renders');
    expect(manifest.excludedStores).toEqual(['renders']);
    expect(manifest.dbVersion).toBe(db.version);
    expect(manifest.formatVersion).toBe(1);
    const files = unzipSync(bytes);
    const meta = strFromU8(files['stores/meta.json']!);
    expect(meta).toContain('knowledge:tags');
    expect(meta).not.toContain('deploy:tokens');
    expect(meta).not.toContain('ai:apiKey');
    expect(meta).not.toContain('backup:last');
    expect(Object.keys(files).filter((f) => f.startsWith('bin/'))).toHaveLength(3);
  });

  it('round-trips export → wipe → replace restore, including binary data', async () => {
    const { bytes } = await createBackup();
    const before = await countLocalStores();
    await wipe();
    await setMeta('backup:syncDir', 'device-handle');
    const parsed = await readBackup(bytes);
    const preview = await previewBackup(parsed);
    expect(preview.unknownStores).toEqual([]);
    expect(preview.stores.find((s) => s.name === 'projects')!.count).toBe(1);
    const report = await restoreBackup(parsed, 'replace');
    expect(report.unknownStores).toEqual([]);
    expect(await countLocalStores()).toEqual(before);

    const db = await getDb();
    const snap = await db.get('snapshots', 's1');
    expect(Array.from(snap!.data)).toEqual([1, 2, 3, 250]);
    const asset = (await db.get('assets', ['p1', 'a1'])) as unknown as { blob: Blob };
    expect(Array.from(new Uint8Array(await asset.blob.arrayBuffer()))).toEqual([137, 80, 78, 71]);
    expect(asset.blob.type).toBe('image/png');
    const img = await db.get('images', 'i1');
    expect(img!.blob.size).toBe(3);
    expect(await db.get('studio', 'profile')).toEqual({ name: 'Ada', updatedAt: '2026-02-01T00:00:00.000Z' });
    const resume = await db.get('resumes', 'r1');
    expect((resume!.data as { when: Date }).when.getTime()).toBe(Date.parse('2026-01-02T00:00:00.000Z'));
    // Device-local keys survive a replace.
    expect(await getMeta('backup:syncDir')).toBe('device-handle');
  });

  it('replace removes records that are not in the backup', async () => {
    const { bytes } = await createBackup();
    const db = await getDb();
    await db.put('resumes', { id: 'extra', name: 'Extra', updatedAt: '2026-05-01T00:00:00.000Z', data: {} });
    await restoreBackup(await readBackup(bytes), 'replace');
    expect(await db.get('resumes', 'extra')).toBeUndefined();
    expect(await db.get('renders', 'r1')).toBeUndefined();
  });

  it('merge keeps the newer record by updatedAt and adds missing ones', async () => {
    const { bytes } = await createBackup();
    const db = await getDb();
    // Local is newer for the project, older for the resume; a local-only doc must survive.
    await db.put('projects', { ...(await db.get('projects', 'p1'))!, name: 'Local newer', updatedAt: '2026-09-01T00:00:00.000Z' });
    await db.put('resumes', { id: 'r1', name: 'Local older', updatedAt: '2025-01-01T00:00:00.000Z', data: {} });
    await db.put('documents', { id: 'local-only', name: 'Mine', updatedAt: '2026-01-01T00:00:00.000Z', data: {} });
    await db.delete('images', 'i1');
    await db.put('studio', { foo: 1 }, 'links');

    const report = await restoreBackup(await readBackup(bytes), 'merge');
    expect((await db.get('projects', 'p1'))!.name).toBe('Local newer');
    expect((await db.get('resumes', 'r1'))!.name).toBe('CV');
    expect(await db.get('documents', 'local-only')).toBeTruthy();
    expect(await db.get('images', 'i1')).toBeTruthy();
    expect(await db.get('studio', 'links')).toEqual({ foo: 1 });
    expect(report.stores.projects).toMatchObject({ added: 0, updated: 0, unchanged: 1 });
    expect(report.stores.resumes).toMatchObject({ updated: 1 });
    expect(report.stores.images).toMatchObject({ added: 1 });
  });

  it('encrypts with a passphrase and rejects the wrong one', async () => {
    const { bytes } = await createBackup({ passphrase: 'correct horse' });
    expect(isEncryptedBackup(bytes)).toBe(true);
    await expect(readBackup(bytes)).rejects.toMatchObject({ code: 'needs-passphrase' });
    await expect(readBackup(bytes, 'wrong')).rejects.toBeInstanceOf(BackupError);
    await expect(readBackup(bytes, 'wrong')).rejects.toMatchObject({ code: 'decrypt' });
    const parsed = await readBackup(bytes, 'correct horse');
    expect(parsed.encrypted).toBe(true);
    expect(parsed.manifest.stores.length).toBeGreaterThan(0);
  });

  it('encryption round-trips raw bytes and detects tampering', async () => {
    const plain = new Uint8Array([1, 2, 3, 4, 5]);
    const enc = await encryptBackup(plain, 'pw', 1000);
    expect(Array.from(await decryptBackup(enc, 'pw'))).toEqual([1, 2, 3, 4, 5]);
    const tampered = enc.slice();
    tampered[tampered.length - 1]! ^= 1;
    await expect(decryptBackup(tampered, 'pw')).rejects.toThrow(/passphrase|damaged/i);
  });

  it('skips and reports stores from a newer app version', async () => {
    const { bytes } = await createBackup();
    const files = unzipSync(bytes);
    const manifest = JSON.parse(strFromU8(files['manifest.json']!)) as BackupManifest;
    manifest.dbVersion = 99;
    manifest.stores.push({ name: 'futureStore', keyPath: 'id', autoIncrement: false, count: 1, file: 'stores/futureStore.json' });
    files['stores/futureStore.json'] = strToU8(JSON.stringify([{ k: 'x', v: { id: 'x' } }]));
    files['manifest.json'] = strToU8(JSON.stringify(manifest));
    const parsed = await readBackup(zipSync(files));
    const preview = await previewBackup(parsed);
    expect(preview.unknownStores).toEqual(['futureStore']);
    await wipe();
    const report = await restoreBackup(parsed, 'replace');
    expect(report.unknownStores).toEqual(['futureStore']);
    expect(await (await getDb()).count('projects')).toBe(1);
  });

  it('rejects non-backups and backups from a newer format', async () => {
    await expect(readBackup(new Uint8Array([1, 2, 3]))).rejects.toBeInstanceOf(BackupError);
    const files = { 'manifest.json': strToU8(JSON.stringify({ format: 'portfolio-os-backup', formatVersion: 999, stores: [] })) };
    await expect(readBackup(zipSync(files))).rejects.toMatchObject({ code: 'newer-format' });
  });
});

describe('backup status helpers', () => {
  it('flags stale backups after 14 days', () => {
    const now = Date.parse('2026-10-04T00:00:00.000Z');
    expect(backupIsStale(undefined, now)).toBe(true);
    expect(backupIsStale({ at: '2026-10-01T00:00:00.000Z' }, now)).toBe(false);
    expect(backupIsStale({ at: '2026-09-01T00:00:00.000Z' }, now)).toBe(true);
  });

  it('recognises backup files in a sync folder', () => {
    expect(isBackupFileName('portfolio-os-sync.pobackup')).toBe(true);
    expect(isBackupFileName('x-backup-2026-01-01.zip')).toBe(true);
    expect(isBackupFileName('photos.zip')).toBe(false);
    expect(isBackupFileName('.portfolio-os-sync.pobackup')).toBe(false);
  });
});

describe('BackupPage', () => {
  it('renders counts, the stale reminder and the no-folder fallback', async () => {
    await wipe();
    await seed();
    render(createElement(MemoryRouter, null, createElement(BackupPage)));
    await waitFor(() => expect(screen.getByText(/last backup was/i)).toBeTruthy());
    expect(screen.getByText('Portfolio versions')).toBeTruthy();
    expect(screen.getByRole('button', { name: /download backup/i })).toBeTruthy();
    expect(screen.getByText(/cannot write to folders directly/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /choose backup file/i })).toBeTruthy();
  });
});
