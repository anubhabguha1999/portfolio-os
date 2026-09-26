import { create } from 'zustand';
import type { AssetRecord } from '@/types/portfolio';
import { listAssets, storeBlob, deleteAsset } from '@/lib/storage/assets';

export interface AssetMeta {
  id: string;
  name: string;
  mime: string;
  size: number;
  width: number;
  height: number;
}

interface AssetState {
  projectId: string | null;
  urls: Record<string, string>;
  blobs: Record<string, Blob>;
  meta: Record<string, AssetMeta>;
  loaded: boolean;
  loadProject(projectId: string): Promise<void>;
  add(blob: Blob, meta: { name: string; width: number; height: number }): Promise<AssetRecord>;
  remove(id: string): Promise<void>;
  clear(): void;
}

function metaOf(r: AssetRecord): AssetMeta {
  return { id: r.id, name: r.name, mime: r.mime, size: r.size, width: r.width, height: r.height };
}

export const useAssets = create<AssetState>()((set, get) => ({
  projectId: null,
  urls: {},
  blobs: {},
  meta: {},
  loaded: false,

  async loadProject(projectId) {
    get().clear();
    const records = await listAssets(projectId);
    const urls: Record<string, string> = {};
    const blobs: Record<string, Blob> = {};
    const meta: Record<string, AssetMeta> = {};
    for (const r of records) {
      urls[r.id] = URL.createObjectURL(r.blob);
      blobs[r.id] = r.blob;
      meta[r.id] = metaOf(r);
    }
    set({ projectId, urls, blobs, meta, loaded: true });
  },

  async add(blob, m) {
    const projectId = get().projectId;
    if (!projectId) throw new Error('No project is open');
    const rec = await storeBlob(projectId, blob, m);
    set((s) => ({
      urls: { ...s.urls, [rec.id]: URL.createObjectURL(rec.blob) },
      blobs: { ...s.blobs, [rec.id]: rec.blob },
      meta: { ...s.meta, [rec.id]: metaOf(rec) },
    }));
    return rec;
  },

  async remove(id) {
    const projectId = get().projectId;
    if (!projectId) return;
    await deleteAsset(projectId, id);
    const url = get().urls[id];
    if (url) URL.revokeObjectURL(url);
    set((s) => {
      const urls = { ...s.urls };
      const blobs = { ...s.blobs };
      const meta = { ...s.meta };
      delete urls[id];
      delete blobs[id];
      delete meta[id];
      return { urls, blobs, meta };
    });
  },

  clear() {
    Object.values(get().urls).forEach((u) => URL.revokeObjectURL(u));
    set({ projectId: null, urls: {}, blobs: {}, meta: {}, loaded: false });
  },
}));
