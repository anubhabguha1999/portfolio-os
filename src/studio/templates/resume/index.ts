/**
 * Resume templates. Every template consumes the same ResolvedResume; switching
 * templates only changes presentation.
 */
import type { BoxNode, FlowColumn, FlowDoc, FlowNode, FontFamily, GroupNode, PageFurniture, Run, TextNode } from '@/studio/engine/flow';
import { getMeasurer, PT } from '@/studio/engine/measure';
import type { ResolvedItem, ResolvedResume, ResolvedSection } from '@/studio/model/resolve';
import type { ResumeSectionKind, ResumeStyle } from '@/studio/model/types';
import type { ResumeTemplateDef, StyleControl } from '../types';
import {
  accentOf,
  bulletNodes,
  contactList,
  contactRuns,
  effectiveStyle,
  fontFor,
  metrics,
  mix,
  paragraphs,
  photoNode,
  readableOnWhite,
  ringedPortrait,
  sectionNode,
  skillsNodes,
  sectionTitle,
  ts,
  type Effective,
  type Look,
  type Metrics,
} from '../kit';

/* ------------------------------------------------------------------ */
/* Shared setup                                                        */
/* ------------------------------------------------------------------ */

interface Setup {
  s: ResumeStyle;
  eff: Effective;
  accent: string;
  font: FontFamily;
  m: Metrics;
  rule: number;
  head: number;
}

function setup(r: ResolvedResume, fallback: FontFamily, marginOver: Partial<Metrics['margin']> = {}): Setup {
  const s = r.style;
  const eff = effectiveStyle(s);
  return {
    s,
    eff,
    accent: readableOnWhite(accentOf(s), 3.2),
    font: fontFor(s.font, fallback),
    m: metrics(s.paper, s.margins, eff.marginScale, 'portrait', marginOver),
    rule: s.borderStyle === 'none' ? 0 : s.borderStyle === 'thick' ? 0.7 : 0.25,
    head: s.headerHeight === 'compact' ? 0.86 : s.headerHeight === 'tall' ? 1.18 : 1,
  };
}

function baseLook(st: Setup, over: Partial<Look> = {}): Look {
  const { eff, accent, font, rule } = st;
  const size = eff.size;
  const text = '#16181d';
  const muted = '#4b5160';
  const look: Look = {
    font,
    headFont: font,
    size,
    lh: eff.lh,
    sp: eff.sp,
    text,
    muted,
    accent,
    rule: mix(accent, '#ffffff', 0.55),
    tint: mix(accent, '#ffffff', 0.9),
    link: text,
    linkUnderline: false,
    section: { size: size + 1.6, upper: true, tracking: 0.3, color: accent, bold: true, italic: false, font, rule: rule ? 'below' : 'none', ruleColor: mix(accent, '#ffffff', 0.35), ruleWeight: rule || 0.25, align: 'left' },
    entry: { titleSize: size + 0.7, titleColor: text, titleBold: true, subtitleColor: muted, subtitleItalic: false, subtitleBold: false, order: 'title-first', date: 'right', dateColor: muted, gutter: 24 },
    bullet: 'bullet',
    bulletColor: accent,
    tags: 'comma',
    chipFill: mix(accent, '#ffffff', 0.88),
    chipText: mix(accent, '#000000', 0.25),
    showTech: false,
    justify: false,
    ...over,
  };
  if (st.s.atsSafe) {
    look.accent = '#111111';
    look.bulletColor = '#111111';
    look.section = { ...look.section, color: '#111111', ruleColor: '#111111', rule: look.section.rule === 'none' || look.section.rule === 'fill' || look.section.rule === 'bar' ? 'below' : look.section.rule };
    look.tags = look.tags === 'chips' ? 'comma' : look.tags;
    look.entry = { ...look.entry, titleColor: '#111111', subtitleColor: '#222222', dateColor: '#333333' };
    look.tint = '#ffffff';
  }
  return look;
}

function footer(r: ResolvedResume, look: Look): PageFurniture | null {
  if (!r.style.pageNumbers) return null;
  return { runs: [{ text: `${r.name}  ·  Page {page} of {pages}` }], style: ts(look, { size: 7.5, color: look.muted }), align: 'center', pages: 'all' };
}

function doc(r: ResolvedResume, st: Setup, look: Look, parts: Pick<FlowDoc, 'columns'> & Partial<FlowDoc>): FlowDoc {
  return {
    page: { width: st.m.pageW, height: st.m.pageH, margin: st.m.margin },
    footer: footer(r, look),
    meta: r.meta,
    repeatHeadings: r.style.repeatHeadings,
    links: true,
    ...parts,
  };
}

function split(r: ResolvedResume): { main: ResolvedSection[]; side: ResolvedSection[] } {
  if (r.style.atsSafe) return { main: r.sections, side: [] };
  return { main: r.sections.filter((s) => s.placement === 'main'), side: r.sections.filter((s) => s.placement === 'side') };
}

const sectionGap = (look: Look) => 5 * look.sp;

function stackSections(secs: ResolvedSection[], look: Look, width: number, opts: Parameters<typeof sectionNode>[3] = {}, first = 0): FlowNode[] {
  return secs.map((s, i) => sectionNode(s, look, width, { ...opts, before: i === 0 ? first : sectionGap(look) }));
}

function nameNode(r: ResolvedResume, look: Look, size: number, over: Partial<TextNode['style']> = {}, node: Partial<TextNode> = {}): TextNode {
  return { t: 'text', runs: [{ text: r.name }], style: ts(look, { size, bold: true, lineHeight: 1.1, font: look.headFont, ...over }), role: 'title', ref: r.profileSectionId ?? 'profile', ...node };
}

function headlineNode(r: ResolvedResume, look: Look, over: Partial<TextNode['style']> = {}, node: Partial<TextNode> = {}): TextNode | null {
  if (!r.headline) return null;
  return { t: 'text', runs: [{ text: r.headline }], style: ts(look, { size: look.size + 2, color: look.accent, lineHeight: 1.25, ...over }), role: 'subtitle', before: 1.2 * look.sp, ...node };
}

function contactNode(r: ResolvedResume, look: Look, opts: Parameters<typeof contactRuns>[2] = {}, node: Partial<TextNode> = {}): TextNode | null {
  if (!r.contact.length) return null;
  return { t: 'text', runs: contactRuns(r.contact, look, { icon: r.style.iconStyle, ...opts }), style: ts(look, { size: look.size - 0.6, color: look.muted, lineHeight: 1.45 }), before: 2 * look.sp, ...node };
}

/** Header column + optional photo on the right (or above when centred). */
function withPhoto(r: ResolvedResume, st: Setup, nodes: FlowNode[], align: 'left' | 'center', width: number): FlowNode[] {
  const photo = photoNode(r.photo, r.style.photo, st.head, align === 'center' ? 'center' : 'right');
  if (!photo) return nodes;
  if (align === 'center') return [{ ...photo, after: 3 * st.eff.sp }, ...nodes];
  const pw = photo.width + 6;
  return [{ t: 'row', gap: 6, cols: [{ nodes }, { width: pw / (width - 6), align: 'right', vAlign: 'top', nodes: [photo] }] }];
}

/** Date in a left gutter, content on the right; the body may flow across pages. */
function gutterEntry(item: ResolvedItem, look: Look, width: number, gutter: number, opts: { dateBold?: boolean } = {}): GroupNode {
  const gap = 4;
  const cw = width - gutter - gap;
  const dateStyle = ts(look, { size: look.size - 1, color: look.entry.dateColor, bold: !!opts.dateBold, lineHeight: 1.25 });
  const head: FlowNode[] = [{ t: 'text', runs: [{ text: item.title || 'Untitled', ...(item.url ? { link: item.url } : {}) }], style: ts(look, { size: look.entry.titleSize, bold: look.entry.titleBold, color: look.entry.titleColor, lineHeight: 1.25, font: look.headFont }), role: 'h3' }];
  const sub = [item.subtitle, item.location].filter((x) => x.trim()).join('  ·  ');
  if (sub) head.push({ t: 'text', runs: [{ text: sub }], style: ts(look, { color: look.entry.subtitleColor, italic: look.entry.subtitleItalic, lineHeight: 1.25 }), before: 0.4 * look.sp });
  const body: FlowNode[] = [];
  if (item.description) body.push(...paragraphs(item.description, look, {}, 1).map((n, i) => (i === 0 ? { ...n, before: 1 * look.sp } : n)));
  const bl = bulletNodes(item.bullets, look);
  if (bl[0]) bl[0].before = 0.9 * look.sp;
  body.push(...bl);
  if (look.showTech && item.tags.length) body.push({ t: 'text', runs: [{ text: item.tags.join(' · '), color: look.muted }], style: ts(look, { size: look.size - 0.8 }), before: 1 * look.sp });
  const row: FlowNode = { t: 'row', gap, cols: [{ width: gutter / (width - gap), nodes: [{ t: 'text', runs: [{ text: item.date || ' ' }], style: dateStyle }] }, { nodes: head }] };
  const nodes: FlowNode[] = [row];
  if (body.length) nodes.push({ t: 'box', nodes: body, padding: [0, 0, 0, gutter + gap], keep: 'split' } as BoxNode);
  void cw;
  return { t: 'group', keep: body.length <= 6 ? 'together' : 'head', head: 1, minBody: 2, nodes, ref: item.id };
}

function gutterSection(sec: ResolvedSection, look: Look, width: number, gutter: number, before: number): FlowNode {
  const entryKinds = ['experience', 'education', 'projects', 'volunteer', 'open-source', 'certifications', 'achievements', 'awards', 'publications', 'references', 'custom'];
  const useGutter = entryKinds.includes(sec.kind) && sec.items.length > 0 && sec.display !== 'inline' && sec.display !== 'list' && sec.kind !== 'publications';
  if (!useGutter) return sectionNode(sec, look, width, { before });
  const nodes: FlowNode[] = [];
  if (sec.text) nodes.push(...paragraphs(sec.text, look));
  sec.items.forEach((it, i) => {
    const g = gutterEntry(it, look, width, gutter);
    if (i > 0 || nodes.length) g.before = 3.2 * look.sp;
    nodes.push(g);
  });
  return { t: 'section', id: sec.id, ref: sec.id, title: sectionTitle(sec.title, look, width), continued: sectionTitle(`${sec.title} (continued)`, look, width), nodes, before };
}

const COMMON: StyleControl[] = ['font', 'baseSize', 'lineHeight', 'spacing', 'accent', 'margins', 'borderStyle', 'headerHeight'];

/* ------------------------------------------------------------------ */
/* 1. ATS Minimal                                                      */
/* ------------------------------------------------------------------ */

const atsMinimal: ResumeTemplateDef = {
  id: 'ats-minimal',
  name: 'ATS Minimal',
  description: 'Single column, standard headings, no graphics. Built to be parsed.',
  tags: ['ATS', 'Single column', 'Clean'],
  columns: 1,
  ats: 'high',
  supportsPhoto: false,
  defaults: { colorPreset: 'black', borderStyle: 'hairline', baseSize: 10, headerAlign: 'left' },
  controls: ['font', 'baseSize', 'lineHeight', 'spacing', 'accent', 'margins', 'borderStyle', 'headerAlign', 'iconStyle'],
  compose(r) {
    const st = setup(r, 'helvetica');
    const look = baseLook(st, {
      accent: readableOnWhite(st.accent, 7),
      bulletColor: '#222222',
      section: { ...baseLook(st).section, color: '#111111', ruleColor: '#111111', tracking: 0.35, size: st.eff.size + 1.2 },
    });
    const align = r.style.headerAlign;
    const mast: FlowNode[] = [
      nameNode(r, look, 20 * st.head, { color: '#111111' }, { align }),
      ...[headlineNode(r, look, { color: '#222222', size: look.size + 1.5 }, { align })].filter(Boolean) as FlowNode[],
      ...[contactNode(r, look, { sep: '  |  ', color: '#222222' }, { align })].filter(Boolean) as FlowNode[],
    ];
    return doc(r, st, look, { masthead: mast, mastheadGap: 5 * look.sp, columns: [{ id: 'main', x: st.m.margin.left, width: st.m.contentW, nodes: stackSections(r.sections, look, st.m.contentW) }] });
  },
};

/* ------------------------------------------------------------------ */
/* 2. Modern Professional (two columns)                                */
/* ------------------------------------------------------------------ */

const modern: ResumeTemplateDef = {
  id: 'modern-professional',
  name: 'Modern Professional',
  description: 'Two columns with a tinted sidebar for contact, skills and education.',
  tags: ['Two column', 'Sidebar', 'Photo'],
  columns: 2,
  ats: 'medium',
  supportsPhoto: true,
  defaults: { colorPreset: 'navy', sidebarWidth: 0.31, photo: 'circle' },
  controls: [...COMMON, 'sidebarWidth', 'photo', 'iconStyle'],
  compose(r) {
    const st = setup(r, 'helvetica');
    const { main, side } = split(r);
    const look = baseLook(st, { section: { ...baseLook(st).section, rule: st.rule ? 'short' : 'none', ruleWeight: Math.max(0.6, st.rule), ruleColor: st.accent }, tags: 'chips' });
    const m = st.m;
    if (!side.length) return atsMinimal.compose(r);
    const sideW = Math.round(m.contentW * Math.min(0.42, Math.max(0.24, r.style.sidebarWidth)));
    const gutter = 7;
    const mainX = m.margin.left + sideW + gutter;
    const mainW = m.pageW - m.margin.right - mainX;
    const sideLook: Look = { ...look, size: look.size - 0.4, chipFill: r.style.atsSafe ? look.chipFill : '#ffffff', section: { ...look.section, size: look.size + 0.8 } };
    const photo = photoNode(r.photo, r.style.photo, 1.05, 'left');
    const sideNodes: FlowNode[] = [];
    if (photo) sideNodes.push({ ...photo, after: 5 * look.sp });
    if (r.contact.length) sideNodes.push({ t: 'section', id: 'contact', ref: r.profileSectionId ?? 'profile', title: sectionTitle('Contact', sideLook, sideW), nodes: contactList(r.contact, sideLook, { icon: r.style.iconStyle }) });
    sideNodes.push(...stackSections(side, sideLook, sideW, { side: true, skillMode: look.tags === 'chips' ? 'chips' : 'lines' }, r.contact.length || photo ? sectionGap(look) : 0));
    const mainNodes: FlowNode[] = [nameNode(r, look, 24 * st.head, { color: look.accent === '#111111' ? '#111111' : mix(look.accent, '#000000', 0.15) })];
    const hl = headlineNode(r, look, { color: look.muted, size: look.size + 2.2 });
    if (hl) mainNodes.push(hl);
    mainNodes.push({ t: 'space', h: 6 * look.sp * st.head });
    mainNodes.push(...stackSections(main, look, mainW));
    const bandRight = m.margin.left + sideW + gutter / 2;
    const columns: FlowColumn[] = [
      { id: 'side', x: m.margin.left, width: sideW, nodes: sideNodes, order: 1, ...(r.style.atsSafe ? {} : { fill: look.tint }) },
      { id: 'main', x: mainX, width: mainW, nodes: mainNodes, order: 0 },
    ];
    return doc(r, st, look, { columns, decorations: r.style.atsSafe ? [] : [{ k: 'rect', x: 0, y: 0, w: bandRight, h: m.pageH, fill: look.tint, pages: 'all' }] });
  },
};

/* ------------------------------------------------------------------ */
/* 3. Executive                                                        */
/* ------------------------------------------------------------------ */

const executive: ResumeTemplateDef = {
  id: 'executive',
  name: 'Executive',
  description: 'Serif typography, centred masthead and a strong, calm hierarchy.',
  tags: ['Serif', 'Leadership', 'Premium'],
  columns: 1,
  ats: 'high',
  supportsPhoto: true,
  defaults: { colorPreset: 'burgundy', baseSize: 10.5, headerAlign: 'center', margins: 'wide', lineHeight: 1.38 },
  controls: [...COMMON, 'headerAlign', 'photo'],
  compose(r) {
    const st = setup(r, 'times');
    const b = baseLook(st);
    const look = baseLook(st, {
      headFont: 'times',
      justify: true,
      section: { ...b.section, font: 'times', size: st.eff.size + 1.4, tracking: 0.9, color: st.accent, rule: st.rule ? 'below' : 'none', ruleColor: mix(st.accent, '#ffffff', 0.4) },
      entry: { ...b.entry, order: 'subtitle-first', subtitleItalic: true, subtitleColor: '#333333', titleSize: st.eff.size + 0.6 },
      bullet: 'square',
      bulletColor: mix(st.accent, '#ffffff', 0.2),
    });
    const align = r.style.headerAlign;
    const mastText: FlowNode[] = [
      nameNode(r, look, 23 * st.head, { font: 'times', uppercase: true, tracking: 1.1, bold: false, color: '#111111' }, { align }),
      ...(r.headline ? [{ t: 'text', runs: [{ text: r.headline }], style: ts(look, { size: look.size + 0.6, color: look.accent, uppercase: true, tracking: 0.7 }), align, role: 'subtitle', before: 2 * look.sp } as TextNode] : []),
      { t: 'rule', color: look.accent, weight: 0.5, before: 3 * look.sp, after: 0.8, length: align === 'center' ? 0.5 : 1, align },
      { t: 'rule', color: look.accent, weight: 0.2, after: 2.2 * look.sp, length: align === 'center' ? 0.5 : 1, align },
      ...[contactNode(r, look, { sep: '   ·   ' }, { align, before: 0 })].filter(Boolean) as FlowNode[],
    ];
    const mast = withPhoto(r, st, mastText, align, st.m.contentW);
    return doc(r, st, look, { masthead: mast, mastheadGap: 7 * look.sp, columns: [{ id: 'main', x: st.m.margin.left, width: st.m.contentW, nodes: stackSections(r.sections, look, st.m.contentW) }] });
  },
};

/* ------------------------------------------------------------------ */
/* 4. Developer                                                        */
/* ------------------------------------------------------------------ */

const developer: ResumeTemplateDef = {
  id: 'developer',
  name: 'Developer',
  description: 'Dark header band, monospace accents, skill chips and tech stacks.',
  tags: ['Engineering', 'Technical', 'Chips'],
  columns: 1,
  ats: 'medium',
  supportsPhoto: true,
  defaults: { colorPreset: 'blue', baseSize: 9.8 },
  controls: [...COMMON, 'photo'],
  compose(r) {
    const st = setup(r, 'helvetica');
    const m = st.m;
    const b = baseLook(st);
    const dark = r.style.atsSafe ? '#ffffff' : '#0f172a';
    const onDark = r.style.atsSafe ? '#111111' : '#f8fafc';
    const look = baseLook(st, {
      section: { ...b.section, font: 'courier', size: st.eff.size + 1.6, tracking: 0, upper: false, rule: st.rule ? 'below' : 'none', ruleColor: mix(st.accent, '#ffffff', 0.7) },
      entry: { ...b.entry, subtitleColor: st.accent, subtitleBold: true },
      bullet: 'arrow',
      tags: 'chips',
      showTech: true,
    });
    const hl = mix(st.accent, '#ffffff', 0.45);
    const inner: FlowNode[] = [
      nameNode(r, look, 22 * st.head, { color: onDark }),
      ...(r.headline ? [{ t: 'text', runs: [{ text: r.headline }], style: ts(look, { font: 'courier', size: look.size + 1.4, color: r.style.atsSafe ? '#333333' : hl }), role: 'subtitle', before: 1.4 * look.sp } as TextNode] : []),
      ...(r.contact.length ? [{ t: 'text', runs: contactRuns(r.contact, look, { sep: '  ·  ', icon: r.style.iconStyle, color: r.style.atsSafe ? '#333333' : '#cbd5e1', linkColor: r.style.atsSafe ? '#111111' : '#e2e8f0' }), style: ts(look, { font: 'courier', size: look.size - 1, color: '#cbd5e1', lineHeight: 1.5 }), before: 2.4 * look.sp } as TextNode] : []),
    ];
    const photo = photoNode(r.photo, r.style.photo, 0.9 * st.head, 'right');
    const content: FlowNode[] = photo ? [{ t: 'row', gap: 6, cols: [{ nodes: inner }, { width: (photo.width + 4) / (m.contentW - 6), align: 'right', nodes: [photo] }] }] : inner;
    const band: BoxNode = { t: 'box', fill: dark, nodes: content, padding: [m.margin.top * 0.85 * st.head, m.margin.right, 7 * st.head, m.margin.left], keep: 'together' };
    const titled = r.sections.map((s, i) =>
      sectionNode(s, look, m.contentW, {
        before: i === 0 ? 0 : sectionGap(look),
        skillMode: r.style.atsSafe ? 'comma' : 'chips',
        titleOverride: [
          { t: 'text', runs: [{ text: '// ', color: mix(st.accent, '#ffffff', 0.35) }, { text: s.title.toLowerCase() }], style: { font: 'courier', size: look.section.size, bold: true, color: look.section.color, lineHeight: 1.2 }, role: 'h1', keepWithNext: true },
          ...(st.rule ? [{ t: 'rule' as const, color: look.section.ruleColor, weight: st.rule, before: 0.9 * look.sp, after: 2 * look.sp, keepWithNext: true }] : [{ t: 'space' as const, h: 1.6 * look.sp }]),
        ],
      }),
    );
    return doc(r, st, look, {
      page: { width: m.pageW, height: m.pageH, margin: { ...m.margin, top: 0 } },
      masthead: [band],
      mastheadX: 0,
      mastheadWidth: m.pageW,
      mastheadGap: 6 * look.sp,
      columns: [{ id: 'main', x: m.margin.left, width: m.contentW, top: m.margin.top, nodes: titled }],
    });
  },
};

/* ------------------------------------------------------------------ */
/* 5. Creative                                                         */
/* ------------------------------------------------------------------ */

const creative: ResumeTemplateDef = {
  id: 'creative',
  name: 'Creative',
  description: 'A bold colour sidebar with photo and skill meters. Strong visual identity.',
  tags: ['Bold', 'Sidebar', 'Photo'],
  columns: 2,
  ats: 'low',
  supportsPhoto: true,
  defaults: { colorPreset: 'purple', sidebarWidth: 0.34, photo: 'circle', baseSize: 9.8 },
  controls: [...COMMON, 'sidebarWidth', 'photo'],
  compose(r) {
    const st = setup(r, 'helvetica');
    const { main, side } = split(r);
    if (!side.length && r.style.atsSafe) return atsMinimal.compose(r);
    const m = st.m;
    const b = baseLook(st);
    const look = baseLook(st, {
      section: { ...b.section, size: st.eff.size + 3, upper: false, tracking: 0, rule: 'short', ruleWeight: 1, ruleColor: st.accent },
      entry: { ...b.entry, titleColor: mix(st.accent, '#000000', 0.2), subtitleBold: true, subtitleColor: '#222222' },
      tags: 'chips',
    });
    const sideBg = mix(st.accent, '#000000', 0.18);
    const sideText = '#ffffff';
    const sideMuted = mix(sideBg, '#ffffff', 0.72);
    const sideLook: Look = {
      ...look,
      size: look.size - 0.3,
      text: sideText,
      muted: sideMuted,
      accent: '#ffffff',
      tint: mix(sideBg, '#ffffff', 0.25),
      bulletColor: '#ffffff',
      chipFill: mix(sideBg, '#ffffff', 0.18),
      chipText: '#ffffff',
      section: { ...look.section, size: look.size, upper: true, tracking: 0.5, color: '#ffffff', rule: 'below', ruleWeight: 0.25, ruleColor: mix(sideBg, '#ffffff', 0.45) },
      entry: { ...look.entry, titleColor: '#ffffff', subtitleColor: sideMuted, dateColor: sideMuted },
    };
    const sideW = Math.round(m.contentW * Math.min(0.42, Math.max(0.26, r.style.sidebarWidth)));
    const bandW = m.margin.left + sideW + 5;
    const mainX = bandW + 8;
    const mainW = m.pageW - m.margin.right - mainX;
    const sideNodes: FlowNode[] = [];
    const photo = photoNode(r.photo, r.style.photo, 1.25 * st.head, 'center');
    if (photo) sideNodes.push({ ...photo, after: 6 * look.sp });
    sideNodes.push(nameNode(r, sideLook, 19 * st.head, { color: '#ffffff' }, { align: photo ? 'center' : 'left' }));
    const hl = headlineNode(r, sideLook, { color: sideMuted, size: sideLook.size + 1 }, { align: photo ? 'center' : 'left' });
    if (hl) sideNodes.push(hl);
    if (r.contact.length) sideNodes.push({ t: 'section', id: 'contact', ref: r.profileSectionId ?? 'profile', title: sectionTitle('Contact', sideLook, sideW), nodes: contactList(r.contact, sideLook, { icon: r.style.iconStyle, color: '#ffffff', labelColor: sideMuted }), before: 7 * look.sp });
    sideNodes.push(...side.map((s) => sectionNode(s, sideLook, sideW, { side: true, before: sectionGap(look), skillMode: 'bars' })));
    return doc(r, st, look, {
      columns: [
        { id: 'side', x: m.margin.left, width: sideW, nodes: sideNodes, order: 1, fill: sideBg },
        { id: 'main', x: mainX, width: mainW, nodes: stackSections(main, look, mainW), order: 0 },
      ],
      decorations: [{ k: 'rect', x: 0, y: 0, w: bandW, h: m.pageH, fill: sideBg, pages: 'all' }],
    });
  },
};

/* ------------------------------------------------------------------ */
/* 6. Compact                                                          */
/* ------------------------------------------------------------------ */

const compact: ResumeTemplateDef = {
  id: 'compact',
  name: 'Compact',
  description: 'Tight rhythm and a split header — fits a lot on one page, still readable.',
  tags: ['One page', 'Dense', 'ATS'],
  columns: 1,
  ats: 'high',
  supportsPhoto: false,
  defaults: { colorPreset: 'slate', baseSize: 9, lineHeight: 1.26, spacing: 0.72, margins: 'narrow' },
  controls: [...COMMON, 'iconStyle'],
  compose(r) {
    const st = setup(r, 'helvetica');
    const b = baseLook(st);
    const look = baseLook(st, { section: { ...b.section, size: st.eff.size + 0.9, tracking: 0.4 }, entry: { ...b.entry, titleSize: st.eff.size + 0.4 } });
    const W = st.m.contentW;
    const left: FlowNode[] = [nameNode(r, look, 17 * st.head, { color: '#111111' })];
    const hl = headlineNode(r, look, { size: look.size + 1.2 }, { before: 0.6 * look.sp });
    if (hl) left.push(hl);
    const right: FlowNode[] = r.contact.map((c) => ({ t: 'text' as const, runs: [{ text: c.label, ...(c.url ? { link: c.url } : {}) }], style: ts(look, { size: look.size - 0.6, color: look.muted, lineHeight: 1.35 }), align: 'right' as const }));
    const mast: FlowNode[] = [{ t: 'row', gap: 6, cols: [{ nodes: left, vAlign: 'bottom' }, { width: 0.38, nodes: right, align: 'right', vAlign: 'bottom' }] }, ...(st.rule ? [{ t: 'rule' as const, color: look.accent, weight: Math.max(0.4, st.rule), before: 2.5 * look.sp }] : [])];
    // Short side sections pair up into two columns at the end.
    const sideKinds = new Set(['education', 'certifications', 'languages', 'awards', 'interests']);
    const pairable = r.sections.filter((s) => sideKinds.has(s.kind));
    const rest = r.sections.filter((s) => !sideKinds.has(s.kind));
    const nodes: FlowNode[] = stackSections(rest, look, W, { compact: true });
    for (let i = 0; i < pairable.length; i += 2) {
      const a = pairable[i]!;
      const bsec = pairable[i + 1];
      const colW = (W - 6) / 2;
      if (!bsec) nodes.push(sectionNode(a, look, W, { compact: true, before: sectionGap(look) }));
      else nodes.push({ t: 'row', gap: 6, before: sectionGap(look), cols: [{ nodes: [sectionNode(a, look, colW, { compact: true, side: true })] }, { nodes: [sectionNode(bsec, look, colW, { compact: true, side: true })] }] });
    }
    return doc(r, st, look, { masthead: mast, mastheadGap: 4 * look.sp, columns: [{ id: 'main', x: st.m.margin.left, width: W, nodes }] });
  },
};

/* ------------------------------------------------------------------ */
/* 7. Academic                                                         */
/* ------------------------------------------------------------------ */

const academic: ResumeTemplateDef = {
  id: 'academic',
  name: 'Academic',
  description: 'CV conventions: serif type, dates in a left gutter, numbered publications.',
  tags: ['CV', 'Serif', 'Multi-page'],
  columns: 1,
  ats: 'high',
  supportsPhoto: true,
  defaults: { colorPreset: 'navy', baseSize: 10.5, headerAlign: 'center', pageNumbers: true, repeatHeadings: true },
  controls: [...COMMON, 'headerAlign', 'photo'],
  compose(r) {
    const st = setup(r, 'times');
    const b = baseLook(st);
    const look = baseLook(st, {
      headFont: 'times',
      section: { ...b.section, font: 'times', size: st.eff.size + 1.2, tracking: 0.6, rule: st.rule ? 'below' : 'none', color: st.accent },
      entry: { ...b.entry, subtitleItalic: true },
      bullet: 'dash',
      bulletColor: '#333333',
    });
    const align = r.style.headerAlign;
    const mast = withPhoto(
      r,
      st,
      [
        nameNode(r, look, 20 * st.head, { font: 'times', color: '#111111' }, { align }),
        ...[headlineNode(r, look, { italic: true, color: '#333333', size: look.size + 1.2 }, { align })].filter(Boolean) as FlowNode[],
        ...[contactNode(r, look, { sep: '  ·  ' }, { align })].filter(Boolean) as FlowNode[],
      ],
      align,
      st.m.contentW,
    );
    const W = st.m.contentW;
    const nodes = r.sections.map((s, i) => gutterSection(s, look, W, 29, i === 0 ? 0 : sectionGap(look)));
    return doc(r, st, look, { masthead: mast, mastheadGap: 6 * look.sp, columns: [{ id: 'main', x: st.m.margin.left, width: W, nodes }] });
  },
};

/* ------------------------------------------------------------------ */
/* 8. Minimal Mono                                                     */
/* ------------------------------------------------------------------ */

const minimalMono: ResumeTemplateDef = {
  id: 'minimal-mono',
  name: 'Minimal Mono',
  description: 'Monospace throughout, dotted rules, zero ornament. Quietly technical.',
  tags: ['Monospace', 'Minimal', 'Technical'],
  columns: 1,
  ats: 'high',
  supportsPhoto: false,
  defaults: { colorPreset: 'black', baseSize: 9.2, lineHeight: 1.38 },
  controls: ['baseSize', 'lineHeight', 'spacing', 'accent', 'margins', 'borderStyle', 'headerHeight'],
  compose(r) {
    const st = setup(r, 'courier');
    const b = baseLook({ ...st, font: 'courier' });
    const look = baseLook({ ...st, font: 'courier' }, {
      section: { ...b.section, font: 'courier', size: st.eff.size + 0.8, tracking: 0.2, rule: st.rule ? 'below' : 'none', ruleColor: '#9ca3af', color: st.accent === '#111111' ? '#111111' : st.accent },
      bullet: 'dash',
      bulletColor: '#6b7280',
      tags: 'pipes',
      entry: { ...b.entry, titleSize: st.eff.size + 0.3 },
    });
    const W = st.m.contentW;
    const mast: FlowNode[] = [
      { t: 'text', runs: [{ text: r.name }], style: ts(look, { size: 16 * st.head, bold: true, color: '#111111', lineHeight: 1.15 }), role: 'title', ref: r.profileSectionId ?? 'profile' },
      ...(r.headline ? [{ t: 'text', runs: [{ text: r.headline }], style: ts(look, { color: '#4b5563' }), role: 'subtitle', before: 1 * look.sp } as TextNode] : []),
      ...[contactNode(r, look, { sep: '  /  ' })].filter(Boolean) as FlowNode[],
      { t: 'rule', color: '#9ca3af', weight: 0.3, dash: 'dotted', before: 3 * look.sp },
    ];
    const nodes = r.sections.map((s, i) => {
      const n = sectionNode(s, look, W, { before: i === 0 ? 0 : sectionGap(look) });
      if (n.t === 'section' && st.rule) n.title = n.title.map((t) => (t.t === 'rule' ? { ...t, dash: 'dotted' as const } : t));
      return n;
    });
    return doc(r, st, look, { masthead: mast, mastheadGap: 5 * look.sp, columns: [{ id: 'main', x: st.m.margin.left, width: W, nodes }] });
  },
};

/* ------------------------------------------------------------------ */
/* 9. Editorial                                                        */
/* ------------------------------------------------------------------ */

const editorial: ResumeTemplateDef = {
  id: 'editorial',
  name: 'Editorial',
  description: 'Magazine typography: a large serif name, italic section heads, justified text.',
  tags: ['Serif', 'Editorial', 'Elegant'],
  columns: 1,
  ats: 'high',
  supportsPhoto: true,
  defaults: { colorPreset: 'burgundy', baseSize: 9.8, lineHeight: 1.42, margins: 'wide' },
  controls: [...COMMON, 'photo'],
  compose(r) {
    const st = setup(r, 'helvetica');
    const b = baseLook(st);
    const look = baseLook(st, {
      headFont: 'times',
      justify: true,
      section: { ...b.section, font: 'times', size: st.eff.size + 5, upper: false, tracking: 0, italic: true, bold: false, color: '#111111', rule: st.rule ? 'above' : 'none', ruleColor: '#111111', ruleWeight: Math.max(0.3, st.rule) },
      entry: { ...b.entry, titleColor: '#111111', titleSize: st.eff.size + 1.4, dateColor: st.accent },
      bulletColor: st.accent,
    });
    const W = st.m.contentW;
    const mastText: FlowNode[] = [
      nameNode(r, look, 34 * st.head, { font: 'times', bold: false, color: '#111111', lineHeight: 1.02 }),
      ...(r.headline ? [{ t: 'text', runs: [{ text: r.headline }], style: ts(look, { size: look.size, uppercase: true, tracking: 0.9, color: look.accent, bold: true }), role: 'subtitle', before: 2.6 * look.sp } as TextNode] : []),
      ...[contactNode(r, look, { sep: '  ·  ' }, { before: 2.2 * look.sp })].filter(Boolean) as FlowNode[],
      { t: 'rule', color: '#111111', weight: 1.1, before: 4 * look.sp },
    ];
    const mast = withPhoto(r, st, mastText, 'left', W);
    const nodes = r.sections.map((s, i) => {
      const n = gutterSection(s, look, W, 31, i === 0 ? 0 : sectionGap(look) * 1.1);
      // The masthead already ends with a heavy rule; skip the first section's top rule.
      if (i === 0 && n.t === 'section') n.title = n.title.filter((t) => t.t !== 'rule');
      return n;
    });
    return doc(r, st, look, { masthead: mast, mastheadGap: 6 * look.sp, columns: [{ id: 'main', x: st.m.margin.left, width: W, nodes }] });
  },
};

/* ------------------------------------------------------------------ */
/* 10. Timeline                                                        */
/* ------------------------------------------------------------------ */

function timelineSection(sec: ResolvedSection, look: Look, width: number, before: number, st: Setup): FlowNode {
  const timed = ['experience', 'education', 'volunteer', 'projects', 'open-source'].includes(sec.kind) && sec.items.length > 0;
  if (!timed) return sectionNode(sec, look, width, { before });
  const nodes: FlowNode[] = [];
  const railX = 2.2;
  const pad = 8;
  sec.items.forEach((it, i) => {
    const head: FlowNode[] = [];
    if (it.date) head.push({ t: 'text', runs: [{ text: it.date }], style: ts(look, { size: look.size - 0.7, bold: true, color: look.accent, uppercase: true, tracking: 0.25, lineHeight: 1.2 }) });
    head.push({ t: 'text', runs: [{ text: it.title || 'Untitled', ...(it.url ? { link: it.url } : {}) }], style: ts(look, { size: look.entry.titleSize, bold: true, lineHeight: 1.25 }), role: 'h3', before: 0.6 * look.sp });
    const sub = [it.subtitle, it.location].filter((x) => x.trim()).join('  ·  ');
    if (sub) head.push({ t: 'text', runs: [{ text: sub }], style: ts(look, { color: look.muted, lineHeight: 1.25 }), before: 0.3 * look.sp });
    const body: FlowNode[] = [];
    if (it.description) body.push(...paragraphs(it.description, look, {}, 1).map((n, j) => (j === 0 ? { ...n, before: 1 * look.sp } : n)));
    const bl = bulletNodes(it.bullets, look);
    if (bl[0]) bl[0].before = 0.9 * look.sp;
    body.push(...bl);
    const last = i === sec.items.length - 1;
    nodes.push({
      t: 'box',
      ref: it.id,
      keep: body.length <= 6 ? 'together' : 'split',
      padding: [0, 0, last ? 0 : 3.2 * look.sp, pad],
      rail: { x: railX, color: mix(look.accent, '#ffffff', 0.6), width: 0.35, dot: 1.15, dotColor: look.accent, hollow: !!st.s.atsSafe },
      nodes: [...head, ...body],
    } as BoxNode);
  });
  return { t: 'section', id: sec.id, ref: sec.id, title: sectionTitle(sec.title, look, width), continued: sectionTitle(`${sec.title} (continued)`, look, width), nodes, before };
}

const timeline: ResumeTemplateDef = {
  id: 'timeline',
  name: 'Timeline',
  description: 'Experience drawn as a vertical timeline with dated milestones.',
  tags: ['Timeline', 'Story', 'Photo'],
  columns: 1,
  ats: 'medium',
  supportsPhoto: true,
  defaults: { colorPreset: 'green', baseSize: 9.8 },
  controls: [...COMMON, 'photo', 'iconStyle', 'headerAlign'],
  compose(r) {
    const st = setup(r, 'helvetica');
    const b = baseLook(st);
    const look = baseLook(st, { section: { ...b.section, rule: 'none', size: st.eff.size + 1.4, tracking: 0.6 }, tags: 'chips' });
    const W = st.m.contentW;
    const align = r.style.headerAlign;
    const mast = withPhoto(
      r,
      st,
      [
        nameNode(r, look, 25 * st.head, { color: look.accent === '#111111' ? '#111111' : mix(look.accent, '#000000', 0.25) }, { align }),
        ...[headlineNode(r, look, { color: '#333333', size: look.size + 2 }, { align })].filter(Boolean) as FlowNode[],
        ...[contactNode(r, look, { sep: '   ·   ' }, { align })].filter(Boolean) as FlowNode[],
        ...(st.rule ? [{ t: 'rule' as const, color: look.rule, weight: st.rule, before: 3.5 * look.sp }] : []),
      ],
      align,
      W,
    );
    const nodes = r.sections.map((s, i) => timelineSection(s, look, W, i === 0 ? 0 : sectionGap(look), st));
    return doc(r, st, look, { masthead: mast, mastheadGap: 6 * look.sp, columns: [{ id: 'main', x: st.m.margin.left, width: W, nodes }] });
  },
};

/* ------------------------------------------------------------------ */
/* Shared by the signature templates below                             */
/* ------------------------------------------------------------------ */

function placeBy(r: ResolvedResume, sideKinds: Set<ResumeSectionKind>, skip: Set<string> = new Set()): { main: ResolvedSection[]; side: ResolvedSection[] } {
  const main: ResolvedSection[] = [];
  const side: ResolvedSection[] = [];
  for (const s of r.sections) {
    if (skip.has(s.id)) continue;
    const toSide = s.autoPlacement ? sideKinds.has(s.kind) : s.placement === 'side';
    (toSide ? side : main).push(s);
  }
  return { main, side };
}

/** Heading with an underline exactly as wide as the text. */
function underlinedTitle(title: string, look: Look, width: number, color: string, weight: number): FlowNode[] {
  const s = look.section;
  const label = s.upper ? title.toUpperCase() : title;
  const tw = getMeasurer().width(label, s.font, s.bold, s.italic, s.size, s.tracking);
  return [
    { t: 'text', runs: [{ text: title }], style: { font: s.font, size: s.size, color: s.color, bold: s.bold, italic: s.italic, uppercase: s.upper, tracking: s.tracking, lineHeight: 1.2 }, role: 'h1', keepWithNext: true },
    { t: 'rule', color, weight, before: 0.9 * look.sp, after: 2.6 * look.sp, length: Math.min(1, (tw + 1.2) / width), keepWithNext: true },
  ];
}

/** Summary text: several lines become a bulleted profile, one paragraph stays prose. */
function summaryNodes(text: string, look: Look): FlowNode[] {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^\s*[-*•▪]\s*/, '').trim())
    .filter(Boolean);
  return lines.length > 1 ? bulletNodes(lines, look, {}, 1.4) : paragraphs(text, look);
}

function flatSkills(sec: ResolvedSection): ResolvedSection {
  const names = sec.skills.flatMap((g) => g.names);
  const levels = sec.skills.flatMap((g) => g.levels);
  return { ...sec, kind: 'skills', skills: [{ category: '', names, levels }] };
}

/* ------------------------------------------------------------------ */
/* 11. Slate Banner                                                    */
/* ------------------------------------------------------------------ */

const SLATE_SIDE = new Set<ResumeSectionKind>(['skills', 'technical-skills', 'projects', 'languages', 'certifications', 'awards', 'interests', 'achievements', 'publications', 'open-source', 'references']);

function slateEntry(item: ResolvedItem, look: Look, kind: ResumeSectionKind, label: string): GroupNode {
  const head: FlowNode[] = [{ t: 'text', runs: [{ text: item.title || 'Untitled', ...(item.url ? { link: item.url } : {}) }], style: ts(look, { size: look.entry.titleSize, bold: true, color: look.entry.titleColor, lineHeight: 1.25 }), role: 'h3' }];
  if (item.subtitle) head.push({ t: 'text', runs: [{ text: item.subtitle }], style: ts(look, { size: look.size + 0.6, lineHeight: 1.25 }), before: 0.5 * look.sp });
  const isEdu = kind === 'education';
  const shortDesc = isEdu && item.description.length <= 40 ? item.description : '';
  const meta = [item.date, item.location, shortDesc].filter((x) => x.trim());
  if (meta.length) {
    const runs: Run[] = [];
    meta.forEach((m, i) => {
      if (i > 0) runs.push({ text: '  |  ', color: look.muted });
      runs.push({ text: m });
    });
    head.push({ t: 'text', runs, style: ts(look, { size: look.size - 0.4, color: look.text, lineHeight: 1.25 }), before: 0.5 * look.sp });
  }
  const body: FlowNode[] = [];
  const desc = shortDesc ? '' : item.description;
  if (desc.trim()) body.push(...paragraphs(desc, look, {}, 1).map((n, i) => (i === 0 ? { ...n, before: 1.2 * look.sp } : n)));
  if (item.bullets.length) {
    body.push({ t: 'text', runs: [{ text: label }], style: ts(look, { size: look.size - 0.2, bold: true, color: look.accent, lineHeight: 1.2 }), before: 1.6 * look.sp, keepWithNext: true });
    const bl = bulletNodes(item.bullets, look, {}, 0.8);
    if (bl[0]) bl[0].before = 0.9 * look.sp;
    body.push(...bl);
  }
  return { t: 'group', keep: body.length <= 6 ? 'together' : 'head', head: head.length, minBody: 2, nodes: [...head, ...body], ref: item.id };
}

function slateProject(item: ResolvedItem, look: Look): GroupNode {
  const metaRuns: Run[] = [item.subtitle, item.date].filter((x) => x.trim()).map((x, i) => ({ text: `${i ? '  ·  ' : ''}${x}` }));
  const nodes: FlowNode[] = [{ t: 'text', runs: [{ text: item.title || 'Untitled', ...(item.url ? { link: item.url } : {}) }], style: ts(look, { size: look.size + 0.9, bold: true, uppercase: true, tracking: 0.1, lineHeight: 1.25 }), role: 'h3' }];
  if (metaRuns.length) nodes.push({ t: 'text', runs: metaRuns, style: ts(look, { size: look.size - 0.6, color: look.accent, lineHeight: 1.2 }), before: 0.4 * look.sp });
  const it = { color: look.muted, italic: true, size: look.size - 0.3 };
  if (item.description.trim()) nodes.push(...paragraphs(item.description, look, it, 1).map((n, i) => (i === 0 ? { ...n, before: 0.8 * look.sp } : n)));
  const bl = bulletNodes(item.bullets, { ...look, bulletColor: look.muted }, it, 0.5);
  if (bl[0]) bl[0].before = 0.8 * look.sp;
  nodes.push(...bl);
  if (look.showTech && item.tags.length) nodes.push({ t: 'text', runs: [{ text: item.tags.join(' · ') }], style: ts(look, { size: look.size - 0.9, color: look.entry.titleColor, bold: true }), before: 0.8 * look.sp });
  return { t: 'group', keep: 'together', nodes, ref: item.id };
}

function slateLanguages(sec: ResolvedSection, look: Look): FlowNode[] {
  const out: FlowNode[] = [];
  for (let i = 0; i < sec.items.length; i += 2) {
    const cell = (it: ResolvedItem | undefined): FlowNode[] =>
      it
        ? [
            { t: 'text', runs: [{ text: it.title }], style: ts(look, { bold: true, lineHeight: 1.25 }), ref: it.id },
            ...(it.subtitle ? [{ t: 'text' as const, runs: [{ text: it.subtitle }], style: ts(look, { size: look.size - 0.6, italic: true, color: look.accent, lineHeight: 1.25 }), before: 0.3 * look.sp }] : []),
          ]
        : [];
    out.push({ t: 'row', gap: 4, ...(i ? { before: 1.6 * look.sp } : {}), cols: [{ width: 0.5, nodes: cell(sec.items[i]) }, { width: 0.5, nodes: cell(sec.items[i + 1]) }] });
  }
  return out;
}

const slateBanner: ResumeTemplateDef = {
  id: 'slate-banner',
  name: 'Slate Banner',
  description: 'Dark header with ringed portrait and summary, a contact strip, then two balanced columns with skill chips.',
  tags: ['Two column', 'Photo', 'Chips', 'Premium'],
  columns: 2,
  ats: 'medium',
  supportsPhoto: true,
  defaults: { colorPreset: 'custom', accent: '#2c7a7b', sidebarWidth: 0.47, photo: 'circle', baseSize: 9.6, lineHeight: 1.36, iconStyle: 'glyph', margins: 'normal' },
  controls: [...COMMON, 'sidebarWidth', 'photo', 'iconStyle'],
  starter: {
    sections: [
      { kind: 'profile' },
      { kind: 'summary' },
      { kind: 'experience' },
      { kind: 'education' },
      { kind: 'skills' },
      { kind: 'projects', maxBullets: 2 },
      { kind: 'languages' },
    ],
    persona: 'engineer-lead',
  },
  compose(r) {
    if (r.style.atsSafe) return atsMinimal.compose(r);
    const st = setup(r, 'helvetica');
    const m = st.m;
    const band = '#2f3a4c';
    const accent = st.accent;
    const b = baseLook(st);
    const look = baseLook(st, {
      text: '#1f2633',
      muted: '#6b7280',
      section: { ...b.section, size: st.eff.size + 3.2, upper: true, tracking: 0.15, color: accent, rule: 'none' },
      entry: { ...b.entry, titleSize: st.eff.size + 1.6, titleColor: band },
      bullet: 'bullet',
      bulletColor: accent,
      tags: 'chips',
      chipFill: band,
      chipText: '#ffffff',
    });
    const rule = Math.max(0.7, st.rule * 1.6 || 0.7);
    const summary = r.sections.find((s) => s.kind === 'summary');

    /* header band */
    const d = 30 * st.head;
    const photoW = d + 2;
    const innerW = m.pageW - m.margin.left - m.margin.right;
    const showPortrait = r.style.photo !== 'none';
    const text: FlowNode[] = [nameNode(r, look, 22 * st.head, { color: '#ffffff', lineHeight: 1.1 })];
    if (r.headline) text.push({ t: 'text', runs: [{ text: r.headline }], style: ts(look, { size: look.size + 3.4, color: '#e2e8f0', lineHeight: 1.2 }), role: 'subtitle', before: 1.2 * look.sp });
    if (summary) text.push({ t: 'text', runs: [{ text: summary.text.replace(/\s*\n\s*/g, ' ') }], style: ts(look, { size: look.size + 0.2, color: '#e5e9f0', lineHeight: 1.42 }), before: 2.6 * look.sp, ref: summary.id });
    const head: FlowNode = showPortrait
      ? {
          t: 'row',
          gap: 7,
          cols: [
            { width: photoW / (innerW - 7), nodes: [ringedPortrait(r.photo, r.name, d, photoW, { ring: accent, ringWidth: 1, disc: mix(band, '#ffffff', 0.14), discText: '#ffffff', align: 'left', mode: r.style.photo })] },
            { nodes: text, vAlign: 'middle' },
          ],
        }
      : { t: 'box', nodes: text };
    const blocks: FlowNode[] = [{ t: 'box', fill: band, keep: 'together', padding: [8 * st.head, m.margin.right, 7 * st.head, m.margin.left], nodes: [head] }];
    if (r.contact.length) {
      const runs = contactRuns(r.contact, look, { sep: '      ', icon: r.style.iconStyle, color: look.text, iconColor: accent });
      blocks.push({ t: 'box', fill: mix(band, '#ffffff', 0.84), keep: 'together', padding: [3.4, m.margin.right, 3.4, m.margin.left], nodes: [{ t: 'text', runs, style: ts(look, { size: look.size - 0.4, lineHeight: 1.7 }), align: 'center' }] });
    }

    /* columns */
    const { main, side } = placeBy(r, SLATE_SIDE, new Set(summary ? [summary.id] : []));
    const gutter = 9;
    const rightW = Math.round((m.contentW - gutter) * Math.min(0.6, Math.max(0.36, r.style.sidebarWidth)));
    const leftW = m.contentW - gutter - rightW;
    const render = (secs: ResolvedSection[], width: number): FlowNode[] =>
      secs.map((sec, i) => {
        const before = i === 0 ? 0 : 5.4 * look.sp;
        const titleOverride = underlinedTitle(sec.title, look, width, accent, rule);
        let nodes: FlowNode[] | null = null;
        if (sec.kind === 'skills' || sec.kind === 'technical-skills') nodes = skillsNodes(flatSkills(sec), look, width, 'chips');
        else if (sec.kind === 'languages' && sec.display === 'auto') nodes = slateLanguages(sec, look);
        else if (sec.kind === 'projects' && sec.display === 'auto') nodes = sec.items.map((it, j) => ({ ...slateProject(it, look), ...(j ? { before: 3.4 * look.sp } : {}) }));
        else if (['experience', 'education', 'volunteer', 'open-source'].includes(sec.kind) && (sec.display === 'auto' || sec.display === 'entries'))
          nodes = sec.items.map((it, j) => ({ ...slateEntry(it, look, sec.kind, sec.kind === 'education' ? 'Highlights' : 'Key achievements'), ...(j ? { before: 3.2 * look.sp } : {}) }));
        if (!nodes) return sectionNode(sec, look, width, { before, side: width < m.contentW * 0.6, titleOverride });
        if (sec.text && sec.kind !== 'summary') nodes = [...paragraphs(sec.text, look), ...nodes];
        return { t: 'section', id: sec.id, ref: sec.id, title: titleOverride, continued: sectionTitle(`${sec.title} (continued)`, { ...look, section: { ...look.section, color: look.muted } }, width), nodes, before } as FlowNode;
      });
    const columns: FlowColumn[] = [
      { id: 'main', x: m.margin.left, width: leftW, nodes: render(main, leftW), order: 0 },
      { id: 'side', x: m.margin.left + leftW + gutter, width: rightW, nodes: render(side, rightW), order: 1 },
    ];
    return doc(r, st, look, {
      page: { width: m.pageW, height: m.pageH, margin: { ...m.margin, top: 0 } },
      masthead: blocks,
      mastheadX: 0,
      mastheadWidth: m.pageW,
      mastheadGap: 7 * look.sp,
      columns: columns.map((c) => ({ ...c, top: m.margin.top })),
    });
  },
};

/* ------------------------------------------------------------------ */
/* 12. Navy Sidebar                                                    */
/* ------------------------------------------------------------------ */

const NAVY_SIDE = new Set<ResumeSectionKind>(['skills', 'technical-skills', 'education', 'languages', 'certifications', 'interests', 'awards']);

function navyMainEntry(item: ResolvedItem, look: Look, kind: ResumeSectionKind, gold: string): GroupNode {
  const companyFirst = kind === 'experience' || kind === 'volunteer';
  const top = companyFirst ? item.subtitle || item.title : item.title;
  const second = companyFirst ? (item.subtitle ? item.title : '') : item.subtitle;
  const l1: Run[] = [{ text: top || 'Untitled', ...(item.url ? { link: item.url } : {}) }];
  if (item.location) l1.push({ text: '  |  ', color: look.muted, bold: false, size: look.size }, { text: item.location, italic: true, bold: false, color: look.muted, size: look.size });
  const head: FlowNode[] = [{ t: 'text', runs: l1, style: ts(look, { size: look.size + 2, bold: true, color: look.entry.titleColor, lineHeight: 1.22, font: look.headFont }), role: 'h3' }];
  const l2: Run[] = [];
  if (second) l2.push({ text: second, bold: true });
  if (item.date) l2.push(...(l2.length ? [{ text: '   •   ', color: gold, bold: true }] : []), { text: item.date, italic: true, color: look.muted });
  if (l2.length) head.push({ t: 'text', runs: l2, style: ts(look, { size: look.size + 0.8, lineHeight: 1.25 }), before: 0.5 * look.sp });
  const body: FlowNode[] = [];
  if (item.description.trim()) body.push(...paragraphs(item.description, look, {}, 1).map((n, i) => (i === 0 ? { ...n, before: 1.4 * look.sp } : n)));
  const bl = bulletNodes(item.bullets, look, {}, 1.1);
  if (bl[0]) bl[0].before = 1.5 * look.sp;
  body.push(...bl);
  return { t: 'group', keep: body.length <= 6 ? 'together' : 'head', head: head.length, minBody: 2, nodes: [...head, ...body], ref: item.id };
}

const navySidebar: ResumeTemplateDef = {
  id: 'navy-sidebar',
  name: 'Navy Sidebar',
  description: 'Full-height navy sidebar with gold rules, serif masthead and a justified, bulleted profile.',
  tags: ['Two column', 'Sidebar', 'Serif', 'Photo', 'Premium'],
  columns: 2,
  ats: 'medium',
  supportsPhoto: true,
  defaults: { colorPreset: 'custom', accent: '#1f3864', sidebarWidth: 0.32, photo: 'circle', baseSize: 9.8, lineHeight: 1.36, margins: 'normal' },
  controls: [...COMMON, 'sidebarWidth', 'photo', 'iconStyle'],
  starter: {
    sections: [
      { kind: 'profile' },
      { kind: 'summary' },
      { kind: 'experience' },
      { kind: 'achievements' },
      { kind: 'technical-skills', title: 'Skills' },
      { kind: 'custom', title: 'Strengths', display: 'grid', placement: 'side' },
      { kind: 'education' },
    ],
    persona: 'content-strategist',
  },
  compose(r) {
    if (r.style.atsSafe) return atsMinimal.compose(r);
    const st = setup(r, 'times');
    const m = st.m;
    const navy = mix(st.accent, '#000000', 0.05);
    const gold = '#c9a24b';
    const b = baseLook(st);
    const look = baseLook(st, {
      headFont: 'times',
      text: '#232323',
      muted: '#666666',
      justify: true,
      section: { ...b.section, font: 'times', size: st.eff.size + 4, upper: true, tracking: 0.1, color: navy, rule: 'below', ruleColor: navy, ruleWeight: 0.45 },
      entry: { ...b.entry, titleColor: navy },
      bullet: 'square',
      bulletColor: gold,
    });
    const sideText = '#e8edf5';
    const sideMuted = '#afc0da';
    const sideLook: Look = {
      ...look,
      size: look.size - 0.5,
      text: sideText,
      muted: sideMuted,
      accent: gold,
      justify: false,
      bulletColor: gold,
      section: { ...look.section, size: look.size + 0.8, color: '#ffffff', tracking: 0.25, rule: 'below', ruleColor: gold, ruleWeight: 0.4 },
      entry: { ...look.entry, titleColor: '#ffffff', subtitleColor: sideText, dateColor: gold },
    };

    const bandW = Math.round(m.pageW * Math.min(0.4, Math.max(0.26, r.style.sidebarWidth)));
    const sx = 7.5;
    const sideW = bandW - sx * 2;
    const mainX = bandW + 8;
    const mainW = m.pageW - m.margin.right - mainX;
    const { main, side } = placeBy(r, NAVY_SIDE);

    const sideNodes: FlowNode[] = [];
    if (r.style.photo !== 'none') sideNodes.push({ ...ringedPortrait(r.photo, r.name, 30 * st.head, sideW, { ring: mix(navy, '#ffffff', 0.35), ringWidth: 1.1, disc: mix(navy, '#ffffff', 0.18), discText: '#ffffff', mode: r.style.photo }), after: 7 * look.sp });
    if (r.contact.length) sideNodes.push({ t: 'section', id: 'contact', ref: r.profileSectionId ?? 'profile', title: sectionTitle('Contact', sideLook, sideW), nodes: contactList(r.contact, sideLook, { icon: r.style.iconStyle, color: sideText, labelColor: gold }) });
    side.forEach((sec, i) => {
      const before = i === 0 && !r.contact.length ? 0 : 5.5 * look.sp;
      let nodes: FlowNode[] | null = null;
      if (sec.kind === 'skills' || sec.kind === 'technical-skills') {
        nodes = sec.skills.flatMap((g, gi) => [
          ...(g.category ? [{ t: 'text' as const, runs: [{ text: g.category }], style: ts(sideLook, { bold: true, size: sideLook.size + 0.6, color: '#ffffff', lineHeight: 1.2 }), before: gi ? 2 * look.sp : 0, keepWithNext: true, role: 'h3' as const }] : []),
          { t: 'text' as const, runs: [{ text: g.names.join(', ') }], style: ts(sideLook, { size: sideLook.size - 0.3, color: sideMuted, lineHeight: 1.32 }), before: g.category ? 0.6 * look.sp : gi ? 2 * look.sp : 0 },
        ]);
      } else if (['education', 'certifications'].includes(sec.kind) && sec.display === 'auto') {
        nodes = sec.items.map((it, j) => ({
          t: 'group' as const,
          keep: 'together' as const,
          ref: it.id,
          before: j ? 2.6 * look.sp : 0,
          nodes: [
            { t: 'text' as const, runs: [{ text: it.title || 'Untitled' }], style: ts(sideLook, { bold: true, size: sideLook.size + 0.9, color: '#ffffff', lineHeight: 1.2 }), role: 'h3' as const },
            ...(it.date ? [{ t: 'text' as const, runs: [{ text: it.date }], style: ts(sideLook, { bold: true, color: gold, size: sideLook.size - 0.2 }), before: 0.3 * look.sp }] : []),
            ...([it.subtitle, it.location].filter(Boolean).length ? [{ t: 'text' as const, runs: [{ text: [it.subtitle, it.location].filter(Boolean).join(', ') }], style: ts(sideLook, { size: sideLook.size - 0.2, color: sideText, lineHeight: 1.25 }), before: 0.3 * look.sp }] : []),
            ...(it.description ? [{ t: 'text' as const, runs: [{ text: it.description }], style: ts(sideLook, { size: sideLook.size - 0.6, color: sideMuted, italic: true }), before: 0.3 * look.sp }] : []),
          ],
        }));
      }
      sideNodes.push(nodes ? { t: 'section', id: sec.id, ref: sec.id, title: sectionTitle(sec.title, sideLook, sideW), nodes, before } : sectionNode(sec, sideLook, sideW, { side: true, before }));
    });

    const mast: FlowNode[] = [nameNode(r, look, 27 * st.head, { font: 'times', uppercase: true, color: navy, lineHeight: 1.02, tracking: 0.2 })];
    if (r.headline) mast.push({ t: 'text', runs: [{ text: r.headline }], style: ts(look, { font: 'times', bold: true, uppercase: true, tracking: 0.35, size: look.size + 2.6, color: '#555555', lineHeight: 1.2 }), role: 'subtitle', before: 1.2 * look.sp });
    mast.push({ t: 'rule', color: gold, weight: 0.6, before: 1.8 * look.sp });

    const mainNodes: FlowNode[] = main.map((sec, i) => {
      const before = i === 0 ? 0 : 6 * look.sp;
      if (sec.kind === 'summary') return { t: 'section', id: sec.id, ref: sec.id, title: sectionTitle(sec.title, look, mainW), nodes: summaryNodes(sec.text, look), before };
      if (['experience', 'volunteer', 'projects', 'open-source'].includes(sec.kind) && (sec.display === 'auto' || sec.display === 'entries'))
        return { t: 'section', id: sec.id, ref: sec.id, title: sectionTitle(sec.title, look, mainW), continued: sectionTitle(`${sec.title} (continued)`, look, mainW), before, nodes: [...(sec.text ? paragraphs(sec.text, look) : []), ...sec.items.map((it, j) => ({ ...navyMainEntry(it, look, sec.kind, gold), ...(j ? { before: 4 * look.sp } : {}) }))] };
      if (['achievements', 'awards'].includes(sec.kind) && sec.display === 'auto')
        return {
          t: 'section',
          id: sec.id,
          ref: sec.id,
          title: sectionTitle(sec.title, look, mainW),
          before,
          nodes: sec.items.map((it, j) => ({
            t: 'text' as const,
            ref: it.id,
            runs: [{ text: `${it.title}${it.description ? '' : '  '}`, ...(it.url ? { link: it.url } : {}) }, ...(it.description ? [{ text: ` — ${it.description}  ` }] : []), ...(it.date ? [{ text: it.date, italic: true, color: look.muted }] : [])],
            style: ts(look, { size: look.size - 0.2 }),
            align: 'left' as const,
            marker: { kind: 'square' as const, color: gold },
            indent: look.size * PT * 1.35,
            before: j ? 1.3 * look.sp : 0,
          })),
        };
      return sectionNode(sec, look, mainW, { before });
    });

    return doc(r, st, look, {
      page: { width: m.pageW, height: m.pageH, margin: { ...m.margin, top: m.margin.top * 0.75 } },
      masthead: mast,
      mastheadX: mainX,
      mastheadWidth: mainW,
      mastheadGap: 6 * look.sp,
      columns: [
        { id: 'side', x: sx, width: sideW, nodes: sideNodes, order: 1, fill: navy, top: 12, firstTop: 12 },
        { id: 'main', x: mainX, width: mainW, nodes: mainNodes, order: 0 },
      ],
      decorations: [{ k: 'rect', x: 0, y: 0, w: bandW, h: m.pageH, fill: navy, pages: 'all' }],
    });
  },
};

export const RESUME_TEMPLATES: ResumeTemplateDef[] = [slateBanner, navySidebar, atsMinimal, modern, executive, developer, creative, compact, academic, minimalMono, editorial, timeline];

export function getResumeTemplate(id: string): ResumeTemplateDef {
  return RESUME_TEMPLATES.find((t) => t.id === id) ?? atsMinimal;
}

/** Used by the ATS checker and the template browser. */
export function templateTraits(id: string): { columns: 1 | 2; ats: ResumeTemplateDef['ats']; decorative: boolean } {
  const t = getResumeTemplate(id);
  return { columns: t.columns, ats: t.ats, decorative: ['creative', 'developer', 'timeline', 'modern-professional', 'slate-banner', 'navy-sidebar'].includes(t.id) };
}

void PT;
