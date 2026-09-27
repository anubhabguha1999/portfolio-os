export type ExportKind = 'html' | 'zip' | 'pdf' | 'docx' | 'json';

export interface ExportProgress {
  /** Stage label, e.g. "Rendering pages…" */
  stage: string;
  /** 0–1 */
  progress: number;
}

export type ProgressFn = (p: ExportProgress) => void;

export interface ExportFileEntry {
  /** Path inside the package, e.g. "portfolio/index.html". */
  path: string;
  /** Uncompressed size in bytes. */
  size: number;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  /** Non-fatal notes, e.g. "2 images could not be embedded". */
  warnings: string[];
  /** PDF: number of pages actually produced. */
  pageCount?: number;
  /** PDF fit-to-pages: typography scale used (1 = natural size). */
  scale?: number;
  /** ZIP: every file in the package with its real size. */
  files?: ExportFileEntry[];
}
