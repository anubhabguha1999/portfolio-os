/**
 * DocModel → jsPDF with real vector text.
 *
 * Layout works in two steps: every block is converted into a stream of unbreakable
 * "pieces" (a line of text, an entry header, an image, a table row…) that know their
 * height and how to draw themselves. A paginator then flows the pieces onto pages,
 * honouring keep-with-next chains (headings, entry headers, orphan/widow control) and
 * explicit page breaks. Header, footer and page numbers are stamped afterwards when the
 * total page count is known.
 */
import { jsPDF } from 'jspdf';
import type { DocBlock, DocModel, DocRun } from '@/types/document';
import type { RasterImage } from '@/lib/export/assets';
import { BRAND } from '@/config/brand';
import { pdfText } from './text';
import type { DocTemplate, ImageMap, PdfRenderOptions } from './types';

const PT = 25.4 / 72; // 1pt in mm
const PX = 25.4 / 96; // 1 CSS px in mm

type FontFamily = 'helvetica' | 'times' | 'courier';

interface TStyle {
  font: FontFamily;
  bold: boolean;
  italic: boolean;
  size: number; // pt
  color: string;
  underline: boolean;
}

interface Seg {
  text: string;
  style: TStyle;
  link: string | undefined;
  x: number;
  w: number;
}

interface Line {
  segs: Seg[];
  width: number;
  size: number;
}

interface Piece {
  h: number;
  before: number;
  draw?: (y: number) => void;
  /** Keep on the same page as the following piece. */
  keep?: boolean;
  /** Re-drawn at the top of a page when this piece starts a new page (table header). */
  header?: Piece;
  brk?: boolean;
}

interface Look {
  font: FontFamily;
  text: string;
  muted: string;
  accent: string;
  border: string;
  tint: string;
  link: string;
  linkUnderline: boolean;
  headerAlign: 'left' | 'center';
  sectionUpper: boolean;
  sectionRule: boolean;
  sectionColor: string;
  subtitleColor: string;
  chips: boolean;
  images: boolean;
  sizes: { name: number; headline: number; contact: number; body: number; small: number; lead: number; section: number; h1: number; h2: number; h3: number; entry: number; meta: number };
  lh: number;
}

export const PAGE_SIZES: Record<'a4' | 'letter' | 'a3', [number, number]> = {
  a4: [210, 297],
  letter: [215.9, 279.4],
  a3: [297, 420],
};

export function pageDimensions(o: Pick<PdfRenderOptions, 'pageSize' | 'customSize' | 'orientation'>): { width: number; height: number } {
  let [w, h] =
    o.pageSize === 'custom'
      ? [clamp(o.customSize.width || 210, 50, 1200), clamp(o.customSize.height || 297, 50, 1200)]
      : PAGE_SIZES[o.pageSize];
  const landscape = o.orientation === 'landscape';
  if ((landscape && h > w) || (!landscape && w > h)) [w, h] = [h, w];
  return { width: w, height: h };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [17, 24, 39];
  const h = m[1]!.length === 3 ? m[1]!.split('').map((c) => c + c).join('') : m[1]!;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function mix(hex: string, withHex: string, t: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(withHex);
  const c = a.map((v, i) => Math.round(v * (1 - t) + (b[i] ?? 0) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function safeColor(hex: string, fallback: string): string {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex.trim()) ? hex.trim() : fallback;
}

function lookFor(doc: DocModel, template: DocTemplate, s: number, includeImages: boolean): Look {
  const text = safeColor(doc.theme.text, '#111827');
  const muted = safeColor(doc.theme.muted, '#4b5563');
  const border = safeColor(doc.theme.border, '#d1d5db');
  const accent = safeColor(doc.theme.primary, '#1f2937');
  const base = {
    text,
    muted,
    border,
    lh: 1.36,
    sizes: { name: 24, headline: 12, contact: 9, body: 10, small: 8.5, lead: 11.5, section: 12.5, h1: 12, h2: 11, h3: 10.2, entry: 10.6, meta: 9 },
  };
  const scaleSizes = (sz: Look['sizes']): Look['sizes'] => {
    const out = { ...sz };
    for (const k of Object.keys(out) as Array<keyof Look['sizes']>) out[k] = Math.round(out[k] * s * 100) / 100;
    return out;
  };
  switch (template) {
    case 'classic':
      return {
        ...base,
        font: 'times',
        accent: text,
        tint: '#f3f4f6',
        link: text,
        linkUnderline: true,
        headerAlign: 'center',
        sectionUpper: true,
        sectionRule: true,
        sectionColor: text,
        subtitleColor: text,
        chips: false,
        images: includeImages,
        sizes: scaleSizes({ ...base.sizes, name: 22, section: 11.5, body: 10.5, entry: 11, meta: 9.5 }),
      };
    case 'ats':
      return {
        ...base,
        font: 'helvetica',
        text: '#000000',
        muted: '#333333',
        border: '#000000',
        accent: '#000000',
        tint: '#f2f2f2',
        link: '#000000',
        linkUnderline: false,
        headerAlign: 'left',
        sectionUpper: true,
        sectionRule: false,
        sectionColor: '#000000',
        subtitleColor: '#000000',
        chips: false,
        images: false,
        sizes: scaleSizes({ ...base.sizes, name: 18, headline: 11, section: 11.5 }),
      };
    case 'modern':
      return {
        ...base,
        font: 'helvetica',
        accent,
        tint: mix(accent, '#ffffff', 0.9),
        link: accent,
        linkUnderline: false,
        headerAlign: 'left',
        sectionUpper: true,
        sectionRule: true,
        sectionColor: accent,
        subtitleColor: accent,
        chips: false,
        images: includeImages,
        sizes: scaleSizes(base.sizes),
      };
    case 'portfolio':
    default:
      return {
        ...base,
        font: doc.theme.font,
        accent,
        tint: mix(accent, '#ffffff', 0.9),
        link: accent,
        linkUnderline: false,
        headerAlign: 'left',
        sectionUpper: false,
        sectionRule: true,
        sectionColor: accent,
        subtitleColor: accent,
        chips: true,
        images: includeImages,
        sizes: scaleSizes({ ...base.sizes, name: 26, section: 15, body: 10.2, lead: 12 }),
      };
  }
}

function safeLink(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const u = url.trim();
  if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
  if (/^[\w-]+\.[\w.-]+(\/|$)/.test(u)) return `https://${u}`;
  return undefined;
}

function displayUrl(url: string): string {
  return url.replace(/^mailto:/i, '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
}

/** Render a DocModel at typography scale `s`. */
export function renderPdfDocument(model: DocModel, images: ImageMap, o: PdfRenderOptions, s = 1): jsPDF {
  const { width: pageW, height: pageH } = pageDimensions(o);
  const doc = new jsPDF({ unit: 'mm', format: [pageW, pageH], orientation: pageW > pageH ? 'landscape' : 'portrait', compress: o.compress, putOnlyUsedFonts: true, floatPrecision: 3 });
  doc.setProperties({
    title: pdfText(model.title),
    subject: pdfText(model.subject),
    author: pdfText(model.author),
    keywords: pdfText(model.keywords.join(', ')),
    creator: BRAND.generator,
  });

  const look = lookFor(model, o.template, s, o.includeImages);
  const margin = clamp(o.margins || 18, 5, Math.min(pageW, pageH) / 3);
  const hasHeader = !!o.headerText.trim();
  const hasFooter = !!o.footerText.trim() || o.pageNumbers;
  const band = 8;
  const top = margin + (hasHeader ? band : 0);
  const bottom = pageH - margin - (hasFooter ? band : 0);
  const x0 = margin;
  const W = pageW - margin * 2;
  const contentH = bottom - top;

  /* ------------------------------ text ------------------------------ */

  let fontKey = '';
  const apply = (st: TStyle) => {
    const variant = st.bold && st.italic ? 'bolditalic' : st.bold ? 'bold' : st.italic ? 'italic' : 'normal';
    const key = `${st.font}|${variant}|${st.size}`;
    if (key !== fontKey) {
      doc.setFont(st.font, variant);
      doc.setFontSize(st.size);
      fontKey = key;
    }
  };
  const widthCache = new Map<string, number>();
  const measure = (text: string, st: TStyle): number => {
    const key = `${st.font}${st.bold ? 'b' : ''}${st.italic ? 'i' : ''}${st.size}|${text}`;
    const hit = widthCache.get(key);
    if (hit !== undefined) return hit;
    apply(st);
    const w = doc.getTextWidth(text);
    widthCache.set(key, w);
    return w;
  };
  const style = (over: Partial<TStyle> = {}): TStyle => ({ font: look.font, bold: false, italic: false, size: look.sizes.body, color: look.text, underline: false, ...over });
  const lineH = (size: number, factor = look.lh) => size * PT * factor;

  const same = (a: TStyle, b: TStyle) => a.font === b.font && a.bold === b.bold && a.italic === b.italic && a.size === b.size && a.color === b.color && a.underline === b.underline;

  const runStyle = (r: DocRun, base: TStyle, linkLook: boolean): TStyle => {
    const st: TStyle = { ...base, bold: base.bold || !!r.bold, italic: base.italic || !!r.italic };
    if (r.code) {
      st.font = 'courier';
      st.size = Math.round(base.size * 0.92 * 100) / 100;
    }
    if (linkLook && safeLink(r.link)) {
      st.color = look.link;
      st.underline = look.linkUnderline;
    }
    return st;
  };

  const fitChars = (word: string, st: TStyle, avail: number): number => {
    let n = 0;
    while (n < word.length && measure(word.slice(0, n + 1), st) <= avail) n++;
    return n;
  };

  const layout = (runs: DocRun[], base: TStyle, maxW: number, linkLook = true): Line[] => {
    const lines: Line[] = [];
    let cur: Seg[] = [];
    let x = 0;
    let maxSize = base.size;
    let pending = false;
    const flush = () => {
      lines.push({ segs: cur, width: x, size: maxSize });
      cur = [];
      x = 0;
      maxSize = base.size;
      pending = false;
    };
    const add = (word: string, st: TStyle, link: string | undefined) => {
      const sp = pending && cur.length > 0;
      const spaceW = sp ? measure(' ', st) : 0;
      const last = cur[cur.length - 1];
      if (last && same(last.style, st) && last.link === link) {
        last.text += (sp ? ' ' : '') + word;
        last.w = measure(last.text, st);
        x = last.x + last.w;
      } else {
        const w = measure(word, st);
        cur.push({ text: word, style: st, link, x: x + spaceW, w });
        x += spaceW + w;
      }
      maxSize = Math.max(maxSize, st.size);
      pending = false;
    };
    for (const r of runs) {
      const st = runStyle(r, base, linkLook);
      const link = safeLink(r.link);
      for (const part of pdfText(r.text).split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) {
          pending = true;
          continue;
        }
        let word = part;
        const spaceW = pending && cur.length ? measure(' ', st) : 0;
        let w = measure(word, st);
        if (cur.length && pending && x + spaceW + w > maxW) flush();
        while (w > maxW && word.length > 1) {
          const avail = maxW - x - (pending && cur.length ? measure(' ', st) : 0);
          let n = fitChars(word, st, avail);
          if (n === 0) {
            if (cur.length) {
              flush();
              continue;
            }
            n = 1;
          }
          add(word.slice(0, n), st, link);
          flush();
          word = word.slice(n);
          w = measure(word, st);
        }
        if (word) add(word, st, link);
      }
    }
    if (cur.length || !lines.length) flush();
    return lines;
  };

  const drawLine = (line: Line, x: number, y: number, lh: number, maxW: number, align: 'left' | 'center' | 'right' = 'left') => {
    const off = align === 'center' ? (maxW - line.width) / 2 : align === 'right' ? maxW - line.width : 0;
    const fsMm = line.size * PT;
    const baseline = y + (lh - fsMm) / 2 + fsMm * 0.78;
    for (const seg of line.segs) {
      apply(seg.style);
      doc.setTextColor(seg.style.color);
      const sx = x + off + seg.x;
      doc.text(seg.text, sx, baseline);
      if (seg.style.underline) {
        doc.setDrawColor(seg.style.color);
        doc.setLineWidth(0.15);
        doc.line(sx, baseline + 0.6, sx + seg.w, baseline + 0.6);
      }
      if (seg.link) doc.link(sx, y, seg.w, lh, { url: seg.link });
    }
  };

  const textPieces = (runs: DocRun[], st: TStyle, x: number, maxW: number, before: number, opts: { align?: 'left' | 'center'; decorate?: (y: number, lh: number, i: number) => void; keepLast?: boolean } = {}): Piece[] => {
    const lines = layout(runs, st, maxW);
    const n = lines.length;
    return lines.map((ln, i) => {
      const lh = lineH(ln.size);
      return {
        h: lh,
        before: i === 0 ? before : 0,
        keep: (i === 0 && n >= 2) || (i === n - 2 && n >= 3) || (i === n - 1 && !!opts.keepLast),
        draw: (y: number) => {
          opts.decorate?.(y, lh, i);
          drawLine(ln, x, y, lh, maxW, opts.align ?? 'left');
        },
      };
    });
  };

  /* ------------------------------ images ----------------------------- */

  const aliases = new Map<string, string>();
  const drawImage = (src: string, img: RasterImage, x: number, y: number, w: number, h: number) => {
    let alias = aliases.get(src);
    if (!alias) {
      alias = `img${aliases.size + 1}`;
      aliases.set(src, alias);
    }
    doc.addImage(img.data, img.format === 'png' ? 'PNG' : 'JPEG', x, y, w, h, alias, 'FAST');
  };

  const fitBox = (img: RasterImage, maxW: number, maxH: number): { w: number; h: number } => {
    const naturalW = img.width * PX;
    let w = Math.min(maxW, naturalW);
    let h = (w * img.height) / img.width;
    if (h > maxH) {
      h = maxH;
      w = (h * img.width) / img.height;
    }
    return { w, h };
  };

  /* ------------------------------ blocks ----------------------------- */

  const gap = { block: 2.4 * s, entry: 3.4 * s, section: 6 * s, afterHeading: 2 * s, item: 1 * s };

  const headingPiece = (text: string, st: TStyle, x: number, maxW: number, before: number, rule: 'accent' | 'none' | 'text', align: 'left' | 'center' = 'left'): Piece => {
    const lines = layout([{ text }], st, maxW, false);
    const lh = lineH(st.size, 1.2);
    const ruleSpace = rule === 'none' ? 0 : 1.6 * s;
    return {
      h: lines.length * lh + ruleSpace,
      before,
      keep: true,
      draw: (y) => {
        lines.forEach((ln, i) => drawLine(ln, x, y + i * lh, lh, maxW, align));
        if (rule !== 'none') {
          const ry = y + lines.length * lh + 0.6 * s;
          doc.setDrawColor(rule === 'accent' ? look.accent : look.border);
          doc.setLineWidth(rule === 'accent' ? 0.35 : 0.25);
          doc.line(x, ry, x + maxW, ry);
        }
      },
    };
  };

  const blockPieces = (b: DocBlock, x: number, maxW: number, before: number): Piece[] => {
    switch (b.kind) {
      case 'heading': {
        const size = b.level === 1 ? look.sizes.h1 : b.level === 2 ? look.sizes.h2 : look.sizes.h3;
        const color = b.level === 3 && o.template !== 'ats' ? look.accent : look.text;
        return [headingPiece(b.text, style({ size, bold: true, color }), x, maxW, before + (b.level === 3 ? 0 : gap.item), 'none')];
      }
      case 'paragraph': {
        if (!b.runs.some((r) => pdfText(r.text).trim())) return [];
        const st =
          b.tone === 'lead'
            ? style({ size: look.sizes.lead })
            : b.tone === 'muted'
              ? style({ color: look.muted })
              : b.tone === 'small'
                ? style({ size: look.sizes.small, color: look.muted })
                : style();
        return textPieces(b.runs, st, x, maxW, before);
      }
      case 'contact':
        return textPieces(b.items, style({ size: look.sizes.small, color: look.muted }), x, maxW, before);
      case 'list': {
        const indent = 5 * s;
        const out: Piece[] = [];
        b.items.forEach((item, idx) => {
          if (!item.some((r) => pdfText(r.text).trim())) return;
          const st = style();
          const marker = b.ordered ? `${idx + 1}.` : '';
          out.push(
            ...textPieces(item, st, x + indent, maxW - indent, out.length ? gap.item : before, {
              decorate: (y, lh, i) => {
                if (i !== 0) return;
                const fsMm = st.size * PT;
                const baseline = y + (lh - fsMm) / 2 + fsMm * 0.78;
                if (b.ordered) {
                  apply(st);
                  doc.setTextColor(look.muted);
                  doc.text(marker, x + indent - 1.6 * s, baseline, { align: 'right' });
                } else {
                  doc.setFillColor(o.template === 'modern' || o.template === 'portfolio' ? look.accent : look.text);
                  doc.circle(x + indent * 0.42, baseline - fsMm * 0.3, 0.5 * s, 'F');
                }
              },
            }),
          );
        });
        return out;
      }
      case 'image': {
        if (!look.images) return [];
        const img = images[b.src];
        if (!img || !img.width || !img.height) return [];
        const ratio = clamp(b.maxWidthRatio ?? 1, 0.15, 1);
        const box = fitBox(img, maxW * ratio, Math.min(contentH * 0.55, 130));
        const pieces: Piece[] = [{ h: box.h, before: before + 0.6 * s, draw: (y) => drawImage(b.src, img, x, y, box.w, box.h), keep: !!b.caption }];
        if (b.caption) pieces.push(...textPieces([{ text: b.caption, italic: true }], style({ size: look.sizes.small, color: look.muted }), x, maxW, 1.2 * s));
        return pieces;
      }
      case 'table':
        return tablePieces(b.header, b.rows, x, maxW, before);
      case 'entry':
        return entryPieces(b, x, maxW, before);
      case 'tags': {
        const items = b.items.map((t) => t.trim()).filter(Boolean);
        if (!items.length) return [];
        if (!look.chips) {
          const runs: DocRun[] = [...(b.label ? [{ text: `${b.label}: `, bold: true }] : []), { text: items.join(', ') }];
          return textPieces(runs, style(), x, maxW, before);
        }
        return chipPieces(b.label, items, x, maxW, before);
      }
      case 'quote': {
        const inset = 5 * s;
        const pieces = textPieces([{ text: b.text, italic: true }], style({ size: look.sizes.body + 0.5 * s, italic: true }), x + inset, maxW - inset, before + gap.item, {
          decorate: (y, lh) => {
            doc.setFillColor(look.accent);
            doc.rect(x + 0.6, y, 0.8 * s, lh, 'F');
          },
          keepLast: !!b.cite,
        });
        if (b.cite) pieces.push(...textPieces([{ text: `- ${b.cite}` }], style({ size: look.sizes.small, color: look.muted }), x + inset, maxW - inset, 1 * s));
        return pieces;
      }
      case 'divider':
        return [
          {
            h: 4 * s,
            before,
            draw: (y) => {
              doc.setDrawColor(look.border);
              doc.setLineWidth(0.25);
              doc.line(x, y + 2 * s, x + maxW, y + 2 * s);
            },
          },
        ];
      case 'pageBreak':
        return [{ h: 0, before: 0, brk: true }];
      default:
        return [];
    }
  };

  const chipPieces = (label: string | undefined, items: string[], x: number, maxW: number, before: number): Piece[] => {
    const out: Piece[] = [];
    if (label) out.push(...textPieces([{ text: label }], style({ size: look.sizes.small, bold: true, color: look.muted }), x, maxW, before, { keepLast: true }));
    const st = style({ size: look.sizes.small, color: look.text });
    const padX = 2 * s;
    const chipH = 5.2 * s;
    const g = 1.5 * s;
    const rows: Array<Array<{ text: string; x: number; w: number }>> = [];
    let row: Array<{ text: string; x: number; w: number }> = [];
    let cx = 0;
    for (const raw of items) {
      const text = pdfText(raw);
      if (!text) continue;
      const tw = Math.min(measure(text, st), maxW - padX * 2);
      const w = tw + padX * 2;
      if (row.length && cx + w > maxW) {
        rows.push(row);
        row = [];
        cx = 0;
      }
      row.push({ text, x: cx, w });
      cx += w + g;
    }
    if (row.length) rows.push(row);
    rows.forEach((r, i) => {
      out.push({
        h: chipH,
        before: i === 0 ? (label ? 1 * s : before) : g,
        draw: (y) => {
          for (const c of r) {
            doc.setFillColor(look.tint);
            doc.setDrawColor(mix(look.accent, '#ffffff', 0.65));
            doc.setLineWidth(0.2);
            doc.roundedRect(x + c.x, y, c.w, chipH, chipH / 2, chipH / 2, 'FD');
            const line = layout([{ text: c.text }], st, c.w - padX * 2 + 0.01, false)[0];
            if (line) drawLine({ ...line, segs: line.segs.slice(0, 1) }, x + c.x + padX, y, chipH, c.w - padX * 2);
          }
        },
      });
    });
    return out;
  };

  const tablePieces = (header: string[], rows: string[][], x: number, maxW: number, before: number): Piece[] => {
    const cols = Math.max(header.length, ...rows.map((r) => r.length), 1);
    const st = style({ size: look.sizes.small + 0.3 * s });
    const hst = { ...st, bold: true };
    const lengths = Array.from({ length: cols }, (_, c) => Math.max(4, pdfText(header[c] ?? '').length, ...rows.map((r) => Math.min(60, pdfText(r[c] ?? '').length))));
    const total = lengths.reduce((a, b) => a + b, 0);
    const minW = maxW / cols / 2;
    let widths = lengths.map((l) => Math.max(minW, (l / total) * maxW));
    const sum = widths.reduce((a, b) => a + b, 0);
    widths = widths.map((w) => (w / sum) * maxW);
    const pad = 1.6 * s;
    const lh = lineH(st.size, 1.25);
    const rowPiece = (cells: string[], cst: TStyle, fill: boolean): Piece => {
      const laid = widths.map((w, c) => layout([{ text: cells[c] ?? '' }], cst, w - pad * 2));
      const h = Math.max(...laid.map((l) => l.length)) * lh + pad * 2;
      return {
        h,
        before: 0,
        draw: (y) => {
          let cx = x;
          doc.setLineWidth(0.2);
          doc.setDrawColor(look.border);
          laid.forEach((lines, c) => {
            const w = widths[c] ?? 0;
            if (fill) {
              doc.setFillColor(look.tint);
              doc.rect(cx, y, w, h, 'FD');
            } else doc.rect(cx, y, w, h, 'S');
            lines.forEach((ln, i) => drawLine(ln, cx + pad, y + pad + i * lh, lh, w - pad * 2));
            cx += w;
          });
        },
      };
    };
    const hasHeader = header.some((h) => h.trim());
    const head = hasHeader ? rowPiece(header, hst, true) : null;
    const out: Piece[] = [];
    if (head) out.push({ ...head, before: before + 0.6 * s, keep: true });
    rows.forEach((r, i) => {
      const p = rowPiece(r, st, false);
      out.push({ ...p, before: !head && i === 0 ? before + 0.6 * s : 0, ...(head ? { header: head } : {}) });
    });
    return out;
  };

  const entryPieces = (b: Extract<DocBlock, { kind: 'entry' }>, x: number, maxW: number, before: number): Piece[] => {
    const titleSt = style({ size: look.sizes.entry, bold: true });
    const metaSt = style({ size: look.sizes.meta, color: look.muted });
    const subSt = style({ size: look.sizes.body, italic: o.template !== 'ats', color: look.subtitleColor });
    const link = safeLink(b.link);
    const meta = pdfText(b.meta ?? '').trim();
    const loc = pdfText(b.location ?? '').trim();
    const metaW = meta ? measure(meta, metaSt) : 0;
    const locW = loc ? measure(loc, metaSt) : 0;
    const titleLines = layout([{ text: b.title || 'Untitled', ...(link ? { link } : {}) }], titleSt, maxW - (metaW ? metaW + 4 : 0), false);
    const subtitle = pdfText(b.subtitle ?? '').trim();
    const subLines = subtitle ? layout([{ text: subtitle }], subSt, maxW - (locW ? locW + 4 : 0)) : [];
    // Location sits on the subtitle line; without a subtitle it gets its own right-aligned line.
    const locOwnLine = !!loc && !subLines.length;
    const linkSt = style({ size: look.sizes.small, color: look.link, underline: look.linkUnderline });
    const linkLines = link ? layout([{ text: displayUrl(link), link }], linkSt, maxW) : [];
    const lhT = lineH(titleSt.size, 1.25);
    const lhS = lineH(subSt.size, 1.3);
    const lhL = lineH(linkSt.size, 1.3);
    const h = titleLines.length * lhT + (subLines.length || (locOwnLine ? 1 : 0)) * lhS + linkLines.length * lhL;
    const head: Piece = {
      h,
      before,
      draw: (y) => {
        titleLines.forEach((ln, i) => drawLine(ln, x, y + i * lhT, lhT, maxW));
        if (meta) {
          apply(metaSt);
          doc.setTextColor(metaSt.color);
          const fsMm = metaSt.size * PT;
          doc.text(meta, x + maxW, y + (lhT - fsMm) / 2 + fsMm * 0.78 + (titleSt.size - metaSt.size) * PT * 0.2, { align: 'right' });
        }
        let yy = y + titleLines.length * lhT;
        if (subLines.length || locOwnLine) {
          subLines.forEach((ln, i) => drawLine(ln, x, yy + i * lhS, lhS, maxW));
          if (loc) {
            apply(metaSt);
            doc.setTextColor(metaSt.color);
            const fsMm = metaSt.size * PT;
            doc.text(loc, x + maxW, yy + (lhS - fsMm) / 2 + fsMm * 0.78, { align: 'right' });
          }
          yy += Math.max(1, subLines.length) * lhS;
        }
        linkLines.forEach((ln, i) => drawLine(ln, x, yy + i * lhL, lhL, maxW));
      },
    };
    const body: Piece[] = [];
    for (const child of b.body) body.push(...blockPieces(child, x, maxW, body.length ? gap.block * 0.75 : 1.2 * s));
    head.keep = body.length > 0;
    return [head, ...body];
  };

  /* ------------------------------ header ----------------------------- */

  const headerPieces = (): Piece[] => {
    const hd = model.header;
    if (!hd) return [];
    const photo = look.images && hd.photo ? images[hd.photo] : undefined;
    const photoBox = photo ? fitBox(photo, 26 * s, 26 * s) : null;
    const center = look.headerAlign === 'center';
    const textW = photoBox && !center ? W - photoBox.w - 6 : W;
    const nameSt = style({ size: look.sizes.name, bold: true, color: o.template === 'portfolio' ? look.text : look.text });
    const headSt = style({ size: look.sizes.headline, color: o.template === 'classic' ? look.muted : look.accent, italic: o.template === 'classic' });
    const contactSt = style({ size: look.sizes.contact, color: look.muted });
    const nameLines = layout([{ text: hd.name }], nameSt, textW, false);
    const headLines = hd.headline.trim() ? layout([{ text: hd.headline }], headSt, textW) : [];
    const contactLines = hd.contact.length ? layout(hd.contact, contactSt, textW) : [];
    const lhN = lineH(nameSt.size, 1.12);
    const lhH = lineH(headSt.size, 1.3);
    const lhC = lineH(contactSt.size, 1.4);
    const textH = nameLines.length * lhN + (headLines.length ? 1 * s + headLines.length * lhH : 0) + (contactLines.length ? 1.6 * s + contactLines.length * lhC : 0);
    const rule = o.template === 'classic' || o.template === 'ats';
    const h = Math.max(textH, photoBox && !center ? photoBox.h : 0) + (center && photoBox ? photoBox.h + 2 * s : 0) + (rule ? 3.2 * s : 0);
    return [
      {
        h,
        before: 0,
        draw: (y0) => {
          let y = y0;
          const align = center ? 'center' : 'left';
          if (photo && photoBox) {
            if (center) {
              drawImage(hd.photo ?? '', photo, x0 + (W - photoBox.w) / 2, y, photoBox.w, photoBox.h);
              y += photoBox.h + 2 * s;
            } else drawImage(hd.photo ?? '', photo, x0 + W - photoBox.w, y0, photoBox.w, photoBox.h);
          }
          nameLines.forEach((ln, i) => drawLine(ln, x0, y + i * lhN, lhN, textW, align));
          y += nameLines.length * lhN;
          if (headLines.length) {
            y += 1 * s;
            headLines.forEach((ln, i) => drawLine(ln, x0, y + i * lhH, lhH, textW, align));
            y += headLines.length * lhH;
          }
          if (contactLines.length) {
            y += 1.6 * s;
            contactLines.forEach((ln, i) => drawLine(ln, x0, y + i * lhC, lhC, textW, align));
            y += contactLines.length * lhC;
          }
          if (rule) {
            const ry = y0 + h - 1.2 * s;
            doc.setDrawColor(o.template === 'ats' ? '#000000' : look.text);
            doc.setLineWidth(o.template === 'ats' ? 0.3 : 0.4);
            doc.line(x0, ry, x0 + W, ry);
          }
        },
      },
    ];
  };

  /* ------------------------------ assemble --------------------------- */

  const pieces: Piece[] = headerPieces();
  const sectionSt = style({ size: look.sizes.section, bold: true, color: look.sectionColor });
  model.sections.forEach((sec, si) => {
    const content: Piece[] = [];
    for (const b of sec.blocks) content.push(...blockPieces(b, x0, W, content.length ? (b.kind === 'entry' ? gap.entry : gap.block) : sec.title ? gap.afterHeading : gap.block));
    if (!content.length) return;
    if (o.sectionPageBreaks && si > 0 && pieces.length) pieces.push({ h: 0, before: 0, brk: true });
    if (sec.title.trim()) {
      const title = look.sectionUpper ? sec.title.toUpperCase() : sec.title;
      pieces.push(headingPiece(title, sectionSt, x0, W, pieces.length ? gap.section : 0, look.sectionRule ? (o.template === 'classic' ? 'text' : 'accent') : 'none'));
    } else if (content[0]) content[0] = { ...content[0], before: pieces.length ? gap.section * 0.6 : 0 };
    pieces.push(...content);
  });

  /* ------------------------------ paginate --------------------------- */

  let y = top;
  let atTop = true;
  const newPage = () => {
    doc.addPage([pageW, pageH], pageW > pageH ? 'landscape' : 'portrait');
    y = top;
    atTop = true;
  };
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i]!;
    if (p.brk) {
      if (!atTop) newPage();
      continue;
    }
    let before = atTop ? 0 : p.before;
    let chain = before + p.h;
    for (let j = i; pieces[j]?.keep && j + 1 < pieces.length && !pieces[j + 1]!.brk && j - i < 8; j++) chain += pieces[j + 1]!.before + pieces[j + 1]!.h;
    let broke = false;
    if (!atTop && y + chain > bottom + 0.01 && chain - before <= contentH) {
      newPage();
      broke = true;
    } else if (!atTop && y + before + p.h > bottom + 0.01) {
      newPage();
      broke = true;
    }
    if (broke) {
      before = 0;
      if (p.header) {
        p.header.draw?.(y);
        y += p.header.h;
      }
    }
    y += before;
    p.draw?.(y);
    y += p.h;
    atTop = false;
  }

  /* ------------------------ header / footer stamp -------------------- */

  const total = doc.getNumberOfPages();
  if (hasHeader || hasFooter) {
    const small = style({ size: 8, color: look.muted });
    for (let n = 1; n <= total; n++) {
      doc.setPage(n);
      apply(small);
      doc.setTextColor(small.color);
      if (hasHeader) {
        const line = layout([{ text: o.headerText.trim() }], small, W)[0];
        if (line) drawLine(line, x0, margin, lineH(8), W);
        doc.setDrawColor(look.border);
        doc.setLineWidth(0.2);
        doc.line(x0, margin + band - 2.5, x0 + W, margin + band - 2.5);
      }
      if (hasFooter) {
        const fy = pageH - margin - lineH(8);
        const label = o.pageNumbers ? `Page ${n} of ${total}` : '';
        const labelW = label ? measure(label, small) + 4 : 0;
        const footer = o.footerText.trim();
        if (footer) {
          const line = layout([{ text: footer }], small, W - labelW)[0];
          if (line) drawLine(line, x0, fy, lineH(8), W - labelW, label ? 'left' : 'center');
        }
        if (label) {
          apply(small);
          doc.setTextColor(small.color);
          const fsMm = 8 * PT;
          doc.text(label, footer ? x0 + W : x0 + W / 2, fy + (lineH(8) - fsMm) / 2 + fsMm * 0.78, { align: footer ? 'right' : 'center' });
        }
      }
    }
    doc.setPage(total);
  }
  return doc;
}
