#!/usr/bin/env node
/**
 * Generates the PWA icons (public/icon-192.png, icon-512.png, icon-maskable-512.png)
 * by rasterising the logo mark in pure Node — no image dependencies.
 *
 * The mark (see src/components/Logo.tsx) on a 32-unit grid:
 *   rounded square (x/y 1, size 30, radius 9) with a violet diagonal gradient,
 *   a "P" stroke M10 22 V10 h6.2 a4.2 4.2 0 0 1 0 8.4 H10 (width 2.6, round caps),
 *   and a dot at (22.5, 22) r 2.
 *
 * Usage: node scripts/generate-icons.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = (name) => resolve(root, 'public', name);

const FROM = [0xb3, 0xa8, 0xff];
const TO = [0x6a, 0x58, 0xf5];
const INK = [0x0b, 0x07, 0x16];

/* ------------------------------- Geometry ------------------------------- */

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Distance from a point to the "P" stroke centre-line. */
function pDist(x, y) {
  let d = Math.min(segDist(x, y, 10, 22, 10, 10), segDist(x, y, 10, 10, 16.2, 10), segDist(x, y, 16.2, 18.4, 10, 18.4));
  // Right half-circle, centre (16.2, 14.2), radius 4.2, x >= 16.2.
  const cx = 16.2;
  const cy = 14.2;
  if (x >= cx) d = Math.min(d, Math.abs(Math.hypot(x - cx, y - cy) - 4.2));
  else d = Math.min(d, Math.hypot(x - cx, y - 10), Math.hypot(x - cx, y - 18.4));
  return d;
}

function inRoundedRect(x, y, x0, y0, size, r) {
  const x1 = x0 + size;
  const y1 = y0 + size;
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return Math.hypot(x - cx, y - cy) <= r;
}

/**
 * Sample the mark at unit coordinates (0..32). `bleed` fills the whole square
 * (maskable icons) and scales the glyph into the safe zone.
 */
function sample(u, v, bleed) {
  let x = u;
  let y = v;
  let inside;
  if (bleed) {
    inside = true;
    // Keep the glyph inside the central 80% safe zone.
    const s = 0.78;
    x = 16 + (u - 16) / s;
    y = 16 + (v - 16) / s;
  } else {
    inside = inRoundedRect(u, v, 1, 1, 30, 9);
  }
  if (!inside) return null;
  const t = Math.max(0, Math.min(1, (u + v) / 64));
  let c = FROM.map((f, i) => f + (TO[i] - f) * t);
  if (pDist(x, y) <= 1.3 || Math.hypot(x - 22.5, y - 22) <= 2) c = INK;
  return c;
}

function render(size, bleed) {
  const SS = 4; // 4×4 supersampling
  const px = Buffer.alloc(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = ((i + (sx + 0.5) / SS) / size) * 32;
          const v = ((j + (sy + 0.5) / SS) / size) * 32;
          const c = sample(u, v, bleed);
          if (c) {
            r += c[0];
            g += c[1];
            b += c[2];
            a += 1;
          }
        }
      }
      const o = (j * size + i) * 4;
      const n = SS * SS;
      px[o] = a ? Math.round(r / a) : 0;
      px[o + 1] = a ? Math.round(g / a) : 0;
      px[o + 2] = a ? Math.round(b / a) : 0;
      px[o + 3] = Math.round((a / n) * 255);
    }
  }
  return px;
}

/* --------------------------------- PNG ---------------------------------- */

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync(resolve(root, 'public'), { recursive: true });
for (const [name, size, bleed] of [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, true],
]) {
  const png = encodePng(size, render(size, bleed));
  writeFileSync(out(name), png);
  console.log(`wrote public/${name} (${size}×${size}, ${png.length} bytes)`);
}
