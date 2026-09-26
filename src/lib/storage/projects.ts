import type { Portfolio, ProjectBackup } from '@/types/portfolio';
import { getDb, type ProjectRecord, type SnapshotKind, type SnapshotRecord } from './db';
import { gzipJson, gunzipJson } from '@/lib/compression';
import { uid } from '@/utils/id';
import { parsePortfolio } from '@/schemas/portfolio';
import { listAssets, putAssetRecord, serializeAssets, deserializeAsset } from './assets';
import { BRAND } from '@/config/brand';
import { assetIdOf, assetRef, isAssetRef } from '@/lib/engine/assets';

export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sectionCount: number;
  themeName: string;
  themeId: string;
  colors: [string, string, string];
  headline: string;
}

function summarize(r: ProjectRecord): ProjectSummary {
  const p = r.portfolio;
  const pal = p.theme.palettes[p.theme.defaultScheme];
  const hero = p.sections.find((s) => s.type === 'hero');
  return {
    id: r.id,
    name: r.name,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    sectionCount: p.sections.filter((s) => s.enabled).length,
    themeName: p.theme.name,
    themeId: p.theme.id,
    colors: [pal.background, pal.primary, pal.accent],
    headline: hero && hero.type === 'hero' ? hero.data.name : '',
  };
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const db = await getDb();
  const all = await db.getAll('projects');
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(summarize);
}

export async function getProject(id: string): Promise<ProjectRecord | undefined> {
  const db = await getDb();
  const rec = await db.get('projects', id);
  if (!rec) return undefined;
  // Validate on load so a corrupted record is detected, not rendered.
  const { portfolio } = parsePortfolio(rec.portfolio);
  return { ...rec, portfolio };
}

export async function createProject(portfolio: Portfolio, name?: string): Promise<ProjectRecord> {
  const db = await getDb();
  const now = new Date().toISOString();
  const rec: ProjectRecord = {
    id: portfolio.id,
    name: name?.trim() || portfolio.metadata.title || 'Untitled portfolio',
    portfolio: { ...portfolio, metadata: { ...portfolio.metadata, createdAt: now, updatedAt: now } },
    createdAt: now,
    updatedAt: now,
    versionCounter: 0,
  };
  if (await db.get('projects', rec.id)) {
    rec.id = uid('pf');
    rec.portfolio = { ...rec.portfolio, id: rec.id };
  }
  await db.put('projects', rec);
  return rec;
}

export async function saveProject(portfolio: Portfolio): Promise<string> {
  const db = await getDb();
  const tx = db.transaction('projects', 'readwrite');
  const existing = await tx.store.get(portfolio.id);
  const now = new Date().toISOString();
  const rec: ProjectRecord = existing
    ? { ...existing, portfolio: { ...portfolio, metadata: { ...portfolio.metadata, updatedAt: now } }, updatedAt: now }
    : { id: portfolio.id, name: portfolio.metadata.title || 'Untitled portfolio', portfolio, createdAt: now, updatedAt: now, versionCounter: 0 };
  await tx.store.put(rec);
  await tx.done;
  return now;
}

export async function renameProject(id: string, name: string): Promise<void> {
  const db = await getDb();
  const rec = await db.get('projects', id);
  if (!rec) throw new Error('Project not found');
  await db.put('projects', { ...rec, name: name.trim() || rec.name, updatedAt: new Date().toISOString() });
}

export async function duplicateProject(id: string): Promise<ProjectRecord> {
  const db = await getDb();
  const rec = await db.get('projects', id);
  if (!rec) throw new Error('Project not found');
  const newId = uid('pf');
  const portfolio: Portfolio = { ...structuredClone(rec.portfolio), id: newId };
  const created = await createProject(portfolio, `${rec.name} (copy)`);
  const assets = await listAssets(id);
  for (const a of assets) await putAssetRecord({ ...a, projectId: created.id });
  return created;
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['projects', 'snapshots', 'assets'], 'readwrite');
  await tx.objectStore('projects').delete(id);
  const snaps = await tx.objectStore('snapshots').index('byProject').getAllKeys(id);
  for (const k of snaps) await tx.objectStore('snapshots').delete(k);
  const assets = await tx.objectStore('assets').index('byProject').getAllKeys(id);
  for (const k of assets) await tx.objectStore('assets').delete(k);
  await tx.done;
}

/* ------------------------------ Snapshots ------------------------------ */

export type SnapshotSummary = Omit<SnapshotRecord, 'data'>;

const MAX_AUTO_SNAPSHOTS = 30;
const MAX_SNAPSHOTS = 80;

export async function createSnapshot(portfolio: Portfolio, kind: SnapshotKind, label = ''): Promise<SnapshotSummary> {
  const db = await getDb();
  const tx = db.transaction(['projects', 'snapshots'], 'readwrite');
  const projects = tx.objectStore('projects');
  const rec = await projects.get(portfolio.id);
  const version = (rec?.versionCounter ?? 0) + 1;
  if (rec) await projects.put({ ...rec, versionCounter: version });
  const data = gzipJson(portfolio);
  const snap: SnapshotRecord = {
    id: uid('snap'),
    projectId: portfolio.id,
    version,
    label: label || { manual: 'Saved', auto: 'Autosave checkpoint', restore: 'Before restore', import: 'Imported' }[kind],
    kind,
    createdAt: new Date().toISOString(),
    data,
    size: data.byteLength,
  };
  await tx.objectStore('snapshots').put(snap);
  await tx.done;
  await pruneSnapshots(portfolio.id);
  const { data: _omit, ...summary } = snap;
  void _omit;
  return summary;
}

async function pruneSnapshots(projectId: string): Promise<void> {
  const db = await getDb();
  const all = (await db.getAllFromIndex('snapshots', 'byProject', projectId)).sort((a, b) => b.version - a.version);
  const autos = all.filter((s) => s.kind === 'auto');
  const remove = new Set<string>([...autos.slice(MAX_AUTO_SNAPSHOTS).map((s) => s.id), ...all.slice(MAX_SNAPSHOTS).map((s) => s.id)]);
  if (!remove.size) return;
  const tx = db.transaction('snapshots', 'readwrite');
  for (const id of remove) await tx.store.delete(id);
  await tx.done;
}

export async function listSnapshots(projectId: string): Promise<SnapshotSummary[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex('snapshots', 'byProject', projectId);
  return all
    .sort((a, b) => b.version - a.version)
    .map((s) => {
      const { data: _d, ...rest } = s;
      void _d;
      return rest;
    });
}

export async function loadSnapshot(id: string): Promise<Portfolio> {
  const db = await getDb();
  const snap = await db.get('snapshots', id);
  if (!snap) throw new Error('Version not found');
  return parsePortfolio(gunzipJson(snap.data)).portfolio;
}

export async function deleteSnapshot(id: string): Promise<void> {
  await (await getDb()).delete('snapshots', id);
}

/* ------------------------------- Backups ------------------------------- */

export async function buildBackup(portfolio: Portfolio): Promise<ProjectBackup> {
  const assets = await serializeAssets(portfolio.id);
  return {
    format: 'portfolio-os-project',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    generator: BRAND.generator,
    portfolio,
    assets,
  };
}

export interface ImportResult {
  project: ProjectRecord;
  warnings: string[];
  migratedFrom: string | null;
}

/** Import a backup or a bare portfolio JSON as a *new* project (never overwrites). */
export async function importProjectJson(json: unknown, nameOverride?: string): Promise<ImportResult> {
  const obj = json as Partial<ProjectBackup> | null;
  const isBackup = !!obj && typeof obj === 'object' && obj.format === 'portfolio-os-project';
  const { portfolio, warnings, migratedFrom } = parsePortfolio(isBackup ? obj.portfolio : json);
  const fresh: Portfolio = { ...portfolio, id: uid('pf') };
  const project = await createProject(fresh, nameOverride ?? portfolio.metadata.title);
  if (isBackup && Array.isArray(obj.assets)) {
    for (const a of obj.assets) {
      try {
        const rec = await deserializeAsset(project.id, a);
        await putAssetRecord(rec);
      } catch {
        warnings.push(`Image "${a?.name ?? a?.id}" could not be restored.`);
      }
    }
  }
  const referenced = collectRefs(fresh);
  const present = new Set((await listAssets(project.id)).map((a) => a.id));
  const missing = referenced.filter((id) => !present.has(id));
  if (missing.length) warnings.push(`${missing.length} image(s) referenced by the project are missing from the file.`);
  await createSnapshot(project.portfolio, 'import', migratedFrom ? `Imported (migrated from v${migratedFrom})` : 'Imported');
  return { project, warnings, migratedFrom };
}

function collectRefs(p: Portfolio): string[] {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === 'string') {
      if (isAssetRef(v)) out.add(assetIdOf(v));
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(p.sections);
  walk(p.metadata);
  return [...out];
}

export { assetRef };
