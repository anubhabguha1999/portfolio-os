// CONTRACT (implementation owned by the export workstream). Keep these signatures.
import JSZip from 'jszip';
import type { Portfolio } from '@/types/portfolio';
import type { ExportResult, ProgressFn, ExportFileEntry } from './types';
import { buildBackup } from '@/lib/storage/projects';
import { documentImageSources } from '@/lib/document/build';
import { heroOf } from '@/lib/engine/collect';
import { fileSafeName } from '@/utils/format';
import { buildStandaloneHtml, buildSitePackage, type HtmlEnv } from '@/lib/html/build';
import { renderPdf } from '@/lib/pdf';
import type { PdfRenderOptions, PdfRenderResult } from '@/lib/pdf/types';
import { renderDocx, type DocxRenderOptions } from '@/lib/docx/render';
import { resolveRasterImages, type ImageEnv, type ResolvedImages } from './assets';
import { buildExportDocument, fitTargetOf, templateOf, type DocumentSpec } from './document';
import { pdfInWorker, docxInWorker, imagesDetached, WorkerUnavailableError } from './runner';

export interface HtmlExportOptions {
  fontDelivery: 'system' | 'cdn';
  embedData: boolean;
}
export interface ZipExportOptions extends HtmlExportOptions {
  includeProjectJson: boolean;
}
export interface PdfExportOptions {
  mode: 'portfolio' | 'resume';
  resumeLength: 'one-page' | 'two-page' | 'full';
  resumeTemplate: 'classic' | 'modern' | 'ats';
  pageSize: 'a4' | 'letter' | 'a3' | 'custom';
  customSize: { width: number; height: number }; // mm
  orientation: 'portrait' | 'landscape';
  margins: number; // mm
  headerText: string;
  footerText: string;
  pageNumbers: boolean;
  sectionPageBreaks: boolean;
  includeImages: boolean;
}
export interface DocxExportOptions {
  mode: 'resume' | 'portfolio';
  resumeLength: 'one-page' | 'two-page' | 'full';
  resumeTemplate: 'classic' | 'modern' | 'ats';
  includeImages: boolean;
  pageNumbers: boolean;
}

/** Optional hooks (tests, advanced callers). Every field has a sensible default. */
export interface ExportEnv extends ImageEnv, HtmlEnv {
  /** Run PDF/DOCX generation in the Web Worker when available. Default true. */
  useWorker?: boolean;
  /** Deflate PDF content streams. Default true. */
  compress?: boolean;
}

export const PDF_MIME = 'application/pdf';
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const ZIP_ROOT = 'portfolio';

export function portfolioTitle(p: Portfolio): string {
  return p.metadata.title || heroOf(p)?.name || p.metadata.author || 'Portfolio';
}

function personName(p: Portfolio): string {
  return heroOf(p)?.name || p.metadata.author || p.metadata.title || 'resume';
}

function report(fn: ProgressFn | undefined, stage: string, progress: number): void {
  fn?.({ stage, progress: Math.max(0, Math.min(1, progress)) });
}

/** Let the browser paint the current stage before synchronous main-thread work. */
function yieldToUi(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

export async function exportHtml(p: Portfolio, o: HtmlExportOptions, onProgress?: ProgressFn, env: ExportEnv = {}): Promise<ExportResult> {
  report(onProgress, 'Embedding images and fonts…', 0.15);
  const { html, warnings } = await buildStandaloneHtml(p, o, env);
  report(onProgress, 'Done', 1);
  return { blob: new Blob([html], { type: 'text/html;charset=utf-8' }), filename: `${fileSafeName(portfolioTitle(p))}.html`, warnings };
}

/** Deployable website archive; `files` lists every entry with its real size. */
export async function exportZip(p: Portfolio, o: ZipExportOptions, onProgress?: ProgressFn, env: ExportEnv = {}): Promise<ExportResult> {
  report(onProgress, 'Collecting assets…', 0.1);
  const site = await buildSitePackage(p, o, env);
  const warnings = [...site.warnings];
  const files = [...site.files];
  if (o.includeProjectJson) {
    report(onProgress, 'Adding project backup…', 0.35);
    try {
      const backup = await buildBackup(p);
      files.push({ path: 'portfolio.json', bytes: new TextEncoder().encode(JSON.stringify(backup, null, 2)) });
    } catch {
      warnings.push('The project backup (portfolio.json) could not be created and was left out.');
    }
  }
  const zip = new JSZip();
  const root = zip.folder(ZIP_ROOT);
  if (!root) throw new Error('Could not create the archive.');
  // Explicit folder entries keep the documented structure even when a folder is empty.
  for (const dir of ['assets', 'assets/images', 'assets/fonts', 'assets/icons', 'css', 'js']) root.folder(dir);
  const date = new Date(p.metadata.updatedAt || Date.now());
  for (const f of files) root.file(f.path, f.bytes, { binary: true, date: Number.isFinite(date.getTime()) ? date : new Date() });
  report(onProgress, 'Compressing…', 0.45);
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 }, platform: 'UNIX' }, (meta) => {
    report(onProgress, `Compressing… ${Math.round(meta.percent)}%`, 0.45 + (meta.percent / 100) * 0.5);
  });
  const entries: ExportFileEntry[] = files.map((f) => ({ path: `${ZIP_ROOT}/${f.path}`, size: f.bytes.byteLength })).sort((a, b) => a.path.localeCompare(b.path));
  report(onProgress, 'Done', 1);
  return { blob: new Blob([bytes.slice().buffer], { type: 'application/zip' }), filename: `${fileSafeName(portfolioTitle(p))}-website.zip`, warnings, files: entries };
}

async function prepareDocument(p: Portfolio, spec: DocumentSpec, onProgress: ProgressFn | undefined, env: ExportEnv) {
  report(onProgress, 'Preparing document…', 0.04);
  const model = buildExportDocument(p, spec);
  const wantsImages = spec.includeImages && !(spec.mode === 'resume' && spec.resumeTemplate === 'ats');
  const sources = wantsImages ? documentImageSources(model) : [];
  const resolve = async (): Promise<ResolvedImages> => {
    if (!sources.length) return { images: {}, warnings: [] };
    report(onProgress, `Embedding images… 0/${sources.length}`, 0.1);
    return resolveRasterImages(p, sources, env, (done, total) => report(onProgress, `Embedding images… ${done}/${total}`, 0.1 + (0.3 * done) / total));
  };
  const resolved = await resolve();
  return { model, resolved, resolve };
}

function fileBase(p: Portfolio, mode: 'portfolio' | 'resume'): string {
  return mode === 'resume' ? `${fileSafeName(personName(p))}-resume` : fileSafeName(portfolioTitle(p));
}

export async function exportPdf(p: Portfolio, o: PdfExportOptions, onProgress?: ProgressFn, env: ExportEnv = {}): Promise<ExportResult> {
  const { model, resolved, resolve } = await prepareDocument(p, o, onProgress, env);
  const warnings = [...resolved.warnings];
  const options: PdfRenderOptions = {
    pageSize: o.pageSize,
    customSize: o.customSize,
    orientation: o.orientation,
    margins: o.margins,
    headerText: o.headerText,
    footerText: o.footerText,
    pageNumbers: o.pageNumbers,
    sectionPageBreaks: o.sectionPageBreaks,
    includeImages: o.includeImages,
    template: templateOf(o),
    fitPages: fitTargetOf(o),
    compress: env.compress ?? true,
  };
  const stage = (s: string, v: number) => report(onProgress, s, v);
  report(onProgress, 'Rendering pages…', 0.42);
  let result: PdfRenderResult;
  let images = resolved.images;
  try {
    if (env.useWorker === false) throw new WorkerUnavailableError('disabled');
    result = await pdfInWorker(model, images, options, stage);
  } catch (err) {
    if (!(err instanceof WorkerUnavailableError)) throw err;
    if (imagesDetached(images)) images = (await resolve()).images;
    await yieldToUi();
    result = renderPdf(model, images, options, stage);
  }
  const target = options.fitPages;
  if (result.overflow && target) warnings.push(`The resume still needs ${result.pageCount} pages at the smallest readable size (target: ${target}). Shorten some content or choose a longer length.`);
  else if (target && result.scale < 1) warnings.push(`Text was scaled to ${Math.round(result.scale * 100)}% to fit ${target === 1 ? 'one page' : `${target} pages`}.`);
  report(onProgress, 'Done', 1);
  return { blob: new Blob([result.buffer], { type: PDF_MIME }), filename: `${fileBase(p, o.mode)}.pdf`, warnings, pageCount: result.pageCount, scale: result.scale };
}

export async function exportDocx(p: Portfolio, o: DocxExportOptions, onProgress?: ProgressFn, env: ExportEnv = {}): Promise<ExportResult> {
  const { model, resolved, resolve } = await prepareDocument(p, o, onProgress, env);
  const warnings = [...resolved.warnings];
  const options: DocxRenderOptions = { template: templateOf(o), includeImages: o.includeImages, pageNumbers: o.pageNumbers };
  const stage = (s: string, v: number) => report(onProgress, s, v);
  report(onProgress, 'Building document…', 0.5);
  let buffer: ArrayBuffer;
  let images = resolved.images;
  try {
    if (env.useWorker === false) throw new WorkerUnavailableError('disabled');
    buffer = await docxInWorker(model, images, options, stage);
  } catch (err) {
    if (!(err instanceof WorkerUnavailableError)) throw err;
    if (imagesDetached(images)) images = (await resolve()).images;
    await yieldToUi();
    buffer = await renderDocx(model, images, options);
  }
  report(onProgress, 'Done', 1);
  return { blob: new Blob([buffer], { type: DOCX_MIME }), filename: `${fileBase(p, o.mode)}.docx`, warnings };
}

export async function exportProjectJson(p: Portfolio, projectName: string): Promise<ExportResult> {
  const backup = await buildBackup(p);
  return { blob: new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }), filename: `${fileSafeName(projectName)}.portfolio.json`, warnings: [] };
}

export { printPortfolio, buildStandaloneHtml, buildSitePackage } from '@/lib/html/build';
export { buildExportDocument, templateOf, fitTargetOf } from './document';
export type * from './types';
