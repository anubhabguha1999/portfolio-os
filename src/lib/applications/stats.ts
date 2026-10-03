import { APPLICATION_STATUSES, CLOSED_STATUSES, RESPONSE_STATUSES, STATUS_LABELS, WORK_MODE_LABELS, type Application, type ApplicationStatus } from './types';

export const STALE_DAYS = 14;
const DAY = 86_400_000;

export interface ApplicationStats {
  total: number;
  counts: Record<ApplicationStatus, number>;
  /** Applications actually sent (left the wishlist). */
  applied: number;
  /** Of those, how many got any reply (screening, interview, offer, accepted or rejected). */
  responded: number;
  /** 0–1, or null when nothing has been sent yet. */
  responseRate: number | null;
  active: number;
  /** Open applications with a next-step date, soonest first (overdue ones included). */
  upcoming: Application[];
  /** Open applications with no update for STALE_DAYS or more, oldest first. */
  stale: Application[];
}

export function isOpen(a: Application): boolean {
  return !CLOSED_STATUSES.has(a.status);
}

export function wasSent(a: Application): boolean {
  if (a.status === 'wishlist') return false;
  if (a.status === 'withdrawn') return !!a.appliedAt || a.history.some((h) => h.status !== 'wishlist' && h.status !== 'withdrawn');
  return true;
}

export function gotResponse(a: Application): boolean {
  return RESPONSE_STATUSES.has(a.status) || a.history.some((h) => RESPONSE_STATUSES.has(h.status));
}

export function daysSince(iso: string, now = Date.now()): number {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.floor((now - t) / DAY) : 0;
}

export function isStale(a: Application, now = Date.now()): boolean {
  return isOpen(a) && daysSince(a.updatedAt, now) >= STALE_DAYS;
}

export function computeStats(apps: Application[], now = Date.now()): ApplicationStats {
  const counts = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0])) as Record<ApplicationStatus, number>;
  let applied = 0;
  let responded = 0;
  for (const a of apps) {
    counts[a.status]++;
    if (wasSent(a)) {
      applied++;
      if (gotResponse(a)) responded++;
    }
  }
  const open = apps.filter(isOpen);
  return {
    total: apps.length,
    counts,
    applied,
    responded,
    responseRate: applied ? responded / applied : null,
    active: open.length,
    upcoming: open.filter((a) => a.nextStepDate).sort((a, b) => a.nextStepDate.localeCompare(b.nextStepDate)),
    stale: open.filter((a) => isStale(a, now)).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)),
  };
}

/* -------------------------------- CSV -------------------------------- */

/** RFC 4180 cell; also neutralises spreadsheet formula injection. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export function applicationsToCsv(apps: Application[], names: { resumes?: Record<string, string>; documents?: Record<string, string> } = {}): string {
  const header = ['Company', 'Role', 'Status', 'Location', 'Work mode', 'Salary', 'Source', 'Job URL', 'Saved', 'Applied', 'Next step', 'Next step date', 'Contacts', 'Resume', 'Cover letter / document', 'Notes', 'Last updated'];
  const rows = apps.map((a) => [
    a.company,
    a.role,
    STATUS_LABELS[a.status],
    a.location,
    a.workMode ? WORK_MODE_LABELS[a.workMode] : '',
    a.salary,
    a.source,
    a.jobUrl,
    a.savedAt,
    a.appliedAt,
    a.nextStep,
    a.nextStepDate,
    a.contacts.map((c) => [c.name, c.role && `(${c.role})`, c.email && `<${c.email}>`].filter(Boolean).join(' ')).join('; '),
    a.resumeId ? (names.resumes?.[a.resumeId] ?? a.resumeId) : '',
    a.documentId ? (names.documents?.[a.documentId] ?? a.documentId) : '',
    a.notes,
    a.updatedAt,
  ]);
  return toCsv([header, ...rows]);
}
