/**
 * Cover-letter templates. Structured content (recipient, opening, body…) plus the
 * sender's shared profile, laid out as a real business letter.
 */
import type { Decoration, FlowDoc, FlowNode, FontFamily, Run, TextNode, TextStyle } from '@/studio/engine/flow';
import type { CoverLetterData, Profile } from '@/studio/model/types';
import { displayUrl } from '@/studio/model/resolve';
import type { LetterInput, LetterTemplateDef } from '../types';
import { fontFor, inlineRuns, metrics, mix, readableOnWhite, safeHex } from '../kit';
import { formatFullDate, localizeDefault, t } from '@/i18n';

/** "2026-09-30" → "30 September 2026" (localised for other languages); anything else is kept as typed. */
export function formatLetterDate(value: string, lang: string = 'en'): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return value.trim();
  const mi = Number(m[2]) - 1;
  return mi >= 0 && mi < 12 ? formatFullDate(Number(m[1]), mi, Number(m[3]), lang) : value.trim();
}

/** Letter defaults that were never edited ("Dear Hiring Manager,", "Sincerely,") in the letter's language. */
export function localizeLetter(d: CoverLetterData, lang: string): CoverLetterData {
  if (lang === 'en') return d;
  return {
    ...d,
    salutation: localizeDefault(d.salutation, 'dearHiringManager', lang),
    recipientTitle: localizeDefault(d.recipientTitle, 'hiringManager', lang),
    signOff: localizeDefault(d.signOff, 'sincerely', lang),
  };
}

interface L {
  font: FontFamily;
  size: number;
  lh: number;
  text: string;
  muted: string;
  accent: string;
  /** Output language (dates, "Re: Application for…"). */
  lang?: string;
}

const st = (l: L, over: Partial<TextStyle> = {}): TextStyle => ({ font: l.font, size: l.size, color: l.text, lineHeight: l.lh, ...over });

function contactItems(p: Profile): Array<{ text: string; link?: string }> {
  const out: Array<{ text: string; link?: string }> = [];
  if (p.email.trim()) out.push({ text: p.email.trim(), link: `mailto:${p.email.trim()}` });
  if (p.phone?.trim()) out.push({ text: p.phone.trim() });
  if (p.location?.trim()) out.push({ text: p.location.trim() });
  if (p.website?.trim()) out.push({ text: displayUrl(p.website), link: p.website.trim() });
  const li = p.socialLinks.find((s) => /linkedin/i.test(s.platform + s.url));
  if (li) out.push({ text: li.label || displayUrl(li.url), link: li.url });
  return out;
}

function joined(items: Array<{ text: string; link?: string }>, sep: string, l: L): Run[] {
  const runs: Run[] = [];
  items.forEach((c, i) => {
    if (i) runs.push({ text: sep, color: l.muted });
    runs.push({ text: c.text, ...(c.link ? { link: c.link } : {}) });
  });
  return runs;
}

function paragraphs(text: string, l: L, align: TextNode['align'], gap: number): FlowNode[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
    .map((p) => ({ t: 'text' as const, runs: inlineRuns(p), style: st(l), align, after: gap }));
}

function recipientBlock(d: CoverLetterData, l: L, align: TextNode['align'] = 'left'): FlowNode[] {
  const lines = [d.recipient, d.recipientTitle, d.company, ...d.address.split('\n')].map((s) => s.trim()).filter(Boolean);
  return lines.map((t, i) => ({ t: 'text' as const, runs: [{ text: t, ...(i === 0 ? { bold: true } : {}) }], style: st(l, { lineHeight: 1.35 }), align, ref: 'letter:recipient' }));
}

function letterBody(d: CoverLetterData, l: L, align: TextNode['align'], opts: { subject?: boolean; signatureFont?: FontFamily } = {}): FlowNode[] {
  const gap = l.size * 0.42;
  const out: FlowNode[] = [];
  if (opts.subject && d.role.trim()) out.push({ t: 'text', runs: [{ text: t(l.lang, 'reApplicationFor', { role: d.role.trim() }), bold: true }], style: st(l), after: gap * 1.4, ref: 'letter:role' });
  if (d.salutation.trim()) out.push({ t: 'text', runs: [{ text: d.salutation.trim() }], style: st(l), after: gap, ref: 'letter:salutation' });
  const withRef = (nodes: FlowNode[], ref: string) => (nodes.length ? [{ t: 'group' as const, keep: 'none' as const, nodes, ref }] : []);
  out.push(...withRef(paragraphs(d.opening, l, align, gap), 'letter:opening'));
  out.push(...withRef(paragraphs(d.body, l, align, gap), 'letter:body'));
  out.push(...withRef(paragraphs(d.closing, l, align, gap), 'letter:closing'));
  const sign: FlowNode[] = [];
  if (d.signOff.trim()) sign.push({ t: 'text', runs: [{ text: d.signOff.trim() }], style: st(l), before: gap * 0.6 });
  if (d.signature.trim()) sign.push({ t: 'text', runs: [{ text: d.signature.trim() }], style: { font: opts.signatureFont ?? 'times', size: l.size + 7, italic: true, color: mix(l.accent, '#000000', 0.2), lineHeight: 1.2 }, before: 4 });
  else sign.push({ t: 'space', h: 12 });
  return [...out, { t: 'group', keep: 'together', nodes: sign, ref: 'letter:signature' }];
}

function base(input: LetterInput, fallback: FontFamily): { l: L; m: ReturnType<typeof metrics> } {
  const p = input.page;
  return {
    l: {
      font: fontFor(p.font, fallback),
      size: Math.max(8.5, Math.min(13, p.baseSize || 10.5)),
      lh: Math.max(1.15, Math.min(1.8, p.lineHeight || 1.45)),
      text: '#1b1d22',
      muted: '#5b6170',
      accent: readableOnWhite(safeHex(p.accent), 3.5),
      lang: p.language ?? 'en',
    },
    m: metrics(p.paper, p.margins, 1.15, 'portrait'),
  };
}

function doc(input: LetterInput, m: ReturnType<typeof metrics>, nodes: FlowNode[], extra: Partial<FlowDoc> = {}): FlowDoc {
  const p = input.page;
  return {
    page: { width: m.pageW, height: m.pageH, margin: m.margin },
    columns: [{ id: 'main', x: m.margin.left, width: m.contentW, nodes }],
    meta: input.meta,
    links: true,
    // Footer text runs on every page (with the page number after it); a number alone skips page 1.
    footer: p.footerText.trim()
      ? { runs: [{ text: p.footerText.trim() }, ...(p.pageNumbers ? [{ text: '    ·    {page} / {pages}' }] : [])], style: { font: 'helvetica', size: 7.5, color: '#6b7280' }, align: 'center', pages: 'all' }
      : p.pageNumbers
        ? { runs: [{ text: '{page} / {pages}' }], style: { font: 'helvetica', size: 7.5, color: '#6b7280' }, align: 'center', pages: 'rest' }
        : null,
    header: p.headerText.trim() ? { runs: [{ text: p.headerText.trim() }], style: { font: 'helvetica', size: 7.5, color: '#6b7280' }, align: 'left', pages: 'all' } : null,
    ...extra,
  };
}

const dateNode = (d: CoverLetterData, l: L, align: TextNode['align'] = 'left'): FlowNode[] => (d.date.trim() ? [{ t: 'text', runs: [{ text: formatLetterDate(d.date, l.lang) }], style: st(l, { color: l.muted }), align, ref: 'letter:date' }] : []);

/* ------------------------------------------------------------------ */

const minimal: LetterTemplateDef = {
  id: 'letter-minimal',
  name: 'Minimal',
  description: 'Plain and precise. Name, contact line, letter.',
  compose(input) {
    const { l, m } = base(input, 'helvetica');
    const p = input.profile;
    const nodes: FlowNode[] = [
      { t: 'text', runs: [{ text: p.name || 'Your Name' }], style: st(l, { size: l.size + 7, bold: true, lineHeight: 1.1 }), role: 'title', ref: 'letter:sender' },
      ...(contactItems(p).length ? [{ t: 'text' as const, runs: joined(contactItems(p), '  ·  ', l), style: st(l, { size: l.size - 1, color: l.muted }), before: 2 }] : []),
      { t: 'space', h: 14 },
      ...dateNode(input.letter, l),
      { t: 'space', h: 6 },
      ...recipientBlock(input.letter, l),
      { t: 'space', h: 8 },
      ...letterBody(input.letter, l, 'left'),
    ];
    return doc(input, m, nodes);
  },
};

const professional: LetterTemplateDef = {
  id: 'letter-professional',
  name: 'Professional',
  description: 'Letterhead with stacked contact details, subject line, justified body.',
  compose(input) {
    const { l, m } = base(input, 'helvetica');
    const p = input.profile;
    const contact = contactItems(p);
    const header: FlowNode = {
      t: 'row',
      gap: 8,
      ref: 'letter:sender',
      cols: [
        { vAlign: 'bottom', nodes: [{ t: 'text', runs: [{ text: p.name || 'Your Name' }], style: st(l, { size: l.size + 9, bold: true, color: l.accent, lineHeight: 1.05 }), role: 'title' }, ...(p.headline ? [{ t: 'text' as const, runs: [{ text: p.headline }], style: st(l, { size: l.size + 0.5, color: l.muted }), before: 1.6 }] : [])] },
        { width: 0.38, align: 'right', vAlign: 'bottom', nodes: contact.map((c) => ({ t: 'text' as const, runs: [{ text: c.text, ...(c.link ? { link: c.link } : {}) }], style: st(l, { size: l.size - 1.2, color: l.muted, lineHeight: 1.4 }), align: 'right' as const })) },
      ],
    };
    const nodes: FlowNode[] = [
      header,
      { t: 'rule', color: l.accent, weight: 0.6, before: 5, after: 10 },
      ...dateNode(input.letter, l, 'right'),
      { t: 'space', h: 4 },
      ...recipientBlock(input.letter, l),
      { t: 'space', h: 8 },
      ...letterBody(input.letter, l, 'justify', { subject: true }),
    ];
    return doc(input, m, nodes);
  },
};

const executive: LetterTemplateDef = {
  id: 'letter-executive',
  name: 'Executive',
  description: 'Centred serif letterhead with a fine double rule.',
  compose(input) {
    const { l: l0, m } = base(input, 'times');
    const l = { ...l0, size: l0.size + 0.5 };
    const p = input.profile;
    const contact = contactItems(p);
    const nodes: FlowNode[] = [
      { t: 'text', runs: [{ text: p.name || 'Your Name' }], style: st(l, { font: 'times', size: l.size + 9, uppercase: true, tracking: 1.2, lineHeight: 1.1 }), align: 'center', role: 'title', ref: 'letter:sender' },
      ...(p.headline ? [{ t: 'text' as const, runs: [{ text: p.headline }], style: st(l, { size: l.size - 1.5, uppercase: true, tracking: 0.8, color: l.accent }), align: 'center' as const, before: 2 }] : []),
      { t: 'rule', color: l.accent, weight: 0.5, before: 4, after: 0.8, length: 0.55, align: 'center' },
      { t: 'rule', color: l.accent, weight: 0.2, after: 2.4, length: 0.55, align: 'center' },
      ...(contact.length ? [{ t: 'text' as const, runs: joined(contact, '   ·   ', l), style: st(l, { size: l.size - 1.6, color: l.muted }), align: 'center' as const }] : []),
      { t: 'space', h: 14 },
      ...dateNode(input.letter, l),
      { t: 'space', h: 5 },
      ...recipientBlock(input.letter, l),
      { t: 'space', h: 8 },
      ...letterBody(input.letter, l, 'justify', { subject: true }),
    ];
    return doc(input, m, nodes);
  },
};

const creative: LetterTemplateDef = {
  id: 'letter-creative',
  name: 'Creative',
  description: 'Colour edge, optional photo and a confident header.',
  compose(input) {
    const { l, m: m0 } = base(input, 'helvetica');
    const strip = 9;
    const m = { ...m0, margin: { ...m0.margin, left: m0.margin.left + strip * 0.6 } };
    const width = m.pageW - m.margin.left - m.margin.right;
    const p = input.profile;
    const contact = contactItems(p);
    const text: FlowNode[] = [
      { t: 'text', runs: [{ text: p.name || 'Your Name' }], style: st(l, { size: l.size + 12, bold: true, color: l.accent, lineHeight: 1.02 }), role: 'title' },
      ...(p.headline ? [{ t: 'text' as const, runs: [{ text: p.headline }], style: st(l, { size: l.size + 1.5, color: '#1c1917' }), before: 2 }] : []),
      ...(contact.length ? [{ t: 'text' as const, runs: joined(contact, '  ·  ', l), style: st(l, { size: l.size - 1.2, color: l.muted, lineHeight: 1.45 }), before: 2.4 }] : []),
    ];
    const photo = input.photo ? input.photo.replace(/:[\w-]+$/, ':circle') : null;
    const header: FlowNode = photo ? { t: 'row', gap: 6, ref: 'letter:sender', cols: [{ width: 29 / (width - 6), nodes: [{ t: 'image', src: photo, width: 28, height: 28, alt: 'Profile photo' }] }, { nodes: text, vAlign: 'middle' }] } : { t: 'group', keep: 'together', nodes: text, ref: 'letter:sender' };
    const nodes: FlowNode[] = [
      header,
      { t: 'space', h: 12 },
      { t: 'row', gap: 6, cols: [{ nodes: recipientBlock(input.letter, l) }, { width: 0.35, align: 'right', nodes: dateNode(input.letter, l, 'right') }] },
      { t: 'space', h: 8 },
      ...(input.letter.role.trim() ? [{ t: 'text' as const, runs: [{ text: input.letter.role.trim() }], style: st(l, { size: l.size - 0.5, bold: true, color: l.accent, uppercase: true, tracking: 0.5 }), after: 5, ref: 'letter:role' }] : []),
      ...letterBody(input.letter, l, 'left', { signatureFont: 'helvetica' }),
    ];
    const decorations: Decoration[] = [
      { k: 'rect', x: 0, y: 0, w: strip, h: m.pageH, fill: l.accent, pages: 'all' },
      { k: 'rect', x: strip, y: 0, w: 2, h: m.pageH, fill: mix(l.accent, '#ffffff', 0.6), pages: 'all' },
    ];
    return { ...doc(input, m, nodes, { decorations }), columns: [{ id: 'main', x: m.margin.left, width, nodes }] };
  },
};

export const LETTER_TEMPLATES: LetterTemplateDef[] = [minimal, professional, executive, creative];

export function getLetterTemplate(id: string): LetterTemplateDef {
  return LETTER_TEMPLATES.find((t) => t.id === id) ?? professional;
}
