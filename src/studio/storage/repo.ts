/**
 * IndexedDB persistence for the studios. Everything stays on this device.
 * Records are merged onto current defaults when read, so older data keeps working
 * after the model gains fields.
 */
import { getDb, type StudioImageRecord, type StudioRenderRecord } from '@/lib/storage/db';
import { uid } from '@/utils/id';
import { normalizeLanguage } from '@/i18n';
import type { Library, Profile, ResumeDoc, ResumeSection, StudioDocument } from '@/studio/model/types';
import { createDocument, createLibProject, createResume, createResumeSection, DEFAULT_PAGE, DEFAULT_RESUME_STYLE, emptyLetter, emptyLibrary, emptyProfile } from '@/studio/model/defaults';

export interface PortfolioLink {
  projectId: string;
  enabled: boolean;
  lastSyncedAt: string | null;
}

export type LinkMap = Record<string, PortfolioLink>;

export interface StudioSummary {
  id: string;
  name: string;
  updatedAt: string;
  kind: string;
  templateId: string;
}

const now = () => new Date().toISOString();
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/* ------------------------------ normalise --------------------------- */

export function normalizeProfile(raw: unknown): Profile {
  const base = emptyProfile();
  if (!isObj(raw)) return base;
  const p = { ...base, ...raw } as Profile;
  p.socialLinks = Array.isArray(p.socialLinks) ? p.socialLinks.filter(isObj).map((s) => ({ id: String(s.id || uid('sl')), platform: String(s.platform ?? ''), label: String(s.label ?? ''), url: String(s.url ?? '') })) : [];
  return p;
}

export function normalizeLibrary(raw: unknown): Library {
  const base = emptyLibrary();
  if (!isObj(raw)) return base;
  const out = { ...base } as Library;
  for (const k of ['experience', 'projects', 'education', 'skills', 'certifications', 'achievements'] as const) {
    const arr = raw[k];
    (out as unknown as Record<string, unknown>)[k] = Array.isArray(arr) ? arr.filter(isObj) : [];
  }
  // Projects gained resume-specific fields.
  out.projects = out.projects.map((p) => ({ ...createLibProject(), ...p }));
  out.updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : now();
  return out;
}

function normalizeSection(raw: unknown): ResumeSection | null {
  if (!isObj(raw) || typeof raw.kind !== 'string') return null;
  const base = createResumeSection(raw.kind as ResumeSection['kind']);
  return { ...base, ...raw, refs: Array.isArray(raw.refs) ? (raw.refs as ResumeSection['refs']) : [], entries: Array.isArray(raw.entries) ? (raw.entries as ResumeSection['entries']) : [] } as ResumeSection;
}

export function normalizeResume(raw: unknown): ResumeDoc | null {
  if (!isObj(raw) || typeof raw.id !== 'string') return null;
  const base = createResume(String(raw.name ?? 'Resume'));
  const r = { ...base, ...raw } as ResumeDoc;
  r.style = { ...DEFAULT_RESUME_STYLE, ...(isObj(raw.style) ? raw.style : {}) } as ResumeDoc['style'];
  // Older resumes have no language: English.
  r.style.language = normalizeLanguage(r.style.language);
  r.sections = Array.isArray(raw.sections) ? (raw.sections.map(normalizeSection).filter(Boolean) as ResumeSection[]) : base.sections;
  r.contact = { ...base.contact, ...(isObj(raw.contact) ? raw.contact : {}) } as ResumeDoc['contact'];
  r.meta = { ...base.meta, ...(isObj(raw.meta) ? raw.meta : {}) } as ResumeDoc['meta'];
  return r;
}

export function normalizeDocument(raw: unknown): StudioDocument | null {
  if (!isObj(raw) || typeof raw.id !== 'string') return null;
  const base = createDocument((raw.kind as StudioDocument['kind']) ?? 'custom');
  const d = { ...base, ...raw } as StudioDocument;
  d.page = { ...DEFAULT_PAGE, ...(isObj(raw.page) ? raw.page : {}) } as StudioDocument['page'];
  d.page.language = normalizeLanguage(d.page.language);
  d.blocks = Array.isArray(raw.blocks) ? (raw.blocks.filter(isObj) as unknown as StudioDocument['blocks']) : [];
  d.letter = d.kind === 'cover-letter' ? { ...emptyLetter(), ...(isObj(raw.letter) ? raw.letter : {}) } as StudioDocument['letter'] : null;
  d.meta = { ...base.meta, ...(isObj(raw.meta) ? raw.meta : {}) } as StudioDocument['meta'];
  return d;
}

/* ------------------------------ profile ----------------------------- */

export async function loadProfile(): Promise<Profile> {
  return normalizeProfile(await (await getDb()).get('studio', 'profile'));
}

export async function saveProfile(p: Profile): Promise<void> {
  await (await getDb()).put('studio', p, 'profile');
}

export async function loadLibrary(): Promise<Library> {
  return normalizeLibrary(await (await getDb()).get('studio', 'library'));
}

export async function saveLibrary(l: Library): Promise<void> {
  await (await getDb()).put('studio', l, 'library');
}

export async function loadLinks(): Promise<LinkMap> {
  const v = await (await getDb()).get('studio', 'links');
  return isObj(v) ? (v as LinkMap) : {};
}

export async function saveLinks(links: LinkMap): Promise<void> {
  await (await getDb()).put('studio', links, 'links');
}

/* ------------------------------ resumes ----------------------------- */

export async function listResumes(): Promise<StudioSummary[]> {
  const all = await (await getDb()).getAll('resumes');
  return all
    .map((r) => normalizeResume(r.data))
    .filter((r): r is ResumeDoc => !!r)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((r) => ({ id: r.id, name: r.name, updatedAt: r.updatedAt, kind: r.kind, templateId: r.templateId }));
}

export async function getResume(id: string): Promise<ResumeDoc | null> {
  const rec = await (await getDb()).get('resumes', id);
  return rec ? normalizeResume(rec.data) : null;
}

export async function saveResume(r: ResumeDoc): Promise<ResumeDoc> {
  const next = { ...r, updatedAt: now() };
  await (await getDb()).put('resumes', { id: next.id, name: next.name, updatedAt: next.updatedAt, data: next });
  return next;
}

export async function deleteResume(id: string): Promise<void> {
  await (await getDb()).delete('resumes', id);
}

/** A deep copy with fresh ids. Library references stay shared; detached overrides are copied. */
export async function duplicateResume(id: string, name?: string): Promise<ResumeDoc> {
  const src = await getResume(id);
  if (!src) throw new Error('Resume not found.');
  const copy: ResumeDoc = structuredClone(src);
  copy.id = uid('res');
  copy.name = name?.trim() || `${src.name} (copy)`;
  copy.createdAt = now();
  copy.sections = copy.sections.map((s) => ({ ...s, id: uid('rs'), refs: s.refs.map((r) => ({ ...r, id: uid('ref') })), entries: s.entries.map((e) => ({ ...e, id: uid('ent') })) }));
  return saveResume(copy);
}

/* ----------------------------- documents ---------------------------- */

export async function listDocuments(): Promise<StudioSummary[]> {
  const all = await (await getDb()).getAll('documents');
  return all
    .map((r) => normalizeDocument(r.data))
    .filter((d): d is StudioDocument => !!d)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((d) => ({ id: d.id, name: d.name, updatedAt: d.updatedAt, kind: d.kind, templateId: d.templateId }));
}

export async function getDocument(id: string): Promise<StudioDocument | null> {
  const rec = await (await getDb()).get('documents', id);
  return rec ? normalizeDocument(rec.data) : null;
}

export async function saveDocument(d: StudioDocument): Promise<StudioDocument> {
  const next = { ...d, updatedAt: now() };
  await (await getDb()).put('documents', { id: next.id, name: next.name, updatedAt: next.updatedAt, data: next });
  return next;
}

export async function deleteDocument(id: string): Promise<void> {
  await (await getDb()).delete('documents', id);
}

export async function duplicateDocument(id: string): Promise<StudioDocument> {
  const src = await getDocument(id);
  if (!src) throw new Error('Document not found.');
  const copy: StudioDocument = structuredClone(src);
  copy.id = uid('doc');
  copy.name = `${src.name} (copy)`;
  copy.createdAt = now();
  copy.blocks = copy.blocks.map((b) => ({ ...b, id: uid('blk') }));
  return saveDocument(copy);
}

/* ------------------------------ images ------------------------------ */

export async function putImage(blob: Blob, meta: { name: string; width: number; height: number }): Promise<StudioImageRecord> {
  const rec: StudioImageRecord = { id: uid('simg'), name: meta.name, mime: blob.type || 'application/octet-stream', width: meta.width, height: meta.height, size: blob.size, blob, createdAt: now() };
  await (await getDb()).put('images', rec);
  return rec;
}

export async function getImage(id: string): Promise<StudioImageRecord | undefined> {
  return (await getDb()).get('images', id);
}

export async function listImages(): Promise<StudioImageRecord[]> {
  return (await getDb()).getAll('images');
}

export async function deleteImage(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('images', id);
  const keys = await db.getAllKeys('renders');
  await Promise.all(keys.filter((k) => String(k).includes(id)).map((k) => db.delete('renders', k)));
}

export async function putRender(rec: StudioRenderRecord): Promise<void> {
  await (await getDb()).put('renders', rec);
}

export async function getRender(key: string): Promise<StudioRenderRecord | undefined> {
  return (await getDb()).get('renders', key);
}

export async function deleteRendersWithPrefix(prefix: string): Promise<void> {
  const db = await getDb();
  const keys = await db.getAllKeys('renders');
  await Promise.all(keys.filter((k) => String(k).startsWith(prefix)).map((k) => db.delete('renders', k)));
}

/** Remove every studio record (profile, library, images, resumes, documents). Portfolios are untouched. */
export async function deleteAllStudioData(): Promise<void> {
  const db = await getDb();
  await Promise.all((['studio', 'images', 'renders', 'resumes', 'documents'] as const).map((s) => db.clear(s)));
}

export async function studioUsage(): Promise<{ images: number; imageBytes: number; resumes: number; documents: number }> {
  const db = await getDb();
  const images = await db.getAll('images');
  return { images: images.length, imageBytes: images.reduce((s, i) => s + i.size, 0), resumes: await db.count('resumes'), documents: await db.count('documents') };
}
