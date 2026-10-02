/**
 * Framework export entry point.
 *
 *   const { project, report } = await generateFrameworkProject(portfolio, options);
 *   if (report.canExport) downloadBlob(await projectZip(project), `${project.name}.zip`);
 */
import { zipSync } from 'fflate';
import type { Portfolio } from '@/types/portfolio';
import type { ExportOptions, Framework, GeneratedProject, ProjectGenerator, SiteBuild, ValidationReport } from './types';
import { buildSiteData, type BuildSiteOptions } from './site-model';
import { validateProject } from './validate';
import { NextJsGenerator } from './generators/next';
import { ReactViteGenerator } from './generators/vite';

export const GENERATORS: Record<Framework, ProjectGenerator> = {
  nextjs: new NextJsGenerator(),
  'react-vite': new ReactViteGenerator(),
};

export type BuildEnv = Omit<BuildSiteOptions, 'structure' | 'siteUrl'>;

export interface FrameworkExport {
  project: GeneratedProject;
  build: SiteBuild;
  report: ValidationReport;
}

export function sanitizeProjectName(name: string): string {
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

export async function generateFrameworkProject(portfolio: Portfolio, options: ExportOptions, env: BuildEnv = {}): Promise<FrameworkExport> {
  const opts: ExportOptions = { ...options, projectName: sanitizeProjectName(options.projectName) };
  const build = await buildSiteData(portfolio, { ...env, structure: opts.structure, siteUrl: opts.siteUrl, animations: opts.animations });
  const project = await GENERATORS[opts.framework].generateProject(portfolio, opts, build);
  const report = validateProject(project, opts, build);
  return { project, build, report };
}

/** ZIP with every file under a top-level folder named after the project. */
export function projectZipBytes(project: GeneratedProject): Uint8Array {
  const enc = new TextEncoder();
  const entries: Record<string, Uint8Array> = {};
  for (const f of project.files) entries[`${project.name}/${f.path}`] = typeof f.content === 'string' ? enc.encode(f.content) : f.content;
  return zipSync(entries, { level: 6 });
}

export function projectZip(project: GeneratedProject): Blob {
  const bytes = projectZipBytes(project);
  return new Blob([bytes.slice().buffer], { type: 'application/zip' });
}

export type * from './types';
export type * from './site-types';
