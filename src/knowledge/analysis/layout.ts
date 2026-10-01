/**
 * Positioned text → reading-order lines → structured blocks.
 *
 * Pure functions (no DOM), so they run in the analysis worker and in tests.
 *
 *   items ─▶ segments (runs on one baseline, split at wide gaps)
 *         ─▶ columns (a vertical gutter most segments respect)
 *         ─▶ lines in reading order
 *         ─▶ headers/footers (text repeated at the same place on several pages)
 *         ─▶ blocks: title, heading, subheading, paragraph, list, table, image
 *
 * Everything here is heuristic. Tables and headings are best-effort and flagged when unsure.
 */
import type { Box, ExtractedBlock, ExtractedLine, ExtractedLink, ExtractedPage, RawPage, RawTextItem } from '../types';

// Includes the glyphs OCR commonly reads bullets as ("+", "»", "›", "«").
export const BULLET_RE = /^\s*(?:[•●▪◦·*–—‣⁃■□➢➤►▸✓✔+»›«-]|\d{1,2}[.)])\s+/;

/* ------------------------------ helpers ------------------------------ */

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

const union = (boxes: Box[]): Box => {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const r = Math.max(...boxes.map((b) => b.x + b.width));
  const btm = Math.max(...boxes.map((b) => b.y + b.height));
  return { x, y, width: r - x, height: btm - y };
};

const clean = (s: string) => s.replace(/ /g, ' ').replace(/[​-‍﻿]/g, '').replace(/\s+/g, ' ');

/** Safe link protocols. Everything else (javascript:, data:, file:, vbscript:…) is dropped. */
export function safeLinkUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s || s.length > 2000) return null;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(s)) {
    try {
      const u = new URL(s);
      if (!['http:', 'https:', 'mailto:', 'tel:'].includes(u.protocol)) return null;
      return s;
    } catch {
      return null;
    }
  }
  if (/^www\.[^\s]+\.[a-z]{2,}/i.test(s)) return `https://${s}`;
  return null;
}

/* ------------------------------ segments ----------------------------- */

interface Segment extends Box {
  text: string;
  fontSize: number;
  bold: boolean;
  confidence?: number;
  words: Array<Box & { text: string; confidence?: number }>;
}

/** Runs that share a baseline, split where the horizontal gap is wide enough to be a new column or cell. */
function toSegments(items: RawTextItem[]): Segment[] {
  const live = items.filter((i) => i.text.trim() || i.width > 0).filter((i) => i.text.trim());
  if (!live.length) return [];
  const sorted = [...live].sort((a, b) => a.y + a.height / 2 - (b.y + b.height / 2) || a.x - b.x);
  // Cluster by vertical centre.
  const rows: RawTextItem[][] = [];
  for (const it of sorted) {
    const cy = it.y + it.height / 2;
    const row = rows[rows.length - 1];
    if (row) {
      const ref = row[0]!;
      const rcy = ref.y + ref.height / 2;
      if (Math.abs(cy - rcy) <= Math.max(2, Math.min(ref.height, it.height) * 0.5)) {
        row.push(it);
        continue;
      }
    }
    rows.push([it]);
  }
  const out: Segment[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    let cur: RawTextItem[] = [];
    const flush = () => {
      if (!cur.length) return;
      let text = '';
      let prev: RawTextItem | null = null;
      for (const it of cur) {
        if (prev) {
          const gap = it.x - (prev.x + prev.width);
          const needsSpace = gap > Math.max(prev.fontSize, it.fontSize) * 0.12 && !/\s$/.test(text) && !/^\s/.test(it.text);
          if (needsSpace) text += ' ';
        }
        text += it.text;
        prev = it;
      }
      const box = union(cur);
      const confs = cur.map((c) => c.confidence).filter((c): c is number => typeof c === 'number');
      const sizes = cur.map((c) => c.fontSize);
      out.push({
        ...box,
        text: clean(text).trim(),
        fontSize: median(sizes),
        bold: cur.filter((c) => c.bold).reduce((n, c) => n + c.text.length, 0) >= cur.reduce((n, c) => n + c.text.length, 0) * 0.6,
        ...(confs.length ? { confidence: Math.min(...confs) } : {}),
        words: cur.map((c) => ({ x: c.x, y: c.y, width: c.width, height: c.height, text: c.text, ...(c.confidence !== undefined ? { confidence: c.confidence } : {}) })),
      });
      cur = [];
    };
    for (const it of row) {
      const last = cur[cur.length - 1];
      if (last) {
        const gap = it.x - (last.x + last.width);
        // A gap of ~2.5 em is a column/cell break, not a word space.
        if (gap > Math.max(last.fontSize, it.fontSize) * 2.5) flush();
      }
      cur.push(it);
    }
    flush();
  }
  return out.filter((s) => s.text);
}

/* ------------------------------ columns ------------------------------ */

/**
 * Find a vertical gutter: an x position in the middle of the page that most segments
 * do not cross. Returns null for single-column pages.
 */
export function findGutter(segs: Box[], pageWidth: number): number | null {
  if (segs.length < 8) return null;
  let best: { x: number; score: number } | null = null;
  for (let f = 0.25; f <= 0.75; f += 0.01) {
    const x = pageWidth * f;
    let left = 0;
    let right = 0;
    let cross = 0;
    for (const s of segs) {
      if (s.x + s.width <= x) left++;
      else if (s.x >= x) right++;
      else cross++;
    }
    if (left < 3 || right < 3) continue;
    const score = (left + right - cross * 4) / segs.length;
    if (cross / segs.length <= 0.15 && (!best || score > best.score)) best = { x, score };
  }
  if (!best || best.score <= 0.6) return null;
  // Tables also have a gap down the middle, but almost every left cell has a right cell on the
  // same baseline. Real column layouts (sidebar + main) rarely line up that well.
  const gx = best.x;
  const left = segs.filter((s) => s.x + s.width <= gx);
  const right = segs.filter((s) => s.x >= gx);
  const paired = left.filter((l) => right.some((r) => Math.abs(r.y - l.y) <= Math.max(1.5, l.height * 0.2))).length;
  return paired / left.length > 0.7 ? null : gx;
}

/**
 * Reading order: full-width segments split the page into bands; inside a band, left column then
 * right. Table rows are found first and kept whole, so a table's columns are never mistaken for
 * page columns.
 */
function readingOrder(segs: Segment[], pageWidth: number): Segment[] {
  const byY = [...segs].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = rowsOf(byY);
  const size = median(segs.map((s) => s.fontSize)) || 10;
  const locked = new Set<Segment>();
  for (const t of findTables(rows, size)) {
    const run = rows.slice(t.from, t.to + 1);
    if (tableLike(run)) for (const r of run) for (const s of r.segs) locked.add(s);
  }
  const gutter = findGutter(segs.filter((s) => !locked.has(s)), pageWidth);
  if (gutter === null) return byY;
  const out: Segment[] = [];
  let left: Segment[] = [];
  let right: Segment[] = [];
  const flush = () => {
    out.push(...left, ...right);
    left = [];
    right = [];
  };
  for (const s of byY) {
    if (locked.has(s)) {
      flush();
      out.push(s);
    } else if (s.x + s.width <= gutter) left.push(s);
    else if (s.x >= gutter) right.push(s);
    else {
      flush();
      out.push(s);
    }
  }
  flush();
  return out;
}

/** 3+ columns, or two columns of short cells. A sidebar beside long body text is not a table. */
function tableLike(run: Row[]): boolean {
  if (Math.max(...run.map((r) => r.segs.length)) >= 3) return true;
  return median(run.flatMap((r) => r.segs.map((s) => s.text.length))) <= 30;
}

/* ------------------------------ tables ------------------------------- */

interface Row {
  segs: Segment[];
  y: number;
}

/** Group segments on the same baseline back into rows (after column ordering). */
function rowsOf(segs: Segment[]): Row[] {
  const rows: Row[] = [];
  for (const s of segs) {
    const r = rows[rows.length - 1];
    if (r && Math.abs(r.y - s.y) <= Math.max(2, s.height * 0.45) && s.x > r.segs[r.segs.length - 1]!.x) r.segs.push(s);
    else rows.push({ segs: [s], y: s.y });
  }
  return rows;
}

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

/**
 * Runs of ≥3 consecutive multi-cell rows whose cell starts line up form a table.
 * Returns the row index ranges that are tables.
 */
function findTables(rows: Row[], bodySize: number): Array<{ from: number; to: number; uncertain: boolean }> {
  const tol = Math.max(6, bodySize * 1.2);
  const out: Array<{ from: number; to: number; uncertain: boolean }> = [];
  let i = 0;
  while (i < rows.length) {
    if (rows[i]!.segs.length < 2) {
      i++;
      continue;
    }
    const cols = rows[i]!.segs.map((s) => s.x);
    let j = i + 1;
    let irregular = false;
    while (j < rows.length && rows[j]!.segs.length >= 2) {
      const xs = rows[j]!.segs.map((s) => s.x);
      const aligned = xs.filter((x) => cols.some((c) => near(c, x, tol))).length;
      if (aligned < Math.min(2, xs.length) || aligned < xs.length * 0.6) break;
      if (xs.length !== cols.length) irregular = true;
      j++;
    }
    if (j - i >= 3 && cols.length >= 2) {
      out.push({ from: i, to: j - 1, uncertain: irregular || cols.length === 2 });
      i = j;
    } else i++;
  }
  return out;
}

function tableRows(rows: Row[], bodySize: number): string[][] {
  // Column anchors: cluster every cell's x across the table.
  const tol = Math.max(6, bodySize * 1.2);
  const anchors: number[] = [];
  for (const r of rows) for (const s of r.segs) if (!anchors.some((a) => near(a, s.x, tol))) anchors.push(s.x);
  anchors.sort((a, b) => a - b);
  return rows.map((r) => {
    const cells = anchors.map(() => '');
    for (const s of r.segs) {
      let k = 0;
      let d = Infinity;
      anchors.forEach((a, idx) => {
        const dd = Math.abs(a - s.x);
        if (dd < d) {
          d = dd;
          k = idx;
        }
      });
      cells[k] = cells[k] ? `${cells[k]} ${s.text}` : s.text;
    }
    return cells;
  });
}

/* --------------------------- header / footer ------------------------- */

const signature = (s: string) => s.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();

/**
 * Lines in the top or bottom band that repeat (digits ignored) on at least two pages and on
 * at least half of them, plus bare page numbers, are running headers and footers.
 */
function runningLines(pages: Array<{ height: number; segs: Segment[] }>): Set<Segment> {
  const out = new Set<Segment>();
  const counts = new Map<string, number>();
  const band = (p: { height: number }, s: Segment) => (s.y < p.height * 0.09 ? 'top' : s.y + s.height > p.height * 0.91 ? 'bottom' : null);
  for (const p of pages) {
    const seen = new Set<string>();
    for (const s of p.segs) {
      const b = band(p, s);
      if (!b) continue;
      const k = `${b}|${signature(s.text)}`;
      if (!seen.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
      seen.add(k);
    }
  }
  const min = Math.max(2, Math.ceil(pages.length / 2));
  for (const p of pages) {
    for (const s of p.segs) {
      const b = band(p, s);
      if (!b) continue;
      const pageNo = /^(page\s*)?\d{1,4}(\s*(of|\/)\s*\d{1,4})?$/i.test(s.text.trim());
      if ((pages.length >= 2 && (counts.get(`${b}|${signature(s.text)}`) ?? 0) >= min) || (pageNo && b === 'bottom')) out.add(s);
    }
  }
  return out;
}

/* ------------------------------- blocks ------------------------------ */

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

function isHeadingLike(seg: Segment, bodySize: number): 0 | 1 | 2 | 3 {
  const t = seg.text.trim();
  if (!t || t.length > 80 || BULLET_RE.test(t) || /[.,;]$/.test(t) || words(t) > 9) return 0;
  const ratio = seg.fontSize / (bodySize || seg.fontSize || 1);
  const letters = t.replace(/[^A-Za-z]/g, '');
  const caps = letters.length >= 3 && letters === letters.toUpperCase();
  if (ratio >= 1.6) return 1;
  if (ratio >= 1.2) return 2;
  if ((seg.bold || caps) && words(t) <= 5 && ratio >= 0.95) return 3;
  return 0;
}

let blockCounter = 0;
const blockId = (page: number) => `p${page}-b${++blockCounter}`;

function lineOf(s: Segment): ExtractedLine {
  return { x: s.x, y: s.y, width: s.width, height: s.height, text: s.text, fontSize: s.fontSize, bold: s.bold, ...(s.confidence !== undefined ? { confidence: s.confidence } : {}), words: s.words };
}

function makeBlock(page: number, type: ExtractedBlock['type'], segs: Segment[], extra: Partial<ExtractedBlock> = {}): ExtractedBlock {
  const box = union(segs);
  const confs = segs.map((s) => s.confidence).filter((c): c is number => typeof c === 'number');
  return {
    id: blockId(page),
    page,
    type,
    ...box,
    text: segs.map((s) => s.text).join(type === 'paragraph' ? ' ' : '\n'),
    lines: segs.map(lineOf),
    ...(confs.length ? { confidence: Math.min(...confs) } : {}),
    ...extra,
  };
}

export interface LayoutOptions {
  tables: boolean;
  images: boolean;
  structure: boolean;
}

/** Turn parsed pages into structured pages. */
export function analyseLayout(raw: RawPage[], opts: LayoutOptions = { tables: true, images: true, structure: true }): ExtractedPage[] {
  blockCounter = 0;
  const prepared = raw.map((p) => ({ page: p, height: p.height, segs: readingOrder(toSegments(p.items), p.width) }));
  const running = runningLines(prepared);
  const bodySize = median(prepared.flatMap((p) => p.segs.filter((s) => !running.has(s)).flatMap((s) => Array(Math.max(1, Math.round(s.text.length / 20))).fill(s.fontSize) as number[])));
  let titled = false;

  return prepared.map(({ page: p, segs }) => {
    const blocks: ExtractedBlock[] = [];
    const header = segs.filter((s) => running.has(s) && s.y < p.height / 2);
    const footer = segs.filter((s) => running.has(s) && s.y >= p.height / 2);
    const body = segs.filter((s) => !running.has(s));
    if (header.length) blocks.push(makeBlock(p.page, 'header', header));

    if (!opts.structure) {
      if (body.length) blocks.push(makeBlock(p.page, 'paragraph', body, { text: body.map((s) => s.text).join('\n') }));
    } else {
      const rows = rowsOf(body);
      const tables = opts.tables ? findTables(rows, bodySize) : [];
      let para: Segment[] = [];
      let list: { segs: Segment[]; items: string[]; indent: number } | null = null;
      const flushPara = () => {
        if (para.length) blocks.push(makeBlock(p.page, 'paragraph', para));
        para = [];
      };
      const flushList = () => {
        if (list) blocks.push(makeBlock(p.page, 'list', list.segs, { items: list.items, text: list.items.map((i) => `• ${i}`).join('\n') }));
        list = null;
      };
      const lineGap = Math.max(bodySize * 0.9, 2);
      // A line that runs (almost) to the right edge of the text and does not end a sentence wraps onto the next.
      const right = Math.max(0, ...body.map((s) => s.x + s.width));
      const wraps = (prev: Segment, text: string) => prev.x + prev.width >= right - bodySize * 4 && !/[.!?:;]$/.test(text.trim());
      let prevBottom: number | null = null;
      let prevX: number | null = null;

      for (let r = 0; r < rows.length; r++) {
        const t = tables.find((tb) => tb.from === r);
        if (t) {
          flushPara();
          flushList();
          const tr = rows.slice(t.from, t.to + 1);
          const segsT = tr.flatMap((x) => x.segs);
          const cells = tableRows(tr, bodySize);
          blocks.push(makeBlock(p.page, 'table', segsT, { rows: cells, text: cells.map((c) => c.join(' | ')).join('\n'), ...(t.uncertain ? { uncertain: true } : {}) }));
          r = t.to;
          prevBottom = Math.max(...segsT.map((s) => s.y + s.height));
          prevX = null;
          continue;
        }
        // Rows that are not tables: their segments are separate lines (two columns were already ordered).
        for (const seg of rows[r]!.segs) {
          const gap = prevBottom === null ? 0 : seg.y - prevBottom;
          const level = isHeadingLike(seg, bodySize);
          const bullet = BULLET_RE.test(seg.text);
          const bigGap = prevBottom !== null && gap > lineGap * 1.1;
          const columnJump = prevX !== null && Math.abs(seg.x - prevX) > bodySize * 8 && gap < 0;

          if (level) {
            flushPara();
            flushList();
            const type = !titled && p.page === raw[0]?.page && level === 1 && blocks.filter((b) => b.type !== 'header').length === 0 ? 'title' : level <= 2 ? 'heading' : 'subheading';
            if (type === 'title') titled = true;
            blocks.push(makeBlock(p.page, type, [seg], { level }));
          } else if (bullet) {
            flushPara();
            const text = seg.text.replace(BULLET_RE, '').trim();
            if (!list || bigGap) {
              flushList();
              list = { segs: [], items: [], indent: seg.x };
            }
            list.segs.push(seg);
            list.items.push(text);
          } else if (list && !bigGap && seg.x >= list.indent - bodySize * 0.5 && (seg.x > list.indent + bodySize * 0.3 || /^[a-z(]/.test(seg.text) || wraps(list.segs[list.segs.length - 1]!, list.items[list.items.length - 1]!))) {
            // Wrapped continuation of the last bullet: indented, lower-case, or the previous line ran to the margin.
            list.segs.push(seg);
            list.items[list.items.length - 1] = `${list.items[list.items.length - 1]} ${seg.text}`.trim();
          } else {
            flushList();
            const sizeChange = para.length > 0 && Math.abs(para[para.length - 1]!.fontSize - seg.fontSize) > bodySize * 0.15;
            if (bigGap || columnJump || sizeChange) flushPara();
            para.push(seg);
          }
          prevBottom = seg.y + seg.height;
          prevX = seg.x;
        }
      }
      flushPara();
      flushList();
    }

    if (opts.images) for (const img of p.images) blocks.push({ id: blockId(p.page), page: p.page, type: 'image', ...img, text: '', lines: [] });
    if (footer.length) blocks.push(makeBlock(p.page, 'footer', footer));
    return { page: p.page, width: p.width, height: p.height, ocr: p.ocr, blocks };
  });
}

/* -------------------------------- links ------------------------------ */

const URL_IN_TEXT = /\b(?:https?:\/\/[^\s<>"')\]]+|www\.[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s<>"')\]]*)?|(?:github\.com|gitlab\.com|linkedin\.com|behance\.net|dribbble\.com)\/[^\s<>"')\]]+)/gi;
const EMAIL_IN_TEXT = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/** Link annotations (with the text under them) plus URLs and emails written in the text. */
export function collectLinks(raw: RawPage[], pages: ExtractedPage[]): ExtractedLink[] {
  const out: ExtractedLink[] = [];
  const seen = new Set<string>();
  const push = (l: ExtractedLink) => {
    const k = `${l.page}|${l.url.toLowerCase()}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(l);
  };
  for (const p of raw) {
    for (const a of p.links) {
      const url = safeLinkUrl(a.url);
      if (!url) continue;
      const under = p.items
        .filter((i) => i.x + i.width > a.x - 1 && i.x < a.x + a.width + 1 && i.y + i.height > a.y - 1 && i.y < a.y + a.height + 1)
        .sort((x, y) => x.y - y.y || x.x - y.x)
        .map((i) => i.text)
        .join(' ');
      push({ text: clean(under).trim() || url, url, page: p.page, origin: 'annotation' });
    }
  }
  for (const p of pages) {
    for (const b of p.blocks) {
      for (const m of b.text.matchAll(URL_IN_TEXT)) {
        const raw0 = m[0].replace(/[.,;:]+$/, '');
        const url = safeLinkUrl(/^https?:/i.test(raw0) ? raw0 : `https://${raw0.replace(/^www\./i, 'www.')}`);
        if (url) push({ text: raw0, url, page: p.page, origin: 'text' });
      }
      for (const m of b.text.matchAll(EMAIL_IN_TEXT)) push({ text: m[0], url: `mailto:${m[0]}`, page: p.page, origin: 'text' });
    }
  }
  return out;
}

/* ------------------------------ plain text --------------------------- */

/**
 * Join wrapped lines back into one: a line that reaches close to the right edge of the page's text
 * area and does not end a sentence continues on the next line. Short lines (contact rows, titles,
 * link rows) stay separate. `textRight` = right edge of the text area (see textRightOf).
 */
export function reflow(lines: ExtractedLine[], textRight: number): string[] {
  if (lines.length < 2) return lines.map((l) => l.text);
  const left = Math.min(...lines.map((l) => l.x));
  const out: string[] = [];
  let prev: ExtractedLine | null = null;
  for (const l of lines) {
    const wide = prev && prev.x + prev.width >= textRight - prev.fontSize * 4;
    const sameRow = prev && Math.abs(prev.y - l.y) < l.height * 0.5;
    if (prev && wide && !sameRow && !/[.!?:;|]$/.test(prev.text.trim()) && Math.abs(l.x - left) < l.fontSize * 1.5) out[out.length - 1] = `${out[out.length - 1]} ${l.text}`.replace(/(\w)- (\w)/g, '$1$2');
    else out.push(l.text);
    prev = l;
  }
  return out;
}

/** Right edge of the body text on a page (headers, footers and images excluded). */
export function textRightOf(page: ExtractedPage): number {
  const xs = page.blocks.filter((b) => b.type !== 'header' && b.type !== 'footer' && b.type !== 'image').map((b) => b.x + b.width);
  return xs.length ? Math.max(...xs) : page.width;
}

/** Whole-document text; a paragraph cut by a page break is joined back together. */
export function documentText(pages: ExtractedPage[]): string {
  const texts = pages.map((p) => pageText(p));
  let out = '';
  pages.forEach((p, i) => {
    const t = texts[i]!;
    if (!out) return void (out = t);
    if (!t) return;
    const prevPage = pages[i - 1]!;
    const last = [...prevPage.blocks].reverse().find((b) => b.type !== 'footer' && b.type !== 'image' && b.type !== 'header');
    const first = p.blocks.find((b) => b.type !== 'header' && b.type !== 'image');
    const continues = last?.type === 'paragraph' && first?.type === 'paragraph' && !/[.!?:;]$/.test(last.text.trim());
    out += continues ? ` ${t}` : `\n\n${t}`;
  });
  return out;
}

/** Readable text for one page: headings on their own line, bullets kept, tables as pipe rows. */
export function pageText(page: ExtractedPage, opts: { headersFooters?: boolean } = {}): string {
  const parts: string[] = [];
  const right = textRightOf(page);
  for (const b of page.blocks) {
    if (b.type === 'image') continue;
    if ((b.type === 'header' || b.type === 'footer') && !opts.headersFooters) continue;
    if (b.type === 'list') parts.push((b.items ?? []).map((i) => `• ${i}`).join('\n'));
    else if (b.type === 'table') parts.push((b.rows ?? []).map((r) => r.join(' | ')).join('\n'));
    else if (b.type === 'paragraph') parts.push(reflow(b.lines, right).join('\n'));
    else parts.push(b.text);
  }
  return parts.join('\n\n');
}
