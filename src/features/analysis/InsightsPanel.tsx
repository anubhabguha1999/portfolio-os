// CONTRACT (owned by the analysis workstream).
import type { Portfolio } from '@/types/portfolio';

export interface InsightsPanelProps {
  portfolio: Portfolio;
  /** Jump to a section in the builder. */
  onSelectSection: (sectionId: string) => void;
}
export function InsightsPanel(_props: InsightsPanelProps) {
  return null;
}
