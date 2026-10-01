import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { LaidDocument, RefBox } from '@/studio/engine/flow';
import { PageSvg } from '@/studio/engine/PageSvg';
import { cn } from '@/utils/cn';

export type ZoomMode = number | 'fit-width' | 'fit-page';

export const MM_PX = 96 / 25.4;

export const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5];

export function useContainerSize<T extends HTMLElement>(): [React.RefObject<T | null>, { width: number; height: number }] {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

export function resolveZoom(zoom: ZoomMode, laid: Pick<LaidDocument, 'width' | 'height'>, box: { width: number; height: number }, pad = 64): number {
  if (typeof zoom === 'number') return zoom;
  const byWidth = (box.width - pad) / (laid.width * MM_PX);
  if (zoom === 'fit-width') return Math.max(0.2, Math.min(3, byWidth));
  const byHeight = (box.height - pad) / (laid.height * MM_PX);
  return Math.max(0.2, Math.min(3, Math.min(byWidth, byHeight)));
}

export interface PagedCanvasProps {
  laid: LaidDocument;
  zoom: ZoomMode;
  imageUrl: (src: string) => string | undefined;
  selectedRef?: string | null;
  onSelectRef?: (ref: string | null) => void;
  /** 'edit' shows hover/selection outlines; 'print' shows pages only. */
  mode?: 'edit' | 'print';
  className?: string;
  /** Page gap in px. */
  gap?: number;
  overlay?: (page: number) => ReactNode;
  onZoomChange?: (z: number) => void;
  /** Dim pages beyond this count (page-limit preview). */
  pageLimit?: number;
  /** Page count shown in labels (when rendering a subset of pages). */
  totalPages?: number;
}

/** Smallest box containing the point wins (innermost element). */
function hitTest(refs: RefBox[], x: number, y: number): RefBox | null {
  let best: RefBox | null = null;
  for (const r of refs) {
    if (x >= r.x - 0.5 && x <= r.x + r.w + 0.5 && y >= r.y - 0.5 && y <= r.y + r.h + 0.5) {
      if (!best || r.w * r.h < best.w * best.h) best = r;
    }
  }
  return best;
}

export function PagedCanvas({ laid, zoom, imageUrl, selectedRef, onSelectRef, mode = 'edit', className, gap = 28, overlay, onZoomChange, pageLimit, totalPages }: PagedCanvasProps) {
  const [scrollRef, size] = useContainerSize<HTMLDivElement>();
  const scale = resolveZoom(zoom, laid, size);
  const pxW = laid.width * MM_PX * scale;
  const pxH = laid.height * MM_PX * scale;
  const [hover, setHover] = useState<{ page: number; box: RefBox } | null>(null);

  // Ctrl/⌘ + wheel zooms.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !onZoomChange) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      onZoomChange(Math.max(0.3, Math.min(3, scale * (e.deltaY > 0 ? 0.92 : 1.08))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [scrollRef, onZoomChange, scale]);

  const selectedBoxes = useMemo(() => {
    if (!selectedRef) return [];
    const out: Array<{ page: number; box: RefBox }> = [];
    laid.pages.forEach((p) => p.refs.forEach((r) => r.ref === selectedRef && out.push({ page: p.index, box: r })));
    return out;
  }, [laid, selectedRef]);

  const toMm = (e: React.MouseEvent, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * laid.width, y: ((e.clientY - r.top) / r.height) * laid.height };
  };

  return (
    <div ref={scrollRef} className={cn('relative h-full overflow-auto bg-canvas', className)} onClick={() => onSelectRef?.(null)}>
      <div className="flex min-w-fit flex-col items-center px-8 py-8" style={{ gap }}>
        {laid.pages.map((page) => {
          const beyond = pageLimit && pageLimit > 0 && page.index >= pageLimit;
          return (
            <div key={page.index} className="relative">
              <div
                className={cn('relative overflow-hidden rounded-[2px] bg-white shadow-[0_1px_2px_rgba(0,0,0,.12),0_12px_40px_-12px_rgba(0,0,0,.45)] ring-1 ring-black/5', beyond && 'opacity-60')}
                style={{ width: pxW, height: pxH }}
                onMouseMove={
                  mode === 'edit'
                    ? (e) => {
                        const { x, y } = toMm(e, e.currentTarget);
                        const hit = hitTest(page.refs, x, y);
                        setHover(hit ? { page: page.index, box: hit } : null);
                      }
                    : undefined
                }
                onMouseLeave={() => setHover(null)}
                onClick={
                  mode === 'edit'
                    ? (e) => {
                        e.stopPropagation();
                        const { x, y } = toMm(e, e.currentTarget);
                        onSelectRef?.(hitTest(page.refs, x, y)?.ref ?? null);
                      }
                    : undefined
                }
              >
                <PageSvg page={page} width={laid.width} height={laid.height} {...(laid.background ? { background: laid.background } : {})} imageUrl={imageUrl} pixelWidth={pxW} />
                {mode === 'edit' && (
                  <svg className="pointer-events-none absolute inset-0" viewBox={`0 0 ${laid.width} ${laid.height}`} width={pxW} height={pxH} aria-hidden="true">
                    {hover && hover.page === page.index && hover.box.ref !== selectedRef && <rect x={hover.box.x - 1} y={hover.box.y - 0.8} width={hover.box.w + 2} height={hover.box.h + 1.6} rx={0.8} fill="rgba(106,88,245,.06)" stroke="rgba(106,88,245,.55)" strokeWidth={0.25} strokeDasharray="1 0.8" />}
                    {selectedBoxes
                      .filter((s) => s.page === page.index)
                      .map((s, i) => (
                        <rect key={i} x={s.box.x - 1.2} y={s.box.y - 1} width={s.box.w + 2.4} height={s.box.h + 2} rx={1} fill="rgba(106,88,245,.07)" stroke="#6a58f5" strokeWidth={0.4} />
                      ))}
                  </svg>
                )}
                {overlay?.(page.index)}
                {beyond && <div className="pointer-events-none absolute inset-x-0 top-0 bg-danger/85 py-1 text-center text-[11px] font-semibold text-white">Beyond the {pageLimit}-page limit</div>}
              </div>
              <div className="mt-2 text-center font-mono text-[10.5px] text-fg-subtle">
                Page {page.index + 1} of {totalPages ?? laid.pages.length}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
