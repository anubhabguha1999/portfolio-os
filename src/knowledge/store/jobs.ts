/**
 * Running extractions and OCR jobs, so progress survives navigation between the library and a
 * document. Each job can be cancelled. A password prompt is surfaced instead of failing.
 */
import { create } from 'zustand';
import { ExtractionCancelled, PdfPasswordError, processDoc, runOcr, type Progress } from '../engine/service';
import { DEFAULT_EXTRACTION_OPTIONS, type DocumentType, type ExtractionOptions } from '../types';

export interface Job {
  docId: string;
  kind: 'extract' | 'ocr';
  progress: Progress;
  controller: AbortController;
  error: string | null;
}

export interface PasswordRequest {
  docId: string;
  incorrect: boolean;
  retry: (password: string) => void;
}

interface JobState {
  jobs: Record<string, Job>;
  password: PasswordRequest | null;
  /** Bumped after any job finishes so lists can reload. */
  revision: number;
  extract(docId: string, options?: ExtractionOptions, extra?: { forcedType?: DocumentType }): Promise<boolean>;
  ocr(docId: string, pages: number[], options?: ExtractionOptions): Promise<boolean>;
  cancel(docId: string): void;
  dismissPassword(): void;
}

export const useKnowledgeJobs = create<JobState>()((set, get) => {
  const patch = (docId: string, p: Partial<Job>) => set((s) => (s.jobs[docId] ? { jobs: { ...s.jobs, [docId]: { ...s.jobs[docId]!, ...p } } } : s));
  const finish = (docId: string) =>
    set((s) => {
      const { [docId]: _gone, ...rest } = s.jobs;
      return { jobs: rest, revision: s.revision + 1 };
    });

  const run = async (docId: string, kind: Job['kind'], options: ExtractionOptions, go: (o: ExtractionOptions, ctl: { onProgress: (p: Progress) => void; signal: AbortSignal }) => Promise<unknown>): Promise<boolean> => {
    if (get().jobs[docId]) return false;
    const controller = new AbortController();
    set((s) => ({ jobs: { ...s.jobs, [docId]: { docId, kind, controller, error: null, progress: { stage: 'Starting…', value: 0 } } } }));
    try {
      await go(options, { onProgress: (progress) => patch(docId, { progress }), signal: controller.signal });
      finish(docId);
      return true;
    } catch (err) {
      finish(docId);
      if (err instanceof ExtractionCancelled) return false;
      if (err instanceof PdfPasswordError) {
        // Ask locally; the password is only held in memory for this retry.
        return new Promise<boolean>((resolve) => {
          set({
            password: {
              docId,
              incorrect: err.incorrect,
              retry: (password) => {
                set({ password: null });
                void run(docId, kind, { ...options, password }, go).then(resolve);
              },
            },
          });
        });
      }
      throw err;
    }
  };

  return {
    jobs: {},
    password: null,
    revision: 0,
    extract(docId, options = DEFAULT_EXTRACTION_OPTIONS, extra = {}) {
      return run(docId, 'extract', options, (o, ctl) => processDoc(docId, o, { ...ctl, ...(extra.forcedType ? { forcedType: extra.forcedType } : {}) }));
    },
    ocr(docId, pages, options = DEFAULT_EXTRACTION_OPTIONS) {
      return run(docId, 'ocr', options, (o, ctl) => runOcr(docId, pages, o, ctl));
    },
    cancel(docId) {
      get().jobs[docId]?.controller.abort();
    },
    dismissPassword() {
      set({ password: null });
    },
  };
});
