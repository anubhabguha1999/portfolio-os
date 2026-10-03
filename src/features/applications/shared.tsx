import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/misc';
import { STATUS_LABELS, type ApplicationStatus } from '@/lib/applications';
import { listDocuments, listResumes, type StudioSummary } from '@/studio/storage/repo';

export const STATUS_TONE: Record<ApplicationStatus, 'neutral' | 'accent' | 'ok' | 'warn' | 'danger'> = {
  wishlist: 'neutral',
  applied: 'accent',
  screening: 'accent',
  interview: 'warn',
  offer: 'ok',
  accepted: 'ok',
  rejected: 'danger',
  withdrawn: 'neutral',
};

export function StatusBadge({ status, className }: { status: ApplicationStatus; className?: string }) {
  return (
    <Badge tone={STATUS_TONE[status]} className={className}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

/** Resume and document summaries for pickers and name lookups. */
export function useStudioDocs(): { resumes: StudioSummary[]; documents: StudioSummary[]; loaded: boolean } {
  const [state, setState] = useState<{ resumes: StudioSummary[]; documents: StudioSummary[]; loaded: boolean }>({ resumes: [], documents: [], loaded: false });
  useEffect(() => {
    let alive = true;
    void Promise.all([listResumes(), listDocuments()])
      .then(([resumes, documents]) => alive && setState({ resumes, documents, loaded: true }))
      .catch(() => alive && setState((s) => ({ ...s, loaded: true })));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

/** "Jul 4" / "Jul 4, 2025" for a YYYY-MM-DD date. */
export function formatDay(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(y !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
}

/** Whole days from today to a YYYY-MM-DD date (negative = overdue). */
export function daysUntil(day: string, now = new Date()): number {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const target = new Date(y, m - 1, d).getTime();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - start) / 86_400_000);
}

export function relativeDay(day: string): string {
  if (!day) return '';
  const n = daysUntil(day);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n < 0 ? `${-n} days overdue` : `in ${n} days`;
}
