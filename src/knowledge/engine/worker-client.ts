/**
 * Talks to the knowledge worker. Falls back to running the same code on the main thread when
 * workers are unavailable (tests, very old browsers) so results never depend on the transport.
 */
import { analyse, type AnalyseInput, type AnalyseOutput } from '../analysis/pipeline';
import { buildIndex, search as searchIndex, type SearchIndex } from '../search/index';
import type { Extraction, KnowledgeDoc, SearchHit } from '../types';
import type { KnowledgeJob, KnowledgeWorkerMessage } from '@/workers/knowledge.protocol';

type Pending = { resolve: (m: KnowledgeWorkerMessage) => void; reject: (e: Error) => void };
type JobBody = KnowledgeJob extends infer J ? (J extends { id: number } ? Omit<J, 'id'> : never) : never;

let worker: Worker | null | undefined;
let seq = 0;
const pending = new Map<number, Pending>();
let localIndex: SearchIndex | null = null;

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  if (typeof Worker === 'undefined') return (worker = null);
  try {
    const w = new Worker(new URL('../../workers/knowledge.worker.ts', import.meta.url), { type: 'module', name: 'knowledge' });
    w.onmessage = (e: MessageEvent<KnowledgeWorkerMessage>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.type === 'error') p.reject(new Error(e.data.message));
      else p.resolve(e.data);
    };
    w.onerror = (e) => {
      for (const [, p] of pending) p.reject(new Error(e.message || 'The analysis worker stopped.'));
      pending.clear();
      worker = null;
    };
    return (worker = w);
  } catch {
    return (worker = null);
  }
}

function run(job: JobBody): Promise<KnowledgeWorkerMessage> | null {
  const w = getWorker();
  if (!w) return null;
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ ...job, id } as KnowledgeJob);
  });
}

export async function analyseInWorker(input: AnalyseInput): Promise<AnalyseOutput> {
  const res = run({ kind: 'analyse', input });
  if (!res) return analyse(input);
  const msg = await res;
  if (msg.type !== 'analysed') throw new Error('Unexpected worker reply.');
  return msg.output;
}

export async function indexInWorker(docs: Array<{ doc: KnowledgeDoc; extraction: Extraction | null }>): Promise<void> {
  const res = run({ kind: 'index', docs });
  if (!res) {
    localIndex = buildIndex(docs);
    return;
  }
  await res;
}

export async function searchInWorker(query: string, limit = 50): Promise<SearchHit[]> {
  const res = run({ kind: 'search', query, limit });
  if (!res) return localIndex ? searchIndex(localIndex, query, limit) : [];
  const msg = await res;
  return msg.type === 'hits' ? msg.hits : [];
}
