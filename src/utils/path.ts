export type PathKey = string | number;

export function parsePath(path: string | PathKey[]): PathKey[] {
  if (Array.isArray(path)) return path;
  return path
    .split('.')
    .filter(Boolean)
    .map((seg) => (/^\d+$/.test(seg) ? Number(seg) : seg));
}

export function getIn(obj: unknown, path: string | PathKey[]): unknown {
  let cur: unknown = obj;
  for (const key of parsePath(path)) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<PathKey, unknown>)[key];
  }
  return cur;
}

/** Immutable set with structural sharing. */
export function setIn<T>(obj: T, path: string | PathKey[], value: unknown): T {
  const keys = parsePath(path);
  if (keys.length === 0) return value as T;
  const [head, ...rest] = keys as [PathKey, ...PathKey[]];
  const source = (obj ?? (typeof head === 'number' ? [] : {})) as Record<PathKey, unknown> | unknown[];
  const child = (source as Record<PathKey, unknown>)[head];
  const next = rest.length ? setIn(child, rest, value) : value;
  if (Object.is(child, next)) return obj;
  if (Array.isArray(source)) {
    const copy = source.slice();
    copy[head as number] = next;
    return copy as T;
  }
  return { ...(source as Record<PathKey, unknown>), [head]: next } as T;
}

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const copy = list.slice();
  const [item] = copy.splice(from, 1);
  if (item === undefined) return copy;
  copy.splice(Math.max(0, Math.min(to, copy.length)), 0, item);
  return copy;
}

export function deepClone<T>(value: T): T {
  return structuredClone(value);
}
