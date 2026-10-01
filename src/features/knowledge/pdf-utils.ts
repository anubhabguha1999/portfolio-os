import { closePdf, openPdf, PdfPasswordError } from '@/knowledge/pdf/pdf';

/** Page count for the extraction settings dialog (0 when the file is locked or unreadable). */
export async function pdfPageCount(bytes: ArrayBuffer): Promise<number> {
  try {
    const doc = await openPdf(bytes);
    const n = doc.numPages;
    closePdf(doc);
    return n;
  } catch (err) {
    if (err instanceof PdfPasswordError) return 0;
    throw err;
  }
}
