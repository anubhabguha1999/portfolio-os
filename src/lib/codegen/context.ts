/**
 * Generation context shared by the component library and the framework generators.
 */
import type { ExportOptions, GeneratedFile, SiteBuild, Styling } from './types';
import type { PortfolioData, SectionType } from './site-types';
import type { FontPlan } from './tokens';
import { fontPlan } from './tokens';
import type { Portfolio } from '@/types/portfolio';

export interface GenCtx {
  /** Source portfolio (theme tokens, fonts). */
  portfolio: Portfolio;
  framework: 'nextjs' | 'react-vite';
  styling: Styling;
  /** next/image (Next.js + optimized) vs plain <img>. */
  nextImage: boolean;
  animations: boolean;
  structure: 'single' | 'multi';
  /** Vite: React Router is used (multi-page or project pages). Next: always file routing. */
  router: boolean;
  /** Next.js static export (no server features). */
  staticExport: boolean;
  data: PortfolioData;
  build: SiteBuild;
  fonts: FontPlan;
  options: ExportOptions;
  /** Section types present in the data (only these components are generated). */
  sectionTypes: Set<SectionType>;
  hasProjectPages: boolean;
}

export function text(path: string, content: string): GeneratedFile {
  return { path, content: content.endsWith('\n') ? content : `${content}\n`, type: 'text' };
}

export function binary(path: string, content: Uint8Array): GeneratedFile {
  return { path, content, type: 'binary' };
}

/** `"use client";` banner for Next.js client components (nothing for Vite). */
export function clientDirective(ctx: GenCtx): string {
  return ctx.framework === 'nextjs' ? `'use client';\n\n` : '';
}

/** Pretty JSON for data modules. */
export function tsLiteral(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/** Import path for the project's source root alias. Both generators configure "@/*" → "src/*". */
export const SRC = '@';

export function createContext(portfolio: Portfolio, options: ExportOptions, build: SiteBuild): GenCtx {
  const next = options.framework === 'nextjs';
  const hasProjectPages = build.data.projects.some((p) => p.hasPage);
  return {
    portfolio,
    framework: options.framework,
    styling: options.styling,
    nextImage: next && options.images === 'optimized',
    animations: options.animations,
    structure: options.structure,
    router: next || options.structure === 'multi' || hasProjectPages,
    staticExport: next && options.rendering === 'static',
    data: build.data,
    build,
    fonts: fontPlan(portfolio),
    options,
    sectionTypes: new Set(build.data.sections.map((s) => s.type)),
    hasProjectPages,
  };
}
