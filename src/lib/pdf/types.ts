import type { RasterImage } from '@/lib/export/assets';

/** 'portfolio' = full portfolio document; the others are resume templates. */
export type DocTemplate = 'portfolio' | 'classic' | 'modern' | 'ats';

export interface PdfRenderOptions {
  pageSize: 'a4' | 'letter' | 'a3' | 'custom';
  customSize: { width: number; height: number };
  orientation: 'portrait' | 'landscape';
  margins: number;
  headerText: string;
  footerText: string;
  pageNumbers: boolean;
  sectionPageBreaks: boolean;
  includeImages: boolean;
  template: DocTemplate;
  /** Target page count for fit-to-pages (null = natural length). */
  fitPages: number | null;
  /** Deflate content streams (off in tests so text can be inspected). */
  compress: boolean;
}

export interface PdfRenderResult {
  buffer: ArrayBuffer;
  pageCount: number;
  /** Typography scale that was finally used (1 = natural). */
  scale: number;
  /** True when fit-to-pages could not reach the target even at the minimum scale. */
  overflow: boolean;
}

export type RenderProgress = (stage: string, progress: number) => void;

export type ImageMap = Record<string, RasterImage>;
