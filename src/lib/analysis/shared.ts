import type { Portfolio } from '@/types/portfolio';
import type { AssetMeta } from '@/stores/assets';
import { renderPortfolio } from '@/lib/engine/render';
import type { AnalysisReport, CheckResult, CheckStatus } from './types';

/** 1×1 GIF used for every asset when auditing rendered output. */
export const AUDIT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

const STATUS_VALUE: Record<CheckStatus, number | null> = { pass: 1, info: null, warn: 0.6, fail: 0 };

/** Score 0–100: weighted mean of check outcomes. `info` checks do not affect the score. */
export function scoreChecks(checks: CheckResult[]): number {
  let total = 0;
  let got = 0;
  for (const c of checks) {
    const v = STATUS_VALUE[c.status];
    if (v === null) continue;
    const w = c.weight ?? 1;
    total += w;
    got += w * v;
  }
  if (total === 0) return 100;
  return Math.round((got / total) * 100);
}

export function report(category: AnalysisReport['category'], title: string, checks: CheckResult[]): AnalysisReport {
  return { category, title, score: scoreChecks(checks), checks };
}

export function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

/** Memoise a pure function of (portfolio, assets) by object identity — portfolios are immutable snapshots. */
export function memo2<A extends object, B extends object, R>(fn: (a: A, b: B) => R): (a: A, b: B) => R {
  const cache = new WeakMap<A, WeakMap<B, R>>();
  return (a, b) => {
    let inner = cache.get(a);
    if (!inner) {
      inner = new WeakMap();
      cache.set(a, inner);
    }
    if (inner.has(b)) return inner.get(b) as R;
    const r = fn(a, b);
    inner.set(b, r);
    return r;
  };
}

export function memo1<A extends object, R>(fn: (a: A) => R): (a: A) => R {
  const cache = new WeakMap<A, R>();
  return (a) => {
    if (cache.has(a)) return cache.get(a) as R;
    const r = fn(a);
    cache.set(a, r);
    return r;
  };
}

export interface AuditRender {
  html: string;
  doc: Document;
}

/** The exact export markup (every asset replaced by a 1×1 pixel), parsed without executing anything. */
export const renderForAudit = memo1((p: Portfolio): AuditRender => {
  const { html } = renderPortfolio(p, { mode: 'export', assetUrl: () => AUDIT_PIXEL });
  return { html, doc: parseHtml(html) };
});

/** Marker assets so sizes can be attributed to each asset occurrence. */
const MARK = 'pos-size-marker:';
const markerRe = /pos-size-marker:([A-Za-z0-9_-]+)/g;

export interface SizeEstimate {
  /** Markup without asset payloads (bytes, UTF-8). */
  markupBytes: number;
  /** Base64 payload bytes of inlined assets. */
  assetBytes: number;
  total: number;
  doc: Document;
  /** Asset id → occurrence count in the output. */
  occurrences: Map<string, number>;
}

const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
export function utf8Length(s: string): number {
  return encoder ? encoder.encode(s).length : s.length;
}

/** base64 size of n raw bytes plus the data-URL header. */
export function dataUrlLength(bytes: number, mime: string): number {
  return Math.ceil(bytes / 3) * 4 + `data:${mime};base64,`.length;
}

/** Estimated size of the standalone single-file HTML export. */
export const estimateStandalone = memo2((p: Portfolio, assets: Record<string, AssetMeta>): SizeEstimate => {
  const { html } = renderPortfolio(p, { mode: 'export', assetUrl: (id) => `${MARK}${id}`, fontUrl: (id) => `${MARK}${id}` });
  const occurrences = new Map<string, number>();
  let markerChars = 0;
  for (const m of html.matchAll(markerRe)) {
    const id = m[1]!;
    occurrences.set(id, (occurrences.get(id) ?? 0) + 1);
    markerChars += m[0].length;
  }
  const markupBytes = utf8Length(html) - markerChars;
  let assetBytes = 0;
  for (const [id, count] of occurrences) {
    const meta = assets[id];
    if (meta) assetBytes += dataUrlLength(meta.size, meta.mime) * count;
  }
  const doc = parseHtml(html.replace(markerRe, AUDIT_PIXEL));
  return { markupBytes, assetBytes, total: markupBytes + assetBytes, doc, occurrences };
});

export function sectionNameOf(p: Portfolio, id: string | null | undefined): string {
  if (!id) return '';
  return p.sections.find((s) => s.id === id)?.name ?? '';
}

/** Section id of the closest rendered section wrapper. */
export function sectionIdOfNode(el: Element): string | null {
  return el.closest('[data-section-id]')?.getAttribute('data-section-id') ?? null;
}

/** Pick the verb form that agrees with n. */
export function agree(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
