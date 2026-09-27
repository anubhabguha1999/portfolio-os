import type { Portfolio } from '@/types/portfolio';
import type { AssetMeta } from '@/stores/assets';
import { collectImages, visibleSections, heroOf } from '@/lib/engine/collect';
import { assetIdOf, isAssetRef } from '@/lib/engine/assets';
import { googleFontsHref, getFont } from '@/lib/theme/fonts';
import { formatBytes } from '@/utils/format';
import { safeMediaSrc } from '@/utils/url';
import type { AnalysisReport, CheckResult } from './types';
import { agree, estimateStandalone, memo2, plural, report } from './shared';

type Item = NonNullable<CheckResult['items']>[number];

export const KB = 1024;
export const MB = 1024 * 1024;
export const IMAGE_WARN_BYTES = 500 * KB;
export const IMAGE_FAIL_BYTES = 1.5 * MB;
export const IMAGE_MAX_DIMENSION = 2560;
export const DOM_WARN_NODES = 1500;
export const DOM_FAIL_NODES = 3000;
export const HTML_WARN_BYTES = 5 * MB;
export const HTML_FAIL_BYTES = 15 * MB;

function checkImages(p: Portfolio, assets: Record<string, AssetMeta>): CheckResult {
  const items: Item[] = [];
  let fail = false;
  let warn = false;
  const seen = new Set<string>();
  let count = 0;
  for (const img of collectImages(p)) {
    if (!isAssetRef(img.ref.src)) continue;
    const id = assetIdOf(img.ref.src);
    if (seen.has(id)) continue;
    seen.add(id);
    const meta = assets[id];
    if (!meta) continue;
    count++;
    const problems: string[] = [];
    if (meta.size > IMAGE_FAIL_BYTES) {
      fail = true;
      problems.push(`${formatBytes(meta.size)} (over ${formatBytes(IMAGE_FAIL_BYTES)})`);
    } else if (meta.size > IMAGE_WARN_BYTES) {
      warn = true;
      problems.push(`${formatBytes(meta.size)} (over ${formatBytes(IMAGE_WARN_BYTES)})`);
    }
    if (Math.max(meta.width, meta.height) > IMAGE_MAX_DIMENSION) {
      warn = true;
      problems.push(`${meta.width}×${meta.height}px (larger than ${IMAGE_MAX_DIMENSION}px)`);
    }
    if (problems.length) items.push({ message: `${img.label}: ${problems.join(', ')}`, sectionId: img.sectionId });
  }
  return {
    id: 'perf-images',
    label: 'Image optimization',
    weight: 3,
    status: fail ? 'fail' : warn ? 'warn' : 'pass',
    detail: items.length
      ? `${plural(items.length, 'image')} should be compressed or resized (aim for under ${formatBytes(IMAGE_WARN_BYTES)} and ${IMAGE_MAX_DIMENSION}px).`
      : count
        ? `All ${plural(count, 'uploaded image')} are reasonably sized.`
        : 'No uploaded images.',
    sectionId: items[0]?.sectionId ?? null,
    items,
  };
}

function checkSize(p: Portfolio, assets: Record<string, AssetMeta>): CheckResult {
  const est = estimateStandalone(p, assets);
  const status = est.total > HTML_FAIL_BYTES ? 'fail' : est.total > HTML_WARN_BYTES ? 'warn' : 'pass';
  const biggest = [...est.occurrences.entries()]
    .map(([id, n]) => ({ id, n, bytes: (assets[id]?.size ?? 0) * n }))
    .filter((x) => x.bytes > 0)
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 5);
  return {
    id: 'perf-size',
    label: 'Large assets',
    weight: 2,
    status,
    detail: `Estimated standalone HTML: ${formatBytes(est.total)} (${formatBytes(est.markupBytes)} markup + ${formatBytes(est.assetBytes)} inlined assets).${
      status === 'pass' ? '' : ' Large single-file exports load slowly on mobile — compress images or use the ZIP export.'
    }`,
    items: status === 'pass' ? [] : biggest.map((b) => ({ message: `${assets[b.id]?.name ?? b.id}: ${formatBytes(b.bytes)}${b.n > 1 ? ` (used ${b.n}×)` : ''}` })),
  };
}

function checkDom(p: Portfolio, assets: Record<string, AssetMeta>): CheckResult {
  const { doc } = estimateStandalone(p, assets);
  const nodes = doc.body.getElementsByTagName('*').length;
  const status = nodes > DOM_FAIL_NODES ? 'fail' : nodes > DOM_WARN_NODES ? 'warn' : 'pass';
  const perSection = [...doc.body.querySelectorAll('section[data-section-id]')]
    .map((s) => ({ id: s.getAttribute('data-section-id'), n: s.getElementsByTagName('*').length }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 3);
  return {
    id: 'perf-dom',
    label: 'DOM size',
    weight: 1,
    status,
    detail: `${nodes.toLocaleString('en-US')} elements${status === 'pass' ? ` (under ${DOM_WARN_NODES})` : ` — above ${DOM_WARN_NODES}, layout and style recalculation get slower`}.`,
    items:
      status === 'pass'
        ? []
        : perSection.map((s) => ({ message: `${p.sections.find((x) => x.id === s.id)?.name ?? 'Section'}: ${s.n} elements`, sectionId: s.id })),
    sectionId: status === 'pass' ? null : (perSection[0]?.id ?? null),
  };
}

function checkAnimation(p: Portfolio, assets: Record<string, AssetMeta>): CheckResult {
  const animationsOn = p.settings.animations && p.theme.motion.enabled;
  const { doc } = estimateStandalone(p, assets);
  const hero = p.sections.find((s) => s.type === 'hero' && s.enabled);
  const h = hero && hero.type === 'hero' ? hero.data : null;
  const heavy: Item[] = [];
  if (h) {
    const sid = hero?.id ?? null;
    if (h.background === 'particles') heavy.push({ message: 'Particle canvas animates every frame', sectionId: sid });
    if (h.background === 'video' && safeMediaSrc(h.videoUrl)) heavy.push({ message: 'Autoplaying background video', sectionId: sid });
    if (h.background === 'aurora' || h.background === 'spotlight') heavy.push({ message: `Animated ${h.background} background`, sectionId: sid });
    if (h.typingEnabled && h.typingPhrases.some((x) => x.trim())) heavy.push({ message: 'Typing effect', sectionId: sid });
    if (h.parallax) heavy.push({ message: 'Hero parallax (scroll listener)', sectionId: sid });
    if (h.magneticButtons) heavy.push({ message: 'Magnetic buttons (pointer tracking)', sectionId: sid });
  }
  const parallaxSections = visibleSections(p).filter((s) => s.style.animation.type === 'parallax');
  if (animationsOn && parallaxSections.length) heavy.push({ message: `${plural(parallaxSections.length, 'section')} with parallax scrolling`, sectionId: parallaxSections[0]?.id ?? null });
  const animatedSections = doc.body.querySelectorAll('[data-anim]').length;
  const animatedChildren = animationsOn ? doc.body.querySelectorAll('[data-anim] [data-anim-child]').length : 0;
  if (!animationsOn && heavy.length === 0) {
    return { id: 'perf-animation', label: 'Animation cost', weight: 1, status: 'pass', detail: 'Animations are turned off — no animation cost.' };
  }
  const excessive = heavy.length >= 3 || animatedChildren > 150 || (heavy.length >= 2 && animatedChildren > 80);
  return {
    id: 'perf-animation',
    label: 'Animation cost',
    weight: 1,
    status: excessive ? 'warn' : 'pass',
    detail: `${plural(animatedSections, 'animated section')}, ${plural(animatedChildren, 'animated element')}${heavy.length ? `, ${plural(heavy.length, 'continuous effect')}` : ''}.${
      excessive ? ' This much motion can drop frames on low-end phones — consider removing an effect.' : ''
    }`,
    items: heavy,
    sectionId: heavy[0]?.sectionId ?? null,
  };
}

function checkFonts(p: Portfolio): CheckResult {
  const t = p.theme.typography;
  const used = new Set([t.headingFont, t.bodyFont, t.monoFont]);
  const unused = p.metadata.customFonts.filter((f) => !used.has(f.id) && !used.has(f.family));
  const cdnFamilies = p.settings.fontDelivery === 'cdn' ? [...used].filter((id) => getFont(id)?.google) : [];
  const items: Item[] = unused.map((f) => ({ message: `"${f.family}" (${f.weight} ${f.style}) is uploaded but not used by any typography role` }));
  const cdnNote = cdnFamilies.length ? ` ${plural(cdnFamilies.length, 'font family', 'font families')} load from Google Fonts.` : '';
  return {
    id: 'perf-fonts',
    label: 'Unused fonts',
    weight: 1,
    status: unused.length ? 'warn' : 'pass',
    detail: unused.length
      ? `${plural(unused.length, 'custom font')} will be embedded in the export but never used.${cdnNote}`
      : `No unused custom fonts.${cdnNote || (p.settings.fontDelivery === 'system' ? ' Fonts use local system stacks (no downloads).' : '')}`,
    items,
  };
}

export interface NetworkDependency {
  kind: 'video' | 'image' | 'font' | 'icon';
  url: string;
  sectionId: string | null;
  label: string;
}

export function networkDependencies(p: Portfolio): NetworkDependency[] {
  const out: NetworkDependency[] = [];
  for (const img of collectImages(p)) {
    if (/^https?:\/\//i.test(img.ref.src)) out.push({ kind: 'image', url: img.ref.src, sectionId: img.sectionId, label: img.label });
  }
  for (const s of visibleSections(p)) {
    if (s.type === 'hero' && s.data.background === 'video' && safeMediaSrc(s.data.videoUrl)) out.push({ kind: 'video', url: s.data.videoUrl, sectionId: s.id, label: 'Hero background video' });
    if (s.type === 'skills') for (const sk of s.data.items) if (/^https?:\/\//i.test(sk.icon)) out.push({ kind: 'icon', url: sk.icon, sectionId: s.id, label: `Skill icon "${sk.name}"` });
  }
  const t = p.theme.typography;
  const href = p.settings.fontDelivery === 'cdn' ? googleFontsHref([t.headingFont, t.bodyFont, t.monoFont]) : null;
  if (href) out.push({ kind: 'font', url: href, sectionId: null, label: 'Google Fonts stylesheet' });
  return out;
}

function checkOffline(p: Portfolio): CheckResult {
  const deps = networkDependencies(p);
  return {
    id: 'perf-offline',
    label: 'Works offline',
    weight: 1,
    status: deps.length ? 'warn' : 'pass',
    detail: deps.length
      ? `${plural(deps.length, 'external resource')} ${agree(deps.length, 'needs', 'need')} a network connection; the rest of the page still works offline.`
      : 'Everything is self-contained — the exported file works with no network connection.',
    items: deps.map((d) => ({ message: `${d.label}: ${d.url.length > 80 ? `${d.url.slice(0, 77)}…` : d.url}`, sectionId: d.sectionId })),
    sectionId: deps.find((d) => d.sectionId)?.sectionId ?? null,
  };
}

function checkFirstRender(p: Portfolio, assets: Record<string, AssetMeta>): CheckResult {
  const heroSec = p.sections.find((s) => s.type === 'hero' && s.enabled);
  const h = heroSec ? heroOf(p) : null;
  if (!heroSec || !h) return { id: 'perf-first-render', label: 'First render', weight: 2, status: 'info', detail: 'No hero section — the first screen is text only.' };
  const refs: Array<{ src: string; label: string }> = [];
  if (h.layout !== 'minimal' && h.image.src) refs.push({ src: h.image.src, label: 'Profile image' });
  if (h.background === 'image' && h.backgroundImage.src) refs.push({ src: h.backgroundImage.src, label: 'Background image' });
  let bytes = 0;
  const items: Item[] = [];
  let remote = false;
  for (const r of refs) {
    if (isAssetRef(r.src)) {
      const m = assets[assetIdOf(r.src)];
      if (m) {
        bytes += m.size;
        items.push({ message: `${r.label}: ${formatBytes(m.size)}`, sectionId: heroSec.id });
      }
    } else if (/^https?:/i.test(r.src)) {
      remote = true;
      items.push({ message: `${r.label} loads from the network`, sectionId: heroSec.id });
    }
  }
  const video = h.background === 'video' && Boolean(safeMediaSrc(h.videoUrl));
  if (video) items.push({ message: 'Background video streams from the network', sectionId: heroSec.id });
  const status = bytes > 1 * MB ? 'fail' : bytes > 300 * KB || video ? 'warn' : 'pass';
  return {
    id: 'perf-first-render',
    label: 'First render',
    weight: 2,
    status,
    detail:
      status === 'pass'
        ? `Above-the-fold media: ${bytes ? formatBytes(bytes) : 'none'}${remote ? ' (plus remote images)' : ''} — the hero paints quickly.`
        : `Above-the-fold media weighs ${formatBytes(bytes)}${video ? ' plus a video' : ''}. The hero is the first thing visitors wait for; keep it under 300 KB.`,
    sectionId: heroSec.id,
    items,
  };
}

export const performanceAudit = memo2((p: Portfolio, assets: Record<string, AssetMeta>): AnalysisReport => {
  const checks = [checkFirstRender(p, assets), checkImages(p, assets), checkSize(p, assets), checkFonts(p), checkAnimation(p, assets), checkDom(p, assets), checkOffline(p)];
  return report('performance', 'Performance', checks);
});
