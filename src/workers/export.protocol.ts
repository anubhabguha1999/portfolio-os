import type { DocModel } from '@/types/document';
import type { ImageMap, PdfRenderOptions } from '@/lib/pdf/types';
import type { DocxRenderOptions } from '@/lib/docx/render';

export type ExportJob =
  | { id: number; kind: 'pdf'; model: DocModel; images: ImageMap; options: PdfRenderOptions }
  | { id: number; kind: 'docx'; model: DocModel; images: ImageMap; options: DocxRenderOptions };

export type ExportWorkerMessage =
  | { id: number; type: 'progress'; stage: string; progress: number }
  | { id: number; type: 'pdf'; buffer: ArrayBuffer; pageCount: number; scale: number; overflow: boolean }
  | { id: number; type: 'docx'; buffer: ArrayBuffer }
  | { id: number; type: 'error'; message: string };
