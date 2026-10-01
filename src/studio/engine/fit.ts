/**
 * Fit to N pages: re-lays the document with progressively tighter (but readable)
 * settings and keeps the least aggressive adjustment that reaches the target.
 * Order of sacrifice: vertical spacing → margins → line height → font size.
 */
import type { FlowDoc } from './flow';
import { layoutFlow } from './layout';
import type { FitAdjust } from '@/studio/model/types';

export interface FitResult {
  fit: FitAdjust | null;
  pages: number;
  fits: boolean;
  tried: number;
  level: 'natural' | 'light' | 'moderate' | 'strong' | 'limit';
}

type Level = Exclude<FitResult['level'], 'natural' | 'limit'>;

/** Candidates ordered from least to most aggressive. */
const STEPS: Array<{ adj: FitAdjust; level: Level }> = [
  { adj: { font: 1, spacing: 0.88, margins: 1, lineHeight: 0 }, level: 'light' },
  { adj: { font: 1, spacing: 0.75, margins: 1, lineHeight: 0 }, level: 'light' },
  { adj: { font: 1, spacing: 0.7, margins: 0.88, lineHeight: -0.03 }, level: 'moderate' },
  { adj: { font: 1, spacing: 0.62, margins: 0.78, lineHeight: -0.06 }, level: 'moderate' },
  { adj: { font: 1, spacing: 0.55, margins: 0.7, lineHeight: -0.09 }, level: 'moderate' },
  { adj: { font: 0.96, spacing: 0.55, margins: 0.67, lineHeight: -0.1 }, level: 'strong' },
  { adj: { font: 0.93, spacing: 0.55, margins: 0.65, lineHeight: -0.12 }, level: 'strong' },
  { adj: { font: 0.9, spacing: 0.55, margins: 0.65, lineHeight: -0.12 }, level: 'strong' },
  { adj: { font: 0.88, spacing: 0.55, margins: 0.65, lineHeight: -0.12 }, level: 'strong' },
  { adj: { font: 0.86, spacing: 0.55, margins: 0.65, lineHeight: -0.12 }, level: 'strong' },
];

function pagesOf(flow: FlowDoc): number {
  return layoutFlow(flow).pages.length;
}

export function fitToPages(compose: (fit: FitAdjust | null) => FlowDoc, target: number): FitResult {
  const goal = Math.max(1, Math.floor(target));
  const natural = pagesOf(compose(null));
  let tried = 1;
  if (natural <= goal) return { fit: null, pages: natural, fits: true, tried, level: 'natural' };
  let best: { adj: FitAdjust; pages: number } | null = null;
  for (const step of STEPS) {
    const pages = pagesOf(compose(step.adj));
    tried++;
    if (pages <= goal) return { fit: step.adj, pages, fits: true, tried, level: step.level };
    if (!best || pages < best.pages) best = { adj: step.adj, pages };
  }
  // Could not reach the target: keep the natural layout if tightening didn't help at all.
  if (!best || best.pages >= natural) return { fit: null, pages: natural, fits: false, tried, level: 'limit' };
  return { fit: best.adj, pages: best.pages, fits: false, tried, level: 'limit' };
}

export function fitLabel(r: FitResult): string {
  const pages = `${r.pages} page${r.pages === 1 ? '' : 's'}`;
  if (!r.fits) return `Still needs ${pages} at the smallest readable settings — shorten or hide some content.`;
  switch (r.level) {
    case 'natural':
      return `Fits on ${pages} — no changes needed`;
    case 'light':
      return `Fits on ${pages} (spacing tightened)`;
    case 'moderate':
      return `Fits on ${pages} (spacing, margins and line height tightened)`;
    default:
      return `Fits on ${pages} (text slightly smaller, still readable)`;
  }
}
