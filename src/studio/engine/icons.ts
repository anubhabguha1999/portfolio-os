/**
 * Vector icons for documents (resume contact lines). The artwork is the portfolio icon set
 * (src/sections/icons.ts, 24×24 grid); here it is parsed once into plain move / line / cubic
 * commands, so the PDF draws real vector paths and the SVG preview draws the same shapes.
 */
import { iconBody, socialIconFor } from '@/sections/icons';

export type IconCmd = { op: 'M' | 'L'; x: number; y: number } | { op: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number } | { op: 'Z' };

export interface VectorIcon {
  /** Brand marks are filled; the rest are 1.8-unit strokes, like the portfolio icons. */
  filled: boolean;
  /** One entry per sub-shape (path, circle or rect). */
  shapes: IconCmd[][];
}

/** Icons a document can use; anything else falls back to "link". */
export const DOC_ICONS = ['mail', 'phone', 'map-pin', 'globe', 'link', 'github', 'linkedin', 'x', 'dribbble', 'youtube', 'instagram', 'rss', 'palette'] as const;
export type DocIcon = (typeof DOC_ICONS)[number];

export const ICON_STROKE = 1.8;

/* ------------------------------------------------------------------ */
/* SVG path parsing (absolute commands only on the way out)            */
/* ------------------------------------------------------------------ */

const NUM = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;

function tokens(d: string): Array<string | number> {
  const out: Array<string | number> = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) out.push(m[1] ?? Number(m[2]));
  return out;
}

/** The 7 numbers of an arc segment (the icon set always separates its flags). */
function arcArgs(list: Array<string | number>, i: number): { args: number[]; next: number } | null {
  const args: number[] = [];
  let j = i;
  while (args.length < 7 && j < list.length && typeof list[j] === 'number') args.push(list[j++] as number);
  return args.length === 7 ? { args, next: j } : null;
}

/** SVG arc → cubic Béziers (standard endpoint-to-centre conversion). */
function arcToCubics(x1: number, y1: number, rx: number, ry: number, phiDeg: number, large: number, sweep: number, x2: number, y2: number): IconCmd[] {
  if (rx === 0 || ry === 0) return [{ op: 'L', x: x2, y: y2 }];
  const phi = (phiDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coef = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  let t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  else if (sweep && dt < 0) dt += 2 * Math.PI;
  const segs = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2)));
  const step = dt / segs;
  const k = (4 / 3) * Math.tan(step / 4);
  const out: IconCmd[] = [];
  const pt = (t: number) => ({ x: cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, y: cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos });
  const d = (t: number) => ({ x: -rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, y: -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos });
  for (let i = 0; i < segs; i++) {
    const a = t1;
    const b = t1 + step;
    const p0 = pt(a);
    const p1 = pt(b);
    const d0 = d(a);
    const d1 = d(b);
    out.push({ op: 'C', x1: p0.x + k * d0.x, y1: p0.y + k * d0.y, x2: p1.x - k * d1.x, y2: p1.y - k * d1.y, x: p1.x, y: p1.y });
    t1 = b;
  }
  return out;
}

export function parsePath(d: string): IconCmd[] {
  const list = tokens(d);
  const out: IconCmd[] = [];
  let i = 0;
  let cmd = '';
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let lastC: { x: number; y: number } | null = null; // reflection point for S
  let lastQ: { x: number; y: number } | null = null; // reflection point for T
  const n = () => list[i++] as number;
  const quad = (qx: number, qy: number, ex: number, ey: number) => {
    out.push({ op: 'C', x1: x + (2 / 3) * (qx - x), y1: y + (2 / 3) * (qy - y), x2: ex + (2 / 3) * (qx - ex), y2: ey + (2 / 3) * (qy - ey), x: ex, y: ey });
  };
  while (i < list.length) {
    if (typeof list[i] === 'string') cmd = list[i++] as string;
    else if (!cmd) break;
    const rel = cmd === cmd.toLowerCase() && cmd !== 'z' ? 1 : 0;
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    const C = cmd.toUpperCase();
    if (C !== 'S' && C !== 'C') lastC = null;
    if (C !== 'T' && C !== 'Q') lastQ = null;
    switch (C) {
      case 'M':
        x = ox + n();
        y = oy + n();
        sx = x;
        sy = y;
        out.push({ op: 'M', x, y });
        cmd = rel ? 'l' : 'L'; // following pairs are line-tos
        break;
      case 'L':
        x = ox + n();
        y = oy + n();
        out.push({ op: 'L', x, y });
        break;
      case 'H':
        x = ox + n();
        out.push({ op: 'L', x, y });
        break;
      case 'V':
        y = oy + n();
        out.push({ op: 'L', x, y });
        break;
      case 'C': {
        const x1 = ox + n(), y1 = oy + n(), x2 = ox + n(), y2 = oy + n(), ex = ox + n(), ey = oy + n();
        out.push({ op: 'C', x1, y1, x2, y2, x: ex, y: ey });
        lastC = { x: x2, y: y2 };
        x = ex;
        y = ey;
        break;
      }
      case 'S': {
        const x1 = lastC ? 2 * x - lastC.x : x;
        const y1 = lastC ? 2 * y - lastC.y : y;
        const x2 = ox + n(), y2 = oy + n(), ex = ox + n(), ey = oy + n();
        out.push({ op: 'C', x1, y1, x2, y2, x: ex, y: ey });
        lastC = { x: x2, y: y2 };
        x = ex;
        y = ey;
        break;
      }
      case 'Q': {
        const qx = ox + n(), qy = oy + n(), ex = ox + n(), ey = oy + n();
        quad(qx, qy, ex, ey);
        lastQ = { x: qx, y: qy };
        x = ex;
        y = ey;
        break;
      }
      case 'T': {
        const qx: number = lastQ ? 2 * x - lastQ.x : x;
        const qy: number = lastQ ? 2 * y - lastQ.y : y;
        const ex = ox + n(), ey = oy + n();
        quad(qx, qy, ex, ey);
        lastQ = { x: qx, y: qy };
        x = ex;
        y = ey;
        break;
      }
      case 'A': {
        const a = arcArgs(list, i);
        if (!a) return out;
        i = a.next;
        const [rx, ry, rot, large, sweep, ax, ay] = a.args as [number, number, number, number, number, number, number];
        const ex = ox + ax;
        const ey = oy + ay;
        out.push(...arcToCubics(x, y, rx, ry, rot, large, sweep, ex, ey));
        x = ex;
        y = ey;
        break;
      }
      case 'Z':
        out.push({ op: 'Z' });
        x = sx;
        y = sy;
        break;
      default:
        return out;
    }
  }
  return out;
}

const K = 0.5522847498; // circle → 4 cubics

function circleCmds(cx: number, cy: number, r: number): IconCmd[] {
  const k = K * r;
  return [
    { op: 'M', x: cx + r, y: cy },
    { op: 'C', x1: cx + r, y1: cy + k, x2: cx + k, y2: cy + r, x: cx, y: cy + r },
    { op: 'C', x1: cx - k, y1: cy + r, x2: cx - r, y2: cy + k, x: cx - r, y: cy },
    { op: 'C', x1: cx - r, y1: cy - k, x2: cx - k, y2: cy - r, x: cx, y: cy - r },
    { op: 'C', x1: cx + k, y1: cy - r, x2: cx + r, y2: cy - k, x: cx + r, y: cy },
    { op: 'Z' },
  ];
}

function rectCmds(x: number, y: number, w: number, h: number, r: number): IconCmd[] {
  r = Math.min(r, w / 2, h / 2);
  if (!r) return [{ op: 'M', x, y }, { op: 'L', x: x + w, y }, { op: 'L', x: x + w, y: y + h }, { op: 'L', x, y: y + h }, { op: 'Z' }];
  const k = K * r;
  return [
    { op: 'M', x: x + r, y },
    { op: 'L', x: x + w - r, y },
    { op: 'C', x1: x + w - r + k, y1: y, x2: x + w, y2: y + r - k, x: x + w, y: y + r },
    { op: 'L', x: x + w, y: y + h - r },
    { op: 'C', x1: x + w, y1: y + h - r + k, x2: x + w - r + k, y2: y + h, x: x + w - r, y: y + h },
    { op: 'L', x: x + r, y: y + h },
    { op: 'C', x1: x + r - k, y1: y + h, x2: x, y2: y + h - r + k, x, y: y + h - r },
    { op: 'L', x, y: y + r },
    { op: 'C', x1: x, y1: y + r - k, x2: x + r - k, y2: y, x: x + r, y },
    { op: 'Z' },
  ];
}

const attr = (el: string, name: string): number => {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(el);
  return m ? Number(m[1]!.match(NUM)?.[0] ?? 0) : 0;
};

function parseBody(body: string): IconCmd[][] {
  const shapes: IconCmd[][] = [];
  for (const m of body.matchAll(/<(path|circle|rect)\b[^>]*\/?>/g)) {
    const el = m[0];
    if (m[1] === 'path') {
      const d = /\sd="([^"]*)"/.exec(el)?.[1];
      if (d) shapes.push(parsePath(d));
    } else if (m[1] === 'circle') shapes.push(circleCmds(attr(el, 'cx'), attr(el, 'cy'), attr(el, 'r')));
    else shapes.push(rectCmds(attr(el, 'x'), attr(el, 'y'), attr(el, 'width'), attr(el, 'height'), attr(el, 'rx')));
  }
  return shapes.filter((s) => s.length);
}

const cache = new Map<string, VectorIcon>();

export function vectorIcon(name: string): VectorIcon {
  const key = (DOC_ICONS as readonly string[]).includes(name) ? name : 'link';
  let v = cache.get(key);
  if (!v) {
    const { filled, body } = iconBody(key);
    v = { filled, shapes: parseBody(body) };
    cache.set(key, v);
  }
  return v;
}

/** SVG path data (24×24 units) for the preview. */
export function iconPathData(name: string): string {
  return vectorIcon(name)
    .shapes.map((s) => s.map((c) => (c.op === 'Z' ? 'Z' : c.op === 'C' ? `C${f(c.x1)} ${f(c.y1)} ${f(c.x2)} ${f(c.y2)} ${f(c.x)} ${f(c.y)}` : `${c.op}${f(c.x)} ${f(c.y)}`)).join(''))
    .join('');
}

const f = (n: number) => String(Math.round(n * 1000) / 1000);

/** Which icon a contact item gets: e-mail, phone, location, website, or the social network's mark. */
export function contactIcon(kind: 'email' | 'phone' | 'location' | 'website' | 'social', platform = '', url = ''): DocIcon {
  if (kind === 'email') return 'mail';
  if (kind === 'phone') return 'phone';
  if (kind === 'location') return 'map-pin';
  if (kind === 'website') return 'globe';
  // Unknown networks get the generic link icon rather than a globe (the globe means "website").
  const name = socialIconFor(platform, url);
  return name !== 'globe' && (DOC_ICONS as readonly string[]).includes(name) ? (name as DocIcon) : 'link';
}
