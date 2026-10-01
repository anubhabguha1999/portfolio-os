/**
 * Document Studio templates (PDF-first). Each template is a look + page structure;
 * the block list is converted by blocks.ts, so switching templates never edits content.
 */
import type { Decoration, FlowDoc, FlowNode, FontFamily, PageFurniture, Run, TextStyle } from '@/studio/engine/flow';
import type { DocumentPageSettings } from '@/studio/model/types';
import type { DocTemplateDef, DocumentInput } from '../types';
import { fontFor, metrics, mix, readableOnWhite, safeHex, type Metrics } from '../kit';
import { blocksToNodes, type DocLook, type HeadingLook } from './blocks';

export interface DocInputX extends DocumentInput {
  /** Editor-only hints for empty blocks. */
  placeholders?: boolean;
}

interface Base {
  page: DocumentPageSettings;
  m: Metrics;
  accent: string;
  font: FontFamily;
  size: number;
  lh: number;
}

function base(input: DocumentInput, fallback: FontFamily, marginScale = 1, over: Partial<Metrics['margin']> = {}): Base {
  const page = input.page;
  return {
    page,
    m: metrics(page.paper, page.margins, marginScale, page.orientation, over),
    accent: safeHex(page.accent, '#1f3a8a'),
    font: fontFor(page.font, fallback),
    size: Math.max(7.5, Math.min(14, page.baseSize || 10.5)),
    lh: Math.max(1.1, Math.min(1.9, page.lineHeight || 1.45)),
  };
}

function heading(b: Base, over: Partial<HeadingLook> & { size: number }): HeadingLook {
  return { font: b.font, bold: true, italic: false, upper: false, tracking: 0, color: '#111827', rule: 'none', ruleColor: b.accent, ruleWeight: 0.3, before: 6, after: 3, ...over };
}

function look(b: Base, over: Partial<DocLook> = {}): DocLook {
  const accent = readableOnWhite(b.accent, 3.2);
  const text = '#1a1d24';
  const muted = '#5b6170';
  const surface = over.surface ?? '#ffffff';
  const l: DocLook = {
    font: b.font,
    headFont: b.font,
    size: b.size,
    lh: b.lh,
    sp: 1,
    text,
    muted,
    accent,
    rule: mix(accent, surface, 0.55),
    tint: mix(accent, surface, 0.92),
    link: accent,
    linkUnderline: false,
    section: { size: b.size + 3, upper: false, tracking: 0, color: accent, bold: true, italic: false, font: b.font, rule: 'none', ruleColor: accent, ruleWeight: 0.3, align: 'left' },
    entry: { titleSize: b.size + 1, titleColor: text, titleBold: true, subtitleColor: muted, subtitleItalic: false, subtitleBold: false, order: 'title-first', date: 'right', dateColor: muted, gutter: 24 },
    bullet: 'bullet',
    bulletColor: accent,
    tags: 'comma',
    chipFill: mix(accent, surface, 0.88),
    chipText: accent,
    showTech: false,
    justify: false,
    h1: heading(b, { size: b.size + 9, color: text, before: 8, after: 3.5 }),
    h2: heading(b, { size: b.size + 4, color: text, before: 6, after: 2.5 }),
    h3: heading(b, { size: b.size + 1.2, color: accent, before: 4, after: 1.6 }),
    numbered: false,
    quote: 'bar',
    card: { fill: mix(accent, surface, 0.95), stroke: '', radius: 1.6, bar: null },
    code: { fill: '#f3f4f6', text: '#1f2937' },
    statValue: accent,
    divider: '#d1d5db',
    surface,
    callout: {
      info: { fill: mix('#2563eb', surface, 0.9), bar: '#2563eb', title: '#1e3a8a' },
      success: { fill: mix('#059669', surface, 0.9), bar: '#059669', title: '#065f46' },
      warning: { fill: mix('#d97706', surface, 0.88), bar: '#d97706', title: '#92400e' },
      note: { fill: mix(accent, surface, 0.9), bar: accent, title: accent },
    },
    photoMode: 'circle',
    ...over,
  };
  return l;
}

function furniture(b: Base, input: DocumentInput, l: DocLook, opts: { align?: 'left' | 'center' | 'right'; headerPages?: 'all' | 'rest'; style?: Partial<TextStyle> } = {}): Pick<FlowDoc, 'header' | 'footer'> {
  const small: TextStyle = { font: l.font, size: 7.5, color: l.muted, lineHeight: 1.2, ...opts.style };
  const footerRuns: Run[] = [];
  if (b.page.footerText.trim()) footerRuns.push({ text: b.page.footerText.trim() });
  if (b.page.pageNumbers) footerRuns.push({ text: `${footerRuns.length ? '    ·    ' : ''}{page} / {pages}` });
  const footer: PageFurniture | null = footerRuns.length ? { runs: footerRuns, style: small, align: opts.align ?? 'center', pages: 'all' } : null;
  const header: PageFurniture | null = b.page.headerText.trim() ? { runs: [{ text: b.page.headerText.trim() }], style: small, align: opts.align === 'center' ? 'center' : 'left', pages: opts.headerPages ?? 'all' } : null;
  void input;
  return { header, footer };
}

function flow(b: Base, input: DocInputX, l: DocLook, parts: Partial<FlowDoc> & { width?: number; x?: number; lead?: FlowNode[] }): FlowDoc {
  const width = parts.width ?? b.m.contentW;
  const x = parts.x ?? b.m.margin.left;
  const nodes = [...(parts.lead ?? []), ...blocksToNodes(input.blocks, l, { width, profile: input.profile, library: input.library, photo: input.photo, placeholders: !!input.placeholders })];
  const { width: _w, x: _x, lead: _l, ...rest } = parts;
  void _w;
  void _x;
  void _l;
  return {
    page: { width: b.m.pageW, height: b.m.pageH, margin: b.m.margin, ...(l.surface !== '#ffffff' ? { background: l.surface } : {}) },
    columns: [{ id: 'main', x, width, nodes }],
    meta: input.meta,
    repeatHeadings: false,
    links: true,
    ...furniture(b, input, l),
    ...rest,
  };
}

/* ------------------------------------------------------------------ */

const professional: DocTemplateDef = {
  id: 'doc-professional',
  name: 'Professional',
  description: 'Clear hierarchy, accent headings with rules, running header and page numbers.',
  swatch: ['#ffffff', '#1f3a8a', '#e5e7eb'],
  compose(input) {
    const b = base(input, 'helvetica');
    const l = look(b);
    l.h1 = { ...l.h1, color: l.accent, rule: 'below', ruleColor: mix(l.accent, '#ffffff', 0.4), ruleWeight: 0.35 };
    l.h2 = { ...l.h2, color: '#111827' };
    return flow(b, input, l, { ...furniture(b, input, l, { align: 'right' }) });
  },
};

const minimal: DocTemplateDef = {
  id: 'doc-minimal',
  name: 'Minimal',
  description: 'Generous whitespace, quiet type, no ornament.',
  swatch: ['#ffffff', '#111111', '#f4f4f5'],
  compose(input) {
    const b = base(input, 'helvetica', 1.35);
    const l = look(b, { card: { fill: '', stroke: '#e5e7eb', radius: 0, bar: null }, bulletColor: '#6b7280', divider: '#e5e7eb' });
    l.h1 = { ...l.h1, bold: false, size: b.size + 11, before: 12, after: 4 };
    l.h2 = { ...l.h2, bold: false, size: b.size + 4.5, before: 9 };
    l.h3 = { ...l.h3, upper: true, tracking: 0.4, size: b.size - 0.5, color: '#6b7280', before: 6 };
    l.sp = 1.2;
    return flow(b, input, l, {});
  },
};

const corporate: DocTemplateDef = {
  id: 'doc-corporate',
  name: 'Corporate',
  description: 'Full-bleed letterhead band, uppercase section heads, framed footer.',
  swatch: ['#1e3a8a', '#ffffff', '#dbeafe'],
  compose(input) {
    const b0 = base(input, 'helvetica');
    const b = { ...b0, m: { ...b0.m, margin: { ...b0.m.margin, top: 0 } } };
    const l = look(b);
    l.h1 = { ...l.h1, upper: true, tracking: 0.5, size: b.size + 5, color: l.accent, rule: 'below', ruleColor: l.accent, ruleWeight: 0.5, before: 9 };
    l.h2 = { ...l.h2, color: '#111827' };
    l.card = { fill: '#f8fafc', stroke: '#e2e8f0', radius: 0, bar: l.accent };
    const band = b0.accent;
    const onBand = '#ffffff';
    const brand = input.profile.name || input.title;
    const masthead: FlowNode[] = [
      {
        t: 'box',
        fill: band,
        keep: 'together',
        padding: [b0.m.margin.top * 0.8, b0.m.margin.right, 6, b0.m.margin.left],
        nodes: [
          {
            t: 'row',
            gap: 6,
            cols: [
              { nodes: [{ t: 'text', runs: [{ text: input.title || 'Document' }], style: { font: b.font, size: b.size + 8, bold: true, color: onBand, lineHeight: 1.1 }, role: 'title' }, ...(input.kind && kindLabel(input.kind).toLowerCase() !== (input.title || '').trim().toLowerCase() ? [{ t: 'text' as const, runs: [{ text: kindLabel(input.kind) }], style: { font: b.font, size: b.size - 1.5, color: mix(band, '#ffffff', 0.7), uppercase: true, tracking: 0.5, lineHeight: 1.2 }, before: 1.6 }] : [])] },
              { width: 0.36, align: 'right', vAlign: 'bottom', nodes: [{ t: 'text', runs: [{ text: brand }], style: { font: b.font, size: b.size - 0.5, bold: true, color: onBand, lineHeight: 1.2 }, align: 'right' }, ...(input.profile.email ? [{ t: 'text' as const, runs: [{ text: input.profile.email, link: `mailto:${input.profile.email}` }], style: { font: b.font, size: b.size - 1.5, color: mix(band, '#ffffff', 0.75), lineHeight: 1.3 }, align: 'right' as const }] : [])] },
            ],
          },
        ],
      },
    ];
    const decorations: Decoration[] = [
      { k: 'rect', x: 0, y: 0, w: b.m.pageW, h: 4, fill: band, pages: 'rest' },
      { k: 'line', x1: b0.m.margin.left, y1: b.m.pageH - b0.m.margin.bottom * 0.72, x2: b.m.pageW - b0.m.margin.right, y2: b.m.pageH - b0.m.margin.bottom * 0.72, color: mix(band, '#ffffff', 0.5), lw: 0.3, pages: 'all' },
    ];
    const f = flow(b, input, l, { masthead, mastheadX: 0, mastheadWidth: b.m.pageW, mastheadGap: 8, decorations, ...furniture(b, input, l, { align: 'right' }) });
    // Continuation pages start at the normal top margin (page 1 starts below the band).
    return { ...f, columns: f.columns.map((c) => ({ ...c, top: b0.m.margin.top })) };
  },
};

const editorial: DocTemplateDef = {
  id: 'doc-editorial',
  name: 'Editorial',
  description: 'Magazine serif headlines, justified text and large pull quotes.',
  swatch: ['#fbfaf7', '#111111', '#881337'],
  compose(input) {
    const b = base(input, 'times', 1.15);
    const l = look(b, { justify: true, quote: 'large', card: { fill: '', stroke: '#d6d3d1', radius: 0, bar: null }, divider: '#111111', headFont: 'times' });
    l.h1 = { ...l.h1, font: 'times', bold: false, size: b.size + 16, before: 10, after: 4, rule: 'above', ruleColor: '#111111', ruleWeight: 1.2 };
    l.h2 = { ...l.h2, font: 'times', italic: true, bold: false, size: b.size + 6, before: 7 };
    l.h3 = { ...l.h3, font: 'helvetica', upper: true, tracking: 0.6, size: b.size - 1, color: l.accent, before: 5 };
    return flow(b, input, l, { ...furniture(b, input, l, { align: 'center', style: { font: 'times', italic: true } }) });
  },
};

const technical: DocTemplateDef = {
  id: 'doc-technical',
  name: 'Technical',
  description: 'Numbered sections, monospace headings, code-friendly styling.',
  swatch: ['#ffffff', '#0f766e', '#f1f5f9'],
  compose(input) {
    const b = base(input, 'helvetica');
    const l = look(b, { numbered: true, bullet: 'square', code: { fill: '#0f172a', text: '#e2e8f0' }, card: { fill: '#f8fafc', stroke: '#cbd5e1', radius: 0.6, bar: null } });
    l.h1 = { ...l.h1, font: 'courier', size: b.size + 6, color: '#0f172a', rule: 'below', ruleColor: '#94a3b8', ruleWeight: 0.3 };
    l.h2 = { ...l.h2, font: 'courier', size: b.size + 2.6, color: l.accent };
    l.h3 = { ...l.h3, font: 'courier', size: b.size + 0.6, color: '#334155' };
    const header: PageFurniture = { runs: [{ text: `${input.title}${b.page.headerText.trim() ? `  —  ${b.page.headerText.trim()}` : ''}` }], style: { font: 'courier', size: 7, color: '#64748b', lineHeight: 1.2 }, align: 'left', pages: 'rest' };
    return flow(b, input, l, { header, footer: b.page.pageNumbers || b.page.footerText ? { runs: [{ text: `${b.page.footerText.trim() ? `${b.page.footerText.trim()}    ` : ''}${b.page.pageNumbers ? 'p. {page}/{pages}' : ''}` }], style: { font: 'courier', size: 7, color: '#64748b', lineHeight: 1.2 }, align: 'right', pages: 'all' } : null });
  },
};

const modern: DocTemplateDef = {
  id: 'doc-modern',
  name: 'Modern',
  description: 'An accent edge, bold headings and soft rounded cards.',
  swatch: ['#ffffff', '#6d28d9', '#ede9fe'],
  compose(input) {
    const b = base(input, 'helvetica', 1, {});
    const l = look(b, { card: { fill: mix(safeHex(input.page.accent), '#ffffff', 0.93), stroke: '', radius: 2.4, bar: null } });
    l.h1 = { ...l.h1, size: b.size + 11, color: '#0f0f14', rule: 'short', ruleColor: l.accent, ruleWeight: 1.2, after: 5 };
    l.h2 = { ...l.h2, color: l.accent };
    const decorations: Decoration[] = [{ k: 'rect', x: 0, y: 0, w: 3.2, h: b.m.pageH, fill: l.accent, pages: 'all' }];
    return flow(b, input, l, { decorations, ...furniture(b, input, l, { align: 'right' }) });
  },
};

const creative: DocTemplateDef = {
  id: 'doc-creative',
  name: 'Creative',
  description: 'A bold colour strip, oversized headings and expressive cards.',
  swatch: ['#fff7ed', '#ea580c', '#1c1917'],
  compose(input) {
    const b0 = base(input, 'helvetica');
    const strip = 16;
    const b = { ...b0, m: { ...b0.m, margin: { ...b0.m.margin, left: strip + b0.m.margin.left * 0.8 } } };
    const contentW = b.m.pageW - b.m.margin.left - b.m.margin.right;
    const l = look(b, { card: { fill: '#ffffff', stroke: mix(b.accent, '#ffffff', 0.6), radius: 3, bar: null }, quote: 'large', bullet: 'square' });
    l.h1 = { ...l.h1, size: b.size + 17, color: l.accent, before: 10, after: 4 };
    l.h2 = { ...l.h2, size: b.size + 6, color: '#1c1917' };
    l.h3 = { ...l.h3, upper: true, tracking: 0.5, color: l.accent };
    const dark = mix(b.accent, '#000000', 0.25);
    const decorations: Decoration[] = [
      { k: 'rect', x: 0, y: 0, w: strip, h: b.m.pageH, fill: b.accent, pages: 'all' },
      { k: 'circle', cx: strip, cy: 38, r: 7, fill: dark, pages: 'first' },
      { k: 'circle', cx: strip, cy: b.m.pageH - 40, r: 4.5, fill: mix(b.accent, '#ffffff', 0.35), pages: 'all' },
    ];
    return flow(b, input, l, { width: contentW, x: b.m.margin.left, decorations, ...furniture(b, input, l, { align: 'right' }) });
  },
};

const academic: DocTemplateDef = {
  id: 'doc-academic',
  name: 'Academic',
  description: 'Serif body, numbered sections, centred title — paper style.',
  swatch: ['#ffffff', '#1e3a8a', '#f5f5f4'],
  compose(input) {
    const b = base(input, 'times', 1.12);
    const l = look(b, { justify: true, numbered: true, headFont: 'times', card: { fill: '', stroke: '#a8a29e', radius: 0, bar: null }, bullet: 'dash', bulletColor: '#44403c', statValue: '#111827' });
    l.h1 = { ...l.h1, font: 'times', size: b.size + 3, color: '#111111', before: 7, after: 2.5 };
    l.h2 = { ...l.h2, font: 'times', italic: true, bold: false, size: b.size + 1.5, color: '#111111' };
    l.h3 = { ...l.h3, font: 'times', size: b.size + 0.5, color: '#111111' };
    const title: FlowNode[] = input.title
      ? [
          { t: 'text', runs: [{ text: input.title }], style: { font: 'times', size: b.size + 8, bold: true, color: '#111111', lineHeight: 1.15 }, align: 'center', role: 'title' },
          ...(input.profile.name ? [{ t: 'text' as const, runs: [{ text: input.profile.name }], style: { font: 'times' as const, size: b.size + 1, color: '#333333', lineHeight: 1.3 }, align: 'center' as const, before: 3 }] : []),
          ...(input.profile.headline ? [{ t: 'text' as const, runs: [{ text: input.profile.headline }], style: { font: 'times' as const, size: b.size - 0.5, italic: true, color: '#555555', lineHeight: 1.3 }, align: 'center' as const, before: 0.6 }] : []),
          { t: 'rule', color: '#111111', weight: 0.3, before: 4, after: 5, length: 0.3, align: 'center' },
        ]
      : [];
    return flow(b, input, l, { lead: title, ...furniture(b, input, l, { align: 'center', style: { font: 'times' } }) });
  },
};

const dark: DocTemplateDef = {
  id: 'doc-dark',
  name: 'Dark',
  description: 'Dark pages with luminous accents — for screens and portfolios.',
  dark: true,
  swatch: ['#0f1115', '#818cf8', '#1c1f27'],
  compose(input) {
    const b = base(input, 'helvetica');
    const surface = '#0f1115';
    const accent = mix(safeHex(input.page.accent), '#ffffff', 0.45);
    const l = look(b, {
      surface,
      text: '#e6e8ee',
      muted: '#9aa1b1',
      accent,
      bulletColor: accent,
      link: accent,
      statValue: accent,
      divider: '#2a2e38',
      card: { fill: '#171a21', stroke: '#262a33', radius: 2, bar: null },
      code: { fill: '#05070a', text: '#c7d2fe' },
      tint: '#171a21',
      callout: {
        info: { fill: '#10213d', bar: '#60a5fa', title: '#93c5fd' },
        success: { fill: '#0d2a22', bar: '#34d399', title: '#6ee7b7' },
        warning: { fill: '#2d2210', bar: '#fbbf24', title: '#fcd34d' },
        note: { fill: '#1d1b35', bar: accent, title: accent },
      },
    });
    l.h1 = { ...l.h1, color: '#ffffff', size: b.size + 10 };
    l.h2 = { ...l.h2, color: '#ffffff' };
    l.h3 = { ...l.h3, color: accent };
    const f = flow(b, input, l, { ...furniture(b, input, l, { align: 'right', style: { color: '#6b7280' } }) });
    return { ...f, page: { ...f.page, background: surface } };
  },
};

const luxury: DocTemplateDef = {
  id: 'doc-luxury',
  name: 'Luxury',
  description: 'Framed pages, tracked serif capitals and a gold accent.',
  swatch: ['#fdfbf6', '#a8844a', '#1c1917'],
  compose(input) {
    const gold = input.page.accent && input.page.accent !== '#1f3a8a' ? safeHex(input.page.accent) : '#a8844a';
    const b0 = base({ ...input, page: { ...input.page, accent: gold } }, 'times', 1.3);
    const surface = '#fdfbf6';
    const warm = (t: number) => mix(gold, surface, t);
    const l = look(b0, {
      surface,
      justify: true,
      headFont: 'times',
      quote: 'large',
      divider: gold,
      bulletColor: gold,
      card: { fill: '', stroke: warm(0.4), radius: 0, bar: null },
      code: { fill: warm(0.9), text: '#3b3326' },
      statValue: '#1c1917',
      photoMode: 'large-portrait',
      callout: { info: { fill: warm(0.9), bar: gold, title: '#6b5430' }, success: { fill: warm(0.9), bar: gold, title: '#6b5430' }, warning: { fill: warm(0.85), bar: '#b45309', title: '#7c2d12' }, note: { fill: warm(0.9), bar: gold, title: '#6b5430' } },
    });
    l.accent = mix(gold, '#000000', 0.2);
    l.h1 = { ...l.h1, font: 'times', bold: false, upper: true, tracking: 1.4, size: b0.size + 7, align: 'center', color: '#1c1917', rule: 'short', ruleColor: gold, ruleWeight: 0.5, before: 11, after: 5 };
    l.h2 = { ...l.h2, font: 'times', bold: false, italic: true, size: b0.size + 4, align: 'center', color: '#1c1917' };
    l.h3 = { ...l.h3, font: 'times', upper: true, tracking: 0.9, size: b0.size - 0.5, color: l.accent };
    const inset = 7;
    const decorations: Decoration[] = [
      { k: 'rect', x: inset, y: inset, w: b0.m.pageW - inset * 2, h: b0.m.pageH - inset * 2, stroke: gold, lw: 0.5, pages: 'all' },
      { k: 'rect', x: inset + 1.4, y: inset + 1.4, w: b0.m.pageW - (inset + 1.4) * 2, h: b0.m.pageH - (inset + 1.4) * 2, stroke: mix(gold, surface, 0.45), lw: 0.2, pages: 'all' },
    ];
    const f = flow(b0, input, l, { decorations, ...furniture(b0, input, l, { align: 'center', style: { font: 'times', tracking: 0.3, uppercase: true, color: '#8a7a5c' } }) });
    return { ...f, page: { ...f.page, background: surface } };
  },
};

export const DOC_TEMPLATES: DocTemplateDef[] = [professional, minimal, corporate, editorial, technical, modern, creative, academic, dark, luxury];

export function getDocTemplate(id: string): DocTemplateDef {
  return DOC_TEMPLATES.find((t) => t.id === id) ?? professional;
}

export function kindLabel(kind: string): string {
  return (
    {
      resume: 'Resume',
      cv: 'Curriculum Vitae',
      'cover-letter': 'Cover Letter',
      portfolio: 'Portfolio',
      'case-study': 'Case Study',
      proposal: 'Proposal',
      profile: 'Personal Profile',
      report: 'Project Report',
      presentation: 'Presentation',
      custom: 'Document',
    } as Record<string, string>
  )[kind] ?? 'Document';
}
