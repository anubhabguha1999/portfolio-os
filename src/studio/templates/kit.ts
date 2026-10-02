/**
 * Composition kit shared by every document template. Templates describe a *look*
 * (fonts, colours, rhythm, ornaments) and arrange sections; the kit turns resolved
 * content into FlowNodes with sensible pagination hints.
 */
import { contactIcon } from '@/studio/engine/icons';
import type { BoxNode, FlowNode, RowNode, FontFamily, GroupNode, ImageNode, Run, TextNode, TextStyle } from '@/studio/engine/flow';
import { getMeasurer, PT } from '@/studio/engine/measure';
import type { ContactItem, ResolvedItem, ResolvedSection } from '@/studio/model/resolve';
import type { FontChoice, MarginPreset, PaperSize, ResumeStyle } from '@/studio/model/types';

/* ------------------------------ page ------------------------------- */

export const PAPER: Record<PaperSize, { w: number; h: number; label: string }> = {
  a4: { w: 210, h: 297, label: 'A4' },
  letter: { w: 215.9, h: 279.4, label: 'US Letter' },
  legal: { w: 215.9, h: 355.6, label: 'US Legal' },
};

export const MARGINS: Record<MarginPreset, number> = { narrow: 11, normal: 16, wide: 22 };

export interface Metrics {
  pageW: number;
  pageH: number;
  margin: { top: number; right: number; bottom: number; left: number };
  contentW: number;
}

export function metrics(paper: PaperSize, margins: MarginPreset, marginScale = 1, orientation: 'portrait' | 'landscape' = 'portrait', over: Partial<Metrics['margin']> = {}): Metrics {
  const p = PAPER[paper];
  const [w, h] = orientation === 'landscape' ? [p.h, p.w] : [p.w, p.h];
  const m = Math.max(7, MARGINS[margins] * marginScale);
  const margin = { top: m, right: m, bottom: m, left: m, ...over };
  return { pageW: w, pageH: h, margin, contentW: w - margin.left - margin.right };
}

/* ------------------------------ colour ----------------------------- */

export const COLOR_PRESETS: Array<{ id: string; label: string; accent: string }> = [
  { id: 'black', label: 'Black', accent: '#111111' },
  { id: 'slate', label: 'Slate', accent: '#334155' },
  { id: 'navy', label: 'Navy', accent: '#1e3a8a' },
  { id: 'blue', label: 'Blue', accent: '#1d4ed8' },
  { id: 'green', label: 'Green', accent: '#047857' },
  { id: 'burgundy', label: 'Burgundy', accent: '#881337' },
  { id: 'purple', label: 'Purple', accent: '#6d28d9' },
  { id: 'monochrome', label: 'Monochrome', accent: '#404040' },
];

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [17, 17, 17];
  const h = m[1]!.length === 3 ? m[1]!.split('').map((c) => c + c).join('') : m[1]!;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return `#${x.map((v, i) => Math.round(v * (1 - t) + (y[i] ?? 0) * t).toString(16).padStart(2, '0')).join('')}`;
}

export function safeHex(c: string, fallback = '#1e3a8a'): string {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test((c ?? '').trim()) ? c.trim() : fallback;
}

/** Relative luminance (WCAG). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Darken an accent until it reaches `ratio` contrast on white. */
export function readableOnWhite(hex: string, ratio = 4.5): string {
  let c = safeHex(hex);
  for (let i = 0; i < 12 && (1.05 / (luminance(c) + 0.05)) < ratio; i++) c = mix(c, '#000000', 0.15);
  return c;
}

/* ------------------------------ fonts ------------------------------ */

export function fontFor(choice: FontChoice, fallback: FontFamily): FontFamily {
  return choice === 'sans' ? 'helvetica' : choice === 'serif' ? 'times' : choice === 'mono' ? 'courier' : fallback;
}

/* ------------------------- inline markdown ------------------------- */

/** `**bold**`, `*italic*`, `[label](url)` and bare URLs → runs. */
export function inlineRuns(text: string, extra: Partial<Run> = {}): Run[] {
  const out: Run[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)\s]+\)|https?:\/\/[^\s)]+)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i), ...extra });
    const tok = m[0];
    if (tok.startsWith('**')) out.push({ text: tok.slice(2, -2), ...extra, bold: true });
    else if (tok.startsWith('[')) {
      const mm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok);
      out.push({ text: mm?.[1] ?? tok, ...extra, ...(mm?.[2] ? { link: mm[2] } : {}) });
    } else if (tok.startsWith('http')) out.push({ text: tok.replace(/^https?:\/\//, ''), ...extra, link: tok });
    else out.push({ text: tok.slice(1, -1), ...extra, italic: true });
    last = i + tok.length;
  }
  if (last < text.length) out.push({ text: text.slice(last), ...extra });
  return out.length ? out : [{ text: '', ...extra }];
}

export function plainOf(text: string): string {
  return inlineRuns(text)
    .map((r) => r.text)
    .join('');
}

/* ------------------------------ look ------------------------------- */

export interface Look {
  font: FontFamily;
  headFont: FontFamily;
  size: number;
  lh: number;
  /** Vertical rhythm unit in mm. */
  sp: number;
  text: string;
  muted: string;
  accent: string;
  rule: string;
  tint: string;
  link: string;
  linkUnderline: boolean;
  section: {
    size: number;
    upper: boolean;
    tracking: number;
    color: string;
    bold: boolean;
    italic: boolean;
    font: FontFamily;
    rule: 'none' | 'below' | 'above' | 'bar' | 'fill' | 'short';
    ruleColor: string;
    ruleWeight: number;
    align: 'left' | 'center';
  };
  entry: {
    titleSize: number;
    titleColor: string;
    titleBold: boolean;
    subtitleColor: string;
    subtitleItalic: boolean;
    subtitleBold: boolean;
    /** How the title and subtitle combine. */
    order: 'title-first' | 'subtitle-first';
    date: 'right' | 'inline' | 'below' | 'gutter';
    dateColor: string;
    gutter: number;
  };
  bullet: 'bullet' | 'dash' | 'square' | 'arrow';
  bulletColor: string;
  tags: 'comma' | 'pipes' | 'chips' | 'lines';
  chipFill: string;
  chipText: string;
  /** Show technologies under experience/projects. */
  showTech: boolean;
  justify: boolean;
}

export interface Effective {
  size: number;
  lh: number;
  sp: number;
  marginScale: number;
}

/** Apply fit-to-page adjustments and clamp to readable limits. */
export function effectiveStyle(s: ResumeStyle): Effective {
  const fit = s.fit;
  return {
    size: Math.max(8, Math.min(13, s.baseSize * (fit?.font ?? 1))),
    lh: Math.max(1.1, Math.min(1.7, s.lineHeight + (fit?.lineHeight ?? 0))),
    sp: Math.max(0.45, Math.min(1.8, s.spacing * (fit?.spacing ?? 1))),
    marginScale: Math.max(0.55, fit?.margins ?? 1),
  };
}

export function accentOf(s: ResumeStyle): string {
  if (s.atsSafe) return '#111111';
  const preset = COLOR_PRESETS.find((p) => p.id === s.colorPreset);
  return safeHex(preset && s.colorPreset !== 'custom' ? preset.accent : s.accent);
}

/* ----------------------------- builders ---------------------------- */

export function ts(look: Look, over: Partial<TextStyle> = {}): TextStyle {
  return { font: look.font, size: look.size, color: look.text, lineHeight: look.lh, ...over };
}

export function para(text: string, look: Look, over: Partial<TextStyle> = {}, node: Partial<TextNode> = {}): TextNode {
  return { t: 'text', runs: inlineRuns(text), style: ts(look, over), ...(look.justify ? { align: 'justify' } : {}), ...node };
}

/** Paragraphs separated by blank lines; single newlines become spaces. */
export function paragraphs(text: string, look: Look, over: Partial<TextStyle> = {}, gap = 1.4): FlowNode[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
    .map((p, i) => para(p, look, over, i > 0 ? { before: gap * look.sp } : {}));
}

export function bulletNodes(items: string[], look: Look, over: Partial<TextStyle> = {}, gap = 0.7): TextNode[] {
  return items
    .filter((b) => b.trim())
    .map((b, i) => ({
      t: 'text' as const,
      runs: inlineRuns(b.trim()),
      style: ts(look, over),
      marker: { kind: look.bullet, color: look.bulletColor },
      indent: look.size * PT * (look.bullet === 'dash' || look.bullet === 'arrow' ? 1.75 : 1.35),
      ...(i > 0 ? { before: gap * look.sp } : {}),
    }));
}

export function sectionTitle(title: string, look: Look, width: number): FlowNode[] {
  const s = look.section;
  const style: TextStyle = { font: s.font, size: s.size, color: s.color, bold: s.bold, italic: s.italic, uppercase: s.upper, tracking: s.tracking, lineHeight: 1.2 };
  const text: TextNode = { t: 'text', runs: [{ text: title }], style, role: 'h1', align: s.align, keepWithNext: true };
  switch (s.rule) {
    case 'below':
      return [text, { t: 'rule', color: s.ruleColor, weight: s.ruleWeight, before: 0.9 * look.sp, after: 2 * look.sp, keepWithNext: true }];
    case 'short':
      return [text, { t: 'rule', color: s.ruleColor, weight: s.ruleWeight, before: 1 * look.sp, after: 2.2 * look.sp, length: Math.min(1, 14 / width), keepWithNext: true, align: s.align }];
    case 'above':
      return [{ t: 'rule', color: s.ruleColor, weight: s.ruleWeight, after: 1.6 * look.sp, keepWithNext: true }, { ...text, after: 1.8 * look.sp }];
    case 'bar':
      return [{ t: 'box', nodes: [text], bar: { color: s.ruleColor, width: 1.1 }, padding: [0.2, 0, 0.2, 2.6], after: 2 * look.sp, keepWithNext: true, keep: 'together' } as BoxNode];
    case 'fill':
      return [{ t: 'box', nodes: [text], fill: look.tint, radius: 0.8, padding: [1.2, 2, 1.2, 2], after: 2 * look.sp, keepWithNext: true, keep: 'together' } as BoxNode];
    default:
      return [{ ...text, after: 1.6 * look.sp }];
  }
}

function dateRun(item: ResolvedItem, look: Look, size: number): Run[] {
  return item.date ? [{ text: item.date, color: look.entry.dateColor, size, bold: false, italic: false }] : [];
}

/** A resume entry: header (title/subtitle/date/location), description, bullets, tags. */
export function entryNodes(item: ResolvedItem, look: Look, width: number, opts: { compact?: boolean; showTech?: boolean; ref?: string; kind?: string; side?: boolean } = {}): GroupNode {
  const companyFirst = opts.kind === 'experience' || opts.kind === 'volunteer';
  const e = { ...look.entry, order: companyFirst ? look.entry.order : ('title-first' as const), date: opts.side && look.entry.date === 'right' ? ('below' as const) : look.entry.date };
  const titleStyle = ts(look, { size: e.titleSize, bold: e.titleBold, color: e.titleColor, lineHeight: 1.25 });
  const subStyle = ts(look, { color: e.subtitleColor, italic: e.subtitleItalic, bold: e.subtitleBold, lineHeight: 1.25 });
  const metaSize = Math.max(7.5, look.size - 0.8);
  const metaStyle = ts(look, { size: metaSize, color: look.entry.dateColor, lineHeight: 1.25 });
  const first = e.order === 'title-first' ? item.title : item.subtitle || item.title;
  const second = e.order === 'title-first' ? item.subtitle : item.subtitle ? item.title : '';
  const titleRuns: Run[] = [{ text: first || 'Untitled', ...(item.url && !second ? { link: item.url } : {}) }];
  const head: FlowNode[] = [];
  const dateW = item.date ? Math.min(width * 0.36, getMeasurer().width(item.date, look.font, false, false, metaSize) + 1) : 0;
  if (e.date === 'right' && item.date) {
    head.push({ t: 'row', gap: 3, cols: [{ nodes: [{ t: 'text', runs: titleRuns, style: titleStyle, role: 'h3' }] }, { width: dateW / Math.max(1, width - 3), align: 'right', nodes: [{ t: 'text', runs: dateRun(item, look, metaSize), style: metaStyle, align: 'right' }] }] });
  } else if (e.date === 'inline' && item.date) {
    head.push({ t: 'text', runs: [...titleRuns, { text: '  ·  ', color: look.muted, bold: false }, ...dateRun(item, look, metaSize)], style: titleStyle, role: 'h3' });
  } else {
    head.push({ t: 'text', runs: titleRuns, style: titleStyle, role: 'h3' });
  }
  const subParts: Run[] = [];
  if (second) subParts.push({ text: second, ...(item.url ? { link: item.url } : {}) });
  const loc = item.location.trim();
  if (e.date === 'right' && loc && second) {
    const locW = Math.min(width * 0.36, getMeasurer().width(loc, look.font, false, false, metaSize) + 1);
    head.push({ t: 'row', gap: 3, before: 0.4 * look.sp, cols: [{ nodes: [{ t: 'text', runs: subParts, style: subStyle }] }, { width: locW / Math.max(1, width - 3), align: 'right', nodes: [{ t: 'text', runs: [{ text: loc }], style: metaStyle, align: 'right' }] }] });
  } else {
    if (loc) subParts.push({ text: `${subParts.length ? '  ·  ' : ''}${loc}`, italic: false, bold: false, color: look.muted });
    if (subParts.length) head.push({ t: 'text', runs: subParts, style: subStyle, before: 0.4 * look.sp });
  }
  if (e.date === 'below' && item.date) head.push({ t: 'text', runs: dateRun(item, look, metaSize), style: metaStyle, before: 0.3 * look.sp });
  const body: FlowNode[] = [];
  if (item.description.trim() && !(opts.compact && item.bullets.length)) body.push(...paragraphs(item.description, look, {}, 1).map((n, i) => (i === 0 ? { ...n, before: 1.1 * look.sp } : n)));
  const bl = bulletNodes(item.bullets, look);
  if (bl[0]) bl[0].before = (body.length ? 0.9 : 1.1) * look.sp;
  body.push(...bl);
  if ((opts.showTech ?? look.showTech) && item.tags.length) {
    body.push({ t: 'text', runs: [{ text: 'Tech: ', bold: true, color: look.muted }, { text: item.tags.join(', '), color: look.muted }], style: ts(look, { size: Math.max(7.5, look.size - 0.8) }), before: 1 * look.sp });
  }
  return { t: 'group', keep: body.length <= 6 ? 'together' : 'head', head: head.length, minBody: 2, nodes: [...head, ...body], ref: opts.ref ?? item.id };
}

/** Wrap-packed chips (skill tags). */
export function chipRows(items: string[], look: Look, width: number): FlowNode[] {
  const M = getMeasurer();
  const size = Math.max(7.5, look.size - 1);
  const padX = 1.8;
  const gap = 1.4;
  const rows: string[][] = [];
  let row: string[] = [];
  let x = 0;
  for (const it of items) {
    const w = Math.min(width, M.width(it, look.font, false, false, size) + padX * 2 + 0.3);
    if (row.length && x + w > width) {
      rows.push(row);
      row = [];
      x = 0;
    }
    row.push(it);
    x += w + gap;
  }
  if (row.length) rows.push(row);
  return rows.map((r, ri) => {
    const widths = r.map((it) => Math.min(width, M.width(it, look.font, false, false, size) + padX * 2 + 0.3));
    const natural = widths.reduce((a, b) => a + b, 0) + gap * (r.length - 1);
    const filler = natural < width - gap - 0.5;
    const avail = width - gap * (r.length - (filler ? 0 : 1));
    const used = widths.reduce((a, b) => a + b, 0);
    return {
      t: 'row' as const,
      gap,
      ...(ri > 0 ? { before: gap } : {}),
      cols: [
        ...r.map((it, i) => ({
          width: widths[i]! / avail,
          nodes: [{ t: 'box' as const, fill: look.chipFill, radius: 1.2, padding: [0.9, padX, 0.9, padX] as [number, number, number, number], keep: 'together' as const, nodes: [{ t: 'text' as const, runs: [{ text: it }], style: ts(look, { size, color: look.chipText, lineHeight: 1.15 }) }] }],
        })),
        ...(filler ? [{ width: Math.max(0, (avail - used) / avail - 0.0001), nodes: [] }] : []),
      ],
    };
  });
}

export function skillsNodes(sec: ResolvedSection, look: Look, width: number, mode: 'auto' | 'chips' | 'lines' | 'comma' | 'bars' = 'auto'): FlowNode[] {
  const out: FlowNode[] = [];
  const style = mode === 'auto' ? (sec.display === 'tags' ? 'chips' : sec.display === 'list' ? 'lines' : look.tags) : mode;
  const grouped = sec.skills.length > 1 || sec.kind === 'technical-skills';
  sec.skills.forEach((g, gi) => {
    const before = gi > 0 ? 1.4 * look.sp : 0;
    if (style === 'bars') {
      g.names.forEach((n, i) => {
        const level = g.levels[i] ?? 0;
        out.push({ t: 'text', runs: [{ text: n }], style: ts(look, { size: look.size - 0.3 }), before: i === 0 ? before : 1 * look.sp });
        if (level > 0) {
          const bar = (fill: string): FlowNode => ({ t: 'box', nodes: [{ t: 'space', h: 1.1 }], fill, radius: 0.55, keep: 'together' });
          out.push({ t: 'row', gap: 0, before: 0.6, keepWithNext: false, cols: [{ width: Math.min(1, level / 5), nodes: [bar(look.accent)] }, ...(level < 5 ? [{ nodes: [bar(look.tint)] }] : [])] });
        }
      });
      return;
    }
    if (grouped && g.category) {
      if (style === 'chips' || style === 'lines') out.push({ t: 'text', runs: [{ text: g.category }], style: ts(look, { bold: true, size: look.size - 0.2 }), before, keepWithNext: true, role: 'h3' });
    }
    if (style === 'chips') out.push(...chipRows(g.names, look, width).map((r, i) => (i === 0 ? { ...r, before: grouped && g.category ? 1 * look.sp : before } : r)));
    else if (style === 'lines') out.push(...g.names.map((n, i) => ({ t: 'text' as const, runs: [{ text: n }], style: ts(look), before: i === 0 ? (grouped && g.category ? 0.6 * look.sp : before) : 0.4 * look.sp })));
    else {
      const sep = style === 'pipes' ? '  |  ' : ', ';
      const runs: Run[] = grouped && g.category ? [{ text: `${g.category}: `, bold: true }, { text: g.names.join(sep) }] : [{ text: g.names.join(sep) }];
      out.push({ t: 'text', runs, style: ts(look), before: gi > 0 ? 0.8 * look.sp : 0 });
    }
  });
  return out;
}

/** Compact one-line entries (languages, awards, interests…). */
export function inlineItems(sec: ResolvedSection, look: Look): FlowNode[] {
  return sec.items.map((it, i) => ({
    t: 'text' as const,
    runs: [
      { text: it.title, bold: true, ...(it.url ? { link: it.url } : {}) },
      ...(it.subtitle ? [{ text: ` — ${it.subtitle}` }] : []),
      ...(it.date ? [{ text: `  ·  ${it.date}`, color: look.muted }] : []),
      ...(it.description ? [{ text: `. ${it.description}`, color: look.muted }] : []),
    ],
    style: ts(look),
    before: i > 0 ? 0.8 * look.sp : 0,
    ref: it.id,
  }));
}

/** Short items (strengths, interests, languages) packed two per row with markers. */
export function gridItems(sec: ResolvedSection, look: Look, width = 0, cols = 2): FlowNode[] {
  // Fall back to one column when a single word would not fit a half-width cell.
  if (cols > 1 && width) {
    const M = getMeasurer();
    const cellW = (width - 2.5 * (cols - 1)) / cols - look.size * PT * 1.2;
    const longest = Math.max(0, ...sec.items.flatMap((it) => it.title.split(/\s+/)).map((w) => M.width(w, look.font, false, false, look.size - 0.3)));
    if (longest > cellW) cols = 1;
  }
  const cell = (it: ResolvedItem | undefined): FlowNode[] =>
    it
      ? [
          {
            t: 'text',
            runs: [{ text: it.title, ...(it.url ? { link: it.url } : {}) }, ...(it.subtitle ? [{ text: ` (${it.subtitle})`, color: look.muted }] : [])],
            style: ts(look, { size: look.size - 0.3, lineHeight: 1.25 }),
            marker: { kind: 'square', color: look.bulletColor },
            indent: look.size * PT * 1.2,
            ref: it.id,
          },
        ]
      : [];
  const out: FlowNode[] = [];
  for (let i = 0; i < sec.items.length; i += cols) {
    const row = Array.from({ length: cols }, (_, j) => sec.items[i + j]);
    out.push({ t: 'row', gap: 2.5, ...(i > 0 ? { before: 0.9 * look.sp } : {}), cols: row.map((it) => ({ width: 1 / cols, nodes: cell(it) })) });
  }
  return out;
}

/** Default renderer for any resolved section in a given column width. */
export function sectionBody(sec: ResolvedSection, look: Look, width: number, opts: { side?: boolean; compact?: boolean; skillMode?: 'auto' | 'chips' | 'lines' | 'comma' | 'bars' } = {}): FlowNode[] {
  if (sec.kind === 'summary') return paragraphs(sec.text, look);
  if (sec.kind === 'skills' || sec.kind === 'technical-skills') return skillsNodes(sec, look, width, opts.skillMode ?? 'auto');
  const nodes: FlowNode[] = [];
  if (sec.text) nodes.push(...paragraphs(sec.text, look));
  const inline =
    sec.display === 'inline' ||
    sec.display === 'list' ||
    (sec.display === 'auto' && (sec.kind === 'languages' || sec.kind === 'interests' || sec.kind === 'awards' || (opts.side && sec.kind === 'certifications')));
  if (sec.kind === 'interests' && sec.display !== 'entries') {
    const names = sec.items.map((i) => i.title).filter(Boolean);
    if (names.length) nodes.push(...(look.tags === 'chips' && sec.display !== 'list' ? chipRows(names, look, width) : [{ t: 'text' as const, runs: [{ text: names.join(', ') }], style: ts(look) }]));
    return nodes;
  }
  if (sec.kind === 'publications' && sec.display !== 'entries') {
    sec.items.forEach((it, i) =>
      nodes.push({
        t: 'text',
        runs: [{ text: it.title, bold: true, ...(it.url ? { link: it.url } : {}) }, ...(it.subtitle ? [{ text: `. ${it.subtitle}`, italic: true }] : []), ...(it.date ? [{ text: ` (${it.date})` }] : []), ...(it.description ? [{ text: `. ${it.description}`, color: look.muted }] : [])],
        style: ts(look),
        marker: { kind: 'number', n: i + 1, color: look.muted, list: sec.id },
        indent: look.size * PT * 2,
        before: i > 0 ? 1 * look.sp : nodes.length ? 1 * look.sp : 0,
        ref: it.id,
      }),
    );
    return nodes;
  }
  if (sec.display === 'grid') return [...nodes, ...gridItems(sec, look, width).map((n, i) => (i === 0 && nodes.length ? { ...n, before: 1 * look.sp } : n))];
  if (inline) return [...nodes, ...inlineItems(sec, look).map((n, i) => (i === 0 && nodes.length ? { ...n, before: 1 * look.sp } : n))];
  sec.items.forEach((it, i) => {
    const g = entryNodes(it, look, width, { compact: !!opts.compact, kind: sec.kind, side: !!opts.side });
    if (i > 0 || nodes.length) g.before = (opts.compact ? 2 : 3) * look.sp;
    nodes.push(g);
  });
  return nodes;
}

export function sectionNode(sec: ResolvedSection, look: Look, width: number, opts: { side?: boolean; compact?: boolean; skillMode?: 'auto' | 'chips' | 'lines' | 'comma' | 'bars'; before?: number; titleOverride?: FlowNode[] } = {}): FlowNode {
  const title = opts.titleOverride ?? sectionTitle(sec.title, look, width);
  const continued = sectionTitle(`${sec.title} (continued)`, { ...look, section: { ...look.section, color: look.muted } }, width);
  return { t: 'section', id: sec.id, ref: sec.id, title, continued, nodes: sectionBody(sec, look, width, opts), before: opts.before ?? 0 };
}

/* ------------------------------ header ----------------------------- */

const LABELS: Record<ContactItem['kind'], string> = { email: 'Email', phone: 'Phone', location: 'Location', website: 'Web', social: '' };

/** Contact line. `icon: 'glyph'` puts a real vector icon (mail, phone, GitHub, LinkedIn…) before each item. */
export function contactRuns(items: ContactItem[], look: Look, opts: { sep?: string; icon?: ResumeStyle['iconStyle']; color?: string; linkColor?: string; iconColor?: string } = {}): Run[] {
  const sep = opts.sep ?? '  ·  ';
  const out: Run[] = [];
  items.forEach((c, i) => {
    if (i > 0) out.push({ text: sep, color: look.muted });
    if (opts.icon === 'label') out.push({ text: `${LABELS[c.kind] || c.platform || 'Link'}: `, bold: true, ...(opts.color ? { color: opts.color } : {}) });
    if (opts.icon === 'glyph') out.push({ text: '', icon: contactIcon(c.kind, c.platform, c.url), color: opts.iconColor ?? look.accent, ...(c.url ? { link: c.url } : {}) });
    const color = c.url ? opts.linkColor ?? opts.color : opts.color;
    out.push({ text: c.label, ...(c.url ? { link: c.url } : {}), ...(color ? { color } : {}) });
  });
  return out;
}

/** Stacked contact list (sidebars). */
export function contactList(items: ContactItem[], look: Look, opts: { icon?: ResumeStyle['iconStyle']; color?: string; labelColor?: string } = {}): FlowNode[] {
  return items.map((c, i) => {
    const label = opts.icon === 'label' ? [{ text: `${LABELS[c.kind] || c.platform || 'Link'}`, bold: true, color: opts.labelColor ?? look.muted, size: look.size - 1.5 }] : [];
    const icon: Run[] = opts.icon === 'glyph' ? [{ text: '', icon: contactIcon(c.kind, c.platform, c.url), color: opts.labelColor ?? look.accent, ...(c.url ? { link: c.url } : {}) }] : [];
    const node: TextNode = {
      t: 'text',
      runs: [...icon, { text: c.label, ...(c.url ? { link: c.url } : {}), ...(opts.color ? { color: opts.color } : {}) }],
      style: ts(look, { size: look.size - 0.6, ...(opts.color ? { color: opts.color } : {}) }),
      before: i > 0 ? 1 * look.sp : 0,
    };
    return label.length ? ({ t: 'group', keep: 'together', nodes: [{ t: 'text', runs: label, style: ts(look, { size: look.size - 1.5, uppercase: true, tracking: 0.25 }), before: i > 0 ? 1.2 * look.sp : 0 }, { ...node, before: 0.2 }] } as GroupNode) : node;
  });
}

export const PHOTO_SIZE: Record<Exclude<ResumeStyle['photo'], 'none'>, { w: number; h: number }> = {
  circle: { w: 26, h: 26 },
  square: { w: 26, h: 26 },
  rounded: { w: 26, h: 26 },
  'small-portrait': { w: 22, h: 28 },
  'large-portrait': { w: 32, h: 42 },
};

export function photoNode(src: string | null, mode: ResumeStyle['photo'], scale = 1, align: 'left' | 'center' | 'right' = 'left'): ImageNode | null {
  if (!src || mode === 'none') return null;
  const d = PHOTO_SIZE[mode];
  return { t: 'image', src, width: d.w * scale, height: d.h * scale, align, alt: 'Profile photo' };
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1]![0] ?? '' : '')).toUpperCase() || '?';
}

/** Frame aspect (width / height) and corner radius (fraction of the short side) per photo style. */
const PHOTO_FRAME: Record<Exclude<ResumeStyle['photo'], 'none'>, { aspect: number; radius: number }> = {
  circle: { aspect: 1, radius: 0.5 },
  square: { aspect: 1, radius: 0 },
  // Matches the rounded mask the image pipeline cuts (edit.radius default 0.18).
  rounded: { aspect: 1, radius: 0.18 },
  'small-portrait': { aspect: 22 / 28, radius: 0 },
  'large-portrait': { aspect: 32 / 42, radius: 0 },
};

/**
 * The profile photo in a coloured frame shaped like the chosen photo style (circle, square,
 * rounded, portrait), or an initials badge of the same shape when there is no photo.
 * `d` is the photo height; portraits are narrower so they are never squashed.
 * Returns a row so the frame hugs the image instead of spanning the column.
 */
export function ringedPortrait(src: string | null, name: string, d: number, colW: number, opts: { ring: string; ringWidth?: number; disc: string; discText: string; align?: 'left' | 'center'; mode?: ResumeStyle['photo'] }): RowNode {
  const frame = PHOTO_FRAME[opts.mode && opts.mode !== 'none' ? opts.mode : 'circle'];
  const rw = opts.ringWidth ?? 0.9;
  // Fit the outer frame into the column, keeping the aspect.
  const scale = Math.min(1, colW / (d * frame.aspect + rw * 2));
  const innerH = d * scale;
  const innerW = innerH * frame.aspect;
  const outerW = innerW + rw * 2;
  const innerR = Math.min(innerW, innerH) * frame.radius;
  const outerR = frame.radius ? innerR + (frame.radius >= 0.5 ? rw : rw * 0.6) : 0;
  const textSize = (Math.min(innerW, innerH) * 0.36) / PT;
  const textH = textSize * PT * 1.05;
  const face: FlowNode = src
    ? { t: 'image', src, width: innerW, height: innerH, alt: 'Profile photo' }
    : {
        t: 'box',
        fill: opts.disc,
        radius: innerR,
        padding: [(innerH - textH) / 2, 0, (innerH - textH) / 2, 0],
        keep: 'together',
        nodes: [{ t: 'text', runs: [{ text: initials(name) }], style: { font: 'helvetica', size: textSize, bold: true, color: opts.discText, lineHeight: 1.05, tracking: 0.4 }, align: 'center' }],
      };
  // An initials badge is ornament; a real photo still goes into the DOCX.
  const ring: BoxNode = { t: 'box', fill: opts.ring, radius: outerR, padding: [rw, rw, rw, rw], keep: 'together', nodes: [face], ...(src ? {} : { decorative: true }) };
  const frac = Math.min(1, outerW / colW);
  if (opts.align === 'left') return { t: 'row', gap: 0, cols: [{ width: frac, nodes: [ring] }, { nodes: [] }] };
  const side = (1 - frac) / 2;
  return { t: 'row', gap: 0, cols: [{ width: side, nodes: [] }, { width: frac, nodes: [ring] }, { nodes: [] }] };
}
