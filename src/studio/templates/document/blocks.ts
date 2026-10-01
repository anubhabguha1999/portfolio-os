/**
 * Document blocks → FlowNodes. Every document template describes a DocLook; this
 * module turns the user's block list into flow content with pagination hints.
 */
import type { BoxNode, FlowNode, FontFamily, Run, TextNode, TextStyle } from '@/studio/engine/flow';
import { getMeasurer, PT } from '@/studio/engine/measure';
import type { BlockStyle, DocBlockNode, Library, Profile } from '@/studio/model/types';
import { displayUrl, formatDateRange } from '@/studio/model/resolve';
import { inlineRuns, mix, type Look } from '../kit';

export interface HeadingLook {
  size: number;
  font: FontFamily;
  bold: boolean;
  italic: boolean;
  upper: boolean;
  tracking: number;
  color: string;
  rule: 'none' | 'below' | 'above' | 'bar' | 'short';
  ruleColor: string;
  ruleWeight: number;
  before: number;
  after: number;
  align?: 'left' | 'center';
}

export interface DocLook extends Look {
  h1: HeadingLook;
  h2: HeadingLook;
  h3: HeadingLook;
  /** Prefix headings with 1 / 1.1 / 1.1.1 numbering. */
  numbered: boolean;
  quote: 'bar' | 'large';
  card: { fill: string; stroke: string; radius: number; bar: string | null };
  code: { fill: string; text: string };
  statValue: string;
  divider: string;
  surface: string;
  callout: Record<'info' | 'success' | 'warning' | 'note', { fill: string; bar: string; title: string }>;
  photoMode: 'circle' | 'rounded' | 'square' | 'large-portrait';
}

export interface BlockCtx {
  width: number;
  profile: Profile;
  library: Library;
  /** Profile photo key (documents usage) or null. */
  photo: string | null;
  /** Show hints for empty blocks (editor only, never exported). */
  placeholders: boolean;
  /** Heading counters for numbered templates. */
  counters: [number, number, number];
}

const SIZE_SCALE: Record<BlockStyle['size'], number> = { sm: 0.88, md: 1, lg: 1.18, xl: 1.42 };

function toneColor(look: DocLook, tone: BlockStyle['tone']): string {
  return tone === 'muted' ? look.muted : tone === 'accent' ? look.accent : look.text;
}

function st(look: DocLook, over: Partial<TextStyle> = {}): TextStyle {
  return { font: look.font, size: look.size, color: look.text, lineHeight: look.lh, ...over };
}

function align(style: BlockStyle, look: DocLook): TextNode['align'] {
  if (style.align === 'left' && look.justify) return 'left';
  return style.align;
}

/** Paragraph text: blank lines split paragraphs, "- " lines become bullets. */
function richText(text: string, look: DocLook, style: TextStyle, al: TextNode['align'], gap: number): FlowNode[] {
  const out: FlowNode[] = [];
  const blocks = text.split(/\n\s*\n/);
  for (const raw of blocks) {
    const lines = raw.split('\n');
    const bullets = lines.every((l) => /^\s*[-*•]\s+/.test(l) || !l.trim()) && lines.some((l) => l.trim());
    if (bullets) {
      lines
        .filter((l) => l.trim())
        .forEach((l) =>
          out.push({
            t: 'text',
            runs: inlineRuns(l.replace(/^\s*[-*•]\s+/, '')),
            style,
            marker: { kind: look.bullet, color: look.bulletColor },
            indent: style.size * PT * 1.5,
            before: out.length ? gap * 0.45 : 0,
          }),
        );
      continue;
    }
    const p = raw.replace(/\s*\n\s*/g, ' ').trim();
    if (!p) continue;
    out.push({ t: 'text', runs: inlineRuns(p), style, align: al === 'left' && look.justify ? 'justify' : al, before: out.length ? gap : 0 });
  }
  return out;
}

export function headingNodes(text: string, level: 1 | 2 | 3, look: DocLook, ctx: BlockCtx, style: BlockStyle): FlowNode[] {
  const h = level === 1 ? look.h1 : level === 2 ? look.h2 : look.h3;
  let label = text;
  if (look.numbered) {
    const c = ctx.counters;
    if (level === 1) {
      c[0]++;
      c[1] = 0;
      c[2] = 0;
      label = `${c[0]}  ${text}`;
    } else if (level === 2) {
      c[1]++;
      c[2] = 0;
      label = `${c[0]}.${c[1]}  ${text}`;
    } else {
      c[2]++;
      label = `${c[0]}.${c[1]}.${c[2]}  ${text}`;
    }
  }
  const al = style.align === 'justify' ? 'left' : style.align !== 'left' ? style.align : h.align ?? 'left';
  const node: TextNode = {
    t: 'text',
    runs: [{ text: label || ' ' }],
    style: { font: h.font, size: h.size * SIZE_SCALE[style.size], bold: h.bold, italic: h.italic, uppercase: h.upper, tracking: h.tracking, color: style.tone === 'default' ? h.color : toneColor(look, style.tone), lineHeight: 1.18 },
    role: level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3',
    align: al,
    keepWithNext: true,
  };
  switch (h.rule) {
    case 'below':
      return [node, { t: 'rule', color: h.ruleColor, weight: h.ruleWeight, before: 1.4, keepWithNext: true }];
    case 'short':
      return [node, { t: 'rule', color: h.ruleColor, weight: h.ruleWeight, before: 1.6, length: Math.min(1, 16 / ctx.width), align: al === 'center' ? 'center' : 'left', keepWithNext: true }];
    case 'above':
      return [{ t: 'rule', color: h.ruleColor, weight: h.ruleWeight, after: 2.2, keepWithNext: true }, node];
    case 'bar':
      return [{ t: 'box', nodes: [node], bar: { color: h.ruleColor, width: 1.2 }, padding: [0.3, 0, 0.3, 3], keep: 'together', keepWithNext: true } as BoxNode];
    default:
      return [node];
  }
}

function cardBox(look: DocLook, nodes: FlowNode[], over: Partial<BoxNode> = {}): BoxNode {
  return {
    t: 'box',
    nodes,
    padding: [3.4, 4, 3.4, 4],
    ...(look.card.fill ? { fill: look.card.fill } : {}),
    ...(look.card.stroke ? { stroke: look.card.stroke, strokeWidth: 0.25 } : {}),
    ...(look.card.radius ? { radius: look.card.radius } : {}),
    ...(look.card.bar ? { bar: { color: look.card.bar, width: 1 } } : {}),
    keep: 'together',
    ...over,
  };
}

function hint(look: DocLook, text: string): FlowNode {
  return { t: 'box', nodes: [{ t: 'text', runs: [{ text }], style: st(look, { size: look.size - 1, color: look.muted, italic: true }), align: 'center' }], padding: [5, 4, 5, 4], stroke: mix(look.muted, look.surface, 0.5), strokeWidth: 0.25, radius: 1.5, keep: 'together' };
}

function contactRunsOf(profile: Profile, look: DocLook): Run[] {
  const items: Run[] = [];
  const add = (text: string, link?: string) => {
    if (!text.trim()) return;
    if (items.length) items.push({ text: '  ·  ', color: look.muted });
    items.push({ text: text.trim(), ...(link ? { link } : {}) });
  };
  add(profile.email, profile.email ? `mailto:${profile.email}` : undefined);
  add(profile.phone ?? '');
  add(profile.location ?? '');
  if (profile.website) add(displayUrl(profile.website), profile.website);
  for (const s of profile.socialLinks) if (s.url.trim()) add(s.label || displayUrl(s.url), s.url);
  return items;
}

function codeLines(code: string, look: DocLook): FlowNode[] {
  const size = Math.max(7, look.size - 1.2);
  const charW = getMeasurer().width('0', 'courier', false, false, size);
  return code
    .replace(/\t/g, '  ')
    .split('\n')
    .map((line) => {
      const lead = /^ */.exec(line)?.[0].length ?? 0;
      return { t: 'text' as const, runs: [{ text: line.trim() || ' ' }], style: { font: 'courier' as const, size, color: look.code.text, lineHeight: 1.35 }, ...(lead ? { indent: lead * charW } : {}) };
    });
}

/** Convert one block. Returns nodes already carrying the block's spacing and ref. */
export function blockNodes(b: DocBlockNode, look: DocLook, ctx: BlockCtx): FlowNode[] {
  const s = b.style;
  const scale = SIZE_SCALE[s.size];
  const color = toneColor(look, s.tone);
  const body = st(look, { size: look.size * scale, color });
  const al = align(s, look);
  const W = ctx.width;
  const sp = look.sp;
  let nodes: FlowNode[] = [];
  let keep: 'together' | 'none' | 'head' = 'none';
  let before = 0;
  let after = 0;

  switch (b.kind) {
    case 'pageBreak':
      return [{ t: 'break' }];
    case 'spacer':
      return [{ t: 'space', h: Math.max(1, b.height), ref: b.id }];
    case 'heading': {
      const h = b.level === 1 ? look.h1 : b.level === 2 ? look.h2 : look.h3;
      nodes = headingNodes(b.text, b.level, look, ctx, s);
      before = h.before * sp;
      after = h.after * sp;
      break;
    }
    case 'paragraph':
      nodes = b.text.trim() ? richText(b.text, look, body, al, 2 * sp) : ctx.placeholders ? [hint(look, 'Empty paragraph')] : [];
      after = 3 * sp;
      break;
    case 'image': {
      if (!b.src) {
        nodes = ctx.placeholders ? [hint(look, 'Image — upload one in the properties panel')] : [];
        break;
      }
      const aspect = Math.max(0.2, Math.min(5, (b as { aspect?: number }).aspect ?? imageAspect(b.src) ?? 4 / 3));
      const w = W * Math.min(1, Math.max(0.15, b.width || 1));
      nodes.push({ t: 'image', src: b.src, width: w, height: w / aspect, align: s.align === 'center' ? 'center' : s.align === 'right' ? 'right' : 'left', alt: b.caption || 'Image' });
      if (b.caption.trim()) nodes.push({ t: 'text', runs: inlineRuns(b.caption), style: st(look, { size: look.size - 1.2, italic: true, color: look.muted }), align: s.align === 'justify' ? 'left' : s.align, before: 1.6, role: 'caption' });
      keep = 'together';
      after = 4 * sp;
      break;
    }
    case 'profile': {
      const p = ctx.profile;
      const text: FlowNode[] = [
        { t: 'text', runs: [{ text: p.name || 'Your Name' }], style: { font: look.h1.font, size: look.h1.size * 1.2 * scale, bold: true, color: look.text, lineHeight: 1.1 }, role: 'title', align: al === 'justify' ? 'left' : al },
      ];
      if (p.headline) text.push({ t: 'text', runs: [{ text: p.headline }], style: st(look, { size: look.size + 1.6, color: look.accent }), role: 'subtitle', before: 1.2, align: al === 'justify' ? 'left' : al });
      if (b.showContact) {
        const runs = contactRunsOf(p, look);
        if (runs.length) text.push({ t: 'text', runs, style: st(look, { size: look.size - 0.8, color: look.muted, lineHeight: 1.45 }), before: 2, align: al === 'justify' ? 'left' : al });
      }
      if (b.showBio && p.bio.trim()) text.push(...richText(p.bio, look, body, al, 2 * sp).map((n, i) => (i === 0 ? { ...n, before: 3 } : n)));
      const photoKey = b.showPhoto && ctx.photo ? ctx.photo.replace(/:[\w-]+$/, `:${look.photoMode}`) : null;
      if (photoKey) {
        const pw = look.photoMode === 'large-portrait' ? 30 : 26;
        const ph = look.photoMode === 'large-portrait' ? 30 * (42 / 32) : 26;
        if (s.align === 'center') nodes = [{ t: 'image', src: photoKey, width: pw, height: ph, align: 'center', alt: 'Profile photo', after: 4 }, ...text];
        else nodes = [{ t: 'row', gap: 6, cols: [{ width: (pw + 1) / (W - 6), nodes: [{ t: 'image', src: photoKey, width: pw, height: ph, alt: 'Profile photo' }] }, { nodes: text, vAlign: 'middle' }] }];
      } else nodes = text;
      keep = 'together';
      after = 6 * sp;
      break;
    }
    case 'quote': {
      const qs = look.quote === 'large' ? st(look, { font: 'times', italic: true, size: (look.size + 4) * scale, color, lineHeight: 1.32 }) : st(look, { italic: true, size: (look.size + 0.8) * scale, color, lineHeight: look.lh });
      const inner: FlowNode[] = [{ t: 'text', runs: inlineRuns(look.quote === 'large' ? `"${b.text}"` : b.text), style: qs, align: look.quote === 'large' && s.align === 'left' ? 'left' : al }];
      if (b.cite.trim()) inner.push({ t: 'text', runs: [{ text: `— ${b.cite}` }], style: st(look, { size: look.size - 0.6, color: look.muted, uppercase: look.quote === 'large', tracking: look.quote === 'large' ? 0.3 : 0 }), before: 2, align: look.quote === 'large' && s.align === 'left' ? 'left' : al });
      nodes = look.quote === 'large' ? [{ t: 'box', nodes: inner, padding: [2, 8, 2, 8], keep: 'together' } as BoxNode] : [{ t: 'box', nodes: inner, bar: { color: look.accent, width: 1 }, padding: [1, 0, 1, 5], keep: 'together' } as BoxNode];
      before = 1.5 * sp;
      after = 5 * sp;
      break;
    }
    case 'list':
      nodes = b.items
        .filter((i) => i.trim())
        .map((it, i) => ({ t: 'text' as const, runs: inlineRuns(it), style: body, marker: b.ordered ? { kind: 'number' as const, n: i + 1, color: look.accent, list: b.id } : { kind: look.bullet, color: look.bulletColor }, indent: body.size * PT * (b.ordered ? 2 : 1.5), before: i ? 1.2 * sp : 0 }));
      if (!nodes.length && ctx.placeholders) nodes = [hint(look, 'Empty list')];
      after = 4 * sp;
      break;
    case 'table': {
      const cols = Math.max(b.header.length, ...b.rows.map((r) => r.length), 1);
      const pad = (r: string[]) => Array.from({ length: cols }, (_, i) => inlineRuns(r[i] ?? ''));
      nodes = [
        {
          t: 'table',
          header: b.header.some((h) => h.trim()) ? pad(b.header) : null,
          rows: b.rows.map(pad),
          style: st(look, { size: (look.size - 0.6) * scale, color: look.text, lineHeight: 1.3 }),
          headerFill: mix(look.accent, look.surface, 0.84),
          border: mix(look.muted, look.surface, 0.55),
          zebra: mix(look.muted, look.surface, 0.93),
        },
      ];
      before = 1 * sp;
      after = 5 * sp;
      break;
    }
    case 'divider':
      nodes = [b.variant === 'thick' ? { t: 'rule', color: look.accent, weight: 1.1 } : b.variant === 'dots' ? { t: 'rule', color: look.muted, weight: 0.5, dash: 'dotted', length: 0.3, align: 'center' } : { t: 'rule', color: look.divider, weight: 0.3 }];
      before = 3 * sp;
      after = 5 * sp;
      break;
    case 'timeline': {
      nodes = b.items.map((it, i) => {
        const inner: FlowNode[] = [];
        if (it.date) inner.push({ t: 'text', runs: [{ text: it.date }], style: st(look, { size: look.size - 1, bold: true, color: look.accent, uppercase: true, tracking: 0.25, lineHeight: 1.2 }) });
        inner.push({ t: 'text', runs: inlineRuns(it.title || 'Milestone'), style: st(look, { bold: true, size: look.size + 0.6, lineHeight: 1.25, font: look.headFont }), before: 0.6 });
        if (it.text.trim()) inner.push(...richText(it.text, look, st(look, { color: look.muted }), 'left', 1.5).map((n, j) => (j === 0 ? { ...n, before: 1 } : n)));
        return { t: 'box', keep: 'together', padding: [0, 0, i === b.items.length - 1 ? 0 : 4 * sp, 8], rail: { x: 2.2, color: mix(look.accent, look.surface, 0.6), width: 0.35, dot: 1.2, dotColor: look.accent }, nodes: inner } as BoxNode;
      });
      after = 5 * sp;
      break;
    }
    case 'columns': {
      const gap = 6;
      const colW = (W - gap * (b.count - 1)) / b.count;
      const cols = b.columns.slice(0, b.count);
      while (cols.length < b.count) cols.push({ id: `pad${cols.length}`, heading: '', text: '' });
      nodes = [
        {
          t: 'row',
          gap,
          cols: cols.map((c) => ({
            nodes: [
              ...(c.heading.trim() ? [{ t: 'text' as const, runs: inlineRuns(c.heading), style: { font: look.h3.font, size: look.h3.size * scale, bold: look.h3.bold, color: look.h3.color, uppercase: look.h3.upper, tracking: look.h3.tracking, lineHeight: 1.2 }, role: 'h3' as const, after: 1.6 }] : []),
              ...richText(c.text, look, body, al === 'justify' ? 'left' : al, 1.8 * sp),
            ],
          })),
        },
      ];
      void colW;
      keep = 'together';
      after = 5 * sp;
      break;
    }
    case 'callout': {
      const c = look.callout[b.variant];
      const inner: FlowNode[] = [];
      if (b.title.trim()) inner.push({ t: 'text', runs: inlineRuns(b.title), style: st(look, { bold: true, color: c.title, lineHeight: 1.25 }), after: 1.2 });
      inner.push(...richText(b.text, look, st(look, { size: look.size * scale, color: look.text }), al, 1.6 * sp));
      nodes = [{ t: 'box', nodes: inner, fill: c.fill, bar: { color: c.bar, width: 1.1 }, padding: [3.2, 4, 3.2, 4], radius: 0.6, keep: 'together' } as BoxNode];
      before = 1 * sp;
      after = 5 * sp;
      break;
    }
    case 'code':
      nodes = [
        { t: 'box', nodes: [...(b.language ? [{ t: 'text' as const, runs: [{ text: b.language.toUpperCase() }], style: { font: 'courier' as const, size: 6.5, color: look.muted, tracking: 0.3, lineHeight: 1.2 }, after: 1.4 }] : []), ...codeLines(b.code, look)], fill: look.code.fill, radius: 1, padding: [3, 4, 3, 4], keep: 'split' } as BoxNode,
      ];
      before = 1 * sp;
      after = 5 * sp;
      break;
    case 'stats': {
      const items = b.items.slice(0, 6);
      if (!items.length) break;
      nodes = [
        {
          t: 'row',
          gap: 4,
          cols: items.map((it) => ({
            nodes: [
              cardBox(look, [
                { t: 'text', runs: [{ text: it.value || '—' }], style: { font: look.h1.font, size: (look.size + 9) * scale, bold: true, color: look.statValue, lineHeight: 1.05 }, align: 'center' },
                { t: 'text', runs: inlineRuns(it.label), style: st(look, { size: look.size - 1, color: look.muted, uppercase: true, tracking: 0.25, lineHeight: 1.25 }), align: 'center', before: 1.6 },
              ], { padding: [4, 3, 4, 3], bar: undefined }),
            ],
          })),
        },
      ];
      keep = 'together';
      before = 1 * sp;
      after = 5 * sp;
      break;
    }
    case 'project': {
      const lib = b.libId ? ctx.library.projects.find((p) => p.id === b.libId) : undefined;
      const title = lib?.title || b.title;
      const text = b.text.trim() || lib?.resumeSummary || lib?.description || '';
      const tags = b.tags.length ? b.tags : lib?.technologies ?? [];
      const url = b.url || lib?.live || lib?.github || '';
      const inner: FlowNode[] = [{ t: 'text', runs: [{ text: title || 'Project', ...(url ? { link: url } : {}) }], style: st(look, { bold: true, size: look.size + 1.4, font: look.headFont, lineHeight: 1.2 }), role: 'h3' }];
      if (lib?.role || lib?.duration) inner.push({ t: 'text', runs: [{ text: [lib.role, lib.duration].filter(Boolean).join('  ·  ') }], style: st(look, { size: look.size - 0.6, color: look.accent }), before: 0.8 });
      if (text) inner.push(...richText(text, look, body, 'left', 1.6).map((n, i) => (i === 0 ? { ...n, before: 1.6 } : n)));
      if (tags.length) inner.push({ t: 'text', runs: [{ text: tags.join('  ·  ') }], style: st(look, { size: look.size - 1.2, color: look.muted, font: look.font === 'courier' ? 'courier' : look.font }), before: 2 });
      if (url) inner.push({ t: 'text', runs: [{ text: displayUrl(url), link: url, color: look.accent }], style: st(look, { size: look.size - 1.2 }), before: 1 });
      nodes = [cardBox(look, inner)];
      before = 1 * sp;
      after = 4 * sp;
      break;
    }
    case 'experience': {
      const lib = b.libId ? ctx.library.experience.find((e) => e.id === b.libId) : undefined;
      const role = lib?.role || b.role;
      const company = lib?.company || b.company;
      const dates = b.dates || (lib ? formatDateRange(lib.start, lib.end, lib.current, 'short') : '');
      const text = b.text.trim() || lib?.description || '';
      const metaSize = look.size - 0.8;
      const dateW = dates ? getMeasurer().width(dates, look.font, false, false, metaSize) + 1 : 0;
      const inner: FlowNode[] = [
        dates
          ? { t: 'row', gap: 3, cols: [{ nodes: [{ t: 'text', runs: [{ text: role || 'Role' }], style: st(look, { bold: true, size: look.size + 1, font: look.headFont, lineHeight: 1.2 }), role: 'h3' }] }, { width: Math.min(0.4, dateW / (W - 11)), align: 'right', nodes: [{ t: 'text', runs: [{ text: dates }], style: st(look, { size: metaSize, color: look.muted, lineHeight: 1.2 }), align: 'right' }] }] }
          : { t: 'text', runs: [{ text: role || 'Role' }], style: st(look, { bold: true, size: look.size + 1, font: look.headFont }), role: 'h3' },
      ];
      if (company) inner.push({ t: 'text', runs: [{ text: [company, lib?.location].filter(Boolean).join('  ·  ') }], style: st(look, { color: look.accent }), before: 0.6 });
      if (text) inner.push(...richText(text, look, body, 'left', 1.6).map((n, i) => (i === 0 ? { ...n, before: 1.6 } : n)));
      if (!b.text.trim() && lib?.achievements.length)
        lib.achievements.filter((a) => a.trim()).forEach((a, i) => inner.push({ t: 'text', runs: inlineRuns(a), style: body, marker: { kind: look.bullet, color: look.bulletColor }, indent: body.size * PT * 1.5, before: i === 0 ? 1.8 : 0.9 }));
      nodes = [cardBox(look, inner)];
      before = 1 * sp;
      after = 4 * sp;
      break;
    }
    case 'signature': {
      const a: 'left' | 'center' | 'right' = s.align === 'center' ? 'center' : s.align === 'right' ? 'right' : 'left';
      const name = b.name || ctx.profile.name;
      nodes = [
        { t: 'space', h: 12 },
        { t: 'rule', color: look.text, weight: 0.25, length: Math.min(1, 62 / W), align: a === 'center' ? 'center' : 'left' },
        ...(name ? [{ t: 'text' as const, runs: [{ text: name }], style: st(look, { bold: true }), before: 1.8, align: a }] : []),
        ...(b.title ? [{ t: 'text' as const, runs: [{ text: b.title }], style: st(look, { color: look.muted, size: look.size - 0.6 }), before: 0.4, align: a }] : []),
        ...(b.date ? [{ t: 'text' as const, runs: [{ text: b.date }], style: st(look, { color: look.muted, size: look.size - 0.6 }), before: 0.4, align: a }] : []),
      ];
      keep = 'together';
      before = 4 * sp;
      after = 4 * sp;
      break;
    }
    case 'footer':
      if (!b.text.trim()) {
        nodes = ctx.placeholders ? [hint(look, 'Empty footer')] : [];
        break;
      }
      nodes = [
        { t: 'rule', color: look.divider, weight: 0.25, after: 2.4 },
        { t: 'text', runs: inlineRuns(b.text), style: st(look, { size: look.size - 1.6, color: look.muted }), align: s.align === 'left' ? 'center' : s.align },
      ];
      keep = 'together';
      before = 6 * sp;
      break;
  }
  if (!nodes.length) return [];
  return [{ t: 'group', keep, nodes, ref: b.id, before: before + (s.spaceBefore || 0), after: after + (s.spaceAfter || 0) }];
}

/* ---------------------------- image sizes --------------------------- */

const sizes = new Map<string, number>();

/** Remember an image's aspect ratio (width / height) so layout can size it synchronously. */
export function registerImageAspect(key: string, aspect: number): void {
  if (Number.isFinite(aspect) && aspect > 0) sizes.set(key, aspect);
}

export function imageAspect(key: string): number | undefined {
  return sizes.get(key);
}

/** Lay out a block list; collapses leading spacing and threads heading counters. */
export function blocksToNodes(blocks: DocBlockNode[], look: DocLook, ctx: Omit<BlockCtx, 'counters'>): FlowNode[] {
  const c: BlockCtx = { ...ctx, counters: [0, 0, 0] };
  const out: FlowNode[] = [];
  for (const b of blocks) out.push(...blockNodes(b, look, c));
  return out;
}
