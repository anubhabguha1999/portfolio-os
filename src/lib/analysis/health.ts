// CONTRACT (implementation owned by the analysis workstream). Keep this signature.
import type { Portfolio, PortfolioSection } from '@/types/portfolio';
import type { AssetMeta } from '@/stores/assets';
import type { RenderContext } from '@/sections/types';
import type { AnalysisReport, CheckResult } from './types';
import { withDefinition } from '@/sections/registry';
import { iconSvg } from '@/sections/icons';
import { collectImages, collectLinks, visibleSections, socialLinksOf } from '@/lib/engine/collect';
import { assetIdOf, isAssetRef } from '@/lib/engine/assets';
import { renderMarkdown, sanitizeHtml } from '@/lib/sanitize';
import { checkUrl, safeMediaSrc } from '@/utils/url';
import { esc } from '@/utils/escape';
import { AUDIT_PIXEL, agree, memo2, parseHtml, plural, renderForAudit, report } from './shared';
import { accessibilityAudit } from './accessibility';
import { networkDependencies } from './performance';

type Item = NonNullable<CheckResult['items']>[number];

function auditContext(p: Portfolio): RenderContext {
  return {
    portfolio: p,
    mode: 'export',
    image: (ref, o = {}) => (ref && ref.src ? `<img src="${AUDIT_PIXEL}" alt="${esc(o.decorative ? '' : ref.alt)}">` : ''),
    backgroundImage: () => '',
    mediaUrl: (src) => (isAssetRef(src) ? AUDIT_PIXEL : safeMediaSrc(src)),
    markdown: (md) => renderMarkdown(md),
    icon: (name, className) => iconSvg(name, className),
    socialLinks: () => socialLinksOf(p),
    addCss: () => undefined,
  };
}

/** Render one section in isolation; returns the error message when it throws. */
export function sectionRenderError(p: Portfolio, s: PortfolioSection): string | null {
  const ctx = auditContext(p);
  try {
    withDefinition(s, (def, sec) => {
      def.render(sec.data, ctx, sec);
      def.heading(sec.data);
    });
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

function checkSections(p: Portfolio): CheckResult {
  const items: Item[] = [];
  const hero = p.sections.find((s) => s.type === 'hero');
  let heroSectionId: string | null = hero?.id ?? null;
  if (!hero) items.push({ message: 'There is no hero section — the page has no name or headline.' });
  else if (!hero.enabled) items.push({ message: 'The hero section is hidden — the page has no name or headline.', sectionId: hero.id });
  else if (hero.type === 'hero' && !hero.data.name.trim()) items.push({ message: 'The hero has no name.', sectionId: hero.id });
  else heroSectionId = null;
  for (const s of visibleSections(p)) {
    const err = sectionRenderError(p, s);
    if (err) items.push({ message: `"${s.name}" fails to render: ${err}`, sectionId: s.id });
  }
  const count = visibleSections(p).length;
  return {
    id: 'health-sections',
    label: 'No broken required sections',
    weight: 3,
    status: items.length ? 'fail' : count ? 'pass' : 'fail',
    detail: items.length ? 'These problems would produce a broken or empty page.' : count ? `All ${plural(count, 'visible section')} render correctly.` : 'There are no visible sections.',
    sectionId: heroSectionId ?? items.find((i) => i.sectionId)?.sectionId ?? null,
    items,
  };
}

function checkAssets(p: Portfolio, assets: Record<string, AssetMeta>): CheckResult {
  const items: Item[] = [];
  const seen = new Set<string>();
  let total = 0;
  for (const img of collectImages(p)) {
    if (!isAssetRef(img.ref.src)) continue;
    const id = assetIdOf(img.ref.src);
    total++;
    if (assets[id]) continue;
    const key = `${id}|${img.sectionId ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ message: `${img.label} (${img.sectionName}) — the uploaded file is missing`, sectionId: img.sectionId });
  }
  for (const f of p.metadata.customFonts) {
    total++;
    if (!assets[f.assetId]) items.push({ message: `Custom font "${f.family}" — the uploaded file is missing` });
  }
  return {
    id: 'health-assets',
    label: 'Images available',
    weight: 3,
    status: items.length ? 'fail' : 'pass',
    detail: items.length ? `${plural(items.length, 'reference')} ${agree(items.length, 'points', 'point')} to files that are not in this project. Re-upload them or remove the reference.` : total ? `All ${plural(total, 'uploaded file')} are present.` : 'No uploaded files are referenced.',
    sectionId: items.find((i) => i.sectionId)?.sectionId ?? null,
    items,
  };
}

/** Anchors a `#link` can target in the exported page. */
export function validAnchors(p: Portfolio): Set<string> {
  const set = new Set(['top', 'main', 'main-after-hero']);
  for (const s of visibleSections(p)) set.add(s.style.anchor);
  return set;
}

function checkLinks(p: Portfolio): CheckResult {
  const anchors = validAnchors(p);
  const fails: Item[] = [];
  const warns: Item[] = [];
  const links = collectLinks(p);
  for (const l of links) {
    const url = l.url.trim();
    if (!url) {
      warns.push({ message: `${l.label} (${l.sectionName}) has no URL`, sectionId: l.sectionId });
      continue;
    }
    const res = checkUrl(url);
    if (!res.ok) {
      fails.push({ message: `${l.label} (${l.sectionName}): "${url.slice(0, 60)}" — ${res.reason}`, sectionId: l.sectionId });
      continue;
    }
    if (url.startsWith('#')) {
      const target = decodeURIComponent(url.slice(1));
      if (target && !anchors.has(target)) fails.push({ message: `${l.label} (${l.sectionName}) points to "#${target}", which is not a visible section`, sectionId: l.sectionId });
    }
  }
  // In-content links (markdown / custom HTML) must also resolve.
  const { doc } = renderForAudit(p);
  const ids = new Set([...doc.querySelectorAll('[id]')].map((e) => e.getAttribute('id') ?? ''));
  doc.querySelectorAll('.prose a[href^="#"], .custom-content a[href^="#"]').forEach((a) => {
    const target = (a.getAttribute('href') ?? '#').slice(1);
    if (target && !ids.has(target)) {
      const sectionId = a.closest('[data-section-id]')?.getAttribute('data-section-id') ?? null;
      fails.push({ message: `In-text link "${(a.textContent ?? '').trim().slice(0, 40)}" points to missing "#${target}"`, sectionId });
    }
  });
  return {
    id: 'health-links',
    label: 'Valid links',
    weight: 3,
    status: fails.length ? 'fail' : warns.length ? 'warn' : 'pass',
    detail: fails.length
      ? `${plural(fails.length, 'link')} ${agree(fails.length, 'is', 'are')} broken or unsafe and will not work in the export.`
      : warns.length
        ? `${plural(warns.length, 'button')} ${agree(warns.length, 'has', 'have')} no destination.`
        : `All ${plural(links.length, 'link')} are valid.`,
    sectionId: [...fails, ...warns].find((i) => i.sectionId)?.sectionId ?? null,
    items: [...fails, ...warns],
  };
}

function checkMetadata(p: Portfolio): CheckResult {
  const m = p.metadata;
  const hero = p.sections.find((s) => s.type === 'hero' && s.enabled);
  const fallback = hero && hero.type === 'hero' ? hero.data.name.trim() : '';
  const items: Item[] = [];
  let status: CheckResult['status'] = 'pass';
  if (!m.title.trim()) {
    status = fallback ? 'warn' : 'fail';
    items.push({ message: fallback ? `No page title — "${fallback}" will be used` : 'No page title and no hero name to fall back on' });
  }
  const len = m.description.trim().length;
  if (len === 0 || len < 50 || len > 160) {
    if (status === 'pass') status = 'warn';
    items.push({ message: len === 0 ? 'No meta description' : `Meta description is ${len} characters (recommended 50–160)` });
  }
  if (m.siteUrl.trim() && !/^https?:\/\//i.test(m.siteUrl.trim())) {
    if (status === 'pass') status = 'warn';
    items.push({ message: `Site URL "${m.siteUrl}" should start with https://` });
  }
  return {
    id: 'health-metadata',
    label: 'Valid metadata',
    weight: 2,
    status,
    detail: status === 'pass' ? 'Title and description are ready for search results and link previews.' : 'Search results and link previews will look incomplete.',
    items,
  };
}

const FIXED_WIDTH = /(?:^|[;{\s])(min-width|width)\s*:\s*(\d+(?:\.\d+)?)px/gi;

function checkResponsive(p: Portfolio): CheckResult {
  const items: Item[] = [];
  for (const s of visibleSections(p)) {
    if (s.type !== 'custom') continue;
    const sources = [s.data.css, ...(s.data.mode === 'html' ? [[...s.data.content.matchAll(/style\s*=\s*"([^"]*)"|style\s*=\s*'([^']*)'/gi)].map((m) => m[1] ?? m[2] ?? '').join(';')] : [])];
    for (const src of sources) {
      for (const m of src.matchAll(FIXED_WIDTH)) {
        const px = Number(m[2]);
        if (px > 480) items.push({ message: `"${s.name}": ${m[1]}: ${px}px will overflow on phones (use max-width or %)`, sectionId: s.id });
      }
      if (/white-space\s*:\s*nowrap/i.test(src)) items.push({ message: `"${s.name}": white-space: nowrap can cause horizontal scrolling`, sectionId: s.id });
    }
    if (s.data.mode === 'html' && /<table[\s>]/i.test(s.data.content)) items.push({ message: `"${s.name}": tables can be wider than a phone screen`, sectionId: s.id });
  }
  return {
    id: 'health-responsive',
    label: 'Responsive layout',
    weight: 1,
    status: items.length ? 'warn' : 'pass',
    detail: items.length ? 'Custom code may break the layout on small screens.' : 'All sections use the responsive layout system.',
    sectionId: items[0]?.sectionId ?? null,
    items,
  };
}

function checkA11y(p: Portfolio): CheckResult {
  const a = accessibilityAudit(p);
  const fails = a.checks.filter((c) => c.status === 'fail');
  const warns = a.checks.filter((c) => c.status === 'warn');
  const status = a.score < 50 ? 'fail' : fails.length || warns.length ? 'warn' : 'pass';
  return {
    id: 'health-a11y',
    label: 'Accessibility checks',
    weight: 2,
    status,
    detail:
      status === 'pass'
        ? `Accessibility score ${a.score}/100 — no issues found.`
        : `Accessibility score ${a.score}/100 — ${plural(fails.length, 'failing check')}${warns.length ? `, ${plural(warns.length, 'warning')}` : ''}.`,
    sectionId: fails.find((c) => c.sectionId)?.sectionId ?? null,
    items: [...fails, ...warns].map((c) => ({ message: `${c.label}: ${c.detail ?? ''}`.trim(), sectionId: c.sectionId ?? null })),
  };
}

/** Elements/attributes present in `original` that sanitising removed. */
export function removedMarkup(original: string): string[] {
  const before = parseHtml(`<body>${original}</body>`);
  const after = parseHtml(`<body>${sanitizeHtml(original)}</body>`);
  const count = (doc: Document) => {
    const tags = new Map<string, number>();
    const attrs = new Map<string, number>();
    doc.body.querySelectorAll('*').forEach((el) => {
      const t = el.tagName.toLowerCase();
      tags.set(t, (tags.get(t) ?? 0) + 1);
      for (const a of el.getAttributeNames()) {
        const val = el.getAttribute(a) ?? '';
        const key = /^on/i.test(a) ? `${a} handler` : /^(href|src)$/i.test(a) && /^\s*(javascript|vbscript|data:text)/i.test(val) ? `unsafe ${a}` : `${a} attribute`;
        attrs.set(key, (attrs.get(key) ?? 0) + 1);
      }
    });
    return { tags, attrs };
  };
  const b = count(before);
  const a = count(after);
  const out: string[] = [];
  for (const [t, n] of b.tags) {
    const lost = n - (a.tags.get(t) ?? 0);
    if (lost > 0) out.push(`<${t}>${lost > 1 ? ` ×${lost}` : ''}`);
  }
  for (const [k, n] of b.attrs) {
    const lost = n - (a.attrs.get(k) ?? 0);
    if (lost > 0) out.push(`${k}${lost > 1 ? ` ×${lost}` : ''}`);
  }
  return out;
}

function checkCompatibility(p: Portfolio): CheckResult {
  const items: Item[] = [];
  let sanitized = false;
  for (const s of visibleSections(p)) {
    if (s.type !== 'custom' || s.data.mode !== 'html' || !s.data.content.trim()) continue;
    const removed = removedMarkup(s.data.content);
    if (removed.length) {
      sanitized = true;
      items.push({ message: `"${s.name}": removed ${removed.join(', ')}`, sectionId: s.id });
    }
  }
  const deps = networkDependencies(p);
  for (const d of deps) if (d.kind === 'video' || d.kind === 'image') items.push({ message: `${d.label} needs a network connection`, sectionId: d.sectionId });
  const fonts = deps.find((d) => d.kind === 'font');
  if (fonts) items.push({ message: 'Fonts load from Google Fonts (falls back to system fonts offline)' });
  return {
    id: 'health-compat',
    label: 'Export compatibility',
    weight: 1,
    status: items.length ? 'warn' : 'pass',
    detail: sanitized
      ? 'Scripts and unsafe markup were removed from custom HTML — exported pages never run custom JavaScript.'
      : items.length
        ? 'Some media is hosted remotely and needs a network connection.'
        : 'The export is fully self-contained and safe.',
    sectionId: items.find((i) => i.sectionId)?.sectionId ?? null,
    items,
  };
}

const healthCheck = memo2((p: Portfolio, assets: Record<string, AssetMeta>): AnalysisReport =>
  report('health', 'Portfolio Health Check', [checkSections(p), checkAssets(p, assets), checkLinks(p), checkMetadata(p), checkResponsive(p), checkA11y(p), checkCompatibility(p)]),
);

/** Pre-export Portfolio Health Check. `fail` checks block export unless the user chooses "Export anyway". */
export function runHealthCheck(p: Portfolio, assets: Record<string, AssetMeta>): AnalysisReport {
  return healthCheck(p, assets);
}
