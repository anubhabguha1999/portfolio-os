import { useEffect, useRef } from 'react';
import { useEditor } from '@/stores/editor';
import { saveProject, createSnapshot } from '@/lib/storage/projects';
import { toast } from '@/stores/ui';

const DEBOUNCE_MS = 600;
const CHECKPOINT_MS = 5 * 60 * 1000;

/** Persist every change to IndexedDB (debounced) and take periodic version checkpoints. */
export function useAutosave(): { saveNow: (label?: string) => Promise<void> } {
  const timer = useRef<number | null>(null);
  const lastCheckpoint = useRef<number>(Date.now());
  const lastCheckpointRevision = useRef<number>(-1);
  const inflight = useRef<Promise<void> | null>(null);

  const flush = async () => {
    const { portfolio, saveState } = useEditor.getState();
    if (!portfolio || saveState !== 'dirty') return;
    useEditor.getState().markSaving();
    const revision = useEditor.getState().revision;
    try {
      const at = await saveProject(portfolio);
      // Only mark saved if nothing changed while writing.
      if (useEditor.getState().revision === revision) useEditor.getState().markSaved(at);
      else useEditor.setState({ saveState: 'dirty', lastSavedAt: at });
      if (Date.now() - lastCheckpoint.current > CHECKPOINT_MS && lastCheckpointRevision.current !== revision) {
        lastCheckpoint.current = Date.now();
        lastCheckpointRevision.current = revision;
        await createSnapshot(portfolio, 'auto');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown storage error';
      useEditor.getState().markSaveError(message);
      toast({ tone: 'error', title: 'Autosave failed', description: `${message}. Export a JSON backup to be safe.` });
    }
  };

  const run = () => {
    inflight.current = (inflight.current ?? Promise.resolve()).then(flush);
    return inflight.current;
  };

  useEffect(() => {
    const unsub = useEditor.subscribe((s, prev) => {
      if (s.revision === prev.revision || s.saveState !== 'dirty') return;
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void run(), DEBOUNCE_MS);
    });
    const onHide = () => {
      if (document.visibilityState === 'hidden') void run();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const st = useEditor.getState().saveState;
      if (st === 'dirty' || st === 'saving') {
        void run();
        e.preventDefault();
      }
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      unsub();
      if (timer.current) window.clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
      void run();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    async saveNow(label?: string) {
      if (timer.current) window.clearTimeout(timer.current);
      if (useEditor.getState().saveState !== 'dirty') useEditor.setState({ saveState: 'dirty' });
      await run();
      const { portfolio, saveState } = useEditor.getState();
      if (!portfolio || saveState === 'error') return;
      const snap = await createSnapshot(portfolio, 'manual', label);
      lastCheckpoint.current = Date.now();
      toast({ tone: 'success', title: `Saved as v${snap.version}`, description: 'A restorable version was added to history.' });
    },
  };
}
