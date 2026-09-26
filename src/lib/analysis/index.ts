// CONTRACT (implementation owned by the analysis workstream). Keep these signatures.
import type { Portfolio } from '@/types/portfolio';
import type { AssetMeta } from '@/stores/assets';
import type { AnalysisReport, PortfolioAnalytics } from './types';

export function runAccessibilityAudit(_p: Portfolio, _assets: Record<string, AssetMeta>): AnalysisReport {
  return { category: 'accessibility', title: 'Accessibility', score: 100, checks: [] };
}
export function runPerformanceAudit(_p: Portfolio, _assets: Record<string, AssetMeta>): AnalysisReport {
  return { category: 'performance', title: 'Performance', score: 100, checks: [] };
}
export function runContentAudit(_p: Portfolio): AnalysisReport {
  return { category: 'content', title: 'Content quality', score: 100, checks: [] };
}
export function computeAnalytics(_p: Portfolio, _assets: Record<string, AssetMeta>): PortfolioAnalytics {
  return { sections: 0, projects: 0, experience: 0, images: 0, words: 0, estimatedHtmlBytes: 0, accessibilityScore: 100, performanceScore: 100, contentScore: 100 };
}
export { runHealthCheck } from './health';
export type * from './types';
