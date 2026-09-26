import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AssetRecord, Portfolio } from '@/types/portfolio';
import { BRAND } from '@/config/brand';

export interface ProjectRecord {
  id: string;
  name: string;
  portfolio: Portfolio;
  createdAt: string;
  updatedAt: string;
  /** Monotonic snapshot counter (v1, v2, …). */
  versionCounter: number;
}

export type SnapshotKind = 'manual' | 'auto' | 'restore' | 'import';

export interface SnapshotRecord {
  id: string;
  projectId: string;
  version: number;
  label: string;
  kind: SnapshotKind;
  createdAt: string;
  /** gzip-compressed portfolio JSON. */
  data: Uint8Array;
  size: number;
}

interface PortfolioDB extends DBSchema {
  projects: { key: string; value: ProjectRecord; indexes: { byUpdated: string } };
  snapshots: { key: string; value: SnapshotRecord; indexes: { byProject: string } };
  assets: { key: [string, string]; value: AssetRecord; indexes: { byProject: string } };
  meta: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<PortfolioDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<PortfolioDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PortfolioDB>(`${BRAND.storageNamespace}`, 1, {
      upgrade(db) {
        const projects = db.createObjectStore('projects', { keyPath: 'id' });
        projects.createIndex('byUpdated', 'updatedAt');
        const snaps = db.createObjectStore('snapshots', { keyPath: 'id' });
        snaps.createIndex('byProject', 'projectId');
        const assets = db.createObjectStore('assets', { keyPath: ['projectId', 'id'] });
        assets.createIndex('byProject', 'projectId');
        db.createObjectStore('meta');
      },
      blocked() {
        console.warn('Database upgrade blocked by another open tab.');
      },
    }).catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

/** Test helper: drop the cached connection. */
export async function resetDbConnection(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await (await getDb()).get('meta', key)) as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await (await getDb()).put('meta', value, key);
}

export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    return e ? { usage: e.usage ?? 0, quota: e.quota ?? 0 } : null;
  } catch {
    return null;
  }
}
