/**
 * Raw parsed pages → a complete extraction (minus id/version, which storage assigns).
 * Pure and synchronous: runs inside the analysis worker.
 */
import type { DocumentType, Extraction, ExtractionOptions, OcrSummary, PdfMetadata, RawPage } from '../types';
import { analyseLayout, collectLinks } from './layout';
import { extractSemantic } from './semantic';

export interface AnalyseInput {
  docId: string;
  docName: string;
  raw: RawPage[];
  metadata: PdfMetadata | null;
  options: ExtractionOptions;
  forcedType?: DocumentType;
  warnings?: string[];
}

export type AnalyseOutput = Omit<Extraction, 'id' | 'docId' | 'version' | 'label' | 'origin' | 'createdAt'>;

/** OCR words below this confidence are listed for review. */
export const OCR_REVIEW_THRESHOLD = 0.7;

export function analyse(input: AnalyseInput): AnalyseOutput {
  const { raw, options } = input;
  const pages = analyseLayout(raw, { tables: options.tables, images: options.images, structure: options.structure });
  const links = options.links ? collectLinks(raw, pages) : [];
  const semantic = extractSemantic(pages, links, input.docId, input.docName, options.semantic, input.forcedType);

  let ocr: OcrSummary | null = null;
  const ocrPages = pages.filter((p) => p.ocr);
  if (ocrPages.length) {
    const words = ocrPages.flatMap((p) => p.blocks.flatMap((b) => b.lines.flatMap((l) => (l.words ?? []).map((w) => ({ ...w, page: p.page, blockId: b.id })))));
    const scored = words.filter((w) => typeof w.confidence === 'number');
    ocr = {
      pages: ocrPages.length,
      words: words.length,
      confidence: scored.length ? Math.round((scored.reduce((s, w) => s + w.confidence!, 0) / scored.length) * 100) / 100 : 0,
      uncertain: scored
        .filter((w) => w.confidence! < OCR_REVIEW_THRESHOLD && /[A-Za-z0-9]{2,}/.test(w.text))
        .slice(0, 500)
        .map((w) => ({ page: w.page, blockId: w.blockId, text: w.text.trim(), confidence: Math.round(w.confidence! * 100) / 100 })),
    };
  }

  const blocks = pages.flatMap((p) => p.blocks);
  const warnings = [...(input.warnings ?? [])];
  if (blocks.some((b) => b.type === 'table' && b.uncertain)) warnings.push('Table structure may require verification.');
  const wordCount = blocks.filter((b) => b.type !== 'image').reduce((n, b) => n + (b.text.match(/\S+/g)?.length ?? 0), 0);
  if (!wordCount) warnings.push('No text was found. If this is a scanned document, run OCR.');

  return {
    options,
    metadata: options.metadata ? input.metadata : null,
    pages,
    links,
    semantic,
    ocr,
    warnings,
    stats: {
      pages: pages.length,
      words: wordCount,
      blocks: blocks.filter((b) => b.type !== 'image').length,
      tables: blocks.filter((b) => b.type === 'table').length,
      images: blocks.filter((b) => b.type === 'image').length,
      links: links.length,
    },
  };
}

/* ------------------------- plain-text documents ---------------------- */

/** .txt / .md content as raw pages so the same layout and semantic rules apply. */
export function textToRawPages(text: string, kind: 'txt' | 'md'): RawPage[] {
  const LINE = 14;
  const PER_PAGE = 60;
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const pages: RawPage[] = [];
  for (let i = 0; i < Math.max(1, lines.length); i += PER_PAGE) {
    const chunk = lines.slice(i, i + PER_PAGE);
    let y = 40;
    const items = chunk.flatMap((line) => {
      let t = line.replace(/\t/g, '    ');
      if (!t.trim()) {
        y += LINE;
        return [];
      }
      let size = 10;
      let bold = false;
      if (kind === 'md') {
        const h = /^(#{1,6})\s+(.*)$/.exec(t);
        if (h) {
          size = [0, 20, 16, 13, 12, 11, 11][h[1]!.length]!;
          bold = true;
          t = h[2]!;
        }
        t = t.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)').replace(/^\s*[-*+]\s+/, '• ');
      }
      const indent = (/^\s*/.exec(t)?.[0].length ?? 0) * 5;
      const top = y;
      y += size * 1.4;
      return [{ text: t.trim(), x: 40 + indent, y: top, width: t.trim().length * size * 0.5, height: size, fontSize: size, fontName: '', bold }];
    });
    pages.push({ page: pages.length + 1, width: 612, height: Math.max(792, y + 40), items, links: [], images: [], ocr: false });
  }
  return pages;
}
