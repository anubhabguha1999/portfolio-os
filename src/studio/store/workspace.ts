/**
 * The shared identity: one profile and one library per device, used by every studio.
 * Changes persist to IndexedDB (debounced) and notify subscribers (portfolio sync).
 */
import { create } from 'zustand';
import type { Library, LibraryKind, Profile, ProfileImage } from '@/studio/model/types';
import { emptyLibrary, emptyProfile, LIB_FACTORIES } from '@/studio/model/defaults';
import { loadLibrary, loadLinks, loadProfile, saveLibrary, saveLinks, saveProfile, type LinkMap } from '@/studio/storage/repo';

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export interface WorkspaceState {
  loaded: boolean;
  loading: Promise<void> | null;
  profile: Profile;
  library: Library;
  links: LinkMap;
  saveState: SaveState;
  error: string | null;
  init(): Promise<void>;
  setProfile(next: Profile | ((p: Profile) => Profile)): void;
  patchProfile(patch: Partial<Profile>): void;
  setProfileImage(img: ProfileImage | undefined): void;
  setLibrary(next: Library | ((l: Library) => Library)): void;
  addItem<K extends LibraryKind>(kind: K, over?: Partial<Library[K][number]>): string;
  updateItem<K extends LibraryKind>(kind: K, id: string, patch: Partial<Library[K][number]>): void;
  removeItem(kind: LibraryKind, id: string): void;
  moveItem(kind: LibraryKind, from: number, to: number): void;
  setLinks(links: LinkMap): void;
  flush(): Promise<void>;
  /** Replace everything in memory (after "delete all" or an import). */
  reset(profile?: Profile, library?: Library): void;
}

let timer: ReturnType<typeof setTimeout> | null = null;
let dirtyProfile = false;
let dirtyLibrary = false;
let dirtyLinks = false;

const now = () => new Date().toISOString();

export const useWorkspace = create<WorkspaceState>()((set, get) => {
  const persist = async () => {
    timer = null;
    const { profile, library, links } = get();
    const jobs: Promise<void>[] = [];
    if (dirtyProfile) jobs.push(saveProfile(profile));
    if (dirtyLibrary) jobs.push(saveLibrary(library));
    if (dirtyLinks) jobs.push(saveLinks(links));
    dirtyProfile = dirtyLibrary = dirtyLinks = false;
    if (!jobs.length) return;
    set({ saveState: 'saving' });
    try {
      await Promise.all(jobs);
      set({ saveState: 'saved', error: null });
    } catch (err) {
      set({ saveState: 'error', error: err instanceof Error ? err.message : 'Storage error' });
    }
  };
  const schedule = () => {
    set({ saveState: 'dirty' });
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void persist(), 400);
  };

  return {
    loaded: false,
    loading: null,
    profile: emptyProfile(),
    library: emptyLibrary(),
    links: {},
    saveState: 'idle',
    error: null,

    init() {
      const st = get();
      if (st.loaded) return Promise.resolve();
      if (st.loading) return st.loading;
      const loading = (async () => {
        try {
          const [profile, library, links] = await Promise.all([loadProfile(), loadLibrary(), loadLinks()]);
          set({ profile, library, links, loaded: true, loading: null });
        } catch (err) {
          set({ loaded: true, loading: null, error: err instanceof Error ? err.message : 'Storage unavailable' });
        }
      })();
      set({ loading });
      return loading;
    },

    setProfile(next) {
      const p = typeof next === 'function' ? next(get().profile) : next;
      dirtyProfile = true;
      set({ profile: { ...p, updatedAt: now() } });
      schedule();
    },

    patchProfile(patch) {
      get().setProfile((p) => ({ ...p, ...patch }));
    },

    setProfileImage(img) {
      get().setProfile((p) => {
        const next = { ...p };
        if (img) next.profileImage = img;
        else delete next.profileImage;
        return next;
      });
    },

    setLibrary(next) {
      const l = typeof next === 'function' ? next(get().library) : next;
      dirtyLibrary = true;
      set({ library: { ...l, updatedAt: now() } });
      schedule();
    },

    addItem(kind, over = {}) {
      const item = (LIB_FACTORIES[kind] as (o: unknown) => Library[typeof kind][number])(over);
      get().setLibrary((l) => ({ ...l, [kind]: [...l[kind], item] }));
      return item.id;
    },

    updateItem(kind, id, patch) {
      get().setLibrary((l) => ({ ...l, [kind]: (l[kind] as Array<{ id: string }>).map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
    },

    removeItem(kind, id) {
      get().setLibrary((l) => ({ ...l, [kind]: (l[kind] as Array<{ id: string }>).filter((i) => i.id !== id) }));
    },

    moveItem(kind, from, to) {
      get().setLibrary((l) => {
        const arr = [...(l[kind] as unknown[])];
        const [x] = arr.splice(from, 1);
        if (x === undefined) return l;
        arr.splice(Math.max(0, Math.min(arr.length, to)), 0, x);
        return { ...l, [kind]: arr };
      });
    },

    setLinks(links) {
      dirtyLinks = true;
      set({ links });
      schedule();
    },

    async flush() {
      if (timer) {
        clearTimeout(timer);
        await persist();
      }
    },

    reset(profile = emptyProfile(), library = emptyLibrary()) {
      if (timer) clearTimeout(timer);
      timer = null;
      dirtyProfile = dirtyLibrary = dirtyLinks = false;
      set({ profile, library, links: {}, saveState: 'idle', loaded: true });
    },
  };
});

/** Resolve once the workspace is in memory. */
export function ensureWorkspace(): Promise<void> {
  return useWorkspace.getState().init();
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => void useWorkspace.getState().flush());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void useWorkspace.getState().flush();
  });
}
