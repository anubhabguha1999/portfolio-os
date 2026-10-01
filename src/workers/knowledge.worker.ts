/**
 * PDF Intelligence worker: layout/structure analysis, semantic extraction and the search
 * index run here so large documents never block the UI. PDF parsing itself happens in
 * PDF.js's worker and OCR in Tesseract's worker.
 */
import { analyse } from '@/knowledge/analysis/pipeline';
import { buildIndex, search, type SearchIndex } from '@/knowledge/search/index';
import type { KnowledgeJob, KnowledgeWorkerMessage } from './knowledge.protocol';

const scope = self as unknown as DedicatedWorkerGlobalScope;
let index: SearchIndex | null = null;

const post = (msg: KnowledgeWorkerMessage) => scope.postMessage(msg);

scope.onmessage = (event: MessageEvent<KnowledgeJob>) => {
  const job = event.data;
  try {
    if (job.kind === 'analyse') post({ id: job.id, type: 'analysed', output: analyse(job.input) });
    else if (job.kind === 'index') {
      index = buildIndex(job.docs);
      post({ id: job.id, type: 'indexed', entries: index.entries.length });
    } else post({ id: job.id, type: 'hits', hits: index ? search(index, job.query, job.limit) : [] });
  } catch (err) {
    post({ id: job.id, type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
