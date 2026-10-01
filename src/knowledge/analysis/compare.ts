/**
 * Compare two extractions (two versions of one document, or an old and a new file):
 * structured lists (skills, roles, projects…), profile fields and a line diff of the text.
 */
import type { Extraction } from '../types';
import { pageText } from './layout';
import { canonicalSkill } from './skills';

export type Change = 'added' | 'removed' | 'same';

export interface ListDiff {
  label: string;
  rows: Array<{ text: string; change: Change }>;
}

export interface FieldDiff {
  label: string;
  before: string;
  after: string;
}

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#]+/g, ' ').trim();

export function diffLists(label: string, a: string[], b: string[], norm: (s: string) => string = key): ListDiff {
  const kb = new Set(b.map(norm));
  const ka = new Set(a.map(norm));
  const rows: ListDiff['rows'] = [];
  const seen = new Set<string>();
  // Keep the new order; removed items go where they were.
  for (const x of b) {
    const k = norm(x);
    if (seen.has(k)) continue;
    seen.add(k);
    rows.push({ text: x, change: ka.has(k) ? 'same' : 'added' });
  }
  for (const x of a) {
    const k = norm(x);
    if (seen.has(k)) continue;
    seen.add(k);
    if (!kb.has(k)) rows.push({ text: x, change: 'removed' });
  }
  return { label, rows };
}

/** Longest-common-subsequence line diff (bounded so huge documents stay fast). */
export function diffLines(a: string[], b: string[], max = 1500): Array<{ text: string; change: Change }> {
  const A = a.slice(0, max);
  const B = b.slice(0, max);
  const n = A.length;
  const m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i]![j] = A[i] === B[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const out: Array<{ text: string; change: Change }> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      out.push({ text: A[i]!, change: 'same' });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) out.push({ text: A[i++]!, change: 'removed' });
    else out.push({ text: B[j++]!, change: 'added' });
  }
  while (i < n) out.push({ text: A[i++]!, change: 'removed' });
  while (j < m) out.push({ text: B[j++]!, change: 'added' });
  return out;
}

const linesOf = (e: Extraction) =>
  e.pages
    .map((p) => pageText(p))
    .join('\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

export function compareExtractions(a: Extraction, b: Extraction): { lists: ListDiff[]; fields: FieldDiff[]; text: Array<{ text: string; change: Change }> } {
  const ra = a.semantic.resume;
  const rb = b.semantic.resume;
  const lists: ListDiff[] = [];
  const fields: FieldDiff[] = [];
  if (ra || rb) {
    const skill = (s: string) => key(canonicalSkill(s)?.name ?? s);
    lists.push(diffLists('Skills', ra?.skills.map((s) => s.name) ?? [], rb?.skills.map((s) => s.name) ?? [], skill));
    lists.push(diffLists('Experience', ra?.experience.map((e) => [e.role.value, e.company.value].filter(Boolean).join(' — ')) ?? [], rb?.experience.map((e) => [e.role.value, e.company.value].filter(Boolean).join(' — ')) ?? []));
    lists.push(diffLists('Projects', ra?.projects.map((p) => p.title.value) ?? [], rb?.projects.map((p) => p.title.value) ?? []));
    lists.push(diffLists('Education', ra?.education.map((e) => [e.degree.value, e.institution.value].filter(Boolean).join(' — ')) ?? [], rb?.education.map((e) => [e.degree.value, e.institution.value].filter(Boolean).join(' — ')) ?? []));
    lists.push(diffLists('Certifications', ra?.certifications.map((c) => c.name.value) ?? [], rb?.certifications.map((c) => c.name.value) ?? []));
    const pf = ['name', 'headline', 'email', 'phone', 'location', 'website', 'summary'] as const;
    for (const k of pf) {
      const before = ra?.profile[k].value ?? '';
      const after = rb?.profile[k].value ?? '';
      if (before !== after) fields.push({ label: k[0]!.toUpperCase() + k.slice(1), before, after });
    }
  }
  return { lists: lists.filter((l) => l.rows.length), fields, text: diffLines(linesOf(a), linesOf(b)) };
}
