// CONTRACT (implementation owned by the analysis workstream). Keep this signature.
import type { Portfolio } from '@/types/portfolio';
import type { AssetMeta } from '@/stores/assets';
import type { AnalysisReport } from './types';

/** Pre-export Portfolio Health Check. `fail` checks block export unless the user chooses "Export anyway". */
export function runHealthCheck(_p: Portfolio, _assets: Record<string, AssetMeta>): AnalysisReport {
  return { category: 'health', title: 'Portfolio Health Check', score: 100, checks: [] };
}
