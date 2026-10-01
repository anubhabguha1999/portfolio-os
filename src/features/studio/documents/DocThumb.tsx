import type { StudioDocument } from '@/studio/model/types';
import { PageSvg } from '@/studio/engine/PageSvg';
import { useDocumentLayout } from './useDocumentLayout';

/** Real first-page preview of a document, rendered by the same engine as the PDF. */
export function DocThumb({ doc, width = 220 }: { doc: StudioDocument; width?: number }) {
  const { laid, imageUrl } = useDocumentLayout(doc, { placeholders: false });
  const first = laid?.pages[0];
  if (!laid || !first) return <div className="aspect-[210/297] w-full animate-pulse bg-hover" />;
  return (
    <div className="relative">
      <PageSvg page={first} width={laid.width} height={laid.height} {...(laid.background ? { background: laid.background } : {})} imageUrl={imageUrl} pixelWidth={width} links={false} className="h-auto w-full" title={`${doc.name} preview`} />
      {laid.pages.length > 1 && <span className="absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white">{laid.pages.length} pages</span>}
    </div>
  );
}
