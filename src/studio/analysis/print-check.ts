/**
 * Pre-export document check, computed from the real layout (the same one the PDF uses).
 */
import type { LaidDocument } from '@/studio/engine/flow';

export interface PrintCheckItem {
  level: 'ok' | 'warn' | 'error';
  label: string;
  detail?: string;
  /** Offer "Fix automatically" (fit to page limit). */
  fixable?: boolean;
}

export interface PrintCheck {
  pages: number;
  overflow: number;
  clipped: number;
  images: number;
  links: number;
  fontIssues: string[];
  items: PrintCheckItem[];
  ready: boolean;
}

export function printCheck(laid: LaidDocument, opts: { pageLimit?: number; missingImages?: number } = {}): PrintCheck {
  const overflow = laid.issues.filter((i) => i.kind === 'overflow').length;
  const clipped = laid.issues.filter((i) => i.kind === 'clipped-word').length;
  const fontIssues = laid.issues.filter((i) => i.kind === 'unsupported-chars' || i.kind === 'tiny-text').map((i) => i.message);
  const items: PrintCheckItem[] = [];
  const pages = laid.pages.length;
  const limit = opts.pageLimit ?? 0;
  if (limit > 0 && pages > limit) items.push({ level: 'error', label: `Content exceeds the ${limit}-page limit`, detail: `The document needs ${pages} pages.`, fixable: true });
  else items.push({ level: 'ok', label: `Pages: ${pages}${limit ? ` (limit ${limit})` : ''}` });
  items.push(overflow ? { level: 'error', label: `${overflow} element${overflow === 1 ? '' : 's'} taller than a page`, detail: 'It will be cut at the page edge. Split it or shorten it.' } : { level: 'ok', label: 'Overflow: none' });
  items.push(clipped ? { level: 'warn', label: 'Text clipping: long words broken', detail: laid.issues.find((i) => i.kind === 'clipped-word')?.message ?? '' } : { level: 'ok', label: 'Text clipping: none' });
  items.push({ level: opts.missingImages ? 'warn' : 'ok', label: `Images: ${laid.stats.images}`, ...(opts.missingImages ? { detail: `${opts.missingImages} could not be rendered.` } : {}) });
  items.push({ level: 'ok', label: `Links: ${laid.stats.links}` });
  items.push(fontIssues.length ? { level: 'warn', label: 'Font issues', detail: fontIssues.join(' ') } : { level: 'ok', label: 'Font issues: none' });
  if (limit > 0 && pages === limit && laid.stats.lastPageRatio > 0.97) items.push({ level: 'warn', label: 'The last page is completely full', detail: 'Small edits may push content onto another page.' });
  return { pages, overflow, clipped, images: laid.stats.images, links: laid.stats.links, fontIssues, items, ready: !items.some((i) => i.level === 'error') };
}
