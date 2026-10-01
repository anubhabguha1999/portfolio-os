import type { AnalyseInput, AnalyseOutput } from '@/knowledge/analysis/pipeline';
import type { Extraction, KnowledgeDoc, SearchHit } from '@/knowledge/types';

export type KnowledgeJob =
  | { id: number; kind: 'analyse'; input: AnalyseInput }
  | { id: number; kind: 'index'; docs: Array<{ doc: KnowledgeDoc; extraction: Extraction | null }> }
  | { id: number; kind: 'search'; query: string; limit: number };

export type KnowledgeWorkerMessage =
  | { id: number; type: 'analysed'; output: AnalyseOutput }
  | { id: number; type: 'indexed'; entries: number }
  | { id: number; type: 'hits'; hits: SearchHit[] }
  | { id: number; type: 'error'; message: string };
