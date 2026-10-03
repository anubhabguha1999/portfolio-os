/**
 * Full-device backup: every IndexedDB object store → one ZIP.
 *
 *   manifest.json            format/app/db version, per-store key info and counts
 *   stores/<store>.json      [{ k: key, v: value }] with binary values replaced by references
 *   bin/<n>                  raw bytes of Blobs / Uint8Arrays / ArrayBuffers
 *
 * Stores are discovered from `db.objectStoreNames`, so stores added in later DB versions are
 * included without changes here. Restoring a backup from a newer app skips stores this version
 * does not know and reports them.
 */
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import type { IDBPDatabase } from 'idb';
import { getDb } from '@/lib/storage/db';
import { BRAND } from '@/config/brand';
import { decodeValue, encodeValue, UnsupportedValueError } from './codec';
import { decryptBackup, encryptBackup, isEncryptedBackup, BackupDecryptError } from './crypto';

export const BACKUP_FORMAT = 'portfolio-os-backup';
export const BACKUP_FORMAT_VERSION = 1;

/** Regenerable caches — never exported, cleared on "replace". */
export const EXCLUDED_STORES: ReadonlySet<string> = new Set(['renders']);

/** Saved credentials: deploy tokens and the AI API key never leave the device in a backup. */
const SECRET_META_KEYS: ReadonlySet<string> = new Set(['deploy:tokens', 'ai:apiKey']);

/** Meta keys that belong to this device (sync folder handle, backup timestamps) or are secrets. */
export function isDeviceLocalMetaKey(key: IDBValidKey): boolean {
  return typeof key === 'string' && (key.startsWith('backup:') || SECRET_META_KEYS.has(key));
}

export class BackupError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid' | 'newer-format' | 'needs-passphrase' | 'decrypt' = 'invalid',
  ) {
    super(message);
    this.name = 'BackupError';
  }
}

export interface BackupStoreInfo {
  name: string;
  keyPath: string | string[] | null;
  autoIncrement: boolean;
  count: number;
  file: string;
}

export interface BackupManifest {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  app: string;
  dbName: string;
  dbVersion: number;
  createdAt: string;
  stores: BackupStoreInfo[];
  excludedStores: string[];
  /** Records that could not be serialised (e.g. browser-only handles). */
  skipped: Array<{ store: string; key: string; reason: string }>;
  binaryCount: number;
}

interface EncodedEntry {
  k: unknown;
  v: unknown;
}

export interface ParsedBackup {
  manifest: BackupManifest;
  entries: Map<string, EncodedEntry[]>;
  bins: Record<string, Uint8Array>;
  encrypted: boolean;
  byteSize: number;
}

type AnyDb = IDBPDatabase<unknown>;

async function rawDb(): Promise<AnyDb> {
  return (await getDb()) as unknown as AnyDb;
}

function storeFile(name: string): string {
  return `stores/${encodeURIComponent(name)}.json`;
}

function keyLabel(key: IDBValidKey): string {
  try {
    return typeof key === 'string' ? key : JSON.stringify(key);
  } catch {
    return String(key);
  }
}

/** Number of records per store in this browser (excluded caches omitted). */
export async function countLocalStores(): Promise<Record<string, number>> {
  const db = await rawDb();
  const out: Record<string, number> = {};
  for (const name of Array.from(db.objectStoreNames)) {
    if (EXCLUDED_STORES.has(name)) continue;
    if (name === 'meta') {
      const keys = await db.getAllKeys(name);
      out[name] = keys.filter((k) => !isDeviceLocalMetaKey(k)).length;
    } else out[name] = await db.count(name);
  }
  return out;
}

export interface CreateBackupResult {
  bytes: Uint8Array;
  manifest: BackupManifest;
}

/** Builds the ZIP (optionally encrypted) from the live database. */
export async function createBackup(opts: { passphrase?: string; now?: Date } = {}): Promise<CreateBackupResult> {
  const db = await rawDb();
  const files: Zippable = {};
  let binCount = 0;
  const sink = {
    add(bytes: Uint8Array) {
      const path = `bin/${binCount++}`;
      files[path] = [bytes, { level: 0 }];
      return path;
    },
  };
  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    app: BRAND.name,
    dbName: db.name,
    dbVersion: db.version,
    createdAt: (opts.now ?? new Date()).toISOString(),
    stores: [],
    excludedStores: [],
    skipped: [],
    binaryCount: 0,
  };

  for (const name of Array.from(db.objectStoreNames)) {
    if (EXCLUDED_STORES.has(name)) {
      manifest.excludedStores.push(name);
      continue;
    }
    // Read keys and values in one transaction so they line up; encode afterwards (Blob reads
    // are not IndexedDB requests and would let the transaction auto-commit).
    const tx = db.transaction(name, 'readonly');
    const store = tx.store;
    const [keys, values] = await Promise.all([store.getAllKeys(), store.getAll()]);
    const keyPath = store.keyPath as string | string[] | null;
    const autoIncrement = store.autoIncrement;
    await tx.done;

    const entries: EncodedEntry[] = [];
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]!;
      if (name === 'meta' && isDeviceLocalMetaKey(key)) continue;
      try {
        const k = await encodeValue(key, sink);
        const v = await encodeValue(values[i], sink);
        entries.push({ k, v });
      } catch (err) {
        manifest.skipped.push({ store: name, key: keyLabel(key), reason: err instanceof UnsupportedValueError ? err.message : String(err) });
      }
    }
    const file = storeFile(name);
    files[file] = [strToU8(JSON.stringify(entries)), { level: 6 }];
    manifest.stores.push({ name, keyPath, autoIncrement, count: entries.length, file });
  }
  manifest.binaryCount = binCount;
  files['manifest.json'] = [strToU8(JSON.stringify(manifest, null, 2)), { level: 6 }];

  const zip = zipSync(files);
  const bytes = opts.passphrase ? await encryptBackup(zip, opts.passphrase) : zip;
  return { bytes, manifest };
}

export function backupFileName(encrypted: boolean, at = new Date()): string {
  const d = at.toISOString().slice(0, 10);
  return `${BRAND.storageNamespace}-backup-${d}.${encrypted ? 'pobackup' : 'zip'}`;
}

function validateManifest(m: unknown): BackupManifest {
  const o = m as Partial<BackupManifest> | null;
  if (!o || typeof o !== 'object' || o.format !== BACKUP_FORMAT || !Array.isArray(o.stores)) throw new BackupError(`This file is not a ${BRAND.name} backup.`);
  if (typeof o.formatVersion !== 'number' || o.formatVersion > BACKUP_FORMAT_VERSION)
    throw new BackupError(`This backup was made by a newer version of ${BRAND.name} (format ${String(o.formatVersion)}). Reload the app to update, then try again.`, 'newer-format');
  return {
    ...o,
    excludedStores: Array.isArray(o.excludedStores) ? o.excludedStores : [],
    skipped: Array.isArray(o.skipped) ? o.skipped : [],
  } as BackupManifest;
}

/** Decrypts (if needed), unzips and validates a backup file. */
export async function readBackup(input: Uint8Array, passphrase?: string): Promise<ParsedBackup> {
  const encrypted = isEncryptedBackup(input);
  let zip = input;
  if (encrypted) {
    if (!passphrase) throw new BackupError('This backup is encrypted. Enter its passphrase.', 'needs-passphrase');
    try {
      zip = await decryptBackup(input, passphrase);
    } catch (err) {
      throw new BackupError(err instanceof BackupDecryptError ? err.message : 'Could not decrypt this backup.', 'decrypt');
    }
  }
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(zip);
  } catch {
    throw new BackupError(`This file is not a ${BRAND.name} backup (it could not be opened as a ZIP).`);
  }
  const rawManifest = files['manifest.json'];
  if (!rawManifest) throw new BackupError(`This file is not a ${BRAND.name} backup (manifest.json is missing).`);
  let manifestJson: unknown;
  try {
    manifestJson = JSON.parse(strFromU8(rawManifest));
  } catch {
    throw new BackupError('The backup manifest is damaged.');
  }
  const manifest = validateManifest(manifestJson);
  const entries = new Map<string, EncodedEntry[]>();
  for (const s of manifest.stores) {
    const raw = files[s.file];
    if (!raw) throw new BackupError(`The backup is incomplete: ${s.file} is missing.`);
    let list: unknown;
    try {
      list = JSON.parse(strFromU8(raw));
    } catch {
      throw new BackupError(`The backup is damaged: ${s.file} is not valid JSON.`);
    }
    if (!Array.isArray(list)) throw new BackupError(`The backup is damaged: ${s.file} is not a list.`);
    entries.set(s.name, list as EncodedEntry[]);
  }
  const bins: Record<string, Uint8Array> = {};
  for (const [path, bytes] of Object.entries(files)) if (path.startsWith('bin/')) bins[path] = bytes;
  return { manifest, entries, bins, encrypted, byteSize: input.byteLength };
}

export interface BackupPreview {
  createdAt: string;
  app: string;
  dbVersion: number;
  currentDbVersion: number;
  encrypted: boolean;
  byteSize: number;
  stores: Array<{ name: string; count: number; known: boolean }>;
  unknownStores: string[];
  total: number;
}

export async function previewBackup(parsed: ParsedBackup): Promise<BackupPreview> {
  const db = await rawDb();
  const current = new Set(Array.from(db.objectStoreNames));
  const stores = parsed.manifest.stores.map((s) => ({ name: s.name, count: s.count, known: current.has(s.name) && !EXCLUDED_STORES.has(s.name) }));
  return {
    createdAt: parsed.manifest.createdAt,
    app: parsed.manifest.app,
    dbVersion: parsed.manifest.dbVersion,
    currentDbVersion: db.version,
    encrypted: parsed.encrypted,
    byteSize: parsed.byteSize,
    stores,
    unknownStores: stores.filter((s) => !s.known).map((s) => s.name),
    total: stores.reduce((n, s) => n + (s.known ? s.count : 0), 0),
  };
}

export type RestoreMode = 'merge' | 'replace';

export interface StoreRestoreStats {
  added: number;
  updated: number;
  unchanged: number;
  removed: number;
}

export interface RestoreReport {
  mode: RestoreMode;
  stores: Record<string, StoreRestoreStats>;
  unknownStores: string[];
  skipped: Array<{ store: string; reason: string }>;
  added: number;
  updated: number;
}

function timeOf(v: unknown): number | null {
  if (!v || typeof v !== 'object') return null;
  const u = (v as { updatedAt?: unknown }).updatedAt;
  if (typeof u === 'number' && Number.isFinite(u)) return u;
  if (typeof u === 'string') {
    const t = Date.parse(u);
    return Number.isNaN(t) ? null : t;
  }
  if (u instanceof Date) return u.getTime();
  return null;
}

function hasKeyPath(value: unknown, keyPath: string | string[]): boolean {
  const paths = Array.isArray(keyPath) ? keyPath : [keyPath];
  return paths.every((p) => {
    let cur: unknown = value;
    for (const part of p.split('.')) {
      if (cur === null || typeof cur !== 'object') return false;
      cur = (cur as Record<string, unknown>)[part];
    }
    return cur !== undefined && cur !== null;
  });
}

/**
 * Writes a parsed backup into the database in a single transaction (all or nothing).
 *  - merge:   adds missing records; replaces existing ones only when the backup's `updatedAt` is newer.
 *  - replace: clears every store (keeping this device's sync settings) and writes the backup.
 */
export async function restoreBackup(parsed: ParsedBackup, mode: RestoreMode): Promise<RestoreReport> {
  const db = await rawDb();
  const current = new Set(Array.from(db.objectStoreNames));
  const report: RestoreReport = { mode, stores: {}, unknownStores: [], skipped: [], added: 0, updated: 0 };
  const src = (p: string) => parsed.bins[p];

  // Decode everything before opening the write transaction.
  const plan: Array<{ name: string; inline: boolean; rows: Array<{ key: IDBValidKey; value: unknown }> }> = [];
  for (const info of parsed.manifest.stores) {
    if (!current.has(info.name)) {
      report.unknownStores.push(info.name);
      continue;
    }
    if (EXCLUDED_STORES.has(info.name)) continue;
    const storeKeyPath = db.transaction(info.name).store.keyPath as string | string[] | null;
    const rows: Array<{ key: IDBValidKey; value: unknown }> = [];
    for (const e of parsed.entries.get(info.name) ?? []) {
      try {
        const key = decodeValue(e.k, src) as IDBValidKey;
        const value = decodeValue(e.v, src);
        if (info.name === 'meta' && isDeviceLocalMetaKey(key)) continue;
        if (storeKeyPath !== null && !hasKeyPath(value, storeKeyPath)) {
          report.skipped.push({ store: info.name, reason: `A record has no "${String(storeKeyPath)}" key.` });
          continue;
        }
        rows.push({ key, value });
      } catch (err) {
        report.skipped.push({ store: info.name, reason: err instanceof Error ? err.message : String(err) });
      }
    }
    plan.push({ name: info.name, inline: storeKeyPath !== null, rows });
  }

  const touched = mode === 'replace' ? Array.from(current) : plan.map((p) => p.name);
  if (touched.length === 0) return report;
  const tx = db.transaction(touched, 'readwrite');

  if (mode === 'replace') {
    for (const name of touched) {
      const store = tx.objectStore(name);
      const stats = (report.stores[name] ??= { added: 0, updated: 0, unchanged: 0, removed: 0 });
      if (name === 'meta') {
        for (const key of await store.getAllKeys()) {
          if (isDeviceLocalMetaKey(key)) continue;
          await store.delete(key);
          stats.removed++;
        }
      } else {
        stats.removed = await store.count();
        await store.clear();
      }
    }
  }

  for (const { name, inline, rows } of plan) {
    const store = tx.objectStore(name);
    const stats = (report.stores[name] ??= { added: 0, updated: 0, unchanged: 0, removed: 0 });
    for (const { key, value } of rows) {
      if (mode === 'merge') {
        const existing = await store.get(key);
        if (existing !== undefined) {
          const a = timeOf(value);
          const b = timeOf(existing);
          if (a === null || b === null || a <= b) {
            stats.unchanged++;
            continue;
          }
          if (inline) await store.put(value);
          else await store.put(value, key);
          stats.updated++;
          report.updated++;
          continue;
        }
      }
      if (inline) await store.put(value);
      else await store.put(value, key);
      stats.added++;
      report.added++;
    }
  }
  await tx.done;
  return report;
}

/** Convenience: file bytes → restore, used by sync "pull". */
export async function restoreFromBytes(bytes: Uint8Array, mode: RestoreMode, passphrase?: string): Promise<{ report: RestoreReport; parsed: ParsedBackup }> {
  const parsed = await readBackup(bytes, passphrase);
  return { report: await restoreBackup(parsed, mode), parsed };
}
