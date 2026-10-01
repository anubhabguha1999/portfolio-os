/**
 * Framework export engine.
 *
 *   Portfolio ──buildSiteData()──► SiteData (+ image files)
 *                                     │
 *                     ┌───────────────┴───────────────┐
 *              ReactViteGenerator              NextJsGenerator
 *                     │   shared component library    │
 *                     └───────────────┬───────────────┘
 *                               GeneratedFile[]
 *                                     │
 *                          validateProject() → ZIP
 */
import type { Portfolio } from '@/types/portfolio';
import type { PortfolioData } from './site-types';

export type Framework = 'react-vite' | 'nextjs';
export type Styling = 'tailwind' | 'css-modules' | 'css';
export type Rendering = 'static' | 'standard';
export type ImageMode = 'optimized' | 'img';
export type Structure = 'single' | 'multi';

export interface ExportOptions {
  framework: Framework;
  /** Next.js only: static export (`output: 'export'`) or a standard Next.js app. */
  rendering: Rendering;
  styling: Styling;
  /** Next.js: next/image vs <img>. Vite always uses <img>. */
  images: ImageMode;
  animations: boolean;
  /** One page with anchors, or separate routes (/about, /projects, /contact). */
  structure: Structure;
  /** Canonical origin used for sitemap/robots/Open Graph. Empty = placeholder. */
  siteUrl: string;
  /** Folder + package name. */
  projectName: string;
}

export interface GeneratedFile {
  path: string;
  content: string | Uint8Array;
  type: 'text' | 'binary';
}

export interface ImageFile {
  path: string;
  bytes: Uint8Array;
  mime: string;
  width: number;
  height: number;
}

export interface SiteBuild {
  data: PortfolioData;
  images: ImageFile[];
  /** Scoped custom CSS from custom sections. */
  customCss: string;
  /** User-uploaded font files (public/fonts/…). */
  fontFiles: Array<{ path: string; bytes: Uint8Array }>;
  /** Raster favicon source (asset favicon), when the portfolio has one. */
  faviconImage: ImageFile | null;
  /** Emoji / short text favicon, when used instead of an image. */
  faviconText: string;
  /** Non-fatal notes (e.g. an image could not be converted). */
  warnings: string[];
  /** Problems that block export (validator input). */
  problems: ExportIssue[];
}

export interface GeneratedProject {
  framework: Framework;
  name: string;
  files: GeneratedFile[];
  warnings: string[];
  /** Commands shown in the UI/README. */
  commands: { install: string; dev: string; build: string; start?: string };
}

export interface ExportIssue {
  id: string;
  level: 'error' | 'warning';
  message: string;
  /** Portfolio section to jump to in the builder, when known. */
  sectionId?: string;
  fix?: 'remove-link' | 'remove-image' | 'open-builder';
}

export interface CheckItem {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
}

export interface ValidationReport {
  checks: CheckItem[];
  issues: ExportIssue[];
  canExport: boolean;
}

export interface ProjectGenerator {
  readonly framework: Framework;
  generateProject(portfolio: Portfolio, options: ExportOptions, build?: SiteBuild): Promise<GeneratedProject>;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  framework: 'nextjs',
  rendering: 'static',
  styling: 'tailwind',
  images: 'optimized',
  animations: true,
  structure: 'single',
  siteUrl: '',
  projectName: 'my-portfolio',
};
