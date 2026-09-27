import { useEffect, useState } from 'react';
import { useEditor } from '@/stores/editor';
import { useAssets } from '@/stores/assets';
import { getProject } from '@/lib/storage/projects';
import { setMeta } from '@/lib/storage/db';
import { PortfolioValidationError } from '@/schemas/portfolio';

export type LoadState = { status: 'loading' } | { status: 'ready' } | { status: 'missing' } | { status: 'error'; message: string; issues?: string[] };

/** Ensure the editor store holds `projectId` (loading it from IndexedDB if needed). */
export function useProject(projectId: string | undefined): LoadState {
  const current = useEditor((s) => s.projectId);
  const [state, setState] = useState<LoadState>(() => (projectId && current === projectId ? { status: 'ready' } : { status: 'loading' }));

  useEffect(() => {
    if (!projectId) {
      setState({ status: 'missing' });
      return;
    }
    const editor = useEditor.getState();
    if (editor.projectId === projectId && editor.portfolio) {
      if (useAssets.getState().projectId !== projectId) void useAssets.getState().loadProject(projectId);
      setState({ status: 'ready' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    (async () => {
      try {
        const rec = await getProject(projectId);
        if (cancelled) return;
        if (!rec) {
          setState({ status: 'missing' });
          return;
        }
        await useAssets.getState().loadProject(projectId);
        if (cancelled) return;
        useEditor.getState().load(rec.id, rec.name, rec.portfolio);
        void setMeta('lastProjectId', rec.id);
        setState({ status: 'ready' });
      } catch (err) {
        if (cancelled) return;
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'This project could not be opened.',
          ...(err instanceof PortfolioValidationError ? { issues: err.issues } : {}),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return state;
}
