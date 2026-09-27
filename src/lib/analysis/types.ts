/** Shared result types for all local analyzers (accessibility, performance, content, health). */
export type CheckStatus = 'pass' | 'warn' | 'fail' | 'info';

export interface CheckResult {
  id: string;
  label: string;
  status: CheckStatus;
  /** Human explanation of what was found. */
  detail?: string;
  /** Section the issue belongs to, so the UI can jump to it. */
  sectionId?: string | null;
  /** Optional specific occurrences. */
  items?: Array<{ message: string; sectionId?: string | null }>;
  /** Relative importance used for the report score (default 1). */
  weight?: number;
}

export interface AnalysisReport {
  category: 'accessibility' | 'performance' | 'content' | 'health';
  title: string;
  /** 0–100 */
  score: number;
  checks: CheckResult[];
}

export interface PortfolioAnalytics {
  sections: number;
  projects: number;
  experience: number;
  images: number;
  words: number;
  estimatedHtmlBytes: number;
  accessibilityScore: number;
  performanceScore: number;
  contentScore: number;
}

/** Everything the Insights panel shows, computed in one pass. */
export interface PortfolioInsights {
  accessibility: AnalysisReport;
  performance: AnalysisReport;
  content: AnalysisReport;
  analytics: PortfolioAnalytics;
}
