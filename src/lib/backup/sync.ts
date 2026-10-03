/**
 * Backup status and the optional "sync folder" (File System Access API — Chrome / Edge).
 *
 * The folder handle is kept in IndexedDB meta (handles are structured-cloneable), and permission
 * is re-requested on use because browsers forget grants between sessions. Writing into a folder
 * that iCloud Drive, Dropbox or Google Drive syncs is what moves data between devices; there is
 * no server of our own.
 */
import { getDb, getMeta, setMeta } from '@/lib/storage/db';
import { BRAND } from '@/config/brand';

export const META_LAST_BACKUP = 'backup:last';
export const META_LAST_PULL = 'backup:lastPull';
export const META_SYNC_DIR = 'backup:syncDir';
export const META_PREFS = 'backup:prefs';

export const REMINDER_DAYS = 14;

export interface LastBackup {
  at: string;
  target: 'download' | 'folder';
  encrypted: boolean;
  size: number;
}

export interface LastPull {
  at: string;
  file: string;
  fileModified: string;
}

export interface BackupPrefs {
  encrypt: boolean;
}

export async function getLastBackup(): Promise<LastBackup | undefined> {
  return getMeta<LastBackup>(META_LAST_BACKUP);
}

export async function recordBackup(info: LastBackup): Promise<void> {
  await setMeta(META_LAST_BACKUP, info);
}

export async function getLastPull(): Promise<LastPull | undefined> {
  return getMeta<LastPull>(META_LAST_PULL);
}

export async function getPrefs(): Promise<BackupPrefs> {
  return { encrypt: false, ...((await getMeta<BackupPrefs>(META_PREFS)) ?? {}) };
}

export async function setPrefs(p: BackupPrefs): Promise<void> {
  await setMeta(META_PREFS, p);
}

/** True when no backup has been made, or the last one is older than {@link REMINDER_DAYS}. */
export function backupIsStale(last: Pick<LastBackup, 'at'> | undefined, now = Date.now(), days = REMINDER_DAYS): boolean {
  if (!last) return true;
  const t = Date.parse(last.at);
  return Number.isNaN(t) || now - t > days * 86_400_000;
}

// ---- File System Access API (not in lib.dom for every browser) -----------------------------

type PermissionMode = 'read' | 'readwrite';

interface PermissionCapableHandle {
  queryPermission?(d: { mode: PermissionMode }): Promise<PermissionState>;
  requestPermission?(d: { mode: PermissionMode }): Promise<PermissionState>;
}

export type SyncDirHandle = FileSystemDirectoryHandle & PermissionCapableHandle & {
  values(): AsyncIterable<FileSystemHandle>;
};

type DirectoryPicker = (opts?: { id?: string; mode?: PermissionMode; startIn?: string }) => Promise<SyncDirHandle>;

function picker(): DirectoryPicker | undefined {
  if (typeof window === 'undefined') return undefined;
  const fn = (window as unknown as { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker;
  return typeof fn === 'function' ? fn.bind(window) : undefined;
}

export function isSyncFolderSupported(): boolean {
  return Boolean(picker()) && typeof window !== 'undefined' && window.isSecureContext !== false;
}

export const SYNC_FILE_BASE = `${BRAND.storageNamespace}-sync`;

export function syncFileName(encrypted: boolean): string {
  return `${SYNC_FILE_BASE}.${encrypted ? 'pobackup' : 'zip'}`;
}

/** Backup files we recognise in the folder (including cloud-drive conflict copies). */
export function isBackupFileName(name: string): boolean {
  const n = name.toLowerCase();
  if (n.startsWith('.')) return false;
  if (n.endsWith('.pobackup')) return true;
  return n.endsWith('.zip') && (n.includes('backup') || n.startsWith(SYNC_FILE_BASE));
}

export async function chooseSyncFolder(): Promise<SyncDirHandle> {
  const pick = picker();
  if (!pick) throw new Error('This browser cannot open folders. Use Download / Restore from file instead.');
  const handle = await pick({ id: `${BRAND.storageNamespace}-sync`, mode: 'readwrite' });
  await setMeta(META_SYNC_DIR, handle);
  return handle;
}

export async function getSyncFolder(): Promise<SyncDirHandle | undefined> {
  try {
    return await getMeta<SyncDirHandle>(META_SYNC_DIR);
  } catch {
    return undefined;
  }
}

export async function forgetSyncFolder(): Promise<void> {
  await (await getDb()).delete('meta', META_SYNC_DIR);
}

/** Checks, then (inside a user gesture) requests, permission for the folder. */
export async function ensureFolderPermission(handle: SyncDirHandle, mode: PermissionMode = 'readwrite'): Promise<boolean> {
  if (!handle.queryPermission) return true;
  if ((await handle.queryPermission({ mode })) === 'granted') return true;
  if (!handle.requestPermission) return false;
  return (await handle.requestPermission({ mode })) === 'granted';
}

export async function writeToFolder(handle: SyncDirHandle, name: string, bytes: Uint8Array): Promise<void> {
  const file = await handle.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  try {
    await writable.write(bytes as unknown as BufferSource);
    await writable.close();
  } catch (err) {
    await writable.abort().catch(() => undefined);
    throw err;
  }
}

export interface FolderBackupFile {
  name: string;
  lastModified: number;
  size: number;
  file: File;
}

/** The most recently modified backup file in the folder, if any. */
export async function findLatestInFolder(handle: SyncDirHandle): Promise<FolderBackupFile | null> {
  let best: FolderBackupFile | null = null;
  for await (const entry of handle.values()) {
    if (entry.kind !== 'file' || !isBackupFileName(entry.name)) continue;
    const file = await (entry as FileSystemFileHandle).getFile();
    if (!best || file.lastModified > best.lastModified) best = { name: entry.name, lastModified: file.lastModified, size: file.size, file };
  }
  return best;
}

export async function recordPull(f: FolderBackupFile): Promise<void> {
  const info: LastPull = { at: new Date().toISOString(), file: f.name, fileModified: new Date(f.lastModified).toISOString() };
  await setMeta(META_LAST_PULL, info);
}
