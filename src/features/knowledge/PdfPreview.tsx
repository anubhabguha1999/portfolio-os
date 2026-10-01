import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { FileWarning, KeyRound } from 'lucide-react';
import { Spinner } from '@/components/ui/Button';
import { closePdf, openPdf, PdfPasswordError, renderPage } from '@/knowledge/pdf/pdf';
import type { Box, ExtractedPage } from '@/knowledge/types';
import { cn } from '@/utils/cn';

export interface Highlight extends Box {
  page: number;
  tone?: 'select' | 'warn';
}

/**
 * Lazily rendered PDF pages (canvas) with highlight overlays in PDF point coordinates.
 * Pages render when scrolled near; their canvases are kept small (CSS width × devicePixelRatio).
 */
export function PdfPreview({ data, pages, highlights, focusPage, onPageClick }: { data: ArrayBuffer; pages: ExtractedPage[]; highlights: Highlight[]; focusPage: number | null; onPageClick?: (page: number, x: number, y: number) => void }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needPassword, setNeedPassword] = useState<{ incorrect: boolean } | null>(null);
  const [password, setPassword] = useState('');
  const [attempt, setAttempt] = useState<string | undefined>(undefined);

  useEffect(() => {
    let live = true;
    let opened: PDFDocumentProxy | null = null;
    setError(null);
    openPdf(data, attempt)
      .then((d) => {
        if (!live) return closePdf(d);
        opened = d;
        setNeedPassword(null);
        setDoc(d);
      })
      .catch((err: unknown) => {
        if (!live) return;
        if (err instanceof PdfPasswordError) setNeedPassword({ incorrect: err.incorrect });
        else setError(err instanceof Error ? err.message : 'Unable to display this PDF.');
      });
    return () => {
      live = false;
      if (opened) closePdf(opened);
      setDoc(null);
    };
  }, [data, attempt]);

  if (needPassword)
    return (
      <form
        className="m-auto grid max-w-xs gap-2 p-6 text-center"
        onSubmit={(e) => {
          e.preventDefault();
          setAttempt(password);
        }}
      >
        <KeyRound className="mx-auto size-6 text-accent" />
        <p className="text-[13px]">Enter the password locally to preview this PDF.</p>
        <input type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="PDF password" className="h-9 rounded-lg border border-line bg-bg px-2.5 text-[13px]" />
        {needPassword.incorrect && <p className="text-[12px] text-danger">Incorrect password.</p>}
        <button type="submit" className="h-9 rounded-lg bg-accent text-[13px] font-semibold text-accent-fg">
          Unlock preview
        </button>
      </form>
    );
  if (error)
    return (
      <div className="m-auto grid max-w-xs gap-2 p-6 text-center text-[13px] text-fg-muted">
        <FileWarning className="mx-auto size-6 text-warn" /> {error}
      </div>
    );
  if (!doc)
    return (
      <div className="grid h-full place-items-center">
        <Spinner className="size-5" />
      </div>
    );

  const numbers = pages.length ? pages.map((p) => p.page) : Array.from({ length: doc.numPages }, (_, i) => i + 1);
  return (
    <div className="grid gap-4 p-4">
      {numbers.map((n) => (
        <PageCanvas key={n} doc={doc} page={n} size={pages.find((p) => p.page === n)} highlights={highlights.filter((h) => h.page === n)} focused={focusPage === n} onClick={onPageClick} />
      ))}
    </div>
  );
}

function PageCanvas({ doc, page, size, highlights, focused, onClick }: { doc: PDFDocumentProxy; page: number; size: ExtractedPage | undefined; highlights: Highlight[]; focused: boolean; onClick?: (page: number, x: number, y: number) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(page <= 2);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(size ? { w: size.width, h: size.height } : null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el || visible) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setVisible(true), { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || !canvas.current || !wrap.current) return;
    let live = true;
    void (async () => {
      const p = await doc.getPage(page);
      const vp = p.getViewport({ scale: 1 });
      p.cleanup();
      if (!live) return;
      setDims({ w: vp.width, h: vp.height });
      const cssW = wrap.current?.clientWidth || 600;
      const scale = Math.min(3, (cssW / vp.width) * Math.min(2, window.devicePixelRatio || 1));
      await renderPage(doc, page, scale, canvas.current!);
      if (live) setRendered(true);
    })().catch(() => {});
    return () => {
      live = false;
    };
  }, [visible, doc, page]);

  useEffect(() => {
    if (focused) wrap.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [focused]);

  useEffect(() => {
    const first = highlights.find((h) => h.tone !== 'warn');
    if (!first || !dims || !wrap.current) return;
    const el = wrap.current.querySelector<HTMLElement>('[data-hl="select"]');
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlights, dims]);

  const ratio = dims ? dims.h / dims.w : 1.294;
  return (
    <div ref={wrap} className={cn('relative w-full overflow-hidden rounded-md bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)] ring-1 ring-black/5', focused && 'ring-2 ring-accent')} style={{ aspectRatio: `1 / ${ratio}` }} aria-label={`Page ${page}`}>
      <canvas
        ref={canvas}
        className={cn('absolute inset-0 size-full transition-opacity', rendered ? 'opacity-100' : 'opacity-0')}
        onClick={(e) => {
          if (!dims || !onClick) return;
          const r = e.currentTarget.getBoundingClientRect();
          onClick(page, ((e.clientX - r.left) / r.width) * dims.w, ((e.clientY - r.top) / r.height) * dims.h);
        }}
      />
      {!rendered && (
        <div className="absolute inset-0 grid place-items-center">
          <Spinner className="size-4 text-black/40" />
        </div>
      )}
      {dims &&
        highlights.map((h, i) => (
          <span
            key={i}
            data-hl={h.tone ?? 'select'}
            aria-hidden="true"
            className={cn('pointer-events-none absolute rounded-[2px]', h.tone === 'warn' ? 'bg-warn/25 ring-1 ring-warn/60' : 'bg-accent/20 ring-2 ring-accent')}
            style={{ left: `${((h.x - 2) / dims.w) * 100}%`, top: `${((h.y - 2) / dims.h) * 100}%`, width: `${((h.width + 4) / dims.w) * 100}%`, height: `${((h.height + 4) / dims.h) * 100}%` }}
          />
        ))}
      <span className="absolute bottom-1.5 right-2 rounded bg-black/50 px-1.5 text-[10px] font-medium text-white">{page}</span>
    </div>
  );
}
