/**
 * Local Knowledge Library persistence (IndexedDB, this device only).
 *
 *   kdocs         document records (name, type, folder, tags, status, current version)
 *   kblobs        original files — can be deleted while keeping the extracted data
 *   kextractions  every extraction version and saved corrections
 *   studio['provenance']   where each imported profile/library field came from
 *   meta['knowledge:folders' | 'knowledge:tags']   user folders and tags
 */
import { getDb, getMeta, setMeta } from '@/lib/storage/db';
import { uid } from '@/utils/id';
import type { AnalyseOutput } from '../analysis/pipeline';
import { DEFAULT_FOLDERS, DEFAULT_TAGS, type Extraction, type KnowledgeDoc, type KnowledgeFileKind, type ProvenanceRecord } from '../types';

const now = () => new Date().toISOString();

export async function sha256(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function kindOf(file: { name: string; type: string }): KnowledgeFileKind | null {
  const n = file.name.toLowerCase();
  if (n.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  if (n.endsWith('.md') || n.endsWith('.markdown') || file.type === 'text/markdown') return 'md';
  if (n.endsWith('.json') || file.type === 'application/json') return 'json';
  if (n.endsWith('.txt') || file.type === 'text/plain') return 'txt';
  return null;
}

/* ------------------------------ documents ---------------------------- */

export async function listDocs(): Promise<KnowledgeDoc[]> {
  const all = await (await getDb()).getAll('kdocs');
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * A document left "processing" by a closed tab or a crash has no running job: put it back to a
 * state the user can act on. `running` = ids with a live job in this tab.
 */
export async function recoverInterrupted(docs: KnowledgeDoc[], running: Set<string>): Promise<KnowledgeDoc[]> {
  return Promise.all(
    docs.map(async (d) => {
      if (d.status !== 'processing' || running.has(d.id)) return d;
      const ext = d.currentVersion ? await getExtraction(d.currentVersion) : undefined;
      const status: KnowledgeDoc['status'] = !ext ? 'new' : ext.semantic.resume ? 'needs-review' : 'completed';
      return (await patchDoc(d.id, { status, error: ext ? null : 'Processing was interrupted (the tab was closed or reloaded). Extract again.' })) ?? d;
    }),
  );
}

export async function getDoc(id: string): Promise<KnowledgeDoc | undefined> {
  return (await getDb()).get('kdocs', id);
}

export async function findByHash(hash: string): Promise<KnowledgeDoc[]> {
  return (await getDb()).getAllFromIndex('kdocs', 'byHash', hash);
}

export async function putDoc(doc: KnowledgeDoc): Promise<KnowledgeDoc> {
  const next = { ...doc, updatedAt: now() };
  await (await getDb()).put('kdocs', next);
  return next;
}

export async function patchDoc(id: string, patch: Partial<KnowledgeDoc>): Promise<KnowledgeDoc | undefined> {
  const doc = await getDoc(id);
  if (!doc) return undefined;
  return putDoc({ ...doc, ...patch });
}

export async function createDoc(file: File, bytes: ArrayBuffer, over: Partial<KnowledgeDoc> = {}): Promise<KnowledgeDoc> {
  const kind = kindOf(file);
  if (!kind) throw new Error(`“${file.name}” is not a supported file. Use .pdf, .txt, .md or .json.`);
  const doc: KnowledgeDoc = {
    id: uid('kdoc'),
    name: file.name,
    kind,
    mime: file.type || (kind === 'pdf' ? 'application/pdf' : 'text/plain'),
    size: bytes.byteLength,
    hash: await sha256(bytes),
    pageCount: 0,
    docType: 'other',
    docTypeLocked: false,
    folder: kind === 'pdf' && /resume|cv/i.test(file.name) ? 'Resume' : 'Documents',
    tags: [],
    status: 'new',
    error: null,
    hasOriginal: true,
    currentVersion: null,
    previousOf: null,
    createdAt: now(),
    updatedAt: now(),
    ...over,
  };
  const db = await getDb();
  const tx = db.transaction(['kdocs', 'kblobs'], 'readwrite');
  await tx.objectStore('kblobs').put({ id: doc.id, blob: new Blob([bytes], { type: doc.mime }) });
  await tx.objectStore('kdocs').put(doc);
  await tx.done;
  return doc;
}

export async function duplicateDoc(id: string): Promise<KnowledgeDoc> {
  const src = await getDoc(id);
  if (!src) throw new Error('Document not found.');
  const db = await getDb();
  const copy: KnowledgeDoc = { ...src, id: uid('kdoc'), name: src.name.replace(/(\.[a-z0-9]+)?$/i, ' (copy)$1'), currentVersion: null, previousOf: null, createdAt: now(), updatedAt: now() };
  const blob = await db.get('kblobs', id);
  if (blob) await db.put('kblobs', { id: copy.id, blob: blob.blob });
  const ext = src.currentVersion ? await db.get('kextractions', src.currentVersion) : undefined;
  if (ext) {
    const e: Extraction = { ...structuredClone(ext), id: uid('kext'), docId: copy.id, version: 1 };
    await db.put('kextractions', e);
    copy.currentVersion = e.id;
  }
  await db.put('kdocs', copy);
  return copy;
}

export async function getOriginal(id: string): Promise<Blob | null> {
  return (await (await getDb()).get('kblobs', id))?.blob ?? null;
}

/** Free space: drop the original file but keep extracted text and structured data. */
export async function deleteOriginal(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('kblobs', id);
  await patchDoc(id, { hasOriginal: false });
}

export async function deleteDoc(id: string): Promise<void> {
  const db = await getDb();
  const exts = await db.getAllKeysFromIndex('kextractions', 'byDoc', id);
  const tx = db.transaction(['kdocs', 'kblobs', 'kextractions'], 'readwrite');
  await Promise.all([tx.objectStore('kdocs').delete(id), tx.objectStore('kblobs').delete(id), ...exts.map((k) => tx.objectStore('kextractions').delete(k))]);
  await tx.done;
}

/* ----------------------------- extractions --------------------------- */

export async function listExtractions(docId: string): Promise<Extraction[]> {
  const all = await (await getDb()).getAllFromIndex('kextractions', 'byDoc', docId);
  return all.sort((a, b) => b.version - a.version);
}

export async function getExtraction(id: string): Promise<Extraction | undefined> {
  return (await getDb()).get('kextractions', id);
}

/** Store a new version and make it current. */
export async function saveExtraction(docId: string, out: AnalyseOutput, label: string, origin: Extraction['origin'] = 'extraction'): Promise<Extraction> {
  const versions = await listExtractions(docId);
  const e: Extraction = { ...out, id: uid('kext'), docId, version: (versions[0]?.version ?? 0) + 1, label, origin, createdAt: now() };
  await (await getDb()).put('kextractions', e);
  const doc = await getDoc(docId);
  if (doc) await putDoc({ ...doc, currentVersion: e.id, pageCount: Math.max(doc.pageCount, out.metadata?.pageCount ?? 0, out.pages.length ? Math.max(...out.pages.map((p) => p.page)) : 0) });
  return e;
}

export async function setCurrentVersion(docId: string, extractionId: string): Promise<void> {
  await patchDoc(docId, { currentVersion: extractionId });
}

export async function currentExtraction(doc: KnowledgeDoc): Promise<Extraction | null> {
  return doc.currentVersion ? ((await getExtraction(doc.currentVersion)) ?? null) : null;
}

/* --------------------------- folders and tags ------------------------ */

export async function listFolders(): Promise<string[]> {
  const v = await getMeta<string[]>('knowledge:folders');
  return Array.isArray(v) && v.length ? v : [...DEFAULT_FOLDERS];
}

export async function saveFolders(folders: string[]): Promise<void> {
  await setMeta('knowledge:folders', [...new Set(folders.map((f) => f.trim()).filter(Boolean))]);
}

export async function listTags(): Promise<string[]> {
  const v = await getMeta<string[]>('knowledge:tags');
  return Array.isArray(v) && v.length ? v : [...DEFAULT_TAGS];
}

export const normalizeTag = (t: string) =>
  t
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

export async function saveTags(tags: string[]): Promise<void> {
  await setMeta('knowledge:tags', [...new Set(tags.map(normalizeTag).filter(Boolean))]);
}

/* ------------------------------ provenance --------------------------- */

export async function loadProvenance(): Promise<Record<string, ProvenanceRecord>> {
  const v = await (await getDb()).get('studio', 'provenance');
  return v && typeof v === 'object' ? (v as Record<string, ProvenanceRecord>) : {};
}

export async function addProvenance(records: ProvenanceRecord[]): Promise<void> {
  if (!records.length) return;
  const cur = await loadProvenance();
  for (const r of records) cur[r.key] = r;
  await (await getDb()).put('studio', cur, 'provenance');
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PROVENANCE_EVENT));
}

/** Fired after provenance changes, so open editors can refresh their source notes. */
export const PROVENANCE_EVENT = 'knowledge:provenance';

export const provenanceKey = (kind: ProvenanceRecord['kind'], itemId: string, field: string) => `${kind}:${itemId}:${field}`;

/* -------------------------------- usage ------------------------------ */

export async function knowledgeUsage(): Promise<{ documents: number; originals: number; originalBytes: number; extractions: number }> {
  const db = await getDb();
  const docs = await db.getAll('kdocs');
  return {
    documents: docs.length,
    originals: docs.filter((d) => d.hasOriginal).length,
    originalBytes: docs.filter((d) => d.hasOriginal).reduce((s, d) => s + d.size, 0),
    extractions: await db.count('kextractions'),
  };
}

export async function deleteAllKnowledge(): Promise<void> {
  const db = await getDb();
  await Promise.all((['kdocs', 'kblobs', 'kextractions'] as const).map((s) => db.clear(s)));
  await db.delete('studio', 'provenance');
}
