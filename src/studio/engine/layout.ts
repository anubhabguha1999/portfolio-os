/**
 * Layout engine: FlowDoc → LaidDocument (pages of positioned primitives).
 *
 * 1. flatten — every node becomes a stream of unbreakable pieces (a text line, a row,
 *    an image…) that know their height and how to draw themselves. Grouping intent is
 *    encoded as keep-with-next chains (headings, entry heads, orphans/widows, "keep
 *    together" groups).
 * 2. paginate — each column's pieces flow onto pages. A chain that would cross the
 *    bottom edge moves to the next page as a unit when it fits on a fresh page;
 *    sections that continue get a repeated heading; table headers repeat.
 * 3. decorate — boxes that were split get their background / border / rail drawn per
 *    page fragment, beneath the content.
 */
import type {
  BoxNode,
  Decoration,
  FlowDoc,
  FlowNode,
  FontFamily,
  LaidDocument,
  LaidPage,
  LayoutIssue,
  PageSelector,
  Prim,
  RefBox,
  Run,
  TableNode,
  TextNode,
  TextStyle,
} from './flow';
import { getMeasurer, PT, pdfText, unsupportedChars, type Measurer } from './measure';

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

interface Container {
  id: number;
  box: BoxNode;
  x: number;
  w: number;
  depth: number;
}

interface SectionCtx {
  id: string;
  continued: FlowNode[];
  x: number;
  w: number;
  containers: Container[];
  refs: string[];
}

interface Piece {
  h: number;
  before: number;
  after: number;
  keep: boolean;
  brk?: boolean;
  space?: boolean;
  x: number;
  w: number;
  draw?: (y: number, out: Prim[]) => void;
  containers: Container[];
  refs: string[];
  section?: SectionCtx;
  sectionTitle?: boolean;
  /** Re-drawn at the top of a page when this piece starts one (table header). */
  header?: Piece;
}

interface Ctx {
  containers: Container[];
  refs: string[];
  section?: SectionCtx;
}

interface Word {
  text: string;
  font: FontFamily;
  bold: boolean;
  italic: boolean;
  size: number;
  color: string;
  underline: boolean;
  tracking: number;
  link: string | undefined;
  x: number;
  w: number;
  /** Width of the space preceding this word (0 at line start / glued). */
  gap: number;
  /** Icon word: drawn as a vector icon, never left alone at a line end. */
  icon?: string;
}

interface Line {
  words: Word[];
  width: number;
  size: number;
  last: boolean;
}

export interface LayoutOptions {
  measurer?: Measurer;
}

function safeLink(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const u = url.trim();
  if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
  if (/^[\w-]+\.[\w.-]+(\/|$)/.test(u)) return `https://${u}`;
  return undefined;
}

let containerSeq = 0;

export function layoutFlow(flow: FlowDoc, opts: LayoutOptions = {}): LaidDocument {
  const M = opts.measurer ?? getMeasurer();
  const { width: pageW, height: pageH, margin } = flow.page;
  const issues: LayoutIssue[] = [];
  const unsupported = new Set<string>();
  const stats = { images: 0, links: 0, minFont: Infinity, runs: 0, shapes: 0 };
  const linksOn = flow.links !== false;
  let clippedWords = 0;

  /* ------------------------------ text ------------------------------ */

  const clean = (s: string, upper: boolean): string => {
    for (const c of unsupportedChars(s)) unsupported.add(c);
    const t = pdfText(s);
    return upper ? t.toUpperCase() : t;
  };

  const layoutRuns = (runs: Run[], st: TextStyle, maxW: number): Line[] => {
    const lines: Line[] = [];
    let cur: Word[] = [];
    let x = 0;
    let maxSize = st.size;
    let pendingSpace = false;
    /** Gap owed after an icon: its word follows on the same line. */
    let gluedIcon = 0;
    const flush = (last = false) => {
      lines.push({ words: cur, width: x, size: maxSize, last });
      cur = [];
      x = 0;
      maxSize = st.size;
      pendingSpace = false;
    };
    const tracking = st.tracking ?? 0;
    for (const r of runs) {
      if (r.icon) {
        // An icon is one em-ish box, glued to the next word with a small fixed gap.
        const size = r.size ?? st.size;
        const box = size * PT * 0.9;
        const g = pendingSpace && cur.length ? M.width(' ', r.font ?? st.font, false, false, size, tracking) : 0;
        if (cur.length && x + g + box > maxW + 0.001) flush();
        const gx = cur.length ? g : 0;
        cur.push({ text: '', icon: r.icon, font: r.font ?? st.font, bold: false, italic: false, size, color: r.color ?? st.color, underline: false, tracking: 0, link: linksOn ? safeLink(r.link) : undefined, x: x + gx, w: box, gap: gx });
        x += gx + box;
        maxSize = Math.max(maxSize, size);
        pendingSpace = false;
        gluedIcon = box * 0.45;
        continue;
      }
      const font = r.font ?? st.font;
      const bold = r.bold ?? st.bold ?? false;
      const italic = r.italic ?? st.italic ?? false;
      const size = r.size ?? st.size;
      const color = r.color ?? st.color;
      const link = linksOn ? safeLink(r.link) : undefined;
      const underline = r.underline ?? st.underline ?? false;
      const text = clean(r.text, !!st.uppercase);
      const spaceW = M.width(' ', font, bold, italic, size, tracking);
      for (const part of text.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) {
          pendingSpace = true;
          continue;
        }
        let word = part;
        let w = M.width(word, font, bold, italic, size, tracking);
        if (gluedIcon) {
          // Keep the icon with its word: carry it to the next line if the pair does not fit.
          const icon = cur[cur.length - 1];
          if (icon?.icon && cur.length > 1 && x + gluedIcon + w > maxW + 0.001) {
            cur.pop();
            x = icon.x - icon.gap;
            flush();
            cur.push({ ...icon, x: 0, gap: 0 });
            x = icon.w;
            maxSize = Math.max(maxSize, icon.size);
          }
          const gx = gluedIcon;
          gluedIcon = 0;
          pendingSpace = false;
          if (w <= maxW - x - gx + 0.001 || word.length <= 1) {
            cur.push({ text: word, font, bold, italic, size, color, underline, tracking, link, x: x + gx, w, gap: 0 });
            x += gx + w;
            maxSize = Math.max(maxSize, size);
            continue;
          }
          x += gx;
        }
        if (cur.length && x + (pendingSpace ? spaceW : 0) + w > maxW + 0.001) flush();
        // Words longer than a whole line are broken by characters.
        if (w > maxW + 0.001 && word.length > 1) clippedWords++;
        while (w > maxW + 0.001 && word.length > 1) {
          if (cur.length) flush();
          let n = 1;
          while (n < word.length && M.width(word.slice(0, n + 1), font, bold, italic, size, tracking) <= maxW) n++;
          const chunk = word.slice(0, n);
          const cw = M.width(chunk, font, bold, italic, size, tracking);
          cur.push({ text: chunk, font, bold, italic, size, color, underline, tracking, link, x: 0, w: cw, gap: 0 });
          x = cw;
          maxSize = Math.max(maxSize, size);
          flush();
          word = word.slice(n);
          w = M.width(word, font, bold, italic, size, tracking);
        }
        if (!word) continue;
        const g = pendingSpace && cur.length ? spaceW : 0;
        cur.push({ text: word, font, bold, italic, size, color, underline, tracking, link, x: x + g, w, gap: g });
        x += g + w;
        maxSize = Math.max(maxSize, size);
        pendingSpace = false;
      }
    }
    if (cur.length || !lines.length) flush(true);
    else if (lines.length) lines[lines.length - 1]!.last = true;
    return lines;
  };

  const lineHeight = (size: number, st: TextStyle) => size * PT * (st.lineHeight ?? 1.3);

  const drawLine = (line: Line, x: number, y: number, lh: number, maxW: number, align: TextNode['align'], out: Prim[]) => {
    if (!line.words.length) return;
    const gaps = line.words.filter((w, i) => i > 0 && w.gap > 0).length;
    const justify = align === 'justify' && !line.last && gaps > 0;
    const extra = justify ? Math.max(0, maxW - line.width) / gaps : 0;
    const off = align === 'center' ? (maxW - line.width) / 2 : align === 'right' ? maxW - line.width : 0;
    const fsLine = line.size * PT;
    const baseline = y + (lh - fsLine) / 2 + fsLine * 0.78;
    let shift = 0;
    let run: { word: Word; x: number; text: string; w: number } | null = null;
    const emit = () => {
      if (!run) return;
      const wd = run.word;
      stats.runs++;
      stats.minFont = Math.min(stats.minFont, wd.size);
      out.push({ k: 'text', x: run.x, y: baseline, w: run.w, text: run.text, font: wd.font, bold: wd.bold, italic: wd.italic, size: wd.size, color: wd.color, ...(wd.underline ? { underline: true } : {}), ...(wd.tracking ? { tracking: wd.tracking } : {}), ...(wd.link ? { link: wd.link } : {}) });
      if (wd.link) {
        stats.links++;
        out.push({ k: 'link', x: run.x, y, w: run.w, h: lh, url: wd.link });
      }
      run = null;
    };
    line.words.forEach((wd, i) => {
      if (justify && i > 0 && wd.gap > 0) shift += extra;
      const wx = x + off + wd.x + shift;
      if (wd.icon) {
        // Centred on the x-height of the line's text.
        emit();
        const mid = baseline - fsLine * 0.3;
        out.push({ k: 'icon', name: wd.icon, x: wx, y: mid - wd.w / 2, size: wd.w, color: wd.color });
        stats.shapes++;
        if (wd.link) {
          stats.links++;
          out.push({ k: 'link', x: wx, y, w: wd.w, h: lh, url: wd.link });
        }
        return;
      }
      const same =
        run &&
        !justify &&
        run.word.font === wd.font &&
        run.word.bold === wd.bold &&
        run.word.italic === wd.italic &&
        run.word.size === wd.size &&
        run.word.color === wd.color &&
        run.word.underline === wd.underline &&
        run.word.link === wd.link &&
        run.word.tracking === wd.tracking;
      if (same && run) {
        run.text += (wd.gap > 0 ? ' ' : '') + wd.text;
        run.w = wx + wd.w - run.x;
      } else {
        emit();
        run = { word: wd, x: wx, text: wd.text, w: wd.w };
      }
    });
    emit();
  };

  const markerText = (m: NonNullable<TextNode['marker']>): string =>
    m.kind === 'number' ? `${m.n ?? 1}.` : m.kind === 'dash' ? '-' : m.kind === 'arrow' ? '>' : '';

  const textPieces = (node: TextNode, x: number, w: number, ctx: Ctx): Piece[] => {
    const st = node.style;
    const indent = node.indent ?? (node.marker ? st.size * PT * 1.25 : 0);
    const lines = layoutRuns(node.runs, st, Math.max(4, w - indent));
    if (lines.length === 1 && !lines[0]!.words.length && !node.marker) return [];
    const n = lines.length;
    return lines.map((ln, i) => {
      const lh = lineHeight(ln.size, st);
      return {
        h: lh,
        before: i === 0 ? node.before ?? 0 : 0,
        after: i === n - 1 ? node.after ?? 0 : 0,
        // Orphan/widow control: first line keeps with the second, penultimate with the last.
        keep: (i === 0 && n >= 2) || (i === n - 2 && n >= 3) || (i === n - 1 && !!node.keepWithNext),
        x,
        w,
        containers: ctx.containers,
        refs: ctx.refs,
        ...(ctx.section ? { section: ctx.section } : {}),
        draw: (y, out) => {
          if (i === 0 && node.marker) {
            const m = node.marker;
            const color = m.color ?? st.color;
            const fs = st.size * PT;
            const baseline = y + (lh - (ln.size * PT)) / 2 + ln.size * PT * 0.78;
            if (m.kind === 'bullet' || m.kind === 'square') {
              if (m.kind === 'bullet') out.push({ k: 'circle', cx: x + indent * 0.4, cy: baseline - fs * 0.3, r: Math.max(0.35, fs * 0.13), fill: color });
              else out.push({ k: 'rect', x: x + indent * 0.4 - fs * 0.13, y: baseline - fs * 0.43, w: fs * 0.26, h: fs * 0.26, fill: color });
              // The drawn dot is a shape; an invisible "•" makes the list readable to ATS and text extraction.
              const bw = M.width('•', st.font, false, false, st.size);
              out.push({ k: 'text', x: x + indent * 0.4 - bw / 2, y: baseline, w: bw, text: '•', font: st.font, bold: false, italic: false, size: st.size, color, invisible: true });
            } else {
              const t = markerText(m);
              const mw = M.width(t, st.font, !!st.bold, false, st.size);
              out.push({ k: 'text', x: x + indent - mw - fs * 0.35, y: baseline, w: mw, text: t, font: st.font, bold: !!st.bold, italic: false, size: st.size, color });
            }
          }
          drawLine(ln, x + indent, y, lh, w - indent, node.align, out);
        },
      };
    });
  };

  /* ------------------------------ nodes ----------------------------- */

  const withRef = (ctx: Ctx, ref: string | undefined): Ctx => (ref ? { ...ctx, refs: [...ctx.refs, ref] } : ctx);

  const markKeepLast = (pieces: Piece[], keep: boolean | undefined) => {
    if (keep && pieces.length) pieces[pieces.length - 1]!.keep = true;
  };

  const applyBeforeAfter = (pieces: Piece[], before = 0, after = 0) => {
    if (!pieces.length) return;
    pieces[0]!.before += before;
    pieces[pieces.length - 1]!.after += after;
  };

  /** Lay pieces out in a single strip (no page breaks) and return one atomic piece. */
  const atomic = (inner: Piece[], x: number, w: number, ctx: Ctx, over: Partial<Piece> = {}): Piece | null => {
    const visible = inner.filter((p) => !p.brk);
    if (!visible.length) return null;
    let y = 0;
    let prevAfter = 0;
    const offsets: number[] = [];
    visible.forEach((p, i) => {
      if (i > 0) y += prevAfter + p.before;
      offsets.push(y);
      y += p.h;
      prevAfter = p.after;
    });
    const depth = ctx.containers.length;
    return {
      h: y,
      before: 0,
      after: 0,
      keep: false,
      x,
      w,
      containers: ctx.containers,
      refs: ctx.refs,
      ...(ctx.section ? { section: ctx.section } : {}),
      draw: (y0, out) => {
        const placed = visible.map((p, i) => ({ piece: p, y: y0 + offsets[i]!, page: 0 }));
        const deco = decorate(placed, depth);
        out.push(...(deco.get(0) ?? []));
        for (const pl of placed) pl.piece.draw?.(pl.y, out);
        refBoxesInto(placed, ctx.refs.length, atomicRefs);
      },
      ...over,
    };
  };

  // Ref boxes produced inside atomic pieces during drawing (collected per page by the caller).
  let atomicRefs: RefBox[] = [];

  const refBoxesInto = (placed: Array<{ piece: Piece; y: number }>, fromDepth: number, target: RefBox[]) => {
    const map = new Map<string, RefBox>();
    for (const { piece, y } of placed) {
      for (let d = fromDepth; d < piece.refs.length; d++) {
        const ref = piece.refs[d]!;
        const box = map.get(ref);
        if (!box) map.set(ref, { ref, x: piece.x, y, w: piece.w, h: piece.h });
        else {
          const x1 = Math.max(box.x + box.w, piece.x + piece.w);
          const y1 = Math.max(box.y + box.h, y + piece.h);
          box.x = Math.min(box.x, piece.x);
          box.y = Math.min(box.y, y);
          box.w = x1 - box.x;
          box.h = y1 - box.y;
        }
      }
    }
    target.push(...map.values());
  };

  const flatten = (node: FlowNode, x: number, w: number, ctx: Ctx): Piece[] => {
    switch (node.t) {
      case 'text': {
        const c = withRef(ctx, node.ref);
        return textPieces(node, x, w, c);
      }
      case 'space':
        return [{ h: node.h, before: 0, after: 0, keep: false, space: true, x, w, containers: ctx.containers, refs: ctx.refs }];
      case 'break':
        return [{ h: 0, before: 0, after: 0, keep: false, brk: true, x, w, containers: ctx.containers, refs: ctx.refs }];
      case 'rule': {
        const c = withRef(ctx, node.ref);
        const len = w * Math.min(1, Math.max(0.05, node.length ?? 1));
        const rx = node.align === 'center' ? x + (w - len) / 2 : x;
        stats.shapes++;
        const p: Piece = {
          h: Math.max(0.1, node.weight),
          before: node.before ?? 0,
          after: node.after ?? 0,
          keep: !!node.keepWithNext,
          x,
          w,
          containers: c.containers,
          refs: c.refs,
          ...(c.section ? { section: c.section } : {}),
          draw: (y, out) => {
            const mid = y + node.weight / 2;
            out.push({ k: 'line', x1: rx, y1: mid, x2: rx + len, y2: mid, color: node.color, lw: node.weight, ...(node.dash === 'dashed' ? { dash: [1.6, 1] } : node.dash === 'dotted' ? { dash: [0.3, 0.9] } : {}) });
          },
        };
        return [p];
      }
      case 'image': {
        if (!node.src) return [];
        const c = withRef(ctx, node.ref);
        const iw = Math.min(node.width, w);
        const ih = node.width > 0 ? (node.height * iw) / node.width : node.height;
        const ix = node.align === 'center' ? x + (w - iw) / 2 : node.align === 'right' ? x + w - iw : x;
        return [
          {
            h: ih,
            before: node.before ?? 0,
            after: node.after ?? 0,
            keep: !!node.keepWithNext,
            x,
            w,
            containers: c.containers,
            refs: c.refs,
            ...(c.section ? { section: c.section } : {}),
            draw: (y, out) => {
              stats.images++;
              out.push({ k: 'image', src: node.src, x: ix, y, w: iw, h: ih, ...(node.alt ? { alt: node.alt } : {}) });
            },
          },
        ];
      }
      case 'row': {
        const c = withRef(ctx, node.ref);
        const gap = node.gap ?? 4;
        const cols = node.cols;
        const avail = w - gap * Math.max(0, cols.length - 1);
        const fixed = cols.reduce((s, col) => s + (col.width ?? 0), 0);
        const flexible = cols.filter((col) => col.width === undefined).length;
        const widths = cols.map((col) => (col.width !== undefined ? col.width * avail : (avail * Math.max(0, 1 - fixed)) / Math.max(1, flexible)));
        let cx = x;
        const inner = cols.map((col, i) => {
          const cw = widths[i]!;
          const colX = cx;
          cx += cw + gap;
          const pieces = col.nodes.flatMap((n) => flatten(n, colX, cw, { ...c, section: undefined }));
          const strip = atomic(pieces, colX, cw, { ...c, section: undefined });
          return { strip, align: col.vAlign ?? 'top' };
        });
        const h = Math.max(0, ...inner.map((i) => i.strip?.h ?? 0));
        if (h <= 0) return [];
        return [
          {
            h,
            before: node.before ?? 0,
            after: node.after ?? 0,
            keep: !!node.keepWithNext,
            x,
            w,
            containers: c.containers,
            refs: c.refs,
            ...(c.section ? { section: c.section } : {}),
            draw: (y, out) => {
              for (const i of inner) {
                if (!i.strip) continue;
                const dy = i.align === 'middle' ? (h - i.strip.h) / 2 : i.align === 'bottom' ? h - i.strip.h : 0;
                i.strip.draw?.(y + dy, out);
              }
            },
          },
        ];
      }
      case 'box': {
        const c0 = withRef(ctx, node.ref);
        const [pt, pr, pb, pl] = node.padding ?? [0, 0, 0, 0];
        const barW = node.bar ? node.bar.width : 0;
        const container: Container = { id: ++containerSeq, box: node, x, w, depth: c0.containers.length };
        const c: Ctx = { ...c0, containers: [...c0.containers, container] };
        const ix = x + pl + barW;
        const iw = Math.max(4, w - pl - pr - barW);
        const inner = node.nodes.flatMap((n) => flatten(n, ix, iw, c));
        if (!inner.length) return [];
        const pad = (h: number): Piece => ({ h, before: 0, after: 0, keep: true, x, w, containers: c.containers, refs: c.refs, ...(c.section ? { section: c.section } : {}) });
        const pieces = [pad(pt), ...inner, { ...pad(pb), keep: false }];
        // The last content piece stays with the bottom padding.
        pieces[pieces.length - 2]!.keep = true;
        let out: Piece[] = pieces;
        if (node.keep === 'together') {
          const total = pieces.reduce((s, p) => s + p.h + p.before + p.after, 0);
          if (total <= contentHeight() * 0.92) {
            const one = atomic(pieces, x, w, c0);
            if (one) out = [one];
          }
        }
        applyBeforeAfter(out, node.before, node.after);
        markKeepLast(out, node.keepWithNext);
        return out;
      }
      case 'group': {
        const c = withRef(ctx, node.ref);
        const heads = node.head ?? 1;
        const perNode = node.nodes.map((n) => flatten(n, x, w, c));
        const pieces = perNode.flat();
        if (!pieces.length) return [];
        if (node.keep === 'together') {
          const total = pieces.reduce((s, p) => s + p.h + p.before + p.after, 0);
          if (total <= contentHeight() * 0.6) for (let i = 0; i < pieces.length - 1; i++) pieces[i]!.keep = true;
          else for (let i = 0; i < Math.min(pieces.length - 1, 3); i++) pieces[i]!.keep = true;
        } else if (node.keep === 'head') {
          const headCount = perNode.slice(0, heads).reduce((s, arr) => s + arr.length, 0);
          const upto = Math.min(pieces.length - 1, headCount + Math.max(0, (node.minBody ?? 2) - 1));
          for (let i = 0; i < upto; i++) pieces[i]!.keep = true;
        }
        applyBeforeAfter(pieces, node.before, node.after);
        markKeepLast(pieces, node.keepWithNext);
        return pieces;
      }
      case 'section': {
        const c0 = withRef(ctx, node.ref ?? node.id);
        const sec: SectionCtx = { id: node.id, continued: node.continued ?? node.title, x, w, containers: c0.containers, refs: c0.refs };
        const c: Ctx = { ...c0, section: sec };
        const title = node.title.flatMap((n) => flatten(n, x, w, c));
        title.forEach((p) => {
          p.keep = true;
          p.sectionTitle = true;
        });
        const body = node.nodes.flatMap((n) => flatten(n, x, w, c));
        if (!body.length) return [];
        const pieces = [...title, ...body];
        applyBeforeAfter(pieces, node.before, node.after);
        markKeepLast(pieces, node.keepWithNext);
        return pieces;
      }
      case 'table':
        return tablePieces(node, x, w, withRef(ctx, node.ref));
      default:
        return [];
    }
  };

  const tablePieces = (node: TableNode, x: number, w: number, ctx: Ctx): Piece[] => {
    const st = node.style;
    const cols = Math.max(node.header?.length ?? 0, ...node.rows.map((r) => r.length), 1);
    let widths = node.widths && node.widths.length === cols ? node.widths : Array.from({ length: cols }, () => 1 / cols);
    const sum = widths.reduce((a, b) => a + b, 0) || 1;
    widths = widths.map((v) => (v / sum) * w);
    const pad = 1.6;
    const border = node.border ?? '#d1d5db';
    const rowPiece = (cells: Run[][], bold: boolean, fill: string | undefined): Piece => {
      const laid = widths.map((cw, i) => layoutRuns(cells[i] ?? [{ text: '' }], { ...st, bold: bold || st.bold }, cw - pad * 2));
      const lh = lineHeight(st.size, st);
      const h = Math.max(1, ...laid.map((l) => l.length)) * lh + pad * 2;
      stats.shapes++;
      return {
        h,
        before: 0,
        after: 0,
        keep: false,
        x,
        w,
        containers: ctx.containers,
        refs: ctx.refs,
        ...(ctx.section ? { section: ctx.section } : {}),
        draw: (y, out) => {
          let cx = x;
          laid.forEach((lines, i) => {
            const cw = widths[i]!;
            out.push({ k: 'rect', x: cx, y, w: cw, h, ...(fill ? { fill } : {}), stroke: border, lw: 0.2 });
            lines.forEach((ln, li) => drawLine(ln, cx + pad, y + pad + li * lh, lh, cw - pad * 2, 'left', out));
            cx += cw;
          });
        },
      };
    };
    const head = node.header && node.header.some((c) => c.some((r) => r.text.trim())) ? rowPiece(node.header, true, node.headerFill ?? '#f3f4f6') : null;
    const out: Piece[] = [];
    if (head) out.push({ ...head, keep: true });
    node.rows.forEach((r, i) => {
      const p = rowPiece(r, false, node.zebra && i % 2 === 1 ? node.zebra : undefined);
      out.push(head ? { ...p, header: head } : p);
    });
    applyBeforeAfter(out, node.before, node.after);
    markKeepLast(out, node.keepWithNext);
    return out;
  };

  /* ---------------------------- decorations -------------------------- */

  function decorate(placed: Array<{ piece: Piece; y: number; page: number }>, minDepth: number): Map<number, Prim[]> {
    const spans = new Map<string, { c: Container; page: number; y0: number; y1: number; first: boolean }>();
    const seen = new Set<number>();
    for (const { piece, y, page } of placed) {
      for (const c of piece.containers) {
        if (c.depth < minDepth) continue;
        const key = `${c.id}|${page}`;
        const s = spans.get(key);
        if (!s) {
          spans.set(key, { c, page, y0: y, y1: y + piece.h, first: !seen.has(c.id) });
          seen.add(c.id);
        } else {
          s.y0 = Math.min(s.y0, y);
          s.y1 = Math.max(s.y1, y + piece.h);
        }
      }
    }
    const byPage = new Map<number, Prim[]>();
    const sorted = [...spans.values()].sort((a, b) => a.c.depth - b.c.depth);
    for (const s of sorted) {
      const b = s.c.box;
      const list = byPage.get(s.page) ?? [];
      const h = s.y1 - s.y0;
      if (b.fill || b.stroke) {
        stats.shapes++;
        list.push({ k: 'rect', x: s.c.x, y: s.y0, w: s.c.w, h, ...(b.fill ? { fill: b.fill } : {}), ...(b.stroke ? { stroke: b.stroke, lw: b.strokeWidth ?? 0.25 } : {}), ...(b.radius ? { r: b.radius } : {}) });
      }
      if (b.bar) {
        stats.shapes++;
        list.push({ k: 'rect', x: s.c.x, y: s.y0, w: b.bar.width, h, fill: b.bar.color });
      }
      if (b.rail) {
        const r = b.rail;
        const rx = s.c.x + r.x;
        const top = s.first ? s.y0 + (b.padding?.[0] ?? 0) + r.dot + 0.8 : s.y0;
        list.push({ k: 'line', x1: rx, y1: top, x2: rx, y2: s.y1, color: r.color, lw: r.width });
        if (s.first) {
          stats.shapes++;
          const cy = s.y0 + (b.padding?.[0] ?? 0) + r.dot + 0.6;
          list.push(r.hollow ? { k: 'circle', cx: rx, cy, r: r.dot, fill: '#ffffff', stroke: r.dotColor ?? r.color, lw: r.width * 1.4 } : { k: 'circle', cx: rx, cy, r: r.dot, fill: r.dotColor ?? r.color });
        }
      }
      byPage.set(s.page, list);
    }
    return byPage;
  }

  /* ----------------------------- paginate ---------------------------- */

  const colTop = (colTopAbs: number | undefined) => colTopAbs ?? margin.top;
  const defaultBottom = pageH - margin.bottom;
  const contentHeight = () => defaultBottom - margin.top;

  const pages: LaidPage[] = [];
  const pageAt = (i: number): LaidPage => {
    while (pages.length <= i) pages.push({ index: pages.length, prims: [], refs: [] });
    return pages[i]!;
  };
  pageAt(0);

  // Masthead (page 1, full width).
  let mastheadBottom = margin.top;
  const mastPrims: Prim[] = [];
  if (flow.masthead?.length) {
    const mx = flow.mastheadX ?? margin.left;
    const mw = flow.mastheadWidth ?? pageW - margin.left - margin.right;
    const ctx: Ctx = { containers: [], refs: [] };
    const pieces = flow.masthead.flatMap((n) => flatten(n, mx, mw, ctx));
    const strip = atomic(pieces, mx, mw, ctx);
    if (strip) {
      atomicRefs = [];
      strip.draw?.(margin.top, mastPrims);
      pageAt(0).refs.push(...atomicRefs);
      mastheadBottom = margin.top + strip.h + (flow.mastheadGap ?? 5);
      if (mastheadBottom > defaultBottom) issues.push({ kind: 'overflow', message: 'The header is taller than the page.', page: 1 });
    }
  }

  const contentByPage = new Map<number, Prim[]>();
  const push = (page: number, prims: Prim[]) => {
    const list = contentByPage.get(page) ?? [];
    list.push(...prims);
    contentByPage.set(page, list);
  };
  const decoByPage = new Map<number, Prim[]>();
  let lastRatio = 0;
  let lastFill = 0;
  const colEnds: Array<{ page: number; used: number; avail: number }> = [];

  for (const col of flow.columns) {
    const ctx: Ctx = { containers: [], refs: [] };
    const pieces = col.nodes.flatMap((n) => flatten(n, col.x, col.width, ctx));
    const top = (page: number) => (page === 0 ? col.firstTop ?? (flow.masthead?.length ? Math.max(mastheadBottom, colTop(col.top)) : colTop(col.top)) : colTop(col.top));
    const bottom = col.bottom ?? defaultBottom;
    const placed: Array<{ piece: Piece; y: number; page: number }> = [];
    let page = 0;
    let y = top(0);
    let atTop = true;
    let prevAfter = 0;
    const sectionsSeen = new Set<string>();
    const newPage = () => {
      page++;
      pageAt(page);
      y = top(page);
      atTop = true;
      prevAfter = 0;
    };
    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i]!;
      if (p.brk) {
        if (!atTop) newPage();
        continue;
      }
      if (p.space && atTop) continue;
      let gap = atTop ? 0 : prevAfter + p.before;
      // Length of the keep-with-next chain starting here.
      let chain = gap + p.h;
      const fresh = bottom - top(page + 1);
      for (let j = i; pieces[j]?.keep && j + 1 < pieces.length && !pieces[j + 1]!.brk; j++) {
        const nx = pieces[j + 1]!;
        chain += pieces[j]!.after + nx.before + nx.h;
        if (chain > fresh + 1) break;
      }
      let broke = false;
      if (!atTop && y + chain > bottom + 0.01 && chain - gap <= fresh) {
        newPage();
        broke = true;
      } else if (!atTop && y + gap + p.h > bottom + 0.01) {
        newPage();
        broke = true;
      }
      if (p.space && broke) continue;
      if (broke) {
        gap = 0;
        // Repeat the section heading when a section continues on a new page.
        if (flow.repeatHeadings && p.section && !p.sectionTitle && sectionsSeen.has(p.section.id) && p.section.continued.length) {
          const sec = p.section;
          const cont = sec.continued.flatMap((n) => flatten(n, sec.x, sec.w, { containers: sec.containers, refs: sec.refs }));
          const strip = atomic(cont, sec.x, sec.w, { containers: sec.containers, refs: sec.refs });
          if (strip) {
            placed.push({ piece: strip, y, page });
            y += strip.h + (cont[cont.length - 1]?.after ?? 1.5);
          }
        }
        if (p.header) {
          placed.push({ piece: { ...p.header, containers: p.containers }, y, page });
          y += p.header.h;
        }
      }
      y += gap;
      placed.push({ piece: p, y, page });
      if (p.section) sectionsSeen.add(p.section.id);
      y += p.h;
      prevAfter = p.after;
      atTop = false;
      if (y > bottom + 0.5) {
        issues.push({ kind: 'overflow', message: 'An element is taller than the page and is cut off.', page: page + 1, ...(p.refs.length ? { ref: p.refs[p.refs.length - 1]! } : {}) });
      }
    }
    // Draw
    const deco = decorate(placed, 0);
    for (const [pg, prims] of deco) decoByPage.set(pg, [...(decoByPage.get(pg) ?? []), ...prims]);
    const byPage = new Map<number, Array<{ piece: Piece; y: number }>>();
    for (const pl of placed) {
      const out: Prim[] = [];
      atomicRefs = [];
      pl.piece.draw?.(pl.y, out);
      push(pl.page, out);
      pageAt(pl.page).refs.push(...atomicRefs);
      const arr = byPage.get(pl.page) ?? [];
      arr.push(pl);
      byPage.set(pl.page, arr);
    }
    for (const [pg, arr] of byPage) refBoxesInto(arr, 0, pageAt(pg).refs);
    const lastOnLast = placed.filter((p) => p.page === page);
    const used = lastOnLast.length ? Math.max(...lastOnLast.map((p) => p.y + p.piece.h)) - top(page) : 0;
    colEnds.push({ page, used, avail: Math.max(1, bottom - top(page)) });
  }
  for (const c of colEnds) {
    if (c.page !== pages.length - 1) continue;
    lastFill = Math.max(lastFill, c.used);
    lastRatio = Math.max(lastRatio, c.used / c.avail);
  }

  /* ------------------------- furniture & static ---------------------- */

  const total = pages.length;
  const selects = (sel: PageSelector, i: number) => sel === 'all' || (sel === 'first' ? i === 0 : i > 0);
  const decoPrims = (d: Decoration): Prim => {
    stats.shapes++;
    if (d.k === 'rect') return { k: 'rect', x: d.x, y: d.y, w: d.w, h: d.h, ...(d.fill ? { fill: d.fill } : {}), ...(d.stroke ? { stroke: d.stroke, lw: d.lw ?? 0.3 } : {}), ...(d.r ? { r: d.r } : {}) };
    if (d.k === 'line') return { k: 'line', x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2, color: d.color, lw: d.lw };
    return { k: 'circle', cx: d.cx, cy: d.cy, r: d.r, fill: d.fill };
  };
  const furniture = (f: NonNullable<FlowDoc['footer']>, i: number, yTop: number): Prim[] => {
    const runs = f.runs.map((r) => ({ ...r, text: r.text.replace(/\{page\}/g, String(i + 1)).replace(/\{pages\}/g, String(total)) }));
    const w = pageW - margin.left - margin.right;
    const lines = layoutRuns(runs, f.style, w);
    const out: Prim[] = [];
    const lh = lineHeight(f.style.size, f.style);
    lines.slice(0, 1).forEach((ln) => drawLine(ln, margin.left, yTop, lh, w, f.align, out));
    return out;
  };

  pages.forEach((pg, i) => {
    const prims: Prim[] = [];
    for (const d of flow.decorations ?? []) if (selects(d.pages, i)) prims.push(decoPrims(d));
    prims.push(...(decoByPage.get(i) ?? []));
    if (i === 0) prims.push(...mastPrims);
    prims.push(...(contentByPage.get(i) ?? []));
    if (flow.header && selects(flow.header.pages, i)) prims.push(...furniture(flow.header, i, Math.max(4, margin.top * 0.42 - 2)));
    if (flow.footer && selects(flow.footer.pages, i)) prims.push(...furniture(flow.footer, i, pageH - Math.max(6, margin.bottom * 0.55)));
    pg.prims = prims;
  });

  if (clippedWords) issues.push({ kind: 'clipped-word', message: `${clippedWords} long word${clippedWords === 1 ? ' was' : 's were'} broken across lines.` });
  if (unsupported.size) issues.push({ kind: 'unsupported-chars', message: `${unsupported.size} character${unsupported.size === 1 ? '' : 's'} (${[...unsupported].slice(0, 6).join(' ')}) cannot be shown by the PDF fonts and were removed.` });
  const minFont = Number.isFinite(stats.minFont) ? stats.minFont : 0;
  if (minFont && minFont < 7) issues.push({ kind: 'tiny-text', message: `Some text is set at ${minFont.toFixed(1)}pt, below the 7pt readability floor.` });

  return {
    width: pageW,
    height: pageH,
    ...(flow.page.background ? { background: flow.page.background } : {}),
    pages,
    issues,
    meta: flow.meta,
    ...(flow.data ? { data: flow.data } : {}),
    stats: {
      pages: total,
      images: stats.images,
      links: stats.links,
      minFontSize: minFont,
      textRuns: stats.runs,
      decorativeShapes: stats.shapes,
      unsupportedChars: [...unsupported],
      lastPageFill: lastFill,
      lastPageRatio: lastRatio,
    },
  };
}
