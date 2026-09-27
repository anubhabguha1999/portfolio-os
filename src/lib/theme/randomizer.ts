// CONTRACT (implementation owned by the analysis/import workstream). Keep this signature.
import type { AnimationType, ColorPalette, ColorScheme, ShadowStyle, ThemeConfig } from '@/types/portfolio';
import { contrastRatio, hslToHex, readableOn } from '@/utils/color';
import { FONT_CATALOG, type FontDefinition } from './fonts';

/** Small, fast, deterministic PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;
const pick = <T>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length) % list.length]!;
const range = (rng: Rng, min: number, max: number): number => min + rng() * (max - min);

export type Harmony = 'analogous' | 'complementary' | 'triadic' | 'monochrome';
export const HARMONIES: Harmony[] = ['analogous', 'complementary', 'triadic', 'monochrome'];

function harmonyHues(h: number, harmony: Harmony, rng: Rng): { primary: number; secondary: number; accent: number } {
  switch (harmony) {
    case 'analogous':
      return { primary: h, secondary: h - range(rng, 25, 40), accent: h + range(rng, 25, 45) };
    case 'complementary':
      return { primary: h, secondary: h + range(rng, 160, 200), accent: h + 180 };
    case 'triadic':
      return { primary: h, secondary: h + 120, accent: h + 240 };
    case 'monochrome':
      return { primary: h, secondary: h, accent: h + range(rng, -12, 12) };
  }
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}
const hex = (c: Hsl) => hslToHex(c.h, c.s, c.l);

/**
 * Move lightness away from `against` until the contrast target is met.
 * `dir` -1 darkens, +1 lightens. Returns the adjusted colour (hex).
 */
function ensureContrast(c: Hsl, against: string[], min: number, dir: 1 | -1): string {
  let l = c.l;
  for (let i = 0; i < 120; i++) {
    const out = hslToHex(c.h, c.s, l);
    if (against.every((bg) => contrastRatio(out, bg) >= min)) return out;
    l += dir * 1;
    if (l <= 0 || l >= 100) break;
  }
  return dir === -1 ? '#000000' : '#ffffff';
}

/** Primary colour whose black/white label reaches 4.5:1 and which stays readable as link text where possible. */
function buttonColor(c: Hsl, bg: string, scheme: ColorScheme): { primary: string; primaryContrast: string } {
  const dir: 1 | -1 = scheme === 'light' ? -1 : 1;
  let l = c.l;
  let best: { primary: string; primaryContrast: string } | null = null;
  for (let i = 0; i < 100; i++) {
    const primary = hslToHex(c.h, c.s, l);
    const primaryContrast = readableOn(primary);
    const label = contrastRatio(primary, primaryContrast);
    const link = contrastRatio(primary, bg);
    if (label >= 4.5 && !best) best = { primary, primaryContrast };
    if (label >= 4.5 && link >= 4.5) return { primary, primaryContrast };
    l += dir;
    if (l <= 2 || l >= 98) break;
  }
  if (best) return best;
  // Fallback that always works: very dark (light scheme) or very light (dark scheme) primary.
  const primary = hslToHex(c.h, c.s, scheme === 'light' ? 25 : 80);
  return { primary, primaryContrast: readableOn(primary) };
}

function buildPalette(scheme: ColorScheme, hues: { primary: number; secondary: number; accent: number }, base: number, rng: Rng, harmony: Harmony): ColorPalette {
  const tint = harmony === 'monochrome' ? range(rng, 14, 26) : range(rng, 8, 22);
  const light = scheme === 'light';
  const bgC: Hsl = light ? { h: base, s: tint, l: range(rng, 96.5, 99) } : { h: base, s: tint + 6, l: range(rng, 5, 9) };
  const background = hex(bgC);
  const surface = hex(light ? { ...bgC, l: bgC.l - range(rng, 2.5, 4.5) } : { ...bgC, l: bgC.l + range(rng, 3.5, 6) });
  const border = hex(light ? { ...bgC, s: tint + 4, l: bgC.l - range(rng, 9, 13) } : { ...bgC, l: bgC.l + range(rng, 12, 16) });
  const bgs = [background, surface];
  const text = ensureContrast(light ? { h: base, s: range(rng, 18, 38), l: range(rng, 8, 14) } : { h: base, s: range(rng, 12, 28), l: range(rng, 91, 96) }, bgs, 7, light ? -1 : 1);
  const muted = ensureContrast(light ? { h: base, s: range(rng, 10, 22), l: range(rng, 38, 46) } : { h: base, s: range(rng, 10, 22), l: range(rng, 62, 70) }, bgs, 4.6, light ? -1 : 1);
  const sat = range(rng, 58, 86);
  const { primary, primaryContrast } = buttonColor({ h: hues.primary, s: sat, l: light ? range(rng, 42, 52) : range(rng, 60, 70) }, background, scheme);
  const secondary = ensureContrast(light ? { h: hues.secondary, s: range(rng, 30, 60), l: range(rng, 20, 34) } : { h: hues.secondary, s: range(rng, 30, 60), l: range(rng, 72, 84) }, [background], 4.5, light ? -1 : 1);
  const accent = ensureContrast({ h: hues.accent, s: range(rng, 60, 90), l: light ? range(rng, 40, 50) : range(rng, 60, 72) }, [background], 3, light ? -1 : 1);
  return {
    primary,
    primaryContrast,
    secondary,
    accent,
    background,
    surface,
    text,
    muted,
    border,
    success: light ? '#15803d' : '#4ade80',
    warning: light ? '#b45309' : '#fbbf24',
    error: light ? '#b91c1c' : '#f87171',
  };
}

const byCategory = (cat: FontDefinition['category']) => FONT_CATALOG.filter((f) => f.category === cat);

function pickFonts(rng: Rng): { heading: FontDefinition; body: FontDefinition; mono: FontDefinition; mood: 'serif' | 'display' | 'sans' } {
  const mood = pick(rng, ['serif', 'display', 'sans', 'sans'] as const);
  const heading = pick(rng, byCategory(mood));
  const bodyPool = mood === 'serif' ? [...byCategory('sans'), ...byCategory('serif').filter((f) => f.id !== heading.id && !f.google)] : byCategory('sans');
  const body = mood === 'sans' && rng() < 0.5 ? heading : pick(rng, bodyPool);
  return { heading, body, mono: pick(rng, byCategory('mono')), mood };
}

const ADJECTIVES = ['Velvet', 'Quiet', 'Solar', 'Harbor', 'Midnight', 'Paper', 'Copper', 'Glacier', 'Ember', 'Orchard', 'Neon', 'Linen', 'Cobalt', 'Saffron', 'Moss', 'Opal', 'Dune', 'Signal', 'Atlas', 'Coral'];
const NOUNS = ['Studio', 'Grid', 'Atelier', 'Field', 'Signal', 'Press', 'Garden', 'Circuit', 'Journal', 'Canvas', 'Harbor', 'Folio', 'Lab', 'Lantern', 'Quarter', 'Meridian'];

function nameFor(rng: Rng): string {
  const a = pick(rng, ADJECTIVES);
  let n = pick(rng, NOUNS);
  if (n === a) n = 'Studio';
  return `${a} ${n}`;
}

/** Generate a new, accessible theme without touching content. Deterministic for a given seed. */
export function generateTheme(base: ThemeConfig, seed: number = Date.now()): ThemeConfig {
  const rng = mulberry32(seed);
  const harmony = pick(rng, HARMONIES);
  const baseHue = Math.floor(rng() * 360);
  const hues = harmonyHues(baseHue, harmony, rng);
  const light = buildPalette('light', hues, baseHue, rng, harmony);
  const dark = buildPalette('dark', hues, baseHue, rng, harmony);
  const fonts = pickFonts(rng);
  const cardStyle = pick(rng, ['flat', 'outlined', 'outlined', 'elevated', 'glass', 'brutal'] as const);
  const brutal = cardStyle === 'brutal';
  const glass = cardStyle === 'glass';
  const buttonStyle = brutal ? 'brutal' : pick(rng, ['solid', 'solid', 'outline', 'pill', 'underline'] as const);
  const cardRadius = brutal ? 0 : pick(rng, [0, 6, 10, 14, 18, 24]);
  const buttonRadius = buttonStyle === 'pill' ? 999 : brutal || cardRadius === 0 ? 0 : Math.max(4, Math.round(cardRadius * range(rng, 0.45, 0.8)));
  const shadow: ShadowStyle = brutal ? 'hard' : glass ? 'medium' : cardStyle === 'flat' ? 'none' : pick(rng, ['soft', 'soft', 'medium', 'glow'] as const);
  const defaultAnimation: AnimationType = pick(rng, ['fade', 'slide', 'scale', 'blur', 'reveal'] as const);
  const scheme: ColorScheme = rng() < 0.5 ? 'light' : 'dark';
  const name = nameFor(rng);
  const uppercase = fonts.mood === 'display' && rng() < 0.5;
  return {
    ...structuredClone(base),
    id: `generated-${seed}`,
    name,
    description: `Generated ${harmony} palette with ${fonts.heading.label} headings and ${fonts.body.label} body text.`,
    palettes: { light, dark },
    defaultScheme: scheme,
    typography: {
      ...base.typography,
      headingFont: fonts.heading.id,
      bodyFont: fonts.body.id,
      monoFont: fonts.mono.id,
      scale: pick(rng, [1.2, 1.25, 1.25, 1.333, 1.414]),
      headingWeight: fonts.mood === 'serif' ? pick(rng, [500, 600, 700]) : pick(rng, [600, 700, 800]),
      bodyWeight: 400,
      lineHeight: +range(rng, 1.55, 1.75).toFixed(2),
      headingLineHeight: +range(rng, 1.02, 1.18).toFixed(2),
      headingLetterSpacing: uppercase ? 0.02 : +(-range(rng, 0, 0.03)).toFixed(3),
      headingTransform: uppercase ? 'uppercase' : 'none',
    },
    layout: {
      ...base.layout,
      cardRadius,
      buttonRadius,
      gridGap: pick(rng, [20, 24, 28]),
      sectionSpacing: pick(rng, [96, 112, 128]),
    },
    effects: {
      ...base.effects,
      shadow,
      glass,
      blur: glass ? pick(rng, [12, 16, 20]) : 0,
      gradient: glass || rng() < 0.35,
      gradientAngle: pick(rng, [90, 120, 135, 160]),
      borderWidth: brutal ? pick(rng, [2, 3]) : cardStyle === 'outlined' ? 1 : pick(rng, [0, 1]),
      grain: rng() < 0.15,
    },
    motion: {
      ...base.motion,
      enabled: true,
      duration: pick(rng, [500, 600, 700, 800]),
      easing: brutal ? 'linear' : pick(rng, ['ease-out', 'ease-out', 'ease-in-out', 'spring'] as const),
      defaultAnimation,
    },
    cardStyle,
    buttonStyle,
  };
}
