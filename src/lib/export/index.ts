// CONTRACT (implementation owned by the export workstream). Keep these signatures.
import type { Portfolio } from '@/types/portfolio';
import type { ExportResult, ProgressFn } from './types';

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

export async function exportHtml(_p: Portfolio, _o: HtmlExportOptions, _onProgress?: ProgressFn): Promise<ExportResult> {
  throw new Error('HTML export is not available yet.');
}
export async function exportZip(_p: Portfolio, _o: ZipExportOptions, _onProgress?: ProgressFn): Promise<ExportResult> {
  throw new Error('ZIP export is not available yet.');
}
export async function exportPdf(_p: Portfolio, _o: PdfExportOptions, _onProgress?: ProgressFn): Promise<ExportResult> {
  throw new Error('PDF export is not available yet.');
}
export async function exportDocx(_p: Portfolio, _o: DocxExportOptions, _onProgress?: ProgressFn): Promise<ExportResult> {
  throw new Error('DOCX export is not available yet.');
}
export async function exportProjectJson(_p: Portfolio, _projectName: string): Promise<ExportResult> {
  throw new Error('JSON export is not available yet.');
}
export type * from './types';
