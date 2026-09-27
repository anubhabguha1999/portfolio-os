/**
 * Deterministic abstract artwork for template sample content.
 *
 * Every image is an inline SVG encoded as a base64 data URL, so templates work
 * offline, never hotlink third-party photos, and look identical on every render.
 * The same seed always produces the same picture.
 */
import { getTheme } from '@/lib/theme/themes';
import type { ColorScheme, ImageRef } from '@/types/portfolio';

export interface ArtPalette {
  /** Canvas colour. */
  bg: string;
  /** Secondary canvas (cards, panels). */
  surface: string;
  /** Foreground / ink colour. */
  ink: string;
  /** Three accent colours used for shapes. */
  a: string;
  b: string;
  c: string;
}

export type CoverVariant = 'mesh' | 'grid' | 'orbit' | 'stripes' | 'blocks' | 'terminal' | 'waves' | 'arches' | 'dashboard' | 'glass' | 'contours' | 'type';

/** Build an art palette from a theme's palette (defaults to the theme's own scheme). */
export function paletteFor(themeId: string, scheme?: ColorScheme): ArtPalette {
  const theme = getTheme(themeId);
  const p = theme.palettes[scheme ?? theme.defaultScheme];
  return { bg: p.background, surface: p.surface, ink: p.text, a: p.primary, b: p.secondary, c: p.accent };
}

/* ------------------------------ Utilities ------------------------------ */

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — tiny, fast, deterministic PRNG. */
function rngFrom(seed: string): () => number {
  let a = hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length) % list.length] as T;
}

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function base64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${base64(svg)}`;
}

function svg(w: number, h: number, body: string, defs = ''): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`;
}

/** Subtle film grain shared by several variants. */
function grain(id: string, opacity = 0.08): { def: string; layer: (w: number, h: number) => string } {
  return {
    def: `<filter id="${id}"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .6 0"/></filter>`,
    layer: (w, h) => `<rect width="${w}" height="${h}" filter="url(#${id})" opacity="${opacity}"/>`,
  };
}

/* ------------------------------- Variants ------------------------------ */

type Painter = (rng: () => number, p: ArtPalette, w: number, h: number) => string;

const mesh: Painter = (rng, p, w, h) => {
  const g = grain('gr');
  const blobs = [p.a, p.b, p.c, p.a]
    .map((c, i) => {
      const cx = r1(w * (0.15 + rng() * 0.7));
      const cy = r1(h * (0.1 + rng() * 0.8));
      const r = r1(Math.max(w, h) * (0.22 + rng() * 0.18) * (i === 3 ? 0.6 : 1));
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}" opacity="${i === 3 ? 0.55 : 0.85}"/>`;
    })
    .join('');
  return svg(
    w,
    h,
    `<rect width="${w}" height="${h}" fill="${p.bg}"/><g filter="url(#bl)">${blobs}</g>${g.layer(w, h)}<rect x="${w * 0.06}" y="${h * 0.08}" width="${w * 0.88}" height="${h * 0.84}" rx="${Math.min(w, h) * 0.04}" fill="none" stroke="${p.ink}" stroke-opacity=".18"/>`,
    `<filter id="bl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${Math.round(Math.min(w, h) * 0.12)}"/></filter>${g.def}`,
  );
};

const grid: Painter = (rng, p, w, h) => {
  const step = Math.round(Math.min(w, h) / (10 + Math.floor(rng() * 6)));
  let lines = '';
  for (let x = step; x < w; x += step) lines += `<path d="M${x} 0V${h}"/>`;
  for (let y = step; y < h; y += step) lines += `<path d="M0 ${y}H${w}"/>`;
  const cx = r1(w * (0.55 + rng() * 0.2));
  const cy = r1(h * (0.4 + rng() * 0.2));
  const r = r1(Math.min(w, h) * (0.26 + rng() * 0.08));
  const sq = step * (2 + Math.floor(rng() * 3));
  const sx = Math.round((w * 0.12) / step) * step;
  const sy = Math.round((h * 0.58) / step) * step;
  return svg(
    w,
    h,
    `<rect width="${w}" height="${h}" fill="${p.bg}"/><g stroke="${p.ink}" stroke-opacity=".09" stroke-width="1">${lines}</g><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#gg)"/><rect x="${sx}" y="${sy}" width="${sq}" height="${sq}" fill="${p.c}" opacity=".9"/><path d="M${sx} ${sy - step * 2}L${cx} ${cy}" stroke="${p.ink}" stroke-opacity=".35" stroke-dasharray="4 6"/><circle cx="${cx}" cy="${cy}" r="${step * 0.18}" fill="${p.ink}"/>`,
    `<linearGradient id="gg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.a}"/><stop offset="1" stop-color="${p.b}"/></linearGradient>`,
  );
};

const orbit: Painter = (rng, p, w, h) => {
  const cx = w * (0.5 + (rng() - 0.5) * 0.2);
  const cy = h * (0.5 + (rng() - 0.5) * 0.2);
  const base = Math.min(w, h) * 0.08;
  let rings = '';
  let dots = '';
  for (let i = 1; i <= 6; i++) {
    const r = base * i * 1.15;
    rings += `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" fill="none" stroke="${p.ink}" stroke-opacity="${r1(0.22 - i * 0.025)}"/>`;
    const ang = rng() * Math.PI * 2;
    const col = pick(rng, [p.a, p.b, p.c]);
    dots += `<circle cx="${r1(cx + Math.cos(ang) * r)}" cy="${r1(cy + Math.sin(ang) * r)}" r="${r1(base * (0.12 + rng() * 0.22))}" fill="${col}"/>`;
  }
  return svg(
    w,
    h,
    `<rect width="${w}" height="${h}" fill="${p.bg}"/><circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(base * 7.5)}" fill="url(#og)"/>${rings}<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(base * 0.7)}" fill="${p.a}"/>${dots}`,
    `<radialGradient id="og"><stop offset="0" stop-color="${p.a}" stop-opacity=".35"/><stop offset="1" stop-color="${p.bg}" stop-opacity="0"/></radialGradient>`,
  );
};

const stripes: Painter = (rng, p, w, h) => {
  const band = Math.round(Math.min(w, h) * (0.08 + rng() * 0.05));
  let bands = '';
  const cols = [p.a, p.ink, p.c, p.bg];
  for (let i = -Math.ceil(h / band); i < Math.ceil((w + h) / band); i++) {
    const c = cols[(i + 400) % cols.length] ?? p.a;
    const x = i * band;
    bands += `<path d="M${x} ${h}L${x + h} 0h${band}L${x + band} ${h}z" fill="${c}"/>`;
  }
  const bw = Math.round(w * 0.42);
  const bh = Math.round(h * 0.36);
  const bx = Math.round(w * (0.08 + rng() * 0.1));
  const by = Math.round(h * (0.52 + rng() * 0.06));
  const bord = Math.max(4, Math.round(Math.min(w, h) * 0.008));
  return svg(
    w,
    h,
    `<rect width="${w}" height="${h}" fill="${p.bg}"/><g clip-path="url(#sc)">${bands}</g><rect x="${bx + bord * 3}" y="${by + bord * 3}" width="${bw}" height="${bh}" fill="${p.ink}"/><rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="${p.surface}" stroke="${p.ink}" stroke-width="${bord}"/><rect x="${bx + bw * 0.1}" y="${by + bh * 0.28}" width="${bw * 0.62}" height="${bh * 0.14}" fill="${p.ink}"/><rect x="${bx + bw * 0.1}" y="${by + bh * 0.56}" width="${bw * 0.38}" height="${bh * 0.1}" fill="${p.c}"/>`,
    `<clipPath id="sc"><rect x="${w * 0.46}" y="0" width="${w * 0.54}" height="${h}"/></clipPath>`,
  );
};

const blocks: Painter = (rng, p, w, h) => {
  const u = Math.min(w, h) / 4;
  const cols = [p.a, p.b, p.c, p.ink, p.surface];
  let shapes = '';
  for (let gx = 0; gx * u < w; gx++) {
    for (let gy = 0; gy * u < h; gy++) {
      const x = gx * u;
      const y = gy * u;
      const c = pick(rng, cols);
      const k = Math.floor(rng() * 5);
      if (k === 0) shapes += `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(u)}" height="${r1(u)}" fill="${c}"/>`;
      else if (k === 1) shapes += `<circle cx="${r1(x + u / 2)}" cy="${r1(y + u / 2)}" r="${r1(u * 0.42)}" fill="${c}"/>`;
      else if (k === 2) shapes += `<path d="M${r1(x)} ${r1(y + u)}A${r1(u)} ${r1(u)} 0 0 1 ${r1(x + u)} ${r1(y)}V${r1(y + u)}z" fill="${c}"/>`;
      else if (k === 3) shapes += `<path d="M${r1(x)} ${r1(y + u)}L${r1(x + u / 2)} ${r1(y)}L${r1(x + u)} ${r1(y + u)}z" fill="${c}"/>`;
    }
  }
  return svg(w, h, `<rect width="${w}" height="${h}" fill="${p.bg}"/>${shapes}`);
};

const terminal: Painter = (rng, p, w, h) => {
  const pad = Math.round(w * 0.07);
  const ww = w - pad * 2;
  const wh = h - pad * 2;
  const bar = Math.round(wh * 0.08);
  const lh = Math.round(wh * 0.07);
  let code = '';
  let y = pad + bar + lh;
  let indent = 0;
  while (y < pad + wh - lh * 0.6) {
    const segs = 1 + Math.floor(rng() * 3);
    let x = pad + ww * 0.08 + indent * ww * 0.04;
    code += `<rect x="${r1(pad + ww * 0.025)}" y="${r1(y - lh * 0.22)}" width="${r1(ww * 0.025)}" height="${r1(lh * 0.22)}" rx="2" fill="${p.ink}" opacity=".18"/>`;
    for (let s = 0; s < segs; s++) {
      const sw = ww * (0.06 + rng() * 0.18);
      const col = pick(rng, [p.a, p.b, p.c, p.ink]);
      code += `<rect x="${r1(x)}" y="${r1(y - lh * 0.28)}" width="${r1(sw)}" height="${r1(lh * 0.3)}" rx="3" fill="${col}" opacity="${col === p.ink ? 0.45 : 0.9}"/>`;
      x += sw + ww * 0.02;
    }
    indent = Math.max(0, Math.min(3, indent + (rng() > 0.6 ? 1 : rng() > 0.6 ? -1 : 0)));
    y += lh;
  }
  const dots = [0, 1, 2].map((i) => `<circle cx="${r1(pad + bar * (0.7 + i * 0.75))}" cy="${r1(pad + bar / 2)}" r="${r1(bar * 0.2)}" fill="${p.ink}" opacity=".25"/>`).join('');
  return svg(
    w,
    h,
    `<rect width="${w}" height="${h}" fill="url(#tb)"/><rect x="${pad}" y="${pad}" width="${ww}" height="${wh}" rx="${r1(w * 0.012)}" fill="${p.surface}" stroke="${p.ink}" stroke-opacity=".14"/><path d="M${pad} ${pad + bar}H${pad + ww}" stroke="${p.ink}" stroke-opacity=".12"/>${dots}${code}<rect x="${r1(pad + ww * 0.08)}" y="${r1(y - lh * 0.42)}" width="${r1(lh * 0.28)}" height="${r1(lh * 0.48)}" fill="${p.a}"/>`,
    `<linearGradient id="tb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.bg}"/><stop offset="1" stop-color="${p.a}" stop-opacity=".22"/></linearGradient>`,
  );
};

const waves: Painter = (rng, p, w, h) => {
  const layers = 6;
  let paths = '';
  const cols = [p.a, p.b, p.c];
  for (let i = 0; i < layers; i++) {
    const base = h * (0.3 + i * 0.12);
    const amp = h * (0.05 + rng() * 0.07);
    const phase = rng() * Math.PI * 2;
    const freq = 1 + rng() * 1.5;
    let d = `M0 ${r1(base)}`;
    for (let x = 0; x <= w; x += w / 24) d += `L${r1(x)} ${r1(base + Math.sin((x / w) * Math.PI * 2 * freq + phase) * amp)}`;
    d += `L${w} ${h}L0 ${h}z`;
    paths += `<path d="${d}" fill="${cols[i % 3]}" opacity="${r1(0.35 + i * 0.1)}"/>`;
  }
  return svg(w, h, `<rect width="${w}" height="${h}" fill="${p.bg}"/>${paths}`);
};

const arches: Painter = (rng, p, w, h) => {
  const n = 3 + Math.floor(rng() * 2);
  const aw = (w * 0.8) / n;
  let body = '';
  for (let i = 0; i < n; i++) {
    const x = w * 0.1 + i * aw + aw * 0.08;
    const ww = aw * 0.84;
    const top = h * (0.18 + rng() * 0.14);
    const bottom = h * 0.86;
    const d = `M${r1(x)} ${r1(bottom)}V${r1(top + ww / 2)}A${r1(ww / 2)} ${r1(ww / 2)} 0 0 1 ${r1(x + ww)} ${r1(top + ww / 2)}V${r1(bottom)}`;
    body += `<path d="${d}" fill="${i % 2 ? p.surface : 'url(#ag)'}" stroke="${p.a}" stroke-width="1.5"/>`;
    body += `<path d="${d}" fill="none" stroke="${p.a}" stroke-opacity=".35" transform="translate(${r1(ww * 0.08)} ${r1(ww * 0.08)}) scale(${r1((ww * 0.84) / ww)})" transform-origin="${r1(x)} ${r1(bottom)}"/>`;
  }
  const sun = `<circle cx="${r1(w * (0.3 + rng() * 0.4))}" cy="${r1(h * 0.3)}" r="${r1(h * 0.09)}" fill="${p.a}" opacity=".85"/>`;
  return svg(
    w,
    h,
    `<rect width="${w}" height="${h}" fill="${p.bg}"/>${sun}${body}<path d="M${w * 0.06} ${h * 0.86}H${w * 0.94}" stroke="${p.a}" stroke-width="1.5"/><rect x="${w * 0.03}" y="${h * 0.05}" width="${w * 0.94}" height="${h * 0.9}" fill="none" stroke="${p.a}" stroke-opacity=".4"/>`,
    `<linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.a}" stop-opacity=".45"/><stop offset="1" stop-color="${p.bg}" stop-opacity="0"/></linearGradient>`,
  );
};

const dashboard: Painter = (rng, p, w, h) => {
  const pad = w * 0.06;
  const side = w * 0.16;
  const inner = w - pad * 2;
  const top = h * 0.1;
  const panelH = h - top - pad * 0.6;
  let nav = '';
  for (let i = 0; i < 6; i++) nav += `<rect x="${r1(pad + side * 0.14)}" y="${r1(top + panelH * (0.12 + i * 0.09))}" width="${r1(side * (0.45 + rng() * 0.35))}" height="${r1(panelH * 0.03)}" rx="3" fill="${i === 1 ? p.a : p.ink}" opacity="${i === 1 ? 1 : 0.2}"/>`;
  const cx = pad + side + inner * 0.03;
  const cw = inner - side - inner * 0.06;
  let kpis = '';
  for (let i = 0; i < 3; i++) {
    const kx = cx + i * (cw / 3);
    kpis += `<rect x="${r1(kx)}" y="${r1(top + panelH * 0.08)}" width="${r1(cw / 3 - cw * 0.02)}" height="${r1(panelH * 0.2)}" rx="8" fill="${p.bg}" stroke="${p.ink}" stroke-opacity=".08"/><rect x="${r1(kx + cw * 0.02)}" y="${r1(top + panelH * 0.12)}" width="${r1(cw * 0.08)}" height="${r1(panelH * 0.025)}" rx="3" fill="${p.ink}" opacity=".3"/><rect x="${r1(kx + cw * 0.02)}" y="${r1(top + panelH * 0.18)}" width="${r1(cw * (0.1 + rng() * 0.08))}" height="${r1(panelH * 0.05)}" rx="4" fill="${[p.a, p.b, p.c][i]}"/>`;
  }
  const chartY = top + panelH * 0.34;
  const chartH = panelH * 0.58;
  let d = '';
  let area = '';
  const pts = 14;
  let v = 0.4 + rng() * 0.2;
  for (let i = 0; i <= pts; i++) {
    v = Math.max(0.1, Math.min(0.92, v + (rng() - 0.38) * 0.16));
    const x = cx + (cw * i) / pts;
    const y = chartY + chartH * (1 - v);
    d += `${i ? 'L' : 'M'}${r1(x)} ${r1(y)}`;
  }
  area = `${d}L${r1(cx + cw)} ${r1(chartY + chartH)}L${r1(cx)} ${r1(chartY + chartH)}z`;
  let bars = '';
  for (let i = 0; i < 4; i++) bars += `<path d="M${r1(cx)} ${r1(chartY + (chartH * (i + 1)) / 5)}H${r1(cx + cw)}" stroke="${p.ink}" stroke-opacity=".07"/>`;
  return svg(
    w,
    h,
    `<rect width="${w}" height="${h}" fill="url(#db)"/><rect x="${r1(pad)}" y="${r1(top)}" width="${r1(inner)}" height="${r1(panelH + pad)}" rx="14" fill="${p.surface}" stroke="${p.ink}" stroke-opacity=".1"/><path d="M${r1(pad + side)} ${r1(top)}V${r1(top + panelH + pad)}" stroke="${p.ink}" stroke-opacity=".08"/>${nav}${kpis}${bars}<path d="${area}" fill="url(#da)"/><path d="${d}" fill="none" stroke="${p.a}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`,
    `<linearGradient id="db" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.bg}"/><stop offset="1" stop-color="${p.b}" stop-opacity=".18"/></linearGradient><linearGradient id="da" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.a}" stop-opacity=".35"/><stop offset="1" stop-color="${p.a}" stop-opacity="0"/></linearGradient>`,
  );
};

const glass: Painter = (rng, p, w, h) => {
  const blobs = [p.a, p.b, p.c]
    .map((c) => `<circle cx="${r1(w * (0.15 + rng() * 0.7))}" cy="${r1(h * (0.15 + rng() * 0.7))}" r="${r1(Math.min(w, h) * (0.25 + rng() * 0.12))}" fill="${c}"/>`)
    .join('');
  const pw = w * 0.52;
  const ph = h * 0.46;
  const px = w * (0.2 + rng() * 0.1);
  const py = h * (0.24 + rng() * 0.08);
  return svg(
    w,
    h,
    `<rect width="${w}" height="${h}" fill="${p.bg}"/><g filter="url(#gb)">${blobs}</g><rect x="${r1(px)}" y="${r1(py)}" width="${r1(pw)}" height="${r1(ph)}" rx="${r1(ph * 0.12)}" fill="#ffffff" fill-opacity=".12" stroke="#ffffff" stroke-opacity=".35"/><rect x="${r1(px + pw * 0.08)}" y="${r1(py + ph * 0.2)}" width="${r1(pw * 0.5)}" height="${r1(ph * 0.1)}" rx="${r1(ph * 0.05)}" fill="#ffffff" fill-opacity=".7"/><rect x="${r1(px + pw * 0.08)}" y="${r1(py + ph * 0.4)}" width="${r1(pw * 0.32)}" height="${r1(ph * 0.07)}" rx="${r1(ph * 0.035)}" fill="#ffffff" fill-opacity=".4"/><circle cx="${r1(px + pw * 0.82)}" cy="${r1(py + ph * 0.72)}" r="${r1(ph * 0.12)}" fill="#ffffff" fill-opacity=".25" stroke="#ffffff" stroke-opacity=".5"/>`,
    `<filter id="gb" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${Math.round(Math.min(w, h) * 0.09)}"/></filter>`,
  );
};

const contours: Painter = (rng, p, w, h) => {
  const cx = w * (0.35 + rng() * 0.3);
  const cy = h * (0.35 + rng() * 0.3);
  let rings = '';
  const n = 14;
  for (let i = 1; i <= n; i++) {
    const base = Math.min(w, h) * 0.05 * i;
    let d = '';
    const steps = 48;
    for (let k = 0; k <= steps; k++) {
      const t = (k / steps) * Math.PI * 2;
      const wob = 1 + Math.sin(t * 3 + i * 0.6) * 0.08 + Math.cos(t * 2 - i * 0.3) * 0.06;
      d += `${k ? 'L' : 'M'}${r1(cx + Math.cos(t) * base * wob * 1.35)} ${r1(cy + Math.sin(t) * base * wob)}`;
    }
    rings += `<path d="${d}z" fill="none" stroke="${i % 4 === 0 ? p.c : p.a}" stroke-opacity="${i % 4 === 0 ? 0.9 : 0.45}" stroke-width="${i % 4 === 0 ? 2 : 1.2}"/>`;
  }
  return svg(w, h, `<rect width="${w}" height="${h}" fill="${p.bg}"/>${rings}`);
};

const typeArt: Painter = (rng, p, w, h) => {
  const glyph = pick(rng, ['A', 'R', 'S', 'G', 'K', 'M', 'Q', '&']);
  return svg(
    w,
    h,
    `<rect width="${w}" height="${h}" fill="${p.surface}"/><rect x="${w * 0.58}" y="0" width="${w * 0.42}" height="${h}" fill="${p.a}"/><text x="${w * 0.08}" y="${h * 0.9}" font-family="Georgia, 'Times New Roman', serif" font-size="${h * 1.05}" font-style="italic" fill="${p.ink}">${escXml(glyph)}</text><path d="M${w * 0.06} ${h * 0.12}H${w * 0.5}" stroke="${p.ink}" stroke-width="2"/><circle cx="${w * 0.79}" cy="${h * 0.5}" r="${h * 0.16}" fill="none" stroke="${p.bg}" stroke-width="2"/>`,
  );
};

const PAINTERS: Record<CoverVariant, Painter> = { mesh, grid, orbit, stripes, blocks, terminal, waves, arches, dashboard, glass, contours, type: typeArt };

/* ------------------------------ Public API ----------------------------- */

/** A 16:10 project cover. */
export function coverArt(seed: string, palette: ArtPalette, variant: CoverVariant, size: { w: number; h: number } = { w: 1600, h: 1000 }): string {
  return svgDataUrl(PAINTERS[variant](rngFrom(seed), palette, size.w, size.h));
}

/** A cover image with alt text in one call. */
export function cover(seed: string, palette: ArtPalette, variant: CoverVariant, alt: string): ImageRef {
  return { src: coverArt(seed, palette, variant), alt };
}

/** A square gallery tile, or a portrait-orientation tile when `tall`. */
export function galleryArt(seed: string, palette: ArtPalette, variant: CoverVariant, alt: string, tall = false): ImageRef {
  return { src: coverArt(seed, palette, variant, tall ? { w: 900, h: 1200 } : { w: 1000, h: 1000 }), alt };
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/**
 * An avatar-style monogram portrait: initials over a soft gradient field.
 * `style` picks the typographic voice.
 */
export function portrait(name: string, palette: ArtPalette, style: 'serif' | 'sans' | 'mono' = 'sans', alt?: string): ImageRef {
  const rng = rngFrom(`portrait:${name}`);
  const s = 800;
  const initials = escXml(initialsOf(name));
  const family = style === 'serif' ? "Georgia, 'Times New Roman', serif" : style === 'mono' ? "'SF Mono', Menlo, Consolas, monospace" : "'Helvetica Neue', Helvetica, Arial, sans-serif";
  const weight = style === 'serif' ? 400 : 700;
  const ang = Math.round(rng() * 360);
  const g = grain('pg', 0.1);
  const body = `<rect width="${s}" height="${s}" fill="url(#pbg)"/><g filter="url(#pbl)"><circle cx="${r1(s * (0.2 + rng() * 0.2))}" cy="${r1(s * (0.2 + rng() * 0.2))}" r="${s * 0.34}" fill="${palette.b}" opacity=".7"/><circle cx="${r1(s * (0.6 + rng() * 0.2))}" cy="${r1(s * (0.65 + rng() * 0.2))}" r="${s * 0.3}" fill="${palette.c}" opacity=".6"/></g>${g.layer(s, s)}<circle cx="${s / 2}" cy="${s / 2}" r="${s * 0.36}" fill="none" stroke="${palette.ink}" stroke-opacity=".22" stroke-width="2"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="${family}" font-weight="${weight}" font-size="${s * 0.28}" letter-spacing="${style === 'serif' ? 0 : -4}" fill="${palette.ink}"${style === 'serif' ? ' font-style="italic"' : ''}>${initials}</text>`;
  return {
    src: svgDataUrl(
      svg(
        s,
        s,
        body,
        `<linearGradient id="pbg" gradientTransform="rotate(${ang} .5 .5)"><stop offset="0" stop-color="${palette.a}"/><stop offset="1" stop-color="${palette.surface}"/></linearGradient><filter id="pbl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="90"/></filter>${g.def}`,
      ),
    ),
    alt: alt ?? `Monogram portrait of ${name}`,
  };
}

/** A 1200×630 social sharing card. */
export function ogArt(name: string, title: string, palette: ArtPalette, variant: CoverVariant): ImageRef {
  const w = 1200;
  const h = 630;
  const art = PAINTERS[variant](rngFrom(`og:${name}`), palette, 520, 630).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const body = `<rect width="${w}" height="${h}" fill="${palette.bg}"/><svg x="680" y="0" width="520" height="630" viewBox="0 0 520 630">${art}</svg><text x="72" y="300" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="68" font-weight="700" letter-spacing="-2" fill="${palette.ink}">${escXml(name)}</text><text x="72" y="360" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="28" fill="${palette.ink}" fill-opacity=".7">${escXml(title)}</text><rect x="72" y="200" width="56" height="6" fill="${palette.a}"/>`;
  return { src: svgDataUrl(svg(w, h, body)), alt: `${name} — ${title}` };
}
