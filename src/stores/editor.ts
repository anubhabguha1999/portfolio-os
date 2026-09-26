import { create } from 'zustand';
import type { Portfolio, PortfolioSection, SectionType } from '@/types/portfolio';
import { createSection, getDefinition, uniqueAnchor } from '@/sections/registry';
import { getTheme } from '@/lib/theme/themes';
import { setIn, moveItem, type PathKey } from '@/utils/path';
import { uid } from '@/utils/id';

export interface HistoryEntry {
  portfolio: Portfolio;
  label: string;
  at: number;
}

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export interface EditorState {
  projectId: string | null;
  projectName: string;
  portfolio: Portfolio | null;
  past: HistoryEntry[];
  future: HistoryEntry[];
  selectedSectionId: string | null;
  revision: number;
  saveState: SaveState;
  lastSavedAt: string | null;
  saveError: string | null;
  lastChange: { key: string; at: number } | null;
  /** Last action that was rejected (e.g. section locked); UI shows a toast. */
  rejection: { message: string; at: number } | null;
}

export interface EditorActions {
  load(projectId: string, name: string, portfolio: Portfolio): void;
  close(): void;
  setProjectName(name: string): void;
  apply(label: string, recipe: (p: Portfolio) => Portfolio, opts?: { coalesce?: string }): boolean;
  undo(): void;
  redo(): void;
  select(id: string | null): void;
  addSection(type: SectionType, index?: number): string | null;
  removeSection(id: string): boolean;
  duplicateSection(id: string): string | null;
  moveSection(id: string, toIndex: number): boolean;
  toggleEnabled(id: string): void;
  toggleLocked(id: string): void;
  renameSection(id: string, name: string): void;
  updateSectionData(id: string, path: string | PathKey[], value: unknown): boolean;
  updateSectionStyle(id: string, path: string | PathKey[], value: unknown): boolean;
  setTheme(themeId: string): void;
  replaceTheme(theme: Portfolio['theme'], label: string): void;
  updateTheme(path: string | PathKey[], value: unknown): void;
  updateMetadata(path: string | PathKey[], value: unknown): void;
  updateSettings(path: string | PathKey[], value: unknown): void;
  replacePortfolio(p: Portfolio, label: string): void;
  markSaving(): void;
  markSaved(at: string): void;
  markSaveError(message: string): void;
}

const HISTORY_LIMIT = 150;
const COALESCE_MS = 1200;

const initial: EditorState = {
  projectId: null,
  projectName: '',
  portfolio: null,
  past: [],
  future: [],
  selectedSectionId: null,
  revision: 0,
  saveState: 'idle',
  lastSavedAt: null,
  saveError: null,
  lastChange: null,
  rejection: null,
};

function reindex(sections: PortfolioSection[]): PortfolioSection[] {
  return sections.map((s, i) => (s.order === i ? s : { ...s, order: i }));
}

function sorted(p: Portfolio): PortfolioSection[] {
  return [...p.sections].sort((a, b) => a.order - b.order);
}

export const useEditor = create<EditorState & EditorActions>()((set, get) => {
  const reject = (message: string) => {
    set({ rejection: { message, at: Date.now() } });
    return false;
  };

  const findSection = (id: string) => get().portfolio?.sections.find((s) => s.id === id);

  const mapSection = (id: string, fn: (s: PortfolioSection) => PortfolioSection) => (p: Portfolio) => ({
    ...p,
    sections: p.sections.map((s) => (s.id === id ? fn(s) : s)),
  });

  return {
    ...initial,

    load(projectId, name, portfolio) {
      const first = sorted(portfolio)[0];
      set({ ...initial, projectId, projectName: name, portfolio: { ...portfolio, sections: reindex(sorted(portfolio)) }, selectedSectionId: first?.id ?? null, saveState: 'saved' });
    },

    close() {
      set({ ...initial });
    },

    setProjectName(name) {
      set({ projectName: name });
    },

    apply(label, recipe, opts = {}) {
      const { portfolio, past, lastChange } = get();
      if (!portfolio) return false;
      const next = recipe(portfolio);
      if (next === portfolio) return false;
      const now = Date.now();
      const coalesce = opts.coalesce && lastChange && lastChange.key === opts.coalesce && now - lastChange.at < COALESCE_MS;
      const newPast = coalesce ? past : [...past, { portfolio, label, at: now }].slice(-HISTORY_LIMIT);
      set((s) => ({
        portfolio: next,
        past: newPast,
        future: [],
        revision: s.revision + 1,
        saveState: 'dirty',
        lastChange: opts.coalesce ? { key: opts.coalesce, at: now } : null,
      }));
      return true;
    },

    undo() {
      const { past, portfolio, future } = get();
      const prev = past[past.length - 1];
      if (!prev || !portfolio) return;
      set((s) => ({
        portfolio: prev.portfolio,
        past: past.slice(0, -1),
        future: [{ portfolio, label: prev.label, at: Date.now() }, ...future].slice(0, HISTORY_LIMIT),
        revision: s.revision + 1,
        saveState: 'dirty',
        lastChange: null,
        selectedSectionId: prev.portfolio.sections.some((x) => x.id === s.selectedSectionId) ? s.selectedSectionId : null,
      }));
    },

    redo() {
      const { past, portfolio, future } = get();
      const next = future[0];
      if (!next || !portfolio) return;
      set((s) => ({
        portfolio: next.portfolio,
        past: [...past, { portfolio, label: next.label, at: Date.now() }].slice(-HISTORY_LIMIT),
        future: future.slice(1),
        revision: s.revision + 1,
        saveState: 'dirty',
        lastChange: null,
        selectedSectionId: next.portfolio.sections.some((x) => x.id === s.selectedSectionId) ? s.selectedSectionId : null,
      }));
    },

    select(id) {
      set({ selectedSectionId: id });
    },

    addSection(type, index) {
      const p = get().portfolio;
      if (!p) return null;
      const def = getDefinition(type);
      if (def.singleton && p.sections.some((s) => s.type === type)) {
        const existing = p.sections.find((s) => s.type === type)!;
        set({ selectedSectionId: existing.id });
        reject(`Only one ${def.label} section is allowed — selected the existing one.`);
        return null;
      }
      const section = createSection(type, {}, p.sections);
      const list = sorted(p);
      const at = index === undefined ? (type === 'hero' ? 0 : list.length) : Math.max(0, Math.min(index, list.length));
      list.splice(at, 0, section);
      get().apply(`Add ${def.label}`, (cur) => ({ ...cur, sections: reindex(list) }));
      set({ selectedSectionId: section.id });
      return section.id;
    },

    removeSection(id) {
      const s = findSection(id);
      if (!s) return false;
      if (s.locked) return reject(`"${s.name}" is locked. Unlock it to delete.`);
      const ok = get().apply(`Delete ${s.name}`, (p) => ({ ...p, sections: reindex(sorted(p).filter((x) => x.id !== id)) }));
      if (ok && get().selectedSectionId === id) set({ selectedSectionId: null });
      return ok;
    },

    duplicateSection(id) {
      const p = get().portfolio;
      const s = findSection(id);
      if (!p || !s) return null;
      const def = getDefinition(s.type);
      if (def.singleton) {
        reject(`Only one ${def.label} section is allowed.`);
        return null;
      }
      const copy = structuredClone(s) as PortfolioSection;
      copy.id = uid('sec');
      copy.name = `${s.name} copy`;
      copy.locked = false;
      copy.style = { ...copy.style, anchor: uniqueAnchor(s.style.anchor, p.sections) };
      // Fresh ids for list items so keys stay unique.
      const data = copy.data as unknown as Record<string, unknown>;
      for (const [k, v] of Object.entries(data)) {
        if (Array.isArray(v)) data[k] = v.map((item) => (item && typeof item === 'object' && 'id' in item ? { ...item, id: uid('itm') } : item));
      }
      const list = sorted(p);
      const idx = list.findIndex((x) => x.id === id);
      list.splice(idx + 1, 0, copy);
      get().apply(`Duplicate ${s.name}`, (cur) => ({ ...cur, sections: reindex(list) }));
      set({ selectedSectionId: copy.id });
      return copy.id;
    },

    moveSection(id, toIndex) {
      const p = get().portfolio;
      const s = findSection(id);
      if (!p || !s) return false;
      if (s.locked) return reject(`"${s.name}" is locked in place.`);
      const list = sorted(p);
      const from = list.findIndex((x) => x.id === id);
      if (from === toIndex || toIndex < 0 || toIndex >= list.length) return false;
      return get().apply(`Move ${s.name}`, (cur) => ({ ...cur, sections: reindex(moveItem(list, from, toIndex)) }));
    },

    toggleEnabled(id) {
      const s = findSection(id);
      if (!s) return;
      get().apply(`${s.enabled ? 'Hide' : 'Show'} ${s.name}`, mapSection(id, (x) => ({ ...x, enabled: !x.enabled })));
    },

    toggleLocked(id) {
      const s = findSection(id);
      if (!s) return;
      get().apply(`${s.locked ? 'Unlock' : 'Lock'} ${s.name}`, mapSection(id, (x) => ({ ...x, locked: !x.locked })));
    },

    renameSection(id, name) {
      const s = findSection(id);
      if (!s || !name.trim()) return;
      get().apply(`Rename ${s.name}`, mapSection(id, (x) => ({ ...x, name: name.trim() })), { coalesce: `rename:${id}` });
    },

    updateSectionData(id, path, value) {
      const s = findSection(id);
      if (!s) return false;
      if (s.locked) return reject(`"${s.name}" is locked. Unlock it to edit.`);
      const key = `data:${id}:${Array.isArray(path) ? path.join('.') : path}`;
      return get().apply(`Edit ${s.name}`, mapSection(id, (x) => ({ ...x, data: setIn(x.data, path, value) }) as PortfolioSection), { coalesce: key });
    },

    updateSectionStyle(id, path, value) {
      const s = findSection(id);
      if (!s) return false;
      if (s.locked) return reject(`"${s.name}" is locked. Unlock it to edit.`);
      const p = get().portfolio!;
      const pathStr = Array.isArray(path) ? path.join('.') : path;
      const v = pathStr === 'anchor' ? uniqueAnchor(String(value || s.type), p.sections, id) : value;
      return get().apply(`Style ${s.name}`, mapSection(id, (x) => ({ ...x, style: setIn(x.style, path, v) })), { coalesce: `style:${id}:${pathStr}` });
    },

    setTheme(themeId) {
      const theme = getTheme(themeId);
      get().apply(`Theme: ${theme.name}`, (p) => ({ ...p, theme, settings: { ...p.settings, colorScheme: p.settings.colorScheme === 'system' ? 'system' : theme.defaultScheme } }));
    },

    replaceTheme(theme, label) {
      get().apply(label, (p) => ({ ...p, theme }));
    },

    updateTheme(path, value) {
      const key = Array.isArray(path) ? path.join('.') : path;
      get().apply('Edit theme', (p) => ({ ...p, theme: setIn(p.theme, path, value) }), { coalesce: `theme:${key}` });
    },

    updateMetadata(path, value) {
      const key = Array.isArray(path) ? path.join('.') : path;
      get().apply('Edit SEO', (p) => ({ ...p, metadata: setIn(p.metadata, path, value) }), { coalesce: `meta:${key}` });
    },

    updateSettings(path, value) {
      const key = Array.isArray(path) ? path.join('.') : path;
      get().apply('Edit settings', (p) => ({ ...p, settings: setIn(p.settings, path, value) }), { coalesce: `settings:${key}` });
    },

    replacePortfolio(next, label) {
      const cur = get().portfolio;
      if (!cur) return;
      get().apply(label, () => ({ ...next, id: cur.id, sections: reindex(sorted(next)) }));
      const sel = get().selectedSectionId;
      if (sel && !next.sections.some((s) => s.id === sel)) set({ selectedSectionId: null });
    },

    markSaving() {
      set({ saveState: 'saving', saveError: null });
    },
    markSaved(at) {
      set((s) => ({ saveState: s.saveState === 'saving' ? 'saved' : s.saveState, lastSavedAt: at, saveError: null }));
    },
    markSaveError(message) {
      set({ saveState: 'error', saveError: message });
    },
  };
});

/** Stable selectors. */
export const selectSortedSections = (s: EditorState): PortfolioSection[] => (s.portfolio ? sorted(s.portfolio) : []);
export const selectSelected = (s: EditorState): PortfolioSection | null => s.portfolio?.sections.find((x) => x.id === s.selectedSectionId) ?? null;
