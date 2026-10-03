/**
 * Output language + right-to-left support for FlowDocs.
 *
 * `finalizeFlow()` runs after every template's compose(): it tags the document with its
 * language (PDF /Lang, DOCX) and, for Arabic/Hebrew, mirrors the page geometry:
 *
 *  - columns, masthead, decorations and margins swap sides (the sidebar moves right);
 *  - row columns and table cells are reversed, so the first column reads from the right;
 *  - left/right alignment flips (the default becomes right-aligned);
 *  - box padding swaps; the layout engine then draws accent bars, timeline rails and list
 *    markers on the right (`flow.dir === 'rtl'`).
 *
 * What it cannot do: shape or reorder Arabic/Hebrew glyphs. The PDF core fonts have no
 * Arabic or Hebrew glyphs at all, so that text is removed from the PDF/preview (and
 * reported); see `pdfFontNote()` in src/i18n. Latin runs inside a line keep LTR order.
 */
import type { Decoration, FlowDoc, FlowNode, PageFurniture, RowCol, TextNode } from './flow';
import { isRtl, languageInfo, normalizeLanguage } from '@/i18n';

const flipAlign = <A extends string | undefined>(a: A, dflt: 'right' | undefined): A | 'left' | 'right' | undefined =>
  a === 'left' ? 'right' : a === 'right' ? 'left' : a === undefined ? dflt : a;

function mirrorNode(n: FlowNode): FlowNode {
  switch (n.t) {
    case 'text':
      return { ...n, align: flipAlign(n.align, 'right') as TextNode['align'] };
    case 'row':
      return { ...n, cols: [...n.cols].reverse().map((c): RowCol => ({ ...c, ...(c.align ? { align: flipAlign(c.align, undefined) as RowCol['align'] } : {}), nodes: c.nodes.map(mirrorNode) })) };
    case 'box': {
      const p = n.padding;
      return { ...n, ...(p ? { padding: [p[0], p[3], p[2], p[1]] as [number, number, number, number] } : {}), nodes: n.nodes.map(mirrorNode) };
    }
    case 'group':
      return { ...n, nodes: n.nodes.map(mirrorNode) };
    case 'section':
      return { ...n, title: n.title.map(mirrorNode), nodes: n.nodes.map(mirrorNode), ...(n.continued ? { continued: n.continued.map(mirrorNode) } : {}) };
    case 'image':
      return { ...n, align: n.align === 'center' ? 'center' : n.align === 'right' ? 'left' : 'right' };
    case 'table':
      return { ...n, header: n.header ? [...n.header].reverse() : null, rows: n.rows.map((r) => [...r].reverse()), ...(n.widths ? { widths: [...n.widths].reverse() } : {}) };
    default:
      return n;
  }
}

function mirrorDecoration(d: Decoration, W: number): Decoration {
  switch (d.k) {
    case 'rect':
      return { ...d, x: W - d.x - d.w };
    case 'line':
      return { ...d, x1: W - d.x1, x2: W - d.x2 };
    case 'circle':
      return { ...d, cx: W - d.cx };
    case 'poly':
      return { ...d, points: d.points.map(([x, y]) => [W - x, y] as [number, number]) };
  }
}

const mirrorFurniture = (f: PageFurniture | null | undefined): PageFurniture | null | undefined => (f ? { ...f, align: f.align === 'center' ? 'center' : f.align === 'left' ? 'right' : 'left' } : f);

/** Mirror a left-to-right FlowDoc into its right-to-left counterpart. */
export function mirrorFlow(flow: FlowDoc): FlowDoc {
  const W = flow.page.width;
  const m = flow.page.margin;
  const out: FlowDoc = {
    ...flow,
    dir: 'rtl',
    page: { ...flow.page, margin: { ...m, left: m.right, right: m.left } },
    columns: flow.columns.map((c) => ({ ...c, x: W - c.x - c.width, nodes: c.nodes.map(mirrorNode) })),
    ...(flow.masthead ? { masthead: flow.masthead.map(mirrorNode) } : {}),
    ...(flow.decorations ? { decorations: flow.decorations.map((d) => mirrorDecoration(d, W)) } : {}),
    ...(flow.header !== undefined ? { header: mirrorFurniture(flow.header) } : {}),
    ...(flow.footer !== undefined ? { footer: mirrorFurniture(flow.footer) } : {}),
  };
  if (flow.mastheadX !== undefined) {
    const mw = flow.mastheadWidth ?? W - m.left - m.right;
    out.mastheadX = W - flow.mastheadX - mw;
  }
  return out;
}

/**
 * Apply the document language to a composed FlowDoc. English is returned unchanged
 * (byte-for-byte the same output as before languages existed).
 */
export function finalizeFlow(flow: FlowDoc, lang: string | undefined | null): FlowDoc {
  const code = normalizeLanguage(lang);
  if (code === 'en') return flow;
  const tagged: FlowDoc = { ...flow, meta: { ...flow.meta, lang: languageInfo(code).locale } };
  return isRtl(code) ? mirrorFlow(tagged) : tagged;
}
