import { useEffect, useState } from 'react';
import { getResume, listResumes, type StudioSummary } from '@/studio/storage/repo';
import { ensureWorkspace, useWorkspace } from '@/studio/store/workspace';
import { resolveResume, type ResolvedResume } from '@/studio/model/resolve';
import { profileToText } from '@/lib/ai/prompts';

/** Resume summaries for the pickers (null while loading). */
export function useResumeList(): StudioSummary[] | null {
  const [list, setList] = useState<StudioSummary[] | null>(null);
  useEffect(() => {
    let alive = true;
    void ensureWorkspace()
      .then(listResumes)
      .then((l) => alive && setList(l))
      .catch(() => alive && setList([]));
    return () => {
      alive = false;
    };
  }, []);
  return list;
}

/** The printed content of a resume, resolved against the shared profile and library. */
export async function loadResolvedResume(id: string): Promise<ResolvedResume | null> {
  await ensureWorkspace();
  const doc = await getResume(id);
  if (!doc) return null;
  const { library, profile } = useWorkspace.getState();
  return resolveResume(doc, library, profile);
}

/** Resolves the selected resume whenever the id changes. */
export function useResolvedResume(id: string): ResolvedResume | null {
  const [resolved, setResolved] = useState<ResolvedResume | null>(null);
  useEffect(() => {
    let alive = true;
    setResolved(null);
    if (id) void loadResolvedResume(id).then((r) => alive && setResolved(r));
    return () => {
      alive = false;
    };
  }, [id]);
  return resolved;
}

export async function loadProfileText(): Promise<string> {
  await ensureWorkspace();
  return profileToText(useWorkspace.getState().profile);
}
