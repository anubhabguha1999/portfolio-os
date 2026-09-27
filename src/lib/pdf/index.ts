import type { DocModel } from '@/types/document';
import { renderPdfDocument } from './render';
import type { ImageMap, PdfRenderOptions, PdfRenderResult, RenderProgress } from './types';

export type * from './types';
export { pdfText } from './text';
export { pageDimensions, PAGE_SIZES } from './render';

/** Typography scale steps tried by fit-to-pages (natural size first, ~0.78 floor). */
export const FIT_SCALES = [1, 0.95, 0.9, 0.86, 0.82, 0.78] as const;

function plural(n: number): string {
  return `${n} page${n === 1 ? '' : 's'}`;
}

/**
 * Render a DocModel to PDF bytes. With `fitPages` set, the document is re-laid out at
 * decreasing scales until it fits the target page count (or the floor is reached).
 */
export function renderPdf(model: DocModel, images: ImageMap, options: PdfRenderOptions, onProgress?: RenderProgress): PdfRenderResult {
  const target = options.fitPages && options.fitPages > 0 ? options.fitPages : null;
  const scales = target ? FIT_SCALES : [1];
  let chosen: { doc: ReturnType<typeof renderPdfDocument>; scale: number; pages: number } | null = null;
  for (let i = 0; i < scales.length; i++) {
    const scale = scales[i]!;
    const doc = renderPdfDocument(model, images, options, scale);
    const pages = doc.getNumberOfPages();
    chosen = { doc, scale, pages };
    const fits = !target || pages <= target;
    const attempt = target && i > 0 ? ` at ${Math.round(scale * 100)}% scale` : '';
    onProgress?.(`Rendering pages… ${plural(pages)}${attempt}`, 0.45 + (0.4 * (i + 1)) / scales.length);
    if (fits) break;
  }
  if (!chosen) throw new Error('Nothing to render.');
  onProgress?.('Generating PDF…', 0.9);
  const buffer = chosen.doc.output('arraybuffer');
  return { buffer, pageCount: chosen.pages, scale: chosen.scale, overflow: !!target && chosen.pages > target };
}
