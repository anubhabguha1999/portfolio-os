/**
 * DocModel → editable Word document (docx). Real styles (Title, Heading 1–3), real list
 * numbering, hyperlinks, images and tables — never a picture of the page.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  Tab,
  TabStopType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  ShadingType,
  WidthType,
  type ParagraphChild,
} from 'docx';
import type { DocBlock, DocModel, DocRun } from '@/types/document';
import type { RasterImage } from '@/lib/export/assets';
import { BRAND } from '@/config/brand';
import type { DocTemplate } from '@/lib/pdf/types';

export interface DocxRenderOptions {
  template: DocTemplate;
  includeImages: boolean;
  pageNumbers: boolean;
  headerText?: string;
}

type ImageMap = Record<string, RasterImage>;

const PAGE_W = 11906; // A4 in twips
const PAGE_H = 16838;
const MARGIN = 1080; // 0.75in
const CONTENT_TWIPS = PAGE_W - MARGIN * 2;
const CONTENT_PX = Math.floor(CONTENT_TWIPS / 15);

function hex(color: string, fallback: string): string {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(color.trim());
  if (!m) return fallback;
  const h = m[1]!;
  return (h.length === 3 ? h.split('').map((c) => c + c).join('') : h).toUpperCase();
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

/** Word dislikes control characters; keep everything else (docx is fully Unicode). */
function clean(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/[\r\n\t]+/g, ' ');
}

interface Palette {
  font: string;
  text: string;
  muted: string;
  accent: string;
  border: string;
  tint: string;
  ats: boolean;
  images: boolean;
  centerHeader: boolean;
}

function paletteFor(model: DocModel, o: DocxRenderOptions): Palette {
  const text = hex(model.theme.text, '111827');
  const muted = hex(model.theme.muted, '4B5563');
  const accent = hex(model.theme.primary, '1F2937');
  const border = hex(model.theme.border, 'D1D5DB');
  const themeFont = model.theme.font === 'times' ? 'Georgia' : model.theme.font === 'courier' ? 'Consolas' : 'Calibri';
  switch (o.template) {
    case 'ats':
      return { font: 'Arial', text: '000000', muted: '333333', accent: '000000', border: '000000', tint: 'F2F2F2', ats: true, images: false, centerHeader: false };
    case 'classic':
      return { font: 'Georgia', text, muted, accent: text, border: '6B7280', tint: 'F3F4F6', ats: false, images: o.includeImages, centerHeader: true };
    case 'modern':
      return { font: 'Calibri', text, muted, accent, border, tint: 'F3F4F6', ats: false, images: o.includeImages, centerHeader: false };
    default:
      return { font: themeFont, text, muted, accent, border, tint: 'F3F4F6', ats: false, images: o.includeImages, centerHeader: false };
  }
}

export function renderDocxDocument(model: DocModel, images: ImageMap, o: DocxRenderOptions): Document {
  const pal = paletteFor(model, o);
  let listInstance = 0;

  const runsToChildren = (runs: DocRun[], base: { size?: number; color?: string; italics?: boolean; bold?: boolean } = {}): ParagraphChild[] =>
    runs
      .filter((r) => r.text)
      .map((r) => {
        const opts = {
          text: clean(r.text),
          bold: base.bold || !!r.bold,
          italics: base.italics || !!r.italic,
          ...(r.code ? { font: 'Consolas' } : {}),
          ...(base.size ? { size: base.size } : {}),
          ...(base.color ? { color: base.color } : {}),
        };
        const link = safeLink(r.link);
        if (link) return new ExternalHyperlink({ link, children: [new TextRun({ ...opts, style: 'Hyperlink' })] });
        return new TextRun(opts);
      });

  const imageParagraph = (src: string, alt: string, ratio = 1, maxPx = CONTENT_PX, alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT): Paragraph | null => {
    if (!pal.images) return null;
    const img = images[src];
    if (!img || !img.width || !img.height) return null;
    let width = Math.min(img.width, Math.round(maxPx * Math.min(1, Math.max(0.15, ratio))));
    let height = Math.round((width * img.height) / img.width);
    const maxH = 520;
    if (height > maxH) {
      height = maxH;
      width = Math.round((height * img.width) / img.height);
    }
    return new Paragraph({
      alignment,
      spacing: { before: 80, after: 80 },
      children: [
        new ImageRun({
          type: img.format === 'png' ? 'png' : 'jpg',
          data: img.data,
          transformation: { width, height },
          altText: { name: alt || 'Image', description: alt || 'Image', title: alt || 'Image' },
        }),
      ],
    });
  };

  const blockToChildren = (b: DocBlock): Array<Paragraph | Table> => {
    switch (b.kind) {
      case 'heading':
        return [new Paragraph({ heading: b.level === 1 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3, children: [new TextRun(clean(b.text))] })];
      case 'paragraph': {
        const children = runsToChildren(b.runs, b.tone === 'lead' ? { size: 24 } : b.tone === 'muted' ? { color: pal.muted } : b.tone === 'small' ? { size: 18, color: pal.muted } : {});
        return children.length ? [new Paragraph({ children })] : [];
      }
      case 'contact':
        return [new Paragraph({ children: runsToChildren(b.items, { size: 18, color: pal.muted }) })];
      case 'list': {
        const instance = ++listInstance;
        return b.items
          .filter((item) => item.some((r) => r.text.trim()))
          .map(
            (item) =>
              new Paragraph({
                numbering: b.ordered ? { reference: 'pos-numbers', level: 0, instance } : { reference: 'pos-bullets', level: 0 },
                spacing: { after: 40 },
                children: runsToChildren(item),
              }),
          );
      }
      case 'image': {
        const para = imageParagraph(b.src, b.alt, b.maxWidthRatio ?? 1);
        if (!para) return [];
        return b.caption ? [para, new Paragraph({ children: [new TextRun({ text: clean(b.caption), italics: true, size: 18, color: pal.muted })] })] : [para];
      }
      case 'table': {
        const cols = Math.max(b.header.length, ...b.rows.map((r) => r.length), 1);
        const border = { style: BorderStyle.SINGLE, size: 4, color: pal.border };
        const cell = (text: string, header: boolean) =>
          new TableCell({
            ...(header ? { shading: { type: ShadingType.CLEAR, color: 'auto', fill: pal.tint } } : {}),
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: clean(text), bold: header, size: 19 })] })],
          });
        const pad = (r: string[]) => Array.from({ length: cols }, (_, i) => r[i] ?? '');
        const rows: TableRow[] = [];
        if (b.header.some((h) => h.trim())) rows.push(new TableRow({ tableHeader: true, cantSplit: true, children: pad(b.header).map((h) => cell(h, true)) }));
        for (const r of b.rows) rows.push(new TableRow({ cantSplit: true, children: pad(r).map((c) => cell(c, false)) }));
        if (!rows.length) return [];
        return [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
            rows,
          }),
          new Paragraph({ spacing: { after: 60 }, children: [] }),
        ];
      }
      case 'entry': {
        const out: Array<Paragraph | Table> = [];
        const link = safeLink(b.link);
        const tabs = [{ type: TabStopType.RIGHT, position: CONTENT_TWIPS }];
        const title = new TextRun({ text: clean(b.title || 'Untitled'), bold: true, size: 22 });
        const hasSub = !!(b.subtitle?.trim() || b.location?.trim());
        out.push(
          new Paragraph({
            keepNext: true,
            keepLines: true,
            tabStops: tabs,
            spacing: { before: 160, after: hasSub ? 0 : 40 },
            children: [link ? new ExternalHyperlink({ link, children: [title] }) : title, ...(b.meta?.trim() ? [new TextRun({ children: [new Tab(), clean(b.meta)], size: 18, color: pal.muted })] : [])],
          }),
        );
        if (hasSub) {
          out.push(
            new Paragraph({
              keepNext: true,
              tabStops: tabs,
              spacing: { after: 40 },
              children: [
                ...(b.subtitle?.trim() ? [new TextRun({ text: clean(b.subtitle), italics: !pal.ats, color: pal.ats ? pal.text : pal.accent })] : []),
                ...(b.location?.trim() ? [new TextRun({ children: [new Tab(), clean(b.location)], size: 18, color: pal.muted })] : []),
              ],
            }),
          );
        }
        if (link) out.push(new Paragraph({ keepNext: b.body.length > 0, spacing: { after: 40 }, children: [new ExternalHyperlink({ link, children: [new TextRun({ text: displayUrl(link), style: 'Hyperlink', size: 18 })] })] }));
        for (const child of b.body) out.push(...blockToChildren(child));
        return out;
      }
      case 'tags': {
        const items = b.items.map((t) => t.trim()).filter(Boolean);
        if (!items.length) return [];
        return [new Paragraph({ children: [...(b.label ? [new TextRun({ text: `${clean(b.label)}: `, bold: true })] : []), new TextRun(clean(items.join(', ')))] })];
      }
      case 'quote':
        return [
          new Paragraph({
            indent: { left: 567 },
            border: { left: { style: BorderStyle.SINGLE, size: 18, color: pal.accent, space: 10 } },
            spacing: { before: 80, after: b.cite ? 20 : 120 },
            children: [new TextRun({ text: clean(b.text), italics: true })],
          }),
          ...(b.cite ? [new Paragraph({ indent: { left: 567 }, spacing: { after: 120 }, children: [new TextRun({ text: `— ${clean(b.cite)}`, size: 18, color: pal.muted })] })] : []),
        ];
      case 'divider':
        return [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: pal.border, space: 4 } }, children: [] })];
      case 'pageBreak':
        return [new Paragraph({ children: [new PageBreak()] })];
      default:
        return [];
    }
  };

  const body: Array<Paragraph | Table> = [];
  const hd = model.header;
  if (hd) {
    const align = pal.centerHeader ? AlignmentType.CENTER : AlignmentType.LEFT;
    if (hd.photo) {
      const photo = imageParagraph(hd.photo, hd.name, 1, 110, align);
      if (photo) body.push(photo);
    }
    body.push(new Paragraph({ heading: HeadingLevel.TITLE, alignment: align, children: [new TextRun(clean(hd.name))] }));
    if (hd.headline.trim()) body.push(new Paragraph({ alignment: align, spacing: { after: 60 }, children: [new TextRun({ text: clean(hd.headline), size: 24, color: pal.ats ? pal.text : pal.accent, italics: pal.centerHeader })] }));
    if (hd.contact.length)
      body.push(
        new Paragraph({
          alignment: align,
          spacing: { after: 120 },
          ...(pal.centerHeader || pal.ats ? { border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: pal.ats ? '000000' : pal.text, space: 6 } } } : {}),
          children: runsToChildren(hd.contact, { size: 18, color: pal.muted }),
        }),
      );
  }
  for (const sec of model.sections) {
    const content = sec.blocks.flatMap(blockToChildren);
    if (!content.length) continue;
    if (sec.title.trim()) body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(clean(pal.ats || o.template === 'classic' || o.template === 'modern' ? sec.title.toUpperCase() : sec.title))] }));
    body.push(...content);
  }
  if (!body.length) body.push(new Paragraph({ children: [] }));

  const footer = o.pageNumbers
    ? {
        default: new Footer({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], size: 16, color: pal.muted })] })],
        }),
      }
    : undefined;
  const headerText = o.headerText?.trim();
  const header = headerText ? { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: clean(headerText), size: 16, color: pal.muted })] })] }) } : undefined;

  const headingRule = pal.ats ? undefined : { bottom: { style: BorderStyle.SINGLE, size: 6, color: pal.accent, space: 2 } };

  return new Document({
    creator: model.author || BRAND.generator,
    lastModifiedBy: BRAND.generator,
    title: model.title,
    subject: model.subject,
    description: model.subject || model.title,
    keywords: model.keywords.join(', '),
    styles: {
      default: {
        document: { run: { font: pal.font, size: 21, color: pal.text }, paragraph: { spacing: { after: 100, line: 276 } } },
        title: { run: { font: pal.font, size: pal.ats ? 36 : 48, bold: true, color: pal.text }, paragraph: { spacing: { after: 40 } } },
        heading1: {
          run: { font: pal.font, size: 25, bold: true, color: pal.ats ? '000000' : pal.accent },
          paragraph: { spacing: { before: 300, after: 100 }, keepNext: true, keepLines: true, ...(headingRule ? { border: headingRule } : {}) },
        },
        heading2: { run: { font: pal.font, size: 23, bold: true, color: pal.text }, paragraph: { spacing: { before: 200, after: 80 }, keepNext: true, keepLines: true } },
        heading3: { run: { font: pal.font, size: 21, bold: true, color: pal.ats ? pal.text : pal.accent }, paragraph: { spacing: { before: 160, after: 60 }, keepNext: true, keepLines: true } },
        hyperlink: { run: { color: pal.ats ? '000000' : pal.accent, underline: { type: 'single' } } },
      },
    },
    numbering: {
      config: [
        {
          reference: 'pos-bullets',
          levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }],
        },
        {
          reference: 'pos-numbers',
          levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400, hanging: 280 } } } }],
        },
      ],
    },
    sections: [
      {
        properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
        ...(header ? { headers: header } : {}),
        ...(footer ? { footers: footer } : {}),
        children: body,
      },
    ],
  });
}

export async function renderDocx(model: DocModel, images: ImageMap, o: DocxRenderOptions): Promise<ArrayBuffer> {
  return Packer.toArrayBuffer(renderDocxDocument(model, images, o));
}
