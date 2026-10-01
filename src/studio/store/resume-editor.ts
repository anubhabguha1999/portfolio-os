/**
 * Resume Studio state. One history covers the resume *and* the shared library/profile,
 * so undo reverts a shared edit made from inside the studio too.
 *
 * Field edits on library-backed items follow the sharing rule:
 *   shared field   → written to the library (portfolio + every resume update)
 *   detached field → written to this resume's ItemRef.overrides only
 */
import { create } from 'zustand';
import type { ItemRef, Library, LibraryKind, LocalEntry, Profile, ResumeDoc, ResumeSection, ResumeSectionKind, ResumeStyle } from '@/studio/model/types';
import { createEntry, createRef, createResumeSection, sectionInfo } from '@/studio/model/defaults';
import { sectionRefs } from '@/studio/model/resolve';
import { getResume, saveResume } from '@/studio/storage/repo';
import { ensureWorkspace, useWorkspace } from './workspace';
import { uid } from '@/utils/id';

interface Snapshot {
  resume: ResumeDoc;
  library: Library;
  profile: Profile;
  label: string;
}

export type Selection = { sectionId: string | null; itemId: string | null };

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface ResumeEditorState {
  resume: ResumeDoc | null;
  status: 'idle' | 'loading' | 'ready' | 'missing' | 'error';
  past: Snapshot[];
  future: Snapshot[];
  selection: Selection;
  saveState: SaveState;
  lastKey: string | null;
  lastAt: number;
  load(id: string): Promise<void>;
  close(): void;
  /** Change the resume only. */
  apply(label: string, fn: (r: ResumeDoc) => ResumeDoc, coalesce?: string): void;
  /** Change shared data (library/profile), optionally the resume too, as one undo step. */
  applyShared(label: string, fns: { library?: (l: Library) => Library; profile?: (p: Profile) => Profile; resume?: (r: ResumeDoc) => ResumeDoc }, coalesce?: string): void;
  undo(): void;
  redo(): void;
  select(sel: Partial<Selection>): void;
  selectRef(ref: string | null): void;
  flush(): Promise<void>;

  /* sections */
  addSection(kind: ResumeSectionKind, index?: number): string;
  duplicateSection(id: string): void;
  removeSection(id: string): void;
  moveSection(id: string, to: number): void;
  patchSection(id: string, patch: Partial<ResumeSection>, coalesce?: string): void;
  setStyle(patch: Partial<ResumeStyle>, coalesce?: string): void;

  /* library-backed items */
  addLibraryItem(sectionId: string): string | null;
  attachLibraryItem(sectionId: string, libId: string): void;
  /** One undo step: replace the library (with adopted knowledge items) and attach them to the section. */
  insertLibraryItems(sectionId: string, library: Library, ids: string[]): void;
  hideRef(sectionId: string, refId: string, hidden: boolean): void;
  moveRef(sectionId: string, refId: string, to: number): void;
  duplicateLibraryItem(sectionId: string, refId: string): void;
  deleteLibraryItem(kind: LibraryKind, libId: string): void;
  setItemField(sectionId: string, refId: string, key: string, value: unknown): void;
  toggleDetach(sectionId: string, refId: string, key: string, detach: boolean): void;

  /* local entries */
  addEntry(sectionId: string, over?: Partial<LocalEntry>): string;
  patchEntry(sectionId: string, entryId: string, patch: Partial<LocalEntry>): void;
  removeEntry(sectionId: string, entryId: string): void;
  moveEntry(sectionId: string, entryId: string, to: number): void;
  duplicateEntry(sectionId: string, entryId: string): void;
}

const FIT_KEYS = new Set(['baseSize', 'lineHeight', 'spacing', 'margins', 'paper', 'pageLimit', 'font']);
const HISTORY = 120;
const COALESCE_MS = 1000;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

const mapSection = (r: ResumeDoc, id: string, fn: (s: ResumeSection) => ResumeSection): ResumeDoc => ({ ...r, sections: r.sections.map((s) => (s.id === id ? fn(s) : s)) });

function move<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [x] = next.splice(from, 1);
  if (x === undefined) return arr;
  next.splice(Math.max(0, Math.min(next.length, to)), 0, x);
  return next;
}

/** Turn auto-included items into explicit refs so they can be ordered/hidden. */
function materialize(section: ResumeSection, library: Library): ResumeSection {
  const kind = sectionInfo(section.kind).library;
  if (!kind || kind === 'skills') return section;
  const refs = sectionRefs(section, library, kind).map(({ ref }) => (ref.id.startsWith('auto-') ? { ...createRef(ref.libId) } : ref));
  const hidden = section.refs.filter((r) => r.hidden && !refs.some((x) => x.libId === r.libId));
  return { ...section, refs: [...refs, ...hidden] };
}

function libKind(section: ResumeSection): LibraryKind | null {
  return sectionInfo(section.kind).library;
}

export const useResumeEditor = create<ResumeEditorState>()((set, get) => {
  const scheduleSave = () => {
    set({ saveState: 'dirty' });
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void persist(), 500);
  };
  const persist = async () => {
    saveTimer = null;
    const r = get().resume;
    if (!r) return;
    set({ saveState: 'saving' });
    try {
      const saved = await saveResume(r);
      if (get().resume?.id === saved.id) set({ saveState: 'saved' });
    } catch {
      set({ saveState: 'error' });
    }
  };
  const snapshot = (label: string): Snapshot => {
    const ws = useWorkspace.getState();
    return { resume: get().resume!, library: ws.library, profile: ws.profile, label };
  };
  const record = (label: string, coalesce?: string) => {
    const { past, lastKey, lastAt } = get();
    const nowT = Date.now();
    const merge = coalesce && coalesce === lastKey && nowT - lastAt < COALESCE_MS;
    set({ past: merge ? past : [...past, snapshot(label)].slice(-HISTORY), future: [], lastKey: coalesce ?? null, lastAt: nowT });
  };
  const restore = (s: Snapshot) => {
    const ws = useWorkspace.getState();
    if (ws.library !== s.library) ws.setLibrary(s.library);
    if (ws.profile !== s.profile) ws.setProfile(s.profile);
    set({ resume: s.resume });
    scheduleSave();
  };
  const section = (id: string) => get().resume?.sections.find((s) => s.id === id);

  return {
    resume: null,
    status: 'idle',
    past: [],
    future: [],
    selection: { sectionId: null, itemId: null },
    saveState: 'idle',
    lastKey: null,
    lastAt: 0,

    async load(id) {
      if (get().resume?.id === id && get().status === 'ready') return;
      set({ status: 'loading', resume: null, past: [], future: [], selection: { sectionId: null, itemId: null } });
      try {
        await ensureWorkspace();
        const r = await getResume(id);
        if (!r) return set({ status: 'missing' });
        set({ resume: r, status: 'ready', saveState: 'saved', selection: { sectionId: r.sections[0]?.id ?? null, itemId: null } });
      } catch {
        set({ status: 'error' });
      }
    },

    close() {
      void get().flush();
      set({ resume: null, status: 'idle', past: [], future: [] });
    },

    apply(label, fn, coalesce) {
      const r = get().resume;
      if (!r) return;
      const next = fn(r);
      if (next === r) return;
      record(label, coalesce);
      set({ resume: next });
      scheduleSave();
    },

    applyShared(label, fns, coalesce) {
      const r = get().resume;
      if (!r) return;
      record(label, coalesce);
      const ws = useWorkspace.getState();
      if (fns.library) ws.setLibrary(fns.library);
      if (fns.profile) ws.setProfile(fns.profile);
      if (fns.resume) {
        set({ resume: fns.resume(r) });
        scheduleSave();
      }
    },

    undo() {
      const { past, future } = get();
      const prev = past[past.length - 1];
      if (!prev || !get().resume) return;
      const cur = snapshot(prev.label);
      set({ past: past.slice(0, -1), future: [cur, ...future].slice(0, HISTORY), lastKey: null });
      restore(prev);
    },

    redo() {
      const { past, future } = get();
      const next = future[0];
      if (!next || !get().resume) return;
      const cur = snapshot(next.label);
      set({ past: [...past, cur], future: future.slice(1), lastKey: null });
      restore(next);
    },

    select(sel) {
      set((s) => ({ selection: { ...s.selection, ...sel } }));
    },

    selectRef(ref) {
      const r = get().resume;
      if (!r || !ref) return set({ selection: { sectionId: get().selection.sectionId, itemId: null } });
      if (ref === 'profile' || ref === r.sections.find((s) => s.kind === 'profile')?.id) {
        const prof = r.sections.find((s) => s.kind === 'profile');
        return set({ selection: { sectionId: prof?.id ?? null, itemId: null } });
      }
      const sec = r.sections.find((s) => s.id === ref);
      if (sec) return set({ selection: { sectionId: sec.id, itemId: null } });
      for (const s of r.sections) {
        if (s.entries.some((e) => e.id === ref) || s.refs.some((x) => x.id === ref)) return set({ selection: { sectionId: s.id, itemId: ref } });
        if (ref.startsWith('auto-') && libKind(s) && s.autoInclude) {
          const libId = ref.slice(5);
          const kind = libKind(s)!;
          if ((useWorkspace.getState().library[kind] as Array<{ id: string }>).some((i) => i.id === libId)) return set({ selection: { sectionId: s.id, itemId: ref } });
        }
      }
    },

    async flush() {
      if (saveTimer) {
        clearTimeout(saveTimer);
        await persist();
      }
    },

    /* ------------------------------ sections ------------------------------ */

    addSection(kind, index) {
      const s = createResumeSection(kind);
      get().apply(`Add ${sectionInfo(kind).label}`, (r) => {
        const sections = [...r.sections];
        sections.splice(index ?? sections.length, 0, s);
        return { ...r, sections };
      });
      set({ selection: { sectionId: s.id, itemId: null } });
      return s.id;
    },

    duplicateSection(id) {
      const src = section(id);
      if (!src) return;
      const copy: ResumeSection = { ...structuredClone(src), id: uid('rs'), title: `${src.title} (copy)` };
      copy.refs = copy.refs.map((r) => ({ ...r, id: uid('ref') }));
      copy.entries = copy.entries.map((e) => ({ ...e, id: uid('ent') }));
      get().apply('Duplicate section', (r) => {
        const i = r.sections.findIndex((s) => s.id === id);
        const sections = [...r.sections];
        sections.splice(i + 1, 0, copy);
        return { ...r, sections };
      });
      set({ selection: { sectionId: copy.id, itemId: null } });
    },

    removeSection(id) {
      get().apply('Remove section', (r) => ({ ...r, sections: r.sections.filter((s) => s.id !== id) }));
      if (get().selection.sectionId === id) set({ selection: { sectionId: null, itemId: null } });
    },

    moveSection(id, to) {
      get().apply('Move section', (r) => {
        const from = r.sections.findIndex((s) => s.id === id);
        return from < 0 ? r : { ...r, sections: move(r.sections, from, to) };
      });
    },

    patchSection(id, patch, coalesce) {
      get().apply('Edit section', (r) => mapSection(r, id, (s) => ({ ...s, ...patch })), coalesce ?? `sec:${id}:${Object.keys(patch).join(',')}`);
    },

    setStyle(patch, coalesce) {
      // Manual typography/page changes invalidate a previous Fit to page result.
      const resetsFit = !('fit' in patch) && Object.keys(patch).some((k) => FIT_KEYS.has(k));
      get().apply('Change design', (r) => ({ ...r, style: { ...r.style, ...patch, ...(resetsFit ? { fit: null } : {}) } }), coalesce ?? `style:${Object.keys(patch).join(',')}`);
    },

    /* --------------------------- library items --------------------------- */

    addLibraryItem(sectionId) {
      const s = section(sectionId);
      const kind = s ? libKind(s) : null;
      if (!s || !kind) return null;
      const ws = useWorkspace.getState();
      const factory = { experience: { role: 'New role', company: 'Company' }, projects: { title: 'New project' }, education: { institution: 'Institution', degree: 'Degree' }, skills: { name: 'New skill' }, certifications: { name: 'Certification' }, achievements: { title: 'Achievement' } }[kind];
      let newId = '';
      get().applyShared(`Add ${kind}`, {
        library: (l) => {
          const probe = { ...l };
          const item = { id: uid(kind.slice(0, 3)), ...factory };
          newId = item.id;
          return { ...probe, [kind]: [...(l[kind] as unknown[]), { ...defaultsFor(kind), ...item }] } as Library;
        },
        resume: (r) => mapSection(r, sectionId, (sec) => (kind === 'skills' ? (sec.skillIds ? { ...sec, skillIds: [...sec.skillIds, newId] } : sec) : { ...materialize(sec, ws.library), refs: [...materialize(sec, ws.library).refs, createRef(newId)] })),
      });
      const ref = get().resume?.sections.find((x) => x.id === sectionId)?.refs.find((r) => r.libId === newId);
      set({ selection: { sectionId, itemId: ref?.id ?? null } });
      return ref?.id ?? newId;
    },

    attachLibraryItem(sectionId, libId) {
      const lib = useWorkspace.getState().library;
      get().apply('Add from library', (r) =>
        mapSection(r, sectionId, (s) => {
          const m = materialize(s, lib);
          const existing = m.refs.find((x) => x.libId === libId);
          if (existing) return { ...m, refs: m.refs.map((x) => (x.libId === libId ? { ...x, hidden: false } : x)) };
          return { ...m, refs: [...m.refs, createRef(libId)] };
        }),
      );
    },

    insertLibraryItems(sectionId, library, ids) {
      const s = section(sectionId);
      const kind = s ? libKind(s) : null;
      if (!s || !kind || !ids.length) return;
      get().applyShared('Insert from library', {
        library: () => library,
        resume: (r) =>
          mapSection(r, sectionId, (sec) => {
            if (kind === 'skills') return sec.skillIds ? { ...sec, skillIds: [...new Set([...sec.skillIds, ...ids])] } : sec;
            const m = materialize(sec, library);
            const refs = m.refs.map((x) => (ids.includes(x.libId) ? { ...x, hidden: false } : x));
            for (const id of ids) if (!refs.some((x) => x.libId === id)) refs.push(createRef(id));
            return { ...m, refs };
          }),
      });
    },

    hideRef(sectionId, refId, hidden) {
      const lib = useWorkspace.getState().library;
      get().apply(hidden ? 'Hide item' : 'Show item', (r) =>
        mapSection(r, sectionId, (s) => {
          const m = materialize(s, lib);
          const libId = refId.startsWith('auto-') ? refId.slice(5) : s.refs.find((x) => x.id === refId)?.libId;
          return { ...m, refs: m.refs.map((x) => (x.libId === libId ? { ...x, hidden } : x)) };
        }),
      );
    },

    moveRef(sectionId, refId, to) {
      const lib = useWorkspace.getState().library;
      get().apply('Reorder items', (r) =>
        mapSection(r, sectionId, (s) => {
          const m = materialize(s, lib);
          const libId = refId.startsWith('auto-') ? refId.slice(5) : s.refs.find((x) => x.id === refId)?.libId;
          const visible = m.refs.filter((x) => !x.hidden);
          const from = visible.findIndex((x) => x.libId === libId);
          if (from < 0) return s;
          return { ...m, refs: [...move(visible, from, to), ...m.refs.filter((x) => x.hidden)] };
        }),
      );
    },

    duplicateLibraryItem(sectionId, refId) {
      const s = section(sectionId);
      const kind = s ? libKind(s) : null;
      if (!s || !kind) return;
      const lib = useWorkspace.getState().library;
      const libId = refId.startsWith('auto-') ? refId.slice(5) : s.refs.find((x) => x.id === refId)?.libId;
      const item = (lib[kind] as Array<{ id: string }>).find((i) => i.id === libId);
      if (!item) return;
      const copy = { ...structuredClone(item), id: uid(kind.slice(0, 3)) };
      get().applyShared('Duplicate item', {
        library: (l) => ({ ...l, [kind]: [...(l[kind] as unknown[]), copy] }) as Library,
        resume: (r) =>
          mapSection(r, sectionId, (sec) => {
            const m = materialize(sec, lib);
            const i = m.refs.findIndex((x) => x.libId === libId);
            const refs = [...m.refs];
            refs.splice(i + 1, 0, createRef(copy.id));
            return { ...m, refs };
          }),
      });
    },

    deleteLibraryItem(kind, libId) {
      get().applyShared('Delete from library', {
        library: (l) => ({ ...l, [kind]: (l[kind] as Array<{ id: string }>).filter((i) => i.id !== libId) }) as Library,
        resume: (r) => ({ ...r, sections: r.sections.map((s) => ({ ...s, refs: s.refs.filter((x) => x.libId !== libId), skillIds: s.skillIds ? s.skillIds.filter((x) => x !== libId) : s.skillIds })) }),
      });
      set((st) => ({ selection: { ...st.selection, itemId: null } }));
    },

    setItemField(sectionId, refId, key, value) {
      const s = section(sectionId);
      const kind = s ? libKind(s) : null;
      if (!s || !kind) return;
      const lib = useWorkspace.getState().library;
      const ref: ItemRef | undefined = s.refs.find((x) => x.id === refId) ?? (refId.startsWith('auto-') ? { id: refId, libId: refId.slice(5), hidden: false, detached: [], overrides: {} } : undefined);
      if (!ref) return;
      if (ref.detached.includes(key)) {
        get().apply('Edit resume-only field', (r) => mapSection(r, sectionId, (sec) => ({ ...sec, refs: sec.refs.map((x) => (x.id === refId ? { ...x, overrides: { ...x.overrides, [key]: value } } : x)) })), `ov:${refId}:${key}`);
        return;
      }
      void lib;
      get().applyShared('Edit shared field', { library: (l) => ({ ...l, [kind]: (l[kind] as Array<{ id: string }>).map((i) => (i.id === ref.libId ? { ...i, [key]: value } : i)) }) as Library }, `lib:${ref.libId}:${key}`);
    },

    toggleDetach(sectionId, refId, key, detach) {
      const s = section(sectionId);
      const kind = s ? libKind(s) : null;
      if (!s || !kind) return;
      const lib = useWorkspace.getState().library;
      get().apply(detach ? 'Make field resume-only' : 'Share field again', (r) =>
        mapSection(r, sectionId, (sec) => {
          const m = refId.startsWith('auto-') ? materialize(sec, lib) : sec;
          const libId = refId.startsWith('auto-') ? refId.slice(5) : sec.refs.find((x) => x.id === refId)?.libId;
          const item = (lib[kind] as unknown as Array<Record<string, unknown>>).find((i) => i.id === libId);
          return {
            ...m,
            refs: m.refs.map((x) => {
              if (x.libId !== libId) return x;
              if (detach) return { ...x, detached: [...new Set([...x.detached, key])], overrides: { ...x.overrides, [key]: structuredClone(item?.[key] ?? '') } };
              const overrides = { ...x.overrides };
              delete overrides[key];
              return { ...x, detached: x.detached.filter((k) => k !== key), overrides };
            }),
          };
        }),
      );
      if (refId.startsWith('auto-')) {
        const newRef = get().resume?.sections.find((x) => x.id === sectionId)?.refs.find((x) => x.libId === refId.slice(5));
        if (newRef) set({ selection: { sectionId, itemId: newRef.id } });
      }
    },

    /* ---------------------------- local entries ---------------------------- */

    addEntry(sectionId, over = {}) {
      const e = createEntry(over);
      get().apply('Add entry', (r) => mapSection(r, sectionId, (s) => ({ ...s, entries: [...s.entries, e] })));
      set({ selection: { sectionId, itemId: e.id } });
      return e.id;
    },

    patchEntry(sectionId, entryId, patch) {
      get().apply('Edit entry', (r) => mapSection(r, sectionId, (s) => ({ ...s, entries: s.entries.map((e) => (e.id === entryId ? { ...e, ...patch } : e)) })), `ent:${entryId}:${Object.keys(patch).join(',')}`);
    },

    removeEntry(sectionId, entryId) {
      get().apply('Remove entry', (r) => mapSection(r, sectionId, (s) => ({ ...s, entries: s.entries.filter((e) => e.id !== entryId) })));
    },

    moveEntry(sectionId, entryId, to) {
      get().apply('Reorder entries', (r) =>
        mapSection(r, sectionId, (s) => {
          const from = s.entries.findIndex((e) => e.id === entryId);
          return from < 0 ? s : { ...s, entries: move(s.entries, from, to) };
        }),
      );
    },

    duplicateEntry(sectionId, entryId) {
      get().apply('Duplicate entry', (r) =>
        mapSection(r, sectionId, (s) => {
          const i = s.entries.findIndex((e) => e.id === entryId);
          if (i < 0) return s;
          const entries = [...s.entries];
          entries.splice(i + 1, 0, { ...structuredClone(s.entries[i]!), id: uid('ent') });
          return { ...s, entries };
        }),
      );
    },
  };
});

function defaultsFor(kind: LibraryKind): Record<string, unknown> {
  switch (kind) {
    case 'experience':
      return { company: '', role: '', location: '', start: '', end: '', current: false, url: '', description: '', achievements: [], technologies: [] };
    case 'projects':
      return { title: '', description: '', technologies: [], role: '', duration: '', github: '', live: '', features: [], resumeSummary: '', resumeBullets: [] };
    case 'education':
      return { institution: '', degree: '', field: '', location: '', start: '', end: '', grade: '', description: '' };
    case 'skills':
      return { name: '', category: '', level: 0 };
    case 'certifications':
      return { name: '', issuer: '', date: '', credentialId: '', url: '' };
    case 'achievements':
      return { title: '', description: '', date: '', url: '' };
  }
}
