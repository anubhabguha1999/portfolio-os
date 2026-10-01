/**
 * Design tokens for generated projects. Values come from the same generator the
 * builder preview uses, so colours, type scale, radii, spacing and shadows match.
 */
import type { Portfolio } from '@/types/portfolio';
import { themeCssVariables } from '@/lib/theme/tokens';
import { getFont } from '@/lib/theme/fonts';

/** next/font/google export names for catalog fonts that ship on Google Fonts. */
const NEXT_FONT_EXPORT: Record<string, { name: string; weights: string[] }> = {
  inter: { name: 'Inter', weights: [] },
  grotesk: { name: 'Space_Grotesk', weights: [] },
  manrope: { name: 'Manrope', weights: [] },
  geometric: { name: 'Montserrat', weights: [] },
  syne: { name: 'Syne', weights: [] },
  unbounded: { name: 'Unbounded', weights: [] },
  playfair: { name: 'Playfair_Display', weights: [] },
  fraunces: { name: 'Fraunces', weights: [] },
  cormorant: { name: 'Cormorant_Garamond', weights: ['400', '500', '600', '700'] },
  jetbrains: { name: 'JetBrains_Mono', weights: [] },
  'ibm-plex-mono': { name: 'IBM_Plex_Mono', weights: ['400', '500', '600'] },
};

export interface FontRole {
  role: 'heading' | 'body' | 'mono';
  id: string;
  /** CSS variable the font should populate. */
  variable: string;
  stack: string;
}

export interface FontPlan {
  /** next/font/google imports (Next.js, CDN delivery only). */
  nextGoogle: Array<{ exportName: string; variable: string; weights: string[]; roles: FontRole['role'][] }>;
  /** Google Fonts stylesheet URL (Vite, CDN delivery only). */
  googleHref: string | null;
  /** Local @font-face rules for user-uploaded fonts. */
  fontFaces: string;
  /** Font files to copy into public/fonts. */
  files: Array<{ assetId: string; path: string }>;
}

export function fontPlan(p: Portfolio): FontPlan {
  const t = p.theme.typography;
  const cdn = p.settings.fontDelivery === 'cdn';
  const roles: Array<[FontRole['role'], string]> = [
    ['heading', t.headingFont],
    ['body', t.bodyFont],
    ['mono', t.monoFont],
  ];
  const nextGoogle: FontPlan['nextGoogle'] = [];
  if (cdn) {
    for (const [role, id] of roles) {
      const nf = NEXT_FONT_EXPORT[id];
      if (!nf) continue;
      const existing = nextGoogle.find((g) => g.exportName === nf.name);
      if (existing) existing.roles.push(role);
      else nextGoogle.push({ exportName: nf.name, variable: `--font-${id.replace(/[^a-z0-9]+/g, '-')}`, weights: nf.weights, roles: [role] });
    }
  }
  const googleFamilies = cdn ? [...new Set(roles.map(([, id]) => getFont(id)?.google).filter((g): g is string => !!g))] : [];
  const googleHref = googleFamilies.length ? `https://fonts.googleapis.com/css2?${googleFamilies.map((f) => `family=${f}`).join('&')}&display=swap` : null;
  const files: FontPlan['files'] = [];
  const faces: string[] = [];
  for (const f of p.metadata.customFonts) {
    const ext = f.format === 'truetype' ? 'ttf' : f.format === 'opentype' ? 'otf' : f.format;
    const path = `fonts/${f.family.replace(/[^\w-]+/g, '-').toLowerCase()}-${f.weight}${f.style === 'italic' ? '-italic' : ''}.${ext}`;
    files.push({ assetId: f.assetId, path });
    faces.push(`@font-face {\n  font-family: "${f.family.replace(/"/g, '')}";\n  src: url("/${path}") format("${f.format}");\n  font-weight: ${f.weight};\n  font-style: ${f.style};\n  font-display: swap;\n}`);
  }
  return { nextGoogle, googleHref, fontFaces: faces.join('\n'), files };
}

/**
 * styles/tokens.css — the single source of design values. With next/font, the
 * font stacks are prefixed with the next/font CSS variable.
 */
/** Source tokens that share a name with Tailwind theme variables (renamed in Tailwind mode). */
const TW_COLLIDING = ['font-heading', 'font-body', 'font-mono', 'radius-card', 'radius-btn', 'shadow-sm', 'shadow-md', 'shadow-lg'];

export function tokensCss(p: Portfolio, plan: FontPlan, framework: 'nextjs' | 'react-vite', styling: 'tailwind' | 'css-modules' | 'css' = 'css'): string {
  let vars = themeCssVariables(p);
  if (framework === 'nextjs') {
    for (const g of plan.nextGoogle) {
      for (const role of g.roles) vars = vars.replace(new RegExp(`--font-${role}: `), `--font-${role}: var(${g.variable}), `);
    }
  }
  if (styling === 'tailwind') for (const name of TW_COLLIDING) vars = vars.replace(new RegExp(`--${name}:`, 'g'), `--pos-${name}:`);
  const header = `/*
 * Design tokens exported from Portfolio OS.
 * Change the look of the whole site here: colours (light + dark), type scale,
 * spacing, radii, shadows and motion. Components only reference these variables.
 */`;
  return `${header}\n${plan.fontFaces ? `${plan.fontFaces}\n\n` : ''}${vars.trim()}\n`;
}

/** Tailwind v4 theme bridge: exposes tokens as utilities (bg-primary, rounded-card, font-heading…). */
export const TAILWIND_THEME = `@theme inline {
  --color-primary: var(--c-primary);
  --color-primary-contrast: var(--c-primary-contrast);
  --color-primary-soft: var(--c-primary-soft);
  --color-secondary: var(--c-secondary);
  --color-accent: var(--c-accent);
  --color-accent-soft: var(--c-accent-soft);
  --color-bg: var(--c-bg);
  --color-surface: var(--c-surface);
  --color-surface-2: var(--c-surface-2);
  --color-glass: var(--c-glass);
  --color-text: var(--c-text);
  --color-muted: var(--c-muted);
  --color-border: var(--c-border);
  --color-success: var(--c-success);
  --color-warning: var(--c-warning);
  --color-error: var(--c-error);
  --font-heading: var(--pos-font-heading);
  --font-body: var(--pos-font-body);
  --font-mono: var(--pos-font-mono);
  --text-xs: var(--fs-xs);
  --text-sm: var(--fs-sm);
  --text-base: var(--fs-base);
  --text-lg: var(--fs-lg);
  --text-xl: var(--fs-xl);
  --text-2xl: var(--fs-2xl);
  --text-3xl: var(--fs-3xl);
  --text-4xl: var(--fs-4xl);
  --text-5xl: var(--fs-5xl);
  --radius-card: var(--pos-radius-card);
  --radius-btn: var(--pos-radius-btn);
  --shadow-sm: var(--pos-shadow-sm);
  --shadow-md: var(--pos-shadow-md);
  --shadow-lg: var(--pos-shadow-lg);
  --spacing-section: var(--section-y);
  --spacing-gutter: var(--pad-x);
  --spacing-gap: var(--gap);
  --container-site: var(--max-w);
  --blur-glass: var(--blur);
  --ease-theme: var(--motion-ease);
  --animate-duration: var(--motion-duration);
}`;
