import type { ColorPalette, ColorScheme, Portfolio } from '@/types/portfolio';
import { contrastRatio } from '@/utils/color';
import { collectImages } from '@/lib/engine/collect';
import { assetIdOf, isAssetRef } from '@/lib/engine/assets';
import type { AnalysisReport, CheckResult } from './types';
import { agree, memo1, plural, renderForAudit, report, sectionIdOfNode, sectionNameOf } from './shared';

type Item = NonNullable<CheckResult['items']>[number];

/** Schemes a visitor can actually see. */
export function schemesInUse(p: Portfolio): ColorScheme[] {
  const s = p.settings.colorScheme;
  if (s === 'system' || p.settings.showThemeToggle) {
    const first: ColorScheme = s === 'system' ? p.theme.defaultScheme : s;
    return [first, first === 'dark' ? 'light' : 'dark'];
  }
  return [s];
}

interface ContrastPair {
  fg: keyof ColorPalette;
  bg: keyof ColorPalette;
  label: string;
  /** Minimum ratio for a pass. */
  min: number;
  /** Ratios between warnAt and min are warnings; below warnAt fail. */
  warnAt: number;
}

const PAIRS: ContrastPair[] = [
  { fg: 'text', bg: 'background', label: 'Body text on background', min: 4.5, warnAt: 4.5 },
  { fg: 'muted', bg: 'background', label: 'Muted text on background', min: 4.5, warnAt: 3 },
  { fg: 'primaryContrast', bg: 'primary', label: 'Button text on primary colour', min: 4.5, warnAt: 4.5 },
  { fg: 'text', bg: 'surface', label: 'Text on cards / surfaces', min: 4.5, warnAt: 4.5 },
  { fg: 'muted', bg: 'surface', label: 'Muted text on cards / surfaces', min: 4.5, warnAt: 3 },
  { fg: 'primary', bg: 'background', label: 'Links / accent text on background', min: 4.5, warnAt: 3 },
];

export interface ContrastFinding {
  scheme: ColorScheme;
  pair: string;
  ratio: number;
  status: 'pass' | 'warn' | 'fail';
  min: number;
}

export function contrastFindings(p: Portfolio): ContrastFinding[] {
  const out: ContrastFinding[] = [];
  for (const scheme of schemesInUse(p)) {
    const pal = p.theme.palettes[scheme];
    for (const pair of PAIRS) {
      const ratio = contrastRatio(pal[pair.fg], pal[pair.bg]);
      const status = ratio >= pair.min ? 'pass' : ratio >= pair.warnAt && pair.warnAt < pair.min ? 'warn' : 'fail';
      // Link colour below 3:1 is still only a warning: links are also underlined on hover and bold in prose.
      out.push({ scheme, pair: pair.label, ratio, status: pair.fg === 'primary' && status === 'fail' ? 'warn' : status, min: pair.min });
    }
  }
  return out;
}

function checkContrast(p: Portfolio): CheckResult {
  const findings = contrastFindings(p);
  const bad = findings.filter((f) => f.status !== 'pass');
  const fails = bad.filter((f) => f.status === 'fail');
  const schemes = schemesInUse(p);
  const scope = schemes.length > 1 ? 'light and dark palettes' : `${schemes[0]} palette`;
  return {
    id: 'a11y-contrast',
    label: 'Colour contrast',
    weight: 3,
    status: fails.length ? 'fail' : bad.length ? 'warn' : 'pass',
    detail: bad.length
      ? `${plural(bad.length, 'colour pair')} in the ${scope} ${agree(bad.length, 'falls', 'fall')} below WCAG AA (4.5:1 for text).`
      : `All text colours meet WCAG AA (4.5:1) in the ${scope}.`,
    items: bad.map((f) => ({ message: `${f.scheme === 'dark' ? 'Dark' : 'Light'}: ${f.pair} is ${f.ratio.toFixed(2)}:1 (needs ${f.min}:1)` })),
  };
}

const DECORATIVE_CLASSES = ['skill-icon'];

function isDecorativeImage(img: Element): boolean {
  if (img.closest('[aria-hidden="true"]')) return true;
  const role = img.getAttribute('role');
  if (role === 'presentation' || role === 'none') return true;
  if (DECORATIVE_CLASSES.some((c) => img.classList.contains(c))) return true;
  // An image inside a control that has its own label is described by that label.
  const labelled = img.closest('a[aria-label],button[aria-label]');
  return Boolean(labelled && labelled.getAttribute('aria-label')?.trim());
}

function checkAlt(p: Portfolio, doc: Document): CheckResult {
  const labels = new Map<string, string>();
  for (const i of collectImages(p)) {
    const key = `${i.sectionId ?? ''}|${isAssetRef(i.ref.src) ? assetIdOf(i.ref.src) : i.ref.src}`;
    if (!labels.has(key)) labels.set(key, i.label);
  }
  const items: Item[] = [];
  let total = 0;
  doc.body.querySelectorAll('img').forEach((img) => {
    if (isDecorativeImage(img)) return;
    total++;
    const alt = img.getAttribute('alt');
    if (alt !== null && alt.trim()) return;
    const sectionId = sectionIdOfNode(img);
    const key = `${sectionId ?? ''}|${img.getAttribute('data-pos-asset') ?? img.getAttribute('src') ?? ''}`;
    const label = labels.get(key) ?? `Image (${img.getAttribute('class') || 'untitled'})`;
    const where = sectionNameOf(p, sectionId);
    items.push({ message: `${label}${where ? ` — ${where}` : ''}${alt === null ? ' (no alt attribute)' : ''}`, sectionId });
  });
  return {
    id: 'a11y-alt',
    label: 'Image alt text',
    weight: 3,
    status: items.length ? 'fail' : 'pass',
    detail: items.length
      ? `${plural(items.length, 'content image')} ${items.length === 1 ? 'has' : 'have'} no alt text. Screen-reader users hear nothing for ${items.length === 1 ? 'it' : 'them'}.`
      : total
        ? `All ${plural(total, 'content image')} have alt text.`
        : 'No content images to describe.',
    sectionId: items[0]?.sectionId ?? null,
    items,
  };
}

function checkHeadings(p: Portfolio, doc: Document): CheckResult {
  const headings = [...doc.body.querySelectorAll('h1,h2,h3,h4,h5,h6')];
  const h1s = headings.filter((h) => h.tagName === 'H1');
  const items: Item[] = [];
  let fail = false;
  if (h1s.length === 0) {
    fail = true;
    items.push({ message: 'No <h1> on the page — give the hero a name.', sectionId: p.sections.find((s) => s.type === 'hero')?.id ?? null });
  } else if (h1s.length > 1) {
    fail = true;
    for (const h of h1s.slice(1)) items.push({ message: `Extra <h1>: "${(h.textContent ?? '').trim().slice(0, 60)}"`, sectionId: sectionIdOfNode(h) });
  }
  let prev = 0;
  for (const h of headings) {
    const level = Number(h.tagName.slice(1));
    if (prev && level > prev + 1) {
      const sectionId = sectionIdOfNode(h);
      items.push({ message: `Skipped from h${prev} to h${level}: "${(h.textContent ?? '').trim().slice(0, 60)}"${sectionNameOf(p, sectionId) ? ` — ${sectionNameOf(p, sectionId)}` : ''}`, sectionId });
    }
    prev = level;
  }
  const status = fail ? 'fail' : items.length ? 'warn' : 'pass';
  return {
    id: 'a11y-headings',
    label: 'Heading hierarchy',
    weight: 2,
    status,
    detail:
      status === 'pass'
        ? `One h1 and ${plural(headings.length - 1, 'sub-heading')} in logical order.`
        : fail
          ? `The page must have exactly one h1 (found ${h1s.length}).`
          : 'Some heading levels are skipped, which makes the outline confusing for screen readers.',
    sectionId: items[0]?.sectionId ?? null,
    items,
  };
}

function textOf(el: Element): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function accessibleName(el: Element, doc: Document): string {
  const aria = el.getAttribute('aria-label')?.trim();
  if (aria) return aria;
  const by = el.getAttribute('aria-labelledby');
  if (by) {
    const t = by
      .split(/\s+/)
      .map((id) => doc.getElementById(id))
      .filter((x): x is HTMLElement => Boolean(x))
      .map(textOf)
      .join(' ')
      .trim();
    if (t) return t;
  }
  const text = textOf(el);
  if (text) return text;
  for (const img of el.querySelectorAll('img[alt]')) {
    const alt = img.getAttribute('alt')?.trim();
    if (alt) return alt;
  }
  return el.getAttribute('title')?.trim() ?? '';
}

function checkNames(p: Portfolio, doc: Document): CheckResult {
  const items: Item[] = [];
  let count = 0;
  doc.body.querySelectorAll('a[href], button, [role="button"], [role="link"]').forEach((el) => {
    if (el.closest('[aria-hidden="true"]')) return;
    count++;
    if (accessibleName(el, doc)) return;
    const sectionId = sectionIdOfNode(el);
    const what = el.tagName === 'A' ? `Link to ${el.getAttribute('href') ?? '(no href)'}` : 'Button';
    items.push({ message: `${what} has no accessible name${sectionNameOf(p, sectionId) ? ` — ${sectionNameOf(p, sectionId)}` : ''}`, sectionId });
  });
  return {
    id: 'a11y-names',
    label: 'Link & button names',
    weight: 3,
    status: items.length ? 'fail' : 'pass',
    detail: items.length ? `${plural(items.length, 'control')} would be announced as just "link" or "button".` : `All ${plural(count, 'link and button', 'links and buttons')} have accessible names.`,
    sectionId: items[0]?.sectionId ?? null,
    items,
  };
}

const INTERACTIVE = new Set(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY', 'DETAILS', 'VIDEO', 'AUDIO']);

function checkKeyboard(p: Portfolio, doc: Document): CheckResult {
  const items: Item[] = [];
  let fail = false;
  doc.body.querySelectorAll('[tabindex]').forEach((el) => {
    const v = Number(el.getAttribute('tabindex'));
    if (v > 0) {
      fail = true;
      const sectionId = sectionIdOfNode(el);
      items.push({ message: `Positive tabindex="${v}" on <${el.tagName.toLowerCase()}> breaks the natural tab order${sectionNameOf(p, sectionId) ? ` — ${sectionNameOf(p, sectionId)}` : ''}`, sectionId });
    }
  });
  doc.body.querySelectorAll('[onclick], [role="button"], [role="link"]').forEach((el) => {
    if (INTERACTIVE.has(el.tagName)) return;
    if (el.hasAttribute('tabindex')) return;
    fail = true;
    const sectionId = sectionIdOfNode(el);
    items.push({ message: `Clickable <${el.tagName.toLowerCase()}> is not reachable by keyboard${sectionNameOf(p, sectionId) ? ` — ${sectionNameOf(p, sectionId)}` : ''}`, sectionId });
  });
  const skip = doc.body.querySelector('a.skip-link[href^="#"]');
  const target = skip ? doc.getElementById((skip.getAttribute('href') ?? '#').slice(1)) : null;
  if (!skip || !target) {
    fail = true;
    items.push({ message: 'No working "Skip to content" link' });
  }
  return {
    id: 'a11y-keyboard',
    label: 'Keyboard navigation',
    weight: 3,
    status: fail ? 'fail' : 'pass',
    detail: fail ? 'Some parts of the page cannot be reached or ordered correctly with the keyboard.' : 'Skip link present, natural tab order, and every interactive element is focusable.',
    sectionId: items.find((i) => i.sectionId)?.sectionId ?? null,
    items,
  };
}

function checkLang(p: Portfolio, doc: Document): CheckResult {
  const lang = doc.documentElement.getAttribute('lang')?.trim() ?? '';
  const valid = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(lang);
  return {
    id: 'a11y-lang',
    label: 'Page language',
    weight: 1,
    status: valid ? 'pass' : lang ? 'warn' : 'fail',
    detail: valid ? `<html lang="${lang}"> tells screen readers which voice to use.` : lang ? `"${lang}" is not a valid language tag (use e.g. "en" or "pt-BR" in SEO settings).` : 'The page has no language set.',
    items: valid || !p.metadata.language ? [] : [{ message: `Metadata language: "${p.metadata.language}"` }],
  };
}

function checkForms(p: Portfolio, doc: Document): CheckResult {
  const labelsFor = new Set<string>();
  doc.body.querySelectorAll('label[for]').forEach((l) => labelsFor.add(l.getAttribute('for') ?? ''));
  const controls = [...doc.body.querySelectorAll('input, textarea, select')].filter((el) => !['hidden', 'submit', 'button', 'reset', 'image'].includes((el.getAttribute('type') ?? '').toLowerCase()));
  const items: Item[] = [];
  for (const el of controls) {
    const id = el.getAttribute('id');
    const ok = (id && labelsFor.has(id)) || el.closest('label') || el.getAttribute('aria-label')?.trim() || el.getAttribute('aria-labelledby');
    if (!ok) {
      const sectionId = sectionIdOfNode(el);
      items.push({ message: `<${el.tagName.toLowerCase()} name="${el.getAttribute('name') ?? ''}"> has no label${sectionNameOf(p, sectionId) ? ` — ${sectionNameOf(p, sectionId)}` : ''}`, sectionId });
    }
  }
  return {
    id: 'a11y-forms',
    label: 'Form labels',
    weight: 2,
    status: items.length ? 'fail' : controls.length ? 'pass' : 'info',
    detail: items.length ? `${plural(items.length, 'form field')} without a label.` : controls.length ? `All ${plural(controls.length, 'form field')} are labelled.` : 'No form fields on the page.',
    sectionId: items[0]?.sectionId ?? null,
    items,
  };
}

function checkMotion(p: Portfolio): CheckResult {
  const animated = p.settings.animations && p.theme.motion.enabled;
  return {
    id: 'a11y-motion',
    label: 'Reduced motion',
    weight: 1,
    status: 'pass',
    detail: animated
      ? 'Animations are on; the generated CSS and runtime switch them off for visitors who set "prefers-reduced-motion".'
      : 'Animations are off. The generated CSS also honours "prefers-reduced-motion".',
  };
}

function checkDuplicateIds(p: Portfolio, doc: Document): CheckResult {
  const seen = new Map<string, Element[]>();
  doc.querySelectorAll('[id]').forEach((el) => {
    const id = el.getAttribute('id') ?? '';
    if (!id) return;
    seen.set(id, [...(seen.get(id) ?? []), el]);
  });
  const dups = [...seen.entries()].filter(([, els]) => els.length > 1);
  const items: Item[] = dups.map(([id, els]) => {
    const sectionId = els.map(sectionIdOfNode).find(Boolean) ?? null;
    return { message: `id="${id}" is used ${els.length} times${sectionNameOf(p, sectionId) ? ` — ${sectionNameOf(p, sectionId)}` : ''}`, sectionId };
  });
  return {
    id: 'a11y-ids',
    label: 'Unique element ids',
    weight: 1,
    status: dups.length ? 'warn' : 'pass',
    detail: dups.length ? 'Duplicate ids break anchor links and label associations.' : 'Every id on the page is unique.',
    sectionId: items[0]?.sectionId ?? null,
    items,
  };
}

export const accessibilityAudit = memo1((p: Portfolio): AnalysisReport => {
  const { doc } = renderForAudit(p);
  const checks: CheckResult[] = [
    checkAlt(p, doc),
    checkContrast(p),
    checkHeadings(p, doc),
    checkNames(p, doc),
    checkKeyboard(p, doc),
    checkLang(p, doc),
    checkForms(p, doc),
    checkMotion(p),
    checkDuplicateIds(p, doc),
  ];
  return report('accessibility', 'Accessibility', checks);
});

