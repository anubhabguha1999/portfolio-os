/**
 * FlowDoc → editable Word document. The same composition the PDF uses, re-expressed
 * with Word's own primitives: Title/Heading styles, real bullet and number lists,
 * right-aligned tab stops for "title … date" rows, shaded table cells for sidebars and
 * callouts, hyperlinks, images, page-number fields and core document properties.
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
  ShadingType,
  Tab,
  TabStopType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type IParagraphOptions,
  type ParagraphChild,
} from 'docx';
import type { FlowDoc, FlowNode, FontFamily, PageFurniture, Run, TextNode, TextStyle } from './flow';
import type { RasterMap } from './render-pdf';
import { PT } from './measure';

const TW = 1440 / 25.4; // twips per mm
const tw = (mm: number) => Math.max(0, Math.round(mm * TW));
const PX = 96 / 25.4; // px per mm (docx image transformation units)

const FONT: Record<FontFamily, string> = { helvetica: 'Arial', times: 'Times New Roman', courier: 'Courier New' };

function hex(c: string | undefined, fallback = '111111'): string {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec((c ?? '').trim());
  if (!m) return fallback;
  const h = m[1]!;
  return (h.length === 3 ? h.split('').map((x) => x + x).join('') : h).toUpperCase();
}

function clean(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/[\r\n\t]+/g, ' ');
}

function safeLink(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const u = url.trim();
  if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
  if (/^[\w-]+\.[\w.-]+(\/|$)/.test(u)) return `https://${u}`;
  return undefined;
}

type Block = Paragraph | Table;

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER };

export interface DocxOutputOptions {
  images: RasterMap;
  includeImages?: boolean;
}

export function renderFlowDocxDocument(flow: FlowDoc, o: DocxOutputOptions): Document {
  const lists = new Map<string, number>();
  let listSeq = 0;
  const { margin } = flow.page;
  const contentW = flow.page.width - margin.left - margin.right;
  // Right-to-left documents: bidi paragraphs and runs. Word lays bidi paragraphs out from the
  // right, so start-aligned (no explicit left/right) is the natural reading edge.
  const rtl = flow.dir === 'rtl';

  const runs = (rs: Run[], st: TextStyle): ParagraphChild[] =>
    rs
      .filter((r) => r.text)
      .map((r) => {
        const opts = {
          text: clean(r.text),
          bold: r.bold ?? st.bold ?? false,
          italics: r.italic ?? st.italic ?? false,
          size: Math.round((r.size ?? st.size) * 2),
          color: hex(r.color ?? st.color),
          font: FONT[r.font ?? st.font],
          ...(st.uppercase ? { allCaps: true } : {}),
          ...(st.tracking ? { characterSpacing: Math.round((st.tracking / PT) * 20) } : {}),
          ...(r.underline ?? st.underline ? { underline: {} } : {}),
          ...(rtl ? { rightToLeft: true } : {}),
        };
        const link = flow.links === false ? undefined : safeLink(r.link);
        return link ? new ExternalHyperlink({ link, children: [new TextRun(opts)] }) : new TextRun(opts);
      });

  const heading = (role: TextNode['role']) =>
    role === 'title' ? HeadingLevel.TITLE : role === 'h1' ? HeadingLevel.HEADING_1 : role === 'h2' ? HeadingLevel.HEADING_2 : role === 'h3' ? HeadingLevel.HEADING_3 : undefined;

  const align = (a: TextNode['align']) => (a === 'center' ? AlignmentType.CENTER : a === 'right' ? AlignmentType.RIGHT : a === 'justify' ? AlignmentType.JUSTIFIED : AlignmentType.LEFT);

  const spacing = (n: { before?: number; after?: number }, st?: TextStyle) => ({
    before: tw(n.before ?? 0),
    after: tw(n.after ?? 0),
    ...(st ? { line: Math.round(240 * Math.min(2, Math.max(0.9, st.lineHeight ?? 1.3) / 1.15)) } : {}),
  });

  const textPara = (n: TextNode, extra: Partial<IParagraphOptions> = {}): Paragraph => {
    const h = heading(n.role);
    let numbering: IParagraphOptions['numbering'] | undefined;
    if (n.marker) {
      if (n.marker.kind === 'number') {
        const key = n.marker.list ?? 'default';
        if (!lists.has(key) || n.marker.n === 1) lists.set(key, ++listSeq);
        numbering = { reference: 'flow-number', level: 0, instance: lists.get(key)! };
      } else numbering = { reference: n.marker.kind === 'dash' || n.marker.kind === 'arrow' ? 'flow-dash' : 'flow-bullet', level: 0 };
    }
    return new Paragraph({
      ...(h ? { heading: h } : {}),
      ...(rtl ? { bidirectional: true, ...(n.align === 'center' || n.align === 'justify' ? { alignment: align(n.align) } : {}) } : { alignment: align(n.align) }),
      spacing: spacing(n, n.style),
      ...(n.keepWithNext || h ? { keepNext: true, keepLines: true } : {}),
      ...(numbering ? { numbering } : n.indent ? { indent: { left: tw(n.indent) } } : {}),
      children: runs(n.runs, n.style),
      ...extra,
    });
  };

  const imagePara = (src: string, wmm: number, hmm: number, a: 'left' | 'center' | 'right' = 'left'): Paragraph | null => {
    if (o.includeImages === false) return null;
    const img = o.images[src];
    if (!img || !img.data.byteLength) return null;
    return new Paragraph({
      alignment: a === 'center' ? AlignmentType.CENTER : a === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT,
      spacing: { before: 0, after: 80 },
      children: [new ImageRun({ type: img.format === 'png' ? 'png' : 'jpg', data: img.data, transformation: { width: Math.round(wmm * PX), height: Math.round(hmm * PX) }, altText: { name: 'Image', description: 'Image', title: 'Image' } })],
    });
  };

  const isSimpleText = (nodes: FlowNode[]): TextNode | null => {
    const texts = nodes.filter((n) => n.t !== 'space');
    return texts.length === 1 && texts[0]!.t === 'text' && !texts[0]!.marker ? texts[0]! : null;
  };

  const convert = (nodes: FlowNode[], width: number): Block[] => nodes.flatMap((n) => node(n, width));

  const node = (n: FlowNode, width: number): Block[] => {
    if ('decorative' in n && n.decorative) return [];
    switch (n.t) {
      case 'text':
        return n.runs.some((r) => r.text.trim()) || n.marker ? [textPara(n)] : [];
      case 'space':
        return [new Paragraph({ spacing: { before: 0, after: 0, line: Math.max(20, tw(n.h)), lineRule: 'exact' }, children: [] })];
      case 'break':
        return [new Paragraph({ children: [new PageBreak()] })];
      case 'rule':
        return [
          new Paragraph({
            spacing: { before: tw(n.before ?? 0), after: tw(n.after ?? 0), line: 40, lineRule: 'exact' },
            border: { bottom: { style: n.dash === 'dotted' ? BorderStyle.DOTTED : n.dash === 'dashed' ? BorderStyle.DASHED : BorderStyle.SINGLE, size: Math.max(2, Math.round((n.weight / PT) * 8)), color: hex(n.color), space: 1 } },
            children: [],
          }),
        ];
      case 'image': {
        const p = imagePara(n.src, Math.min(n.width, width), n.width ? (n.height * Math.min(n.width, width)) / n.width : n.height, n.align);
        return p ? [p] : [];
      }
      case 'group':
        return convert(n.nodes, width);
      case 'section': {
        const title = convert(n.title, width);
        const body = convert(n.nodes, width);
        return body.length ? [...title, ...body] : [];
      }
      case 'row': {
        // "Left … right" rows become one paragraph with a right tab stop (clean for ATS and Word).
        const simple = n.cols.map((c) => isSimpleText(c.nodes));
        if (n.cols.length === 2 && simple.every(Boolean)) {
          const [l, r] = simple as [TextNode, TextNode];
          return [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: spacing({ before: n.before ?? l.before, after: n.after ?? l.after }, l.style),
              keepNext: true,
              keepLines: true,
              ...(heading(l.role) ? { heading: heading(l.role)! } : {}),
              tabStops: [{ type: TabStopType.RIGHT, position: tw(width) }],
              children: [...runs(l.runs, l.style), new TextRun({ children: [new Tab()] }), ...runs(r.runs, r.style)],
            }),
          ];
        }
        const gap = n.gap ?? 4;
        const avail = width - gap * (n.cols.length - 1);
        const fixed = n.cols.reduce((s, c) => s + (c.width ?? 0), 0);
        const flex = n.cols.filter((c) => c.width === undefined).length;
        const widths = n.cols.map((c) => (c.width !== undefined ? c.width * avail : (avail * Math.max(0, 1 - fixed)) / Math.max(1, flex)));
        return [
          new Table({
            width: { size: tw(width), type: WidthType.DXA },
            columnWidths: widths.map((w, i) => tw(w + (i < widths.length - 1 ? gap : 0))),
            layout: TableLayoutType.FIXED,
            borders: NO_BORDERS,
            rows: [
              new TableRow({
                cantSplit: true,
                children: n.cols.map(
                  (c, i) =>
                    new TableCell({
                      width: { size: tw(widths[i]! + (i < widths.length - 1 ? gap : 0)), type: WidthType.DXA },
                      margins: { top: 0, bottom: 0, left: 0, right: i < widths.length - 1 ? tw(gap) : 0 },
                      verticalAlign: c.vAlign === 'middle' ? VerticalAlign.CENTER : c.vAlign === 'bottom' ? VerticalAlign.BOTTOM : VerticalAlign.TOP,
                      children: withParagraph(convert(c.nodes, widths[i]!)),
                    }),
                ),
              }),
            ],
          }),
        ];
      }
      case 'box': {
        const [pt, pr, pb, pl] = n.padding ?? [0, 0, 0, 0];
        const inner = convert(n.nodes, width - pl - pr - (n.bar?.width ?? 0));
        if (!inner.length) return [];
        if (!n.fill && !n.stroke && !n.bar) return inner;
        const border = n.stroke ? { style: BorderStyle.SINGLE, size: Math.max(2, Math.round(((n.strokeWidth ?? 0.25) / PT) * 8)), color: hex(n.stroke) } : NO_BORDER;
        const bar = n.bar ? { style: BorderStyle.SINGLE, size: Math.min(96, Math.max(8, Math.round((n.bar.width / PT) * 8))), color: hex(n.bar.color) } : border;
        return [
          new Table({
            width: { size: tw(width), type: WidthType.DXA },
            columnWidths: [tw(width)],
            layout: TableLayoutType.FIXED,
            borders: { top: border, bottom: border, right: border, left: bar, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
            rows: [
              new TableRow({
                cantSplit: n.keep === 'together',
                children: [
                  new TableCell({
                    width: { size: tw(width), type: WidthType.DXA },
                    margins: { top: tw(pt), bottom: tw(pb), left: tw(pl), right: tw(pr) },
                    ...(n.fill ? { shading: { type: ShadingType.CLEAR, color: 'auto', fill: hex(n.fill) } } : {}),
                    children: withParagraph(inner),
                  }),
                ],
              }),
            ],
          }),
          new Paragraph({ spacing: { before: 0, after: tw(n.after ?? 0), line: 40, lineRule: 'exact' }, children: [] }),
        ];
      }
      case 'table': {
        const cols = Math.max(n.header?.length ?? 0, ...n.rows.map((r) => r.length), 1);
        const ws = n.widths && n.widths.length === cols ? n.widths : Array.from({ length: cols }, () => 1 / cols);
        const sum = ws.reduce((a, b) => a + b, 0) || 1;
        const colW = ws.map((v) => tw((v / sum) * width));
        const b = { style: BorderStyle.SINGLE, size: 4, color: hex(n.border ?? '#d1d5db') };
        const cell = (content: Run[], header: boolean, i: number, fill?: string) =>
          new TableCell({
            width: { size: colW[i] ?? 0, type: WidthType.DXA },
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            ...(fill ? { shading: { type: ShadingType.CLEAR, color: 'auto', fill: hex(fill) } } : {}),
            children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: runs(content, { ...n.style, bold: header || n.style.bold }) })],
          });
        const pad = (r: Run[][]) => Array.from({ length: cols }, (_, i) => r[i] ?? [{ text: '' }]);
        const rows: TableRow[] = [];
        if (n.header) rows.push(new TableRow({ tableHeader: true, cantSplit: true, children: pad(n.header).map((c, i) => cell(c, true, i, n.headerFill ?? '#f3f4f6')) }));
        n.rows.forEach((r, ri) => rows.push(new TableRow({ cantSplit: true, children: pad(r).map((c, i) => cell(c, false, i, n.zebra && ri % 2 === 1 ? n.zebra : undefined)) })));
        if (!rows.length) return [];
        return [
          new Table({ width: { size: tw(width), type: WidthType.DXA }, columnWidths: colW, layout: TableLayoutType.FIXED, borders: { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b }, rows }),
          new Paragraph({ spacing: { before: 0, after: tw(n.after ?? 2) }, children: [] }),
        ];
      }
      default:
        return [];
    }
  };

  const withParagraph = (blocks: Block[]): Block[] => (blocks.length && blocks[blocks.length - 1] instanceof Paragraph ? blocks : [...blocks, new Paragraph({ children: [] })]);

  /* ------------------------------- body ------------------------------ */

  const body: Block[] = [];
  if (flow.masthead?.length) body.push(...convert(flow.masthead, flow.mastheadWidth ?? contentW));
  const cols = [...flow.columns].sort((a, b) => a.x - b.x);
  if (cols.length === 1) body.push(...convert(cols[0]!.nodes, Math.min(cols[0]!.width, contentW)));
  else if (cols.length > 1) {
    const total = cols.reduce((s, c) => s + c.width, 0);
    const scale = contentW / Math.max(total, 1);
    body.push(
      new Table({
        width: { size: tw(contentW), type: WidthType.DXA },
        columnWidths: cols.map((c) => tw(c.width * scale)),
        layout: TableLayoutType.FIXED,
        borders: NO_BORDERS,
        rows: [
          new TableRow({
            children: cols.map(
              (c, i) =>
                new TableCell({
                  width: { size: tw(c.width * scale), type: WidthType.DXA },
                  margins: { top: c.fill ? tw(4) : 0, bottom: c.fill ? tw(4) : 0, left: c.fill ? tw(4) : i > 0 ? tw(3) : 0, right: c.fill ? tw(4) : i < cols.length - 1 ? tw(3) : 0 },
                  ...(c.fill ? { shading: { type: ShadingType.CLEAR, color: 'auto', fill: hex(c.fill) } } : {}),
                  children: withParagraph(convert(c.nodes, c.width * scale - (c.fill ? 8 : 3))),
                }),
            ),
          }),
        ],
      }),
    );
  }
  if (!body.length) body.push(new Paragraph({ children: [] }));

  /* ---------------------------- furniture ---------------------------- */

  const furniture = (f: PageFurniture): Paragraph => {
    const children: ParagraphChild[] = [];
    for (const r of f.runs) {
      const parts = r.text.split(/(\{page\}|\{pages\})/);
      for (const part of parts) {
        if (!part) continue;
        const base = { size: Math.round((r.size ?? f.style.size) * 2), color: hex(r.color ?? f.style.color), font: FONT[r.font ?? f.style.font], bold: r.bold ?? f.style.bold ?? false, italics: r.italic ?? f.style.italic ?? false };
        if (part === '{page}') children.push(new TextRun({ ...base, children: [PageNumber.CURRENT] }));
        else if (part === '{pages}') children.push(new TextRun({ ...base, children: [PageNumber.TOTAL_PAGES] }));
        else children.push(new TextRun({ ...base, text: clean(part) }));
      }
    }
    return new Paragraph({ alignment: align(f.align), children });
  };
  const footers = flow.footer ? { default: new Footer({ children: [furniture(flow.footer)] }), ...(flow.footer.pages === 'rest' ? { first: new Footer({ children: [new Paragraph({ children: [] })] }) } : {}) } : undefined;
  const headers = flow.header ? { default: new Header({ children: [furniture(flow.header)] }), ...(flow.header.pages === 'rest' ? { first: new Header({ children: [new Paragraph({ children: [] })] }) } : {}) } : undefined;
  const titlePage = flow.footer?.pages === 'rest' || flow.header?.pages === 'rest';

  const bodyFont = FONT[firstFont(flow) ?? 'helvetica'];

  return new Document({
    creator: flow.meta.author || flow.meta.creator,
    lastModifiedBy: flow.meta.creator,
    title: flow.meta.title,
    subject: flow.meta.subject,
    description: flow.meta.subject || flow.meta.title,
    keywords: flow.meta.keywords.join(', '),
    styles: {
      default: {
        document: { run: { font: bodyFont, size: 20 }, paragraph: { spacing: { after: 0, line: 264 } } },
        title: { run: { font: bodyFont, size: 44, bold: true } },
        heading1: { run: { font: bodyFont, size: 24, bold: true }, paragraph: { keepNext: true, keepLines: true } },
        heading2: { run: { font: bodyFont, size: 22, bold: true }, paragraph: { keepNext: true, keepLines: true } },
        heading3: { run: { font: bodyFont, size: 20, bold: true }, paragraph: { keepNext: true, keepLines: true } },
        hyperlink: { run: { underline: { type: 'single' } } },
      },
    },
    numbering: {
      config: [
        { reference: 'flow-bullet', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 340, hanging: 220 } } } }] },
        { reference: 'flow-dash', levels: [{ level: 0, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 340, hanging: 220 } } } }] },
        { reference: 'flow-number', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400, hanging: 280 } } } }] },
      ],
    },
    sections: [
      {
        properties: {
          ...(titlePage ? { titlePage: true } : {}),
          page: {
            size: { width: tw(flow.page.width), height: tw(flow.page.height) },
            margin: { top: tw(margin.top), bottom: tw(margin.bottom), left: tw(margin.left), right: tw(margin.right), header: tw(Math.max(5, margin.top * 0.4)), footer: tw(Math.max(5, margin.bottom * 0.4)) },
          },
        },
        ...(headers ? { headers } : {}),
        ...(footers ? { footers } : {}),
        children: body,
      },
    ],
  });
}

function firstFont(flow: FlowDoc): FontFamily | null {
  const walk = (nodes: FlowNode[]): FontFamily | null => {
    for (const n of nodes) {
      if (n.t === 'text' && n.role !== 'title') return n.style.font;
      if (n.t === 'group' || n.t === 'box') {
        const f = walk(n.nodes);
        if (f) return f;
      }
      if (n.t === 'section') {
        const f = walk(n.nodes);
        if (f) return f;
      }
    }
    return null;
  };
  for (const c of flow.columns) {
    const f = walk(c.nodes);
    if (f) return f;
  }
  return null;
}

export async function renderFlowDocx(flow: FlowDoc, o: DocxOutputOptions): Promise<ArrayBuffer> {
  return Packer.toArrayBuffer(renderFlowDocxDocument(flow, o));
}
