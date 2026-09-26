export type ExportKind = 'html' | 'zip' | 'pdf' | 'docx' | 'json';

export interface ExportProgress {
  /** Stage label, e.g. "Rendering pages…" */
  stage: string;
  /** 0–1 */
  progress: number;
}

export type ProgressFn = (p: ExportProgress) => void;

export interface ExportResult {
  blob: Blob;
  filename: string;
  /** Non-fatal notes, e.g. "2 images could not be embedded". */
  warnings: string[];
}
