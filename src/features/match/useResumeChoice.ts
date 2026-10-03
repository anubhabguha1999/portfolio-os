/**
 * Shared by the job-match and bullet-helper pages: the resume list, the chosen resume
 * (synced with `?resume=<id>`) and its resolved, as-printed view.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getDb } from '@/lib/storage/db';
import type { ResumeDoc } from '@/studio/model/types';
import { resolveResume, type ResolvedResume } from '@/studio/model/resolve';
import { getResume, listResumes, type StudioSummary } from '@/studio/storage/repo';
import { ensureWorkspace, useWorkspace } from '@/studio/store/workspace';
import { useResumeEditor } from '@/studio/store/resume-editor';

export interface ResumeChoice {
  list: StudioSummary[] | null;
  resumeId: string | null;
  resume: ResumeDoc | null;
  resolved: ResolvedResume | null;
  loading: boolean;
  select(id: string): void;
  reload(): Promise<void>;
}

export function useResumeChoice(enabled = true): ResumeChoice {
  const [params, setParams] = useSearchParams();
  const wanted = params.get('resume');
  const [list, setList] = useState<StudioSummary[] | null>(null);
  const [resume, setResume] = useState<ResumeDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const library = useWorkspace((s) => s.library);
  const profile = useWorkspace((s) => s.profile);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await ensureWorkspace();
      const l = await listResumes();
      if (alive) setList(l);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const resumeId = list ? (wanted && list.some((r) => r.id === wanted) ? wanted : (list[0]?.id ?? null)) : null;

  const select = useCallback(
    (id: string) =>
      setParams(
        (p) => {
          p.set('resume', id);
          return p;
        },
        { replace: true },
      ),
    [setParams],
  );

  const load = useCallback(async () => {
    if (!resumeId) {
      setResume(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Prefer the editor's in-memory copy when it holds this resume (it may not be flushed yet).
    const ed = useResumeEditor.getState();
    const r = ed.resume?.id === resumeId && ed.status === 'ready' ? ed.resume : await getResume(resumeId);
    setResume(r);
    setLoading(false);
  }, [resumeId]);

  useEffect(() => {
    if (enabled) void load();
  }, [load, enabled]);

  const resolved = useMemo(() => (resume ? resolveResume(resume, library, profile) : null), [resume, library, profile]);

  return { list, resumeId, resume, resolved, loading: list === null || loading, select, reload: load };
}

/* --------------------------- job-match meta --------------------------- */

export interface JobMatchMeta {
  jd: string;
  title: string;
  company: string;
  updatedAt: string;
}

type MetaWithMatch = ResumeDoc['meta'] & { jobMatch?: JobMatchMeta };

export function readJobMatch(r: ResumeDoc | null): JobMatchMeta | null {
  const m = (r?.meta as MetaWithMatch | undefined)?.jobMatch;
  return m && typeof m.jd === 'string' ? { jd: m.jd, title: String(m.title ?? ''), company: String(m.company ?? ''), updatedAt: String(m.updatedAt ?? '') } : null;
}

/**
 * Remember the pasted job description on the resume (`meta.jobMatch`). The record's
 * `updatedAt` is kept, so analysing a posting does not reorder the resume list.
 */
export async function saveJobMatch(id: string, data: Omit<JobMatchMeta, 'updatedAt'>): Promise<void> {
  const r = await getResume(id);
  if (!r) return;
  const jobMatch: JobMatchMeta = { ...data, updatedAt: new Date().toISOString() };
  const next: ResumeDoc = { ...r, meta: { ...r.meta, jobMatch } as MetaWithMatch };
  await (await getDb()).put('resumes', { id: next.id, name: next.name, updatedAt: next.updatedAt, data: next });
  // Keep an open editor in step so its next autosave doesn't drop the field.
  useResumeEditor.setState((s) => (s.resume?.id === id ? { resume: { ...s.resume, meta: { ...s.resume.meta, jobMatch } as MetaWithMatch } } : {}));
}
