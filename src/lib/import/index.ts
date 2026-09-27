import type { Portfolio } from '@/types/portfolio';
import { createProject, createSnapshot } from '@/lib/storage/projects';
import { dataUrlToBlob, putAssetRecord } from '@/lib/storage/assets';
import type { ProjectRecord } from '@/lib/storage/db';
import { uid } from '@/utils/id';
import type { HtmlImportResult, ImportedAsset } from './html';

export { importHtmlDocument, classifyHeading, type HtmlImportResult, type ImportedAsset } from './html';
export { parseResumeText, parseResumeStructure, summarizeResume, resumeToPortfolio, type ParsedResume } from './resume-text';

async function imageSize(blob: Blob): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap !== 'function' || !blob.type.startsWith('image/')) return { width: 0, height: 0 };
  try {
    const bmp = await createImageBitmap(blob);
    const size = { width: bmp.width, height: bmp.height };
    bmp.close();
    return size;
  } catch {
    return { width: 0, height: 0 };
  }
}

/** Store a portfolio as a brand-new project (fresh id, never overwriting) plus its assets, keeping asset ids so `asset:` refs resolve. */
export async function createImportedProject(portfolio: Portfolio, assets: ImportedAsset[] = [], label = 'Imported'): Promise<{ project: ProjectRecord; failedAssets: string[] }> {
  const project = await createProject({ ...portfolio, id: uid('pf') }, portfolio.metadata.title);
  const failedAssets: string[] = [];
  for (const a of assets) {
    try {
      const blob = dataUrlToBlob(a.dataUrl);
      const { width, height } = await imageSize(blob);
      await putAssetRecord({ id: a.id, projectId: project.id, name: a.name, mime: blob.type, size: blob.size, width, height, blob, createdAt: new Date().toISOString() });
    } catch {
      failedAssets.push(a.name);
    }
  }
  await createSnapshot(project.portfolio, 'import', label);
  return { project, failedAssets };
}

export async function createProjectFromHtml(result: HtmlImportResult): Promise<{ project: ProjectRecord; warnings: string[] }> {
  const { project, failedAssets } = await createImportedProject(result.portfolio, result.assets, result.exact ? 'Imported from HTML export' : 'Imported from HTML page');
  const warnings = [...result.warnings];
  if (failedAssets.length) warnings.push(`${failedAssets.length} image(s) could not be stored: ${failedAssets.join(', ')}.`);
  return { project, warnings };
}
