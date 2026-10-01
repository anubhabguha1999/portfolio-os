import type { FlowDoc } from '@/studio/engine/flow';
import type { RasterMap } from '@/studio/engine/render-pdf';

export interface PdfJobOptions {
  links: boolean;
  metadata: boolean;
  compress: boolean;
}

export type StudioJob =
  | { id: number; kind: 'pdf'; flow: FlowDoc; images: RasterMap; options: PdfJobOptions }
  | { id: number; kind: 'docx'; flow: FlowDoc; images: RasterMap; includeImages: boolean }
  | { id: number; kind: 'zip'; files: Array<{ path: string; bytes: Uint8Array }> };

export type StudioWorkerMessage =
  | { id: number; type: 'progress'; stage: string; progress: number }
  | { id: number; type: 'pdf'; buffer: ArrayBuffer; pages: number }
  | { id: number; type: 'docx'; buffer: ArrayBuffer }
  | { id: number; type: 'zip'; buffer: ArrayBuffer }
  | { id: number; type: 'error'; message: string };
