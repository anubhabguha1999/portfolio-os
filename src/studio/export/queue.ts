/**
 * Export queue: several exports can be requested at once; they run one or two at a
 * time with progress, and the UI stays responsive (heavy work is in a worker).
 */
import { create } from 'zustand';
import { downloadBlob } from '@/utils/download';
import { uid } from '@/utils/id';

export type JobStatus = 'queued' | 'running' | 'done' | 'error';

export interface ExportJob {
  id: string;
  label: string;
  filename: string;
  status: JobStatus;
  progress: number;
  stage: string;
  error?: string;
  warnings: string[];
  size?: number;
  blob?: Blob;
  createdAt: number;
}

export interface JobResult {
  blob: Blob;
  warnings?: string[];
}

type Runner = (progress: (stage: string, value: number) => void) => Promise<JobResult>;

interface QueueState {
  jobs: ExportJob[];
  open: boolean;
  enqueue(label: string, filename: string, run: Runner, opts?: { download?: boolean }): Promise<ExportJob>;
  download(id: string): void;
  remove(id: string): void;
  clearFinished(): void;
  setOpen(open: boolean): void;
}

const CONCURRENCY = 2;
const runners = new Map<string, { run: Runner; download: boolean; resolve: (j: ExportJob) => void }>();

export const useExportQueue = create<QueueState>()((set, get) => {
  const patch = (id: string, p: Partial<ExportJob>) => set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...p } : j)) }));

  const pump = () => {
    const running = get().jobs.filter((j) => j.status === 'running').length;
    const next = get()
      .jobs.filter((j) => j.status === 'queued')
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, Math.max(0, CONCURRENCY - running));
    for (const job of next) {
      const r = runners.get(job.id);
      if (!r) continue;
      patch(job.id, { status: 'running', stage: 'Starting…', progress: 0.02 });
      void (async () => {
        try {
          const res = await r.run((stage, value) => patch(job.id, { stage, progress: Math.max(0, Math.min(1, value)) }));
          patch(job.id, { status: 'done', progress: 1, stage: 'Ready', blob: res.blob, size: res.blob.size, warnings: res.warnings ?? [] });
          if (r.download) downloadBlob(res.blob, job.filename);
        } catch (err) {
          patch(job.id, { status: 'error', stage: 'Failed', error: err instanceof Error ? err.message : String(err) });
        } finally {
          runners.delete(job.id);
          r.resolve(get().jobs.find((j) => j.id === job.id)!);
          pump();
        }
      })();
    }
  };

  return {
    jobs: [],
    open: false,
    enqueue(label, filename, run, opts = {}) {
      const job: ExportJob = { id: uid('job'), label, filename, status: 'queued', progress: 0, stage: 'Queued', warnings: [], createdAt: Date.now() };
      return new Promise<ExportJob>((resolve) => {
        runners.set(job.id, { run, download: opts.download ?? true, resolve });
        set((s) => ({ jobs: [...s.jobs, job], open: true }));
        queueMicrotask(pump);
      });
    },
    download(id) {
      const j = get().jobs.find((x) => x.id === id);
      if (j?.blob) downloadBlob(j.blob, j.filename);
    },
    remove(id) {
      set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id || j.status === 'running') }));
    },
    clearFinished() {
      set((s) => ({ jobs: s.jobs.filter((j) => j.status === 'running' || j.status === 'queued') }));
    },
    setOpen(open) {
      set({ open });
    },
  };
});
