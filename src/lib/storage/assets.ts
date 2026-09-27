import type { AssetRecord, SerializedAsset } from '@/types/portfolio';
import { getDb } from './db';
import { uid } from '@/utils/id';

export async function putAssetRecord(rec: AssetRecord): Promise<void> {
  await (await getDb()).put('assets', rec);
}

export async function getAsset(projectId: string, id: string): Promise<AssetRecord | undefined> {
  return (await getDb()).get('assets', [projectId, id]);
}

export async function listAssets(projectId: string): Promise<AssetRecord[]> {
  return (await getDb()).getAllFromIndex('assets', 'byProject', projectId);
}

export async function deleteAsset(projectId: string, id: string): Promise<void> {
  await (await getDb()).delete('assets', [projectId, id]);
}

export async function storeBlob(projectId: string, blob: Blob, meta: { name: string; width: number; height: number }): Promise<AssetRecord> {
  const rec: AssetRecord = {
    id: uid('img'),
    projectId,
    name: meta.name,
    mime: blob.type || 'application/octet-stream',
    size: blob.size,
    width: meta.width,
    height: meta.height,
    blob,
    createdAt: new Date().toISOString(),
  };
  await putAssetRecord(rec);
  return rec;
}

/** Blob → data URL without FileReader (works in workers and any Blob implementation). */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(bin)}`;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) throw new Error('Invalid data URL');
  const mime = m[1] || 'application/octet-stream';
  const payload = m[3] ?? '';
  if (m[2]) {
    const bin = atob(payload);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(payload)], { type: mime });
}

export async function serializeAssets(projectId: string): Promise<SerializedAsset[]> {
  const all = await listAssets(projectId);
  return Promise.all(
    all.map(async (a) => ({ id: a.id, name: a.name, mime: a.mime, size: a.size, width: a.width, height: a.height, dataUrl: await blobToDataUrl(a.blob) })),
  );
}

export async function deserializeAsset(projectId: string, a: SerializedAsset): Promise<AssetRecord> {
  if (!a || typeof a.id !== 'string' || typeof a.dataUrl !== 'string') throw new Error('Invalid asset');
  const blob = dataUrlToBlob(a.dataUrl);
  return {
    id: a.id,
    projectId,
    name: a.name || a.id,
    mime: blob.type || a.mime,
    size: blob.size,
    width: Number(a.width) || 0,
    height: Number(a.height) || 0,
    blob,
    createdAt: new Date().toISOString(),
  };
}

export function extensionForMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/avif': 'avif',
    'font/woff2': 'woff2',
    'font/woff': 'woff',
    'font/ttf': 'ttf',
    'font/otf': 'otf',
  };
  return map[mime] ?? mime.split('/')[1]?.replace(/[^a-z0-9]/g, '') ?? 'bin';
}
