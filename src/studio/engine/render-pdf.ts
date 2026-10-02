/**
 * LaidDocument → PDF. Real vector text (selectable, searchable), link annotations,
 * embedded images and document metadata — never a screenshot.
 */
import { jsPDF } from 'jspdf';
import type { LaidDocument, Prim } from './flow';
import type { RasterImage } from '@/lib/export/assets';
import { variantOf } from './measure';
import { ICON_STROKE, vectorIcon } from './icons';
import { EMBED_NS } from '@/studio/export/embedded';

export type RasterMap = Record<string, RasterImage>;

export interface PdfOutputOptions {
  compress?: boolean;
  /** Draw link annotations (the text itself is always kept). */
  links?: boolean;
  /** Embed title/author/keywords. */
  metadata?: boolean;
}

export function renderLaidPdf(laid: LaidDocument, images: RasterMap, o: PdfOutputOptions = {}): jsPDF {
  const { width, height } = laid;
  const doc = new jsPDF({ unit: 'mm', format: [width, height], orientation: width > height ? 'landscape' : 'portrait', compress: o.compress ?? true, putOnlyUsedFonts: true, floatPrecision: 3 });
  if (o.metadata !== false) {
    doc.setProperties({
      title: laid.meta.title,
      subject: laid.meta.subject,
      author: laid.meta.author,
      keywords: laid.meta.keywords.join(', '),
      creator: laid.meta.creator,
    });
    // A copy of the printed content, so this PDF imports back exactly (see export/embedded.ts).
    if (laid.data) doc.addMetadata(laid.data, EMBED_NS);
    try {
      doc.setLanguage((laid.meta.lang || 'en-US') as Parameters<typeof doc.setLanguage>[0]);
    } catch {
      /* optional */
    }
  }
  const aliases = new Map<string, string>();
  let fontKey = '';
  const draw = (p: Prim) => {
    switch (p.k) {
      case 'text': {
        const key = `${p.font}|${variantOf(p.bold, p.italic)}|${p.size}`;
        if (key !== fontKey) {
          doc.setFont(p.font, variantOf(p.bold, p.italic));
          doc.setFontSize(p.size);
          fontKey = key;
        }
        doc.setTextColor(p.color);
        doc.text(p.text, p.x, p.y, { ...(p.tracking ? { charSpace: p.tracking } : {}), ...(p.invisible ? { renderingMode: 'invisible' as const } : {}) });
        if (p.underline) {
          doc.setDrawColor(p.color);
          doc.setLineWidth(Math.max(0.12, p.size * 0.012));
          doc.line(p.x, p.y + p.size * 0.06, p.x + p.w, p.y + p.size * 0.06);
        }
        break;
      }
      case 'rect': {
        if (p.fill) doc.setFillColor(p.fill);
        if (p.stroke) {
          doc.setDrawColor(p.stroke);
          doc.setLineWidth(p.lw ?? 0.25);
        }
        const style = p.fill && p.stroke ? 'FD' : p.fill ? 'F' : 'S';
        if (!p.fill && !p.stroke) break;
        if (p.r) doc.roundedRect(p.x, p.y, p.w, p.h, Math.min(p.r, p.w / 2, p.h / 2), Math.min(p.r, p.w / 2, p.h / 2), style);
        else doc.rect(p.x, p.y, p.w, p.h, style);
        break;
      }
      case 'line':
        doc.setDrawColor(p.color);
        doc.setLineWidth(p.lw);
        if (p.dash) doc.setLineDashPattern(p.dash, 0);
        doc.line(p.x1, p.y1, p.x2, p.y2);
        if (p.dash) doc.setLineDashPattern([], 0);
        break;
      case 'circle': {
        if (p.fill) doc.setFillColor(p.fill);
        if (p.stroke) {
          doc.setDrawColor(p.stroke);
          doc.setLineWidth(p.lw ?? 0.25);
        }
        doc.circle(p.cx, p.cy, p.r, p.fill && p.stroke ? 'FD' : p.fill ? 'F' : 'S');
        break;
      }
      case 'image': {
        const img = images[p.src];
        if (!img || !img.data.byteLength) break;
        let alias = aliases.get(p.src);
        if (!alias) {
          alias = `im${aliases.size + 1}`;
          aliases.set(p.src, alias);
        }
        doc.addImage(img.data, img.format === 'png' ? 'PNG' : 'JPEG', p.x, p.y, p.w, p.h, alias, 'SLOW');
        break;
      }
      case 'link':
        if (o.links !== false) doc.link(p.x, p.y, p.w, p.h, { url: p.url });
        break;
      case 'icon': {
        // Real vector paths, scaled from the icon's 24-unit grid.
        const icon = vectorIcon(p.name);
        const k = p.size / 24;
        const X = (v: number) => p.x + v * k;
        const Y = (v: number) => p.y + v * k;
        if (icon.filled) doc.setFillColor(p.color);
        else {
          doc.setDrawColor(p.color);
          doc.setLineWidth(ICON_STROKE * k);
          doc.setLineCap('round');
          doc.setLineJoin('round');
        }
        for (const shape of icon.shapes) {
          for (const c of shape) {
            if (c.op === 'M') doc.moveTo(X(c.x), Y(c.y));
            else if (c.op === 'L') doc.lineTo(X(c.x), Y(c.y));
            else if (c.op === 'C') doc.curveTo(X(c.x1), Y(c.y1), X(c.x2), Y(c.y2), X(c.x), Y(c.y));
            else doc.close();
          }
          if (icon.filled) doc.fill();
          else doc.stroke();
        }
        if (!icon.filled) {
          doc.setLineCap('butt');
          doc.setLineJoin('miter');
        }
        break;
      }
    }
  };
  laid.pages.forEach((page, i) => {
    if (i > 0) doc.addPage([width, height], width > height ? 'landscape' : 'portrait');
    if (laid.background) {
      doc.setFillColor(laid.background);
      doc.rect(0, 0, width, height, 'F');
    }
    fontKey = '';
    for (const p of page.prims) draw(p);
  });
  return doc;
}

export function laidPdfBytes(laid: LaidDocument, images: RasterMap, o: PdfOutputOptions = {}): ArrayBuffer {
  return renderLaidPdf(laid, images, o).output('arraybuffer');
}
