/**
 * Document Studio editor state: the open document, undo/redo history with coalescing,
 * block selection and debounced autosave to IndexedDB.
 */
import { create } from 'zustand';
import type { BlockKind, CoverLetterData, DocBlockNode, DocumentMeta, DocumentPageSettings, StudioDocument } from '@/studio/model/types';
import { createBlock } from '@/studio/model/defaults';
import { getDocument, saveDocument } from '@/studio/storage/repo';
import { uid } from '@/utils/id';

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
type Status = 'idle' | 'loading' | 'ready' | 'missing' | 'error';

const HISTORY_LIMIT = 120;
const COALESCE_MS = 1000;
const SAVE_MS = 500;

export interface DocumentEditorState {
  status: Status;
  error: string | null;
  doc: StudioDocument | null;
  past: StudioDocument[];
  future: StudioDocument[];
  lastKey: string | null;
  lastAt: number;
  selected: string | null;
  saveState: SaveState;
  load(id: string): Promise<void>;
  close(): Promise<void>;
  apply(label: string, fn: (d: StudioDocument) => StudioDocument, opts?: { coalesce?: string }): void;
  undo(): void;
  redo(): void;
  select(id: string | null): void;
  flush(): Promise<void>;
  /* conveniences */
  rename(name: string): void;
  setTemplate(id: string): void;
  updatePage(patch: Partial<DocumentPageSettings>, key?: string): void;
  updateMeta(patch: Partial<DocumentMeta>): void;
  setFileName(name: string): void;
  updateLetter(patch: Partial<CoverLetterData>, key?: string): void;
  addBlock(kind: BlockKind, index?: number): string;
  insertBlock(block: DocBlockNode, index?: number): void;
  updateBlock(id: string, patch: Partial<DocBlockNode>, key?: string): void;
  updateBlockStyle(id: string, patch: Partial<DocBlockNode['style']>, key?: string): void;
  removeBlock(id: string): void;
  duplicateBlock(id: string): string | null;
  moveBlock(id: string, to: number): void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useDocumentEditor = create<DocumentEditorState>()((set, get) => {
  const persist = async () => {
    saveTimer = null;
    const doc = get().doc;
    if (!doc) return;
    set({ saveState: 'saving' });
    try {
      await saveDocument(doc);
      if (get().doc === doc) set({ saveState: 'saved' });
    } catch (err) {
      set({ saveState: 'error', error: err instanceof Error ? err.message : 'Could not save' });
    }
  };
  const schedule = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void persist(), SAVE_MS);
    set({ saveState: 'dirty' });
  };
  const mapBlocks = (fn: (b: DocBlockNode) => DocBlockNode) => (d: StudioDocument) => ({ ...d, blocks: d.blocks.map(fn) });

  return {
    status: 'idle',
    error: null,
    doc: null,
    past: [],
    future: [],
    lastKey: null,
    lastAt: 0,
    selected: null,
    saveState: 'idle',

    async load(id) {
      if (get().doc?.id === id && get().status === 'ready') return;
      await get().flush();
      set({ status: 'loading', doc: null, past: [], future: [], selected: null, error: null });
      try {
        const doc = await getDocument(id);
        if (!doc) return set({ status: 'missing' });
        set({ status: 'ready', doc, saveState: 'saved' });
      } catch (err) {
        set({ status: 'error', error: err instanceof Error ? err.message : 'Could not open this document.' });
      }
    },

    async close() {
      await get().flush();
      set({ status: 'idle', doc: null, past: [], future: [], selected: null });
    },

    apply(_label, fn, opts = {}) {
      const { doc, past, lastKey, lastAt } = get();
      if (!doc) return;
      const next = fn(doc);
      if (next === doc) return;
      const now = Date.now();
      const coalesce = !!opts.coalesce && opts.coalesce === lastKey && now - lastAt < COALESCE_MS;
      set({
        doc: next,
        past: coalesce ? past : [...past, doc].slice(-HISTORY_LIMIT),
        future: [],
        lastKey: opts.coalesce ?? null,
        lastAt: now,
      });
      schedule();
    },

    undo() {
      const { past, doc, future } = get();
      const prev = past[past.length - 1];
      if (!prev || !doc) return;
      set({ doc: prev, past: past.slice(0, -1), future: [doc, ...future].slice(0, HISTORY_LIMIT), lastKey: null });
      if (get().selected && !prev.blocks.some((b) => b.id === get().selected)) set({ selected: null });
      schedule();
    },

    redo() {
      const { past, doc, future } = get();
      const next = future[0];
      if (!next || !doc) return;
      set({ doc: next, past: [...past, doc].slice(-HISTORY_LIMIT), future: future.slice(1), lastKey: null });
      schedule();
    },

    select(id) {
      set({ selected: id });
    },

    async flush() {
      if (saveTimer) {
        clearTimeout(saveTimer);
        await persist();
      }
    },

    rename(name) {
      get().apply('Rename', (d) => ({ ...d, name }), { coalesce: 'rename' });
    },
    setTemplate(id) {
      get().apply('Change template', (d) => (d.templateId === id ? d : { ...d, templateId: id }));
    },
    updatePage(patch, key) {
      get().apply('Page settings', (d) => ({ ...d, page: { ...d.page, ...patch } }), key ? { coalesce: `page:${key}` } : {});
    },
    updateMeta(patch) {
      get().apply('Metadata', (d) => ({ ...d, meta: { ...d.meta, ...patch } }), { coalesce: `meta:${Object.keys(patch).join()}` });
    },
    setFileName(fileName) {
      get().apply('File name', (d) => ({ ...d, fileName }), { coalesce: 'filename' });
    },
    updateLetter(patch, key) {
      get().apply('Edit letter', (d) => (d.letter ? { ...d, letter: { ...d.letter, ...patch } } : d), { coalesce: `letter:${key ?? Object.keys(patch).join()}` });
    },
    addBlock(kind, index) {
      const block = createBlock(kind);
      get().insertBlock(block, index);
      return block.id;
    },
    insertBlock(block, index) {
      get().apply('Add block', (d) => {
        const blocks = [...d.blocks];
        blocks.splice(index === undefined ? blocks.length : Math.max(0, Math.min(blocks.length, index)), 0, block);
        return { ...d, blocks };
      });
      set({ selected: block.id });
    },
    updateBlock(id, patch, key) {
      get().apply('Edit block', mapBlocks((b) => (b.id === id ? ({ ...b, ...patch } as DocBlockNode) : b)), { coalesce: `block:${id}:${key ?? Object.keys(patch).join()}` });
    },
    updateBlockStyle(id, patch, key) {
      get().apply('Block style', mapBlocks((b) => (b.id === id ? { ...b, style: { ...b.style, ...patch } } : b)), { coalesce: `style:${id}:${key ?? Object.keys(patch).join()}` });
    },
    removeBlock(id) {
      const idx = get().doc?.blocks.findIndex((b) => b.id === id) ?? -1;
      get().apply('Delete block', (d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== id) }));
      if (get().selected === id) {
        const blocks = get().doc?.blocks ?? [];
        set({ selected: blocks[Math.min(idx, blocks.length - 1)]?.id ?? null });
      }
    },
    duplicateBlock(id) {
      const doc = get().doc;
      const i = doc?.blocks.findIndex((b) => b.id === id) ?? -1;
      const src = doc?.blocks[i];
      if (!src) return null;
      const copy = structuredClone(src) as DocBlockNode;
      copy.id = uid('blk');
      // Nested item ids must stay unique too.
      if ('items' in copy && Array.isArray(copy.items)) copy.items = (copy.items as unknown[]).map((it) => (typeof it === 'object' && it && 'id' in it ? { ...it, id: uid('it') } : it)) as never;
      if (copy.kind === 'columns') copy.columns = copy.columns.map((c) => ({ ...c, id: uid('col') }));
      get().insertBlock(copy, i + 1);
      return copy.id;
    },
    moveBlock(id, to) {
      get().apply('Move block', (d) => {
        const from = d.blocks.findIndex((b) => b.id === id);
        if (from < 0 || from === to) return d;
        const blocks = [...d.blocks];
        const [b] = blocks.splice(from, 1);
        blocks.splice(Math.max(0, Math.min(blocks.length, to)), 0, b!);
        return { ...d, blocks };
      });
    },
  };
});
