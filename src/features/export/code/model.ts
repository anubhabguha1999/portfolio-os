/**
 * Framework export (React + Vite / Next.js) option handling for Export Studio.
 * The generator itself is loaded lazily (see useFrameworkExport).
 */
import type { Portfolio } from '@/types/portfolio';
import { DEFAULT_EXPORT_OPTIONS, type ExportOptions, type Framework } from '@/lib/codegen/types';

export type FrameworkFormat = 'react' | 'next';

export function frameworkOf(format: FrameworkFormat): Framework {
  return format === 'next' ? 'nextjs' : 'react-vite';
}

/** Mirrors the engine's sanitiser so the folder name preview is exact. */
export function previewProjectName(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'my-portfolio'
  );
}

export type SiteUrlCheck = { ok: true; origin: string | null } | { ok: false; message: string };

/** Optional canonical origin. Empty is fine (a placeholder is used, no domain is invented). */
export function checkSiteUrl(raw: string): SiteUrlCheck {
  const v = raw.trim();
  if (!v) return { ok: true, origin: null };
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, message: 'Use an http(s) address, e.g. https://example.com' };
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return { ok: false, message: 'That does not look like a domain.' };
    return { ok: true, origin: u.origin };
  } catch {
    return { ok: false, message: 'Enter a full address including https://' };
  }
}

const storageKey = (projectId: string) => `pos-framework-export:${projectId}`;

export function defaultFrameworkOptions(p: Portfolio, framework: Framework): ExportOptions {
  return {
    ...DEFAULT_EXPORT_OPTIONS,
    framework,
    animations: p.settings.animations,
    siteUrl: p.metadata.siteUrl && checkSiteUrl(p.metadata.siteUrl).ok ? p.metadata.siteUrl.trim() : '',
    projectName: previewProjectName(p.metadata.title || 'my-portfolio'),
    images: framework === 'nextjs' ? 'optimized' : 'img',
  };
}

export function loadFrameworkOptions(projectId: string, p: Portfolio, framework: Framework): ExportOptions {
  const base = defaultFrameworkOptions(p, framework);
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<ExportOptions>;
    return { ...base, ...saved, framework, ...(framework === 'react-vite' ? { images: 'img' as const } : {}) };
  } catch {
    return base;
  }
}

export function saveFrameworkOptions(projectId: string, o: ExportOptions): void {
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(o));
  } catch {
    /* storage unavailable — choices are simply not remembered */
  }
}

/** Files shown as quick tabs in the source preview (only those that exist). */
export const KEY_FILES: Record<Framework, string[]> = {
  nextjs: ['src/app/page.tsx', 'src/app/layout.tsx', 'src/components/Navbar.tsx', 'src/sections/Hero.tsx', 'src/sections/Projects.tsx', 'src/data/portfolio.ts', 'next.config.ts', 'package.json'],
  'react-vite': ['src/main.tsx', 'src/App.tsx', 'index.html', 'src/components/Navbar.tsx', 'src/sections/Hero.tsx', 'src/sections/Projects.tsx', 'src/data/portfolio.ts', 'vite.config.ts', 'package.json'],
};

/** Stable key for "results are stale" detection. */
export function optionsSignature(o: ExportOptions): string {
  return JSON.stringify([o.framework, o.rendering, o.styling, o.images, o.animations, o.structure, o.siteUrl.trim(), previewProjectName(o.projectName)]);
}
