import { esc } from '@/utils/escape';
import { isExternal, safeHref } from '@/utils/url';
import { formatRange } from '@/utils/format';
import type { DocBlock, DocRun } from '@/types/document';
import type { FieldDef, FieldOption } from '@/types/fields';
import type { ImageRef } from '@/types/portfolio';
import type { RenderContext } from './types';

export { esc };

export const opts = (...values: Array<[string, string]>): FieldOption[] => values.map(([value, label]) => ({ value, label }));

export const emptyImage = (): ImageRef => ({ src: '', alt: '' });

export function hasText(v: string | undefined | null): boolean {
  return Boolean(v && v.trim());
}

/** Render a link, or plain text if the URL is unsafe/empty. */
export function link(url: string, inner: string, className = '', extra = ''): string {
  const href = safeHref(url);
  if (!href) return `<span class="${className}">${inner}</span>`;
  const ext = isExternal(href) ? ' target="_blank" rel="noopener noreferrer"' : '';
  return `<a class="${className}" href="${esc(href)}"${ext}${extra ? ` ${extra}` : ''}>${inner}</a>`;
}

export function tagList(items: string[], className = 'tag-list'): string {
  const clean = items.filter(hasText);
  if (!clean.length) return '';
  return `<ul class="${className}" role="list">${clean.map((t) => `<li class="tag">${esc(t)}</li>`).join('')}</ul>`;
}

export function bulletList(items: string[], className = 'bullets'): string {
  const clean = items.filter(hasText);
  if (!clean.length) return '';
  return `<ul class="${className}">${clean.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
}

export function sectionHeader(heading: string, intro: string, ctx: RenderContext): string {
  if (!hasText(heading) && !hasText(intro)) return '';
  return `<header class="section-header" data-anim-child>${hasText(heading) ? `<h2 class="section-title">${esc(heading)}</h2>` : ''}${
    hasText(intro) ? `<div class="section-intro">${ctx.markdown(intro)}</div>` : ''
  }</header>`;
}

export function dateRange(start: string, end: string, current = false): string {
  const r = formatRange(start, end, current);
  return r ? `<span class="date-range">${esc(r)}</span>` : '';
}

/* ------------------------------- Documents ------------------------------ */

export const run = (text: string, extra: Partial<DocRun> = {}): DocRun => ({ text, ...extra });

export function para(text: string, tone?: 'lead' | 'muted' | 'small'): DocBlock[] {
  if (!hasText(text)) return [];
  return [{ kind: 'paragraph', runs: [run(text.trim())], ...(tone ? { tone } : {}) }];
}

export function bullets(items: string[]): DocBlock[] {
  const clean = items.filter(hasText);
  if (!clean.length) return [];
  return [{ kind: 'list', ordered: false, items: clean.map((t) => [run(t.trim())]) }];
}

export function linkRuns(links: Array<{ label: string; url: string }>): DocRun[] {
  const out: DocRun[] = [];
  for (const l of links) {
    const href = safeHref(l.url);
    if (!href) continue;
    if (out.length) out.push(run('  ·  '));
    out.push(run(l.label, { link: href }));
  }
  return out;
}

/* -------------------------------- Fields -------------------------------- */

export const headingField: FieldDef = { kind: 'text', key: 'heading', label: 'Heading' };
export const introField: FieldDef = { kind: 'markdown', key: 'intro', label: 'Intro', help: 'Markdown supported.' };
