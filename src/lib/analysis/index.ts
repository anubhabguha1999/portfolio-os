// CONTRACT (implementation owned by the analysis workstream). Keep these signatures.
import type { Portfolio } from '@/types/portfolio';
import type { AssetMeta } from '@/stores/assets';
import type { AnalysisReport, PortfolioAnalytics, PortfolioInsights } from './types';
import { collectImages, visibleSections } from '@/lib/engine/collect';
import { accessibilityAudit } from './accessibility';
import { performanceAudit } from './performance';
import { contentAudit } from './content';
import { estimateStandalone, memo2 } from './shared';

/** Audits the real exported markup: alt text, contrast, headings, names, keyboard, language, forms, motion, ids. */
export function runAccessibilityAudit(p: Portfolio, _assets: Record<string, AssetMeta>): AnalysisReport {
  return accessibilityAudit(p);
}
/** Image weight, standalone size, DOM size, animation cost, fonts, network dependencies and first render. */
export function runPerformanceAudit(p: Portfolio, assets: Record<string, AssetMeta>): AnalysisReport {
  return performanceAudit(p, assets);
}
/** Deterministic content rules (no AI): missing sections, placeholders, SEO, links. */
export function runContentAudit(p: Portfolio): AnalysisReport {
  return contentAudit(p);
}

function countWords(p: Portfolio, assets: Record<string, AssetMeta>): number {
  const { doc } = estimateStandalone(p, assets);
  const root = doc.getElementById('pos-root');
  if (!root) return 0;
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('script, style, svg, .sr-only, [aria-hidden="true"]').forEach((n) => n.remove());
  const text = clone.textContent ?? '';
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export const computeAnalytics = memo2((p: Portfolio, assets: Record<string, AssetMeta>): PortfolioAnalytics => {
  const sections = visibleSections(p);
  let projects = 0;
  let experience = 0;
  for (const s of sections) {
    if (s.type === 'projects') projects += s.data.items.length;
    if (s.type === 'experience') experience += s.data.items.length;
  }
  return {
    sections: sections.length,
    projects,
    experience,
    images: collectImages(p).length,
    words: countWords(p, assets),
    estimatedHtmlBytes: estimateStandalone(p, assets).total,
    accessibilityScore: accessibilityAudit(p).score,
    performanceScore: performanceAudit(p, assets).score,
    contentScore: contentAudit(p).score,
  };
});

/** All reports and analytics at once (each piece is memoised per portfolio snapshot). */
export function analyzePortfolio(p: Portfolio, assets: Record<string, AssetMeta>): PortfolioInsights {
  return {
    accessibility: accessibilityAudit(p),
    performance: performanceAudit(p, assets),
    content: contentAudit(p),
    analytics: computeAnalytics(p, assets),
  };
}

export { runHealthCheck } from './health';
export { contrastFindings, schemesInUse, accessibleName } from './accessibility';
export { networkDependencies } from './performance';
export { placeholdersIn, suspiciousUrl } from './content';
export { scoreChecks } from './shared';
export type * from './types';
