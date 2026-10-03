/**
 * Small, dependency-free sequence diff (LCS) with word-level helpers.
 *
 * Inputs here are resume-sized (a summary, a bullet, a list of sections), so a
 * dynamic-programming LCS after trimming the common prefix/suffix is plenty fast.
 * Very large inputs fall back to "everything replaced" instead of using O(n·m) memory.
 */

export type DiffOpType = 'equal' | 'insert' | 'delete';

export interface DiffOp<T = string> {
  type: DiffOpType;
  value: T;
}

/** Above this many DP cells the diff degrades to delete-all + insert-all. */
const MAX_CELLS = 4_000_000;

/**
 * Element-wise diff of two sequences. Returns one op per element, in order:
 * `delete` (only in a), `insert` (only in b), `equal` (in both; value from b).
 * Within a changed run, deletes come before inserts.
 */
export function diffSequence<T>(a: readonly T[], b: readonly T[], eq: (x: T, y: T) => boolean = Object.is): DiffOp<T>[] {
  let start = 0;
  while (start < a.length && start < b.length && eq(a[start]!, b[start]!)) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && eq(a[endA - 1]!, b[endB - 1]!)) {
    endA--;
    endB--;
  }
  const head: DiffOp<T>[] = b.slice(0, start).map((value) => ({ type: 'equal', value }));
  const tail: DiffOp<T>[] = b.slice(endB).map((value) => ({ type: 'equal', value }));
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  return [...head, ...lcsOps(midA, midB, eq), ...tail];
}

function lcsOps<T>(a: readonly T[], b: readonly T[], eq: (x: T, y: T) => boolean): DiffOp<T>[] {
  const n = a.length;
  const m = b.length;
  if (!n) return b.map((value) => ({ type: 'insert', value }));
  if (!m) return a.map((value) => ({ type: 'delete', value }));
  if ((n + 1) * (m + 1) > MAX_CELLS) return [...a.map((value) => ({ type: 'delete' as const, value })), ...b.map((value) => ({ type: 'insert' as const, value }))];
  // dp[i][j] = LCS length of a[i..] and b[j..], flattened.
  const w = m + 1;
  const dp = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] = eq(a[i]!, b[j]!) ? dp[(i + 1) * w + j + 1]! + 1 : Math.max(dp[(i + 1) * w + j]!, dp[i * w + j + 1]!);
    }
  }
  const out: DiffOp<T>[] = [];
  let dels: DiffOp<T>[] = [];
  let ins: DiffOp<T>[] = [];
  const flush = () => {
    out.push(...dels, ...ins);
    dels = [];
    ins = [];
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (eq(a[i]!, b[j]!)) {
      flush();
      out.push({ type: 'equal', value: b[j]! });
      i++;
      j++;
    } else if (dp[(i + 1) * w + j]! >= dp[i * w + j + 1]!) {
      dels.push({ type: 'delete', value: a[i++]! });
    } else {
      ins.push({ type: 'insert', value: b[j++]! });
    }
  }
  while (i < n) dels.push({ type: 'delete', value: a[i++]! });
  while (j < m) ins.push({ type: 'insert', value: b[j++]! });
  flush();
  return out;
}

/** Length of the longest common subsequence. */
export function lcsLength<T>(a: readonly T[], b: readonly T[], eq: (x: T, y: T) => boolean = Object.is): number {
  return diffSequence(a, b, eq).filter((o) => o.type === 'equal').length;
}

/** Words and the whitespace between them, so joining the tokens rebuilds the text exactly. */
export function tokenizeWords(text: string): string[] {
  return text.match(/\s+|[^\s]+/g) ?? [];
}

const isSpace = (s: string) => /^\s+$/.test(s);

/**
 * Word-level diff of two strings. Adjacent ops of the same type are merged into one
 * string; whitespace-only "equal" runs stranded between changes are folded into the
 * change so the result reads as phrases rather than word confetti.
 */
export function diffWords(a: string, b: string): DiffOp<string>[] {
  if (a === b) return a ? [{ type: 'equal', value: a }] : [];
  const raw = diffSequence(tokenizeWords(a), tokenizeWords(b));
  // Fold whitespace-only equals that sit between two changes.
  const folded: DiffOp<string>[] = [];
  for (let k = 0; k < raw.length; k++) {
    const op = raw[k]!;
    if (op.type === 'equal' && isSpace(op.value)) {
      const prev = raw[k - 1];
      const next = raw[k + 1];
      if (prev && next && prev.type !== 'equal' && next.type !== 'equal') {
        folded.push({ type: 'delete', value: op.value }, { type: 'insert', value: op.value });
        continue;
      }
    }
    folded.push(op);
  }
  // Within each changed block, group all deletes before all inserts, then merge runs.
  const grouped: DiffOp<string>[] = [];
  let dels = '';
  let ins = '';
  const flush = () => {
    if (dels) grouped.push({ type: 'delete', value: dels });
    if (ins) grouped.push({ type: 'insert', value: ins });
    dels = ins = '';
  };
  for (const op of folded) {
    if (op.type === 'delete') dels += op.value;
    else if (op.type === 'insert') ins += op.value;
    else {
      flush();
      const last = grouped[grouped.length - 1];
      if (last?.type === 'equal') last.value += op.value;
      else grouped.push({ type: 'equal', value: op.value });
    }
  }
  flush();
  return grouped;
}

/** True when the ops contain any change. */
export function hasChanges(ops: readonly DiffOp<unknown>[]): boolean {
  return ops.some((o) => o.type !== 'equal');
}

/** Word counts of a word diff (whitespace ignored). */
export function wordStats(ops: readonly DiffOp<string>[]): { added: number; removed: number; same: number } {
  const count = (s: string) => (s.match(/[^\s]+/g) ?? []).length;
  let added = 0;
  let removed = 0;
  let same = 0;
  for (const o of ops) {
    if (o.type === 'insert') added += count(o.value);
    else if (o.type === 'delete') removed += count(o.value);
    else same += count(o.value);
  }
  return { added, removed, same };
}

/** 0…1 word similarity (Dice coefficient over the LCS of words, case-insensitive). */
export function similarity(a: string, b: string): number {
  const wa = a.toLowerCase().match(/[^\s]+/g) ?? [];
  const wb = b.toLowerCase().match(/[^\s]+/g) ?? [];
  if (!wa.length && !wb.length) return 1;
  if (!wa.length || !wb.length) return 0;
  return (2 * lcsLength(wa, wb)) / (wa.length + wb.length);
}

export interface SetDiff {
  added: string[];
  removed: string[];
  common: string[];
}

/** Case-insensitive set difference that keeps the original spelling and order (b's for common). */
export function diffSet(a: readonly string[], b: readonly string[]): SetDiff {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const inA = new Set(a.map(norm).filter(Boolean));
  const inB = new Set(b.map(norm).filter(Boolean));
  const seen = new Set<string>();
  const uniq = (list: readonly string[]) =>
    list.filter((s) => {
      const k = norm(s);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  const common = uniq(b.filter((s) => inA.has(norm(s))));
  seen.clear();
  const added = uniq(b.filter((s) => !inA.has(norm(s))));
  seen.clear();
  const removed = uniq(a.filter((s) => !inB.has(norm(s))));
  return { added, removed, common };
}

/** Rebuild one side of a diff. */
export function sideText(ops: readonly DiffOp<string>[], side: 'a' | 'b'): string {
  const skip: DiffOpType = side === 'a' ? 'insert' : 'delete';
  return ops
    .filter((o) => o.type !== skip)
    .map((o) => o.value)
    .join('');
}
