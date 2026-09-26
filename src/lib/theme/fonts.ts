import type { CustomFont } from '@/types/portfolio';

export interface FontDefinition {
  id: string;
  label: string;
  category: 'sans' | 'serif' | 'mono' | 'display';
  /** Local / system stack — always used, so "self-contained" exports need no network. */
  stack: string;
  /** Optional Google Fonts family spec, used only in CDN font delivery mode. */
  google?: string;
}

export const FONT_CATALOG: FontDefinition[] = [
  { id: 'system', label: 'System UI', category: 'sans', stack: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' },
  { id: 'inter', label: 'Inter', category: 'sans', stack: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', google: 'Inter:wght@300;400;500;600;700;800' },
  { id: 'grotesk', label: 'Space Grotesk', category: 'sans', stack: '"Space Grotesk", "Helvetica Neue", Arial, sans-serif', google: 'Space+Grotesk:wght@300;400;500;600;700' },
  { id: 'manrope', label: 'Manrope', category: 'sans', stack: '"Manrope", "Avenir Next", Avenir, "Segoe UI", sans-serif', google: 'Manrope:wght@300;400;500;600;700;800' },
  { id: 'humanist', label: 'Humanist', category: 'sans', stack: 'Seravek, "Gill Sans Nova", Ubuntu, Calibri, "DejaVu Sans", source-sans-pro, sans-serif' },
  { id: 'geometric', label: 'Geometric', category: 'sans', stack: 'Avenir, Montserrat, Corbel, "URW Gothic", source-sans-pro, sans-serif', google: 'Montserrat:wght@400;500;600;700;800' },
  { id: 'neo-grotesque', label: 'Neo-Grotesque', category: 'sans', stack: '"Helvetica Neue", Helvetica, Arial, "Nimbus Sans", sans-serif' },
  { id: 'syne', label: 'Syne', category: 'display', stack: '"Syne", "Arial Black", "Helvetica Neue", sans-serif', google: 'Syne:wght@500;600;700;800' },
  { id: 'unbounded', label: 'Unbounded', category: 'display', stack: '"Unbounded", "Arial Black", Impact, sans-serif', google: 'Unbounded:wght@400;600;800' },
  { id: 'playfair', label: 'Playfair Display', category: 'serif', stack: '"Playfair Display", Didot, "Bodoni MT", Georgia, serif', google: 'Playfair+Display:ital,wght@0,400;0,600;0,700;1,400' },
  { id: 'fraunces', label: 'Fraunces', category: 'serif', stack: '"Fraunces", "Iowan Old Style", Georgia, serif', google: 'Fraunces:ital,wght@0,300;0,500;0,700;1,400' },
  { id: 'cormorant', label: 'Cormorant', category: 'serif', stack: '"Cormorant Garamond", Garamond, "Hoefler Text", "Times New Roman", serif', google: 'Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400' },
  { id: 'transitional', label: 'Transitional Serif', category: 'serif', stack: 'Charter, "Bitstream Charter", "Sitka Text", Cambria, Georgia, serif' },
  { id: 'old-style', label: 'Old Style', category: 'serif', stack: '"Iowan Old Style", "Palatino Linotype", "URW Palladio L", P052, Georgia, serif' },
  { id: 'jetbrains', label: 'JetBrains Mono', category: 'mono', stack: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace', google: 'JetBrains+Mono:wght@400;500;700' },
  { id: 'ibm-plex-mono', label: 'IBM Plex Mono', category: 'mono', stack: '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace', google: 'IBM+Plex+Mono:wght@400;500;600' },
  { id: 'mono', label: 'System Mono', category: 'mono', stack: 'ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, "Liberation Mono", monospace' },
];

const byId = new Map(FONT_CATALOG.map((f) => [f.id, f]));

export function getFont(id: string): FontDefinition | undefined {
  return byId.get(id);
}

/** Resolve a font id (or custom family) to a CSS font-family stack. */
export function fontStack(id: string, customFonts: CustomFont[] = []): string {
  const custom = customFonts.find((f) => f.id === id || f.family === id);
  if (custom) return `"${custom.family.replace(/"/g, '')}", system-ui, sans-serif`;
  return byId.get(id)?.stack ?? FONT_CATALOG[0]!.stack;
}

export function googleFontsHref(ids: string[]): string | null {
  const families = [...new Set(ids)].map((id) => byId.get(id)?.google).filter((g): g is string => Boolean(g));
  if (!families.length) return null;
  return `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join('&')}&display=swap`;
}
