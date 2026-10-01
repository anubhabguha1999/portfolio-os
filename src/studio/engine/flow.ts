/**
 * Document engine types.
 *
 *   DocumentModel (resume / letter / blocks)
 *        │  template.compose()
 *        ▼
 *   FlowDoc  — declarative, serialisable description of pages, columns and nodes
 *        │  layoutFlow()                       │ renderDocx() / renderText()
 *        ▼                                     ▼
 *   LaidDocument — positioned primitives      DOCX / TXT (flow formats)
 *        │
 *   ┌────┴─────┐
 *   SVG preview  PDF (jsPDF, vector text)
 *
 * Everything here is plain data so it can be posted to the export worker.
 * Units: millimetres for geometry, points for font sizes.
 */

export type FontFamily = 'helvetica' | 'times' | 'courier';

export interface TextStyle {
  font: FontFamily;
  size: number;
  color: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** Extra space between characters, in mm. */
  tracking?: number;
  uppercase?: boolean;
  /** Line height multiplier. */
  lineHeight?: number;
}

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  link?: string;
  color?: string;
  font?: FontFamily;
  size?: number;
  underline?: boolean;
}

/** Semantic role — DOCX maps these to real Word styles, TXT to plain-text conventions. */
export type TextRole = 'title' | 'subtitle' | 'h1' | 'h2' | 'h3' | 'body' | 'meta' | 'caption';

export interface NodeBase {
  /** Space above / below in mm (collapses at page tops). */
  before?: number;
  after?: number;
  /** Keep the end of this node on the same page as the start of the next. */
  keepWithNext?: boolean;
  /** Editor mapping: clicking the rendered node selects this ref. */
  ref?: string;
  /** Visual only (monograms, ornaments): drawn in the PDF and preview, left out of DOCX and TXT. */
  decorative?: boolean;
}

export interface TextNode extends NodeBase {
  t: 'text';
  runs: Run[];
  style: TextStyle;
  align?: 'left' | 'center' | 'right' | 'justify';
  role?: TextRole;
  /** Left indent in mm (markers hang inside it). */
  indent?: number;
  marker?: { kind: 'bullet' | 'number' | 'dash' | 'square' | 'arrow'; n?: number; color?: string; list?: string };
}

export interface RowCol {
  /** Fraction of the row width (the last column takes the remainder when omitted). */
  width?: number;
  nodes: FlowNode[];
  align?: 'left' | 'right' | 'center';
  vAlign?: 'top' | 'middle' | 'bottom';
}

/** Side-by-side columns; never splits across pages. */
export interface RowNode extends NodeBase {
  t: 'row';
  cols: RowCol[];
  gap?: number;
}

export interface BoxNode extends NodeBase {
  t: 'box';
  nodes: FlowNode[];
  /** top, right, bottom, left (mm). */
  padding?: [number, number, number, number];
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
  /** Accent bar on the left edge. */
  bar?: { color: string; width: number };
  /** Timeline rail: vertical line at `x` mm from the box's left with a dot at the top. */
  rail?: { x: number; color: string; width: number; dot: number; dotColor?: string; hollow?: boolean };
  /** 'together' keeps the box on one page when it fits; 'split' lets it flow. */
  keep?: 'together' | 'split';
}

/**
 * Pagination hint for a logical unit (a resume entry, a card…):
 * - together: never split if it fits on a page
 * - head: the first `head` pieces stay with at least `minBody` following pieces
 */
export interface GroupNode extends NodeBase {
  t: 'group';
  nodes: FlowNode[];
  keep: 'together' | 'head' | 'none';
  head?: number;
  minBody?: number;
}

export interface SectionNode extends NodeBase {
  t: 'section';
  id: string;
  title: FlowNode[];
  nodes: FlowNode[];
  /** Drawn at the top of a page when the section continues there. */
  continued?: FlowNode[];
}

export interface ImageNode extends NodeBase {
  t: 'image';
  src: string;
  width: number;
  height: number;
  align?: 'left' | 'center' | 'right';
  alt?: string;
}

export interface RuleNode extends NodeBase {
  t: 'rule';
  color: string;
  weight: number;
  dash?: 'solid' | 'dashed' | 'dotted';
  /** Fraction of the available width (default 1). */
  length?: number;
  align?: 'left' | 'center';
}

export interface SpaceNode {
  t: 'space';
  h: number;
  ref?: string;
}

export interface BreakNode {
  t: 'break';
}

export interface TableNode extends NodeBase {
  t: 'table';
  header: Run[][] | null;
  rows: Run[][][];
  widths?: number[];
  style: TextStyle;
  headerFill?: string;
  border?: string;
  zebra?: string;
}

export type FlowNode = TextNode | RowNode | BoxNode | GroupNode | SectionNode | ImageNode | RuleNode | SpaceNode | BreakNode | TableNode;

export type PageSelector = 'all' | 'first' | 'rest';

/** Static page art (sidebar fills, bands, borders) — drawn beneath content. */
export type Decoration =
  | { k: 'rect'; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; lw?: number; r?: number; pages: PageSelector }
  | { k: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; lw: number; pages: PageSelector }
  | { k: 'circle'; cx: number; cy: number; r: number; fill: string; pages: PageSelector };

export interface FlowColumn {
  id: string;
  /** Absolute x (mm from the page's left edge). */
  x: number;
  width: number;
  nodes: FlowNode[];
  /** Absolute top/bottom limits (mm). Defaults: page margins (page 1 below the masthead). */
  top?: number;
  bottom?: number;
  /** First-page top, overriding the masthead-derived start. */
  firstTop?: number;
  /** Background colour — used by DOCX to shade the column cell. */
  fill?: string;
  /** Reading order for TXT/DOCX (lower first). */
  order?: number;
}

export interface PageFurniture {
  /** Runs; "{page}" and "{pages}" are substituted. */
  runs: Run[];
  style: TextStyle;
  align: 'left' | 'center' | 'right';
  pages: PageSelector;
}

export interface FlowDoc {
  page: {
    width: number;
    height: number;
    margin: { top: number; right: number; bottom: number; left: number };
    background?: string;
  };
  /** Full-width content at the top of page 1; columns start below it. */
  masthead?: FlowNode[];
  mastheadX?: number;
  mastheadWidth?: number;
  mastheadGap?: number;
  columns: FlowColumn[];
  decorations?: Decoration[];
  header?: PageFurniture | null;
  footer?: PageFurniture | null;
  meta: { title: string; author: string; subject: string; keywords: string[]; creator: string; lang?: string };
  /** Repeat section headings ("Experience (continued)") on new pages. */
  repeatHeadings?: boolean;
  /** Links become clickable annotations in the PDF. */
  links?: boolean;
}

/* --------------------------- Display list --------------------------- */

export type Prim =
  | { k: 'text'; x: number; y: number; w: number; text: string; font: FontFamily; bold: boolean; italic: boolean; size: number; color: string; underline?: boolean; tracking?: number; link?: string }
  | { k: 'rect'; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; lw?: number; r?: number }
  | { k: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; lw: number; dash?: number[] }
  | { k: 'circle'; cx: number; cy: number; r: number; fill?: string; stroke?: string; lw?: number }
  | { k: 'image'; src: string; x: number; y: number; w: number; h: number; alt?: string }
  | { k: 'link'; x: number; y: number; w: number; h: number; url: string };

export interface RefBox {
  ref: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LaidPage {
  index: number;
  prims: Prim[];
  refs: RefBox[];
}

export interface LayoutIssue {
  kind: 'overflow' | 'clipped-word' | 'unsupported-chars' | 'page-limit' | 'tiny-text' | 'missing-image';
  message: string;
  page?: number;
  ref?: string;
}

export interface LayoutStats {
  pages: number;
  images: number;
  links: number;
  minFontSize: number;
  textRuns: number;
  decorativeShapes: number;
  unsupportedChars: string[];
  /** Height used on the last page (mm) — used by fit-to-page. */
  lastPageFill: number;
  /** Per-column used height on the last page as a fraction of the available height. */
  lastPageRatio: number;
}

export interface LaidDocument {
  width: number;
  height: number;
  background?: string;
  pages: LaidPage[];
  stats: LayoutStats;
  issues: LayoutIssue[];
  meta: FlowDoc['meta'];
}
