import type { ColorPalette, ColorScheme, Portfolio, ShadowStyle, ThemeConfig } from '@/types/portfolio';
import { fontStack } from './fonts';
import { withAlpha, mix } from '@/utils/color';

/**
 * Design tokens for generated portfolios. Every visual value in the
 * generated CSS references one of these custom properties.
 */
export function shadowTokens(style: ShadowStyle, p: ColorPalette): { sm: string; md: string; lg: string } {
  switch (style) {
    case 'none':
      return { sm: 'none', md: 'none', lg: 'none' };
    case 'soft':
      return {
        sm: `0 1px 2px ${withAlpha('#000', 0.05)}`,
        md: `0 4px 16px -4px ${withAlpha('#000', 0.08)}, 0 2px 4px ${withAlpha('#000', 0.04)}`,
        lg: `0 24px 48px -12px ${withAlpha('#000', 0.14)}`,
      };
    case 'medium':
      return {
        sm: `0 2px 4px ${withAlpha('#000', 0.08)}`,
        md: `0 10px 30px -8px ${withAlpha('#000', 0.18)}`,
        lg: `0 30px 60px -15px ${withAlpha('#000', 0.3)}`,
      };
    case 'hard':
      return { sm: `3px 3px 0 ${p.border}`, md: `6px 6px 0 ${p.border}`, lg: `10px 10px 0 ${p.border}` };
    case 'glow':
      return {
        sm: `0 0 0 1px ${withAlpha(p.primary, 0.25)}`,
        md: `0 0 24px ${withAlpha(p.primary, 0.28)}`,
        lg: `0 0 60px ${withAlpha(p.primary, 0.35)}`,
      };
  }
}

function paletteVars(p: ColorPalette, theme: ThemeConfig): string[] {
  const s = shadowTokens(theme.effects.shadow, p);
  const vars: Record<string, string> = {
    '--c-primary': p.primary,
    '--c-primary-contrast': p.primaryContrast,
    '--c-secondary': p.secondary,
    '--c-accent': p.accent,
    '--c-bg': p.background,
    '--c-surface': p.surface,
    '--c-text': p.text,
    '--c-muted': p.muted,
    '--c-border': p.border,
    '--c-success': p.success,
    '--c-warning': p.warning,
    '--c-error': p.error,
    '--c-primary-soft': withAlpha(p.primary, 0.12),
    '--c-accent-soft': withAlpha(p.accent, 0.12),
    '--c-surface-2': mix(p.surface, p.text, 0.05),
    '--c-glass': withAlpha(p.surface, 0.55),
    '--shadow-sm': s.sm,
    '--shadow-md': s.md,
    '--shadow-lg': s.lg,
    '--gradient': `linear-gradient(${theme.effects.gradientAngle}deg, ${p.primary}, ${p.accent})`,
    '--gradient-soft': `linear-gradient(${theme.effects.gradientAngle}deg, ${withAlpha(p.primary, 0.16)}, ${withAlpha(p.accent, 0.12)})`,
  };
  return Object.entries(vars).map(([k, v]) => `${k}: ${v};`);
}

export function themeCssVariables(portfolio: Portfolio): string {
  const { theme, metadata, settings } = portfolio;
  const t = theme.typography;
  const l = theme.layout;
  const e = theme.effects;
  const m = theme.motion;
  const ratio = t.scale;
  const sizes = [-2, -1, 0, 1, 2, 3, 4, 5, 6].map((step) => +(t.baseSize * ratio ** step).toFixed(2));
  const [xs, sm, base, lg, xl, x2, x3, x4, x5] = sizes as [number, number, number, number, number, number, number, number, number];
  const clampPx = (min: number, max: number) => `clamp(${(min / 16).toFixed(3)}rem, ${((max / 1280) * 100).toFixed(3)}vw + ${(min / 32).toFixed(3)}rem, ${(max / 16).toFixed(3)}rem)`;
  const easing = m.easing === 'spring' ? 'cubic-bezier(.2,.9,.25,1.15)' : m.easing;

  const shared = [
    `--font-heading: ${fontStack(t.headingFont, metadata.customFonts)};`,
    `--font-body: ${fontStack(t.bodyFont, metadata.customFonts)};`,
    `--font-mono: ${fontStack(t.monoFont, metadata.customFonts)};`,
    `--fs-xs: ${(xs / 16).toFixed(3)}rem;`,
    `--fs-sm: ${(sm / 16).toFixed(3)}rem;`,
    `--fs-base: ${(base / 16).toFixed(3)}rem;`,
    `--fs-lg: ${(lg / 16).toFixed(3)}rem;`,
    `--fs-xl: ${clampPx(lg, xl)};`,
    `--fs-2xl: ${clampPx(xl, x2)};`,
    `--fs-3xl: ${clampPx(x2 * 0.92, x3)};`,
    `--fs-4xl: ${clampPx(x2, x4)};`,
    `--fs-5xl: ${clampPx(x3 * 0.9, x5)};`,
    `--fw-heading: ${t.headingWeight};`,
    `--fw-body: ${t.bodyWeight};`,
    `--lh-body: ${t.lineHeight};`,
    `--lh-heading: ${t.headingLineHeight};`,
    `--ls-body: ${t.letterSpacing}em;`,
    `--ls-heading: ${t.headingLetterSpacing}em;`,
    `--tt-heading: ${t.headingTransform};`,
    `--max-w: ${l.maxWidth}px;`,
    `--section-y: ${l.sectionSpacing}px;`,
    `--radius-card: ${l.cardRadius}px;`,
    `--radius-btn: ${l.buttonRadius}px;`,
    `--pad-x: ${l.containerPadding}px;`,
    `--gap: ${l.gridGap}px;`,
    `--border-w: ${e.borderWidth}px;`,
    `--blur: ${e.blur}px;`,
    `--motion-duration: ${m.duration}ms;`,
    `--motion-ease: ${easing};`,
  ];

  const light = paletteVars(theme.palettes.light, theme);
  const dark = paletteVars(theme.palettes.dark, theme);
  const scheme = settings.colorScheme;
  const primaryScheme: ColorScheme = scheme === 'system' ? theme.defaultScheme : scheme;
  const primary = primaryScheme === 'dark' ? dark : light;
  const other = primaryScheme === 'dark' ? light : dark;
  const otherName: ColorScheme = primaryScheme === 'dark' ? 'light' : 'dark';

  let css = `:root {\n  color-scheme: ${primaryScheme};\n  ${shared.join('\n  ')}\n  ${primary.join('\n  ')}\n}\n`;
  css += `:root[data-scheme="${otherName}"] {\n  color-scheme: ${otherName};\n  ${other.join('\n  ')}\n}\n`;
  css += `:root[data-scheme="${primaryScheme}"] {\n  color-scheme: ${primaryScheme};\n  ${primary.join('\n  ')}\n}\n`;
  if (scheme === 'system') {
    const sysDark = `@media (prefers-color-scheme: dark) {\n  :root:not([data-scheme]) {\n  color-scheme: dark;\n  ${dark.join('\n  ')}\n  }\n}\n`;
    const sysLight = `@media (prefers-color-scheme: light) {\n  :root:not([data-scheme]) {\n  color-scheme: light;\n  ${light.join('\n  ')}\n  }\n}\n`;
    css += sysDark + sysLight;
  }
  return css;
}

export function activePalette(portfolio: Portfolio): ColorPalette {
  const scheme = portfolio.settings.colorScheme === 'system' ? portfolio.theme.defaultScheme : portfolio.settings.colorScheme;
  return portfolio.theme.palettes[scheme];
}
