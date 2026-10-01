import { useEffect, useRef, useState } from 'react';
import type { ImageEdit } from '@/studio/model/types';
import { getImage } from '@/studio/storage/repo';
import { decodeImage, paintVariant, type Placement, type RenderTarget } from '@/studio/images/pipeline';
import { cn } from '@/utils/cn';

export type Decoded = ImageBitmap | HTMLImageElement;

/** Decode the stored original once (plus an object URL for thumbnails). */
export function useOriginal(assetId: string | undefined): { source: Decoded | null; url: string | null; error: boolean } {
  const [state, setState] = useState<{ source: Decoded | null; url: string | null; error: boolean }>({ source: null, url: null, error: false });
  useEffect(() => {
    if (!assetId) {
      setState({ source: null, url: null, error: false });
      return;
    }
    let cancelled = false;
    let url: string | null = null;
    let decoded: Decoded | null = null;
    void (async () => {
      const rec = await getImage(assetId).catch(() => undefined);
      if (!rec) {
        if (!cancelled) setState({ source: null, url: null, error: true });
        return;
      }
      url = URL.createObjectURL(rec.blob);
      decoded = await decodeImage(rec.blob);
      if (cancelled) {
        URL.revokeObjectURL(url);
        return;
      }
      setState({ source: decoded, url, error: !decoded });
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      if (decoded && 'close' in decoded) decoded.close();
    };
  }, [assetId]);
  return state;
}

const PREVIEW_EDGE = 640;

export const CHECKER = 'repeating-conic-gradient(#d4d4d8 0 25%, #fafafa 0 50%) 50% / 16px 16px';

export interface EditCanvasProps {
  source: Decoded;
  edit: ImageEdit;
  target: RenderTarget;
  placement: Placement;
  onPlacement: (p: Placement) => void;
  /** Called when a drag/zoom gesture ends (commit point). */
  onCommit?: () => void;
  /** Displayed long edge in CSS px (the canvas scales to fit its container). */
  maxDisplay?: number;
  label: string;
  showGrid?: boolean;
  className?: string;
}

/**
 * Live, interactive preview of a variant: drag to pan, wheel/pinch to zoom, arrow keys
 * to nudge, +/− to zoom. Rendering uses the same paint routine as exports.
 */
export function EditCanvas({ source, edit, target, placement, onPlacement, onCommit, maxDisplay = 520, label, showGrid = true, className }: EditCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; start: Placement; w: number; h: number } | null>(null);
  const frame = useRef<number | null>(null);
  const latest = useRef(placement);
  latest.current = placement;

  const w = target.aspect >= 1 ? PREVIEW_EDGE : Math.round(PREVIEW_EDGE * target.aspect);
  const h = target.aspect >= 1 ? Math.round(PREVIEW_EDGE / target.aspect) : PREVIEW_EDGE;

  useEffect(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const c = ref.current;
      const ctx = c?.getContext('2d');
      if (!c || !ctx) return;
      paintVariant(ctx, source as CanvasImageSource & { width: number; height: number }, edit, target, w, h, placement);
    });
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [source, edit, target, placement, w, h]);

  const zoomBy = (factor: number) => {
    const p = latest.current;
    onPlacement({ ...p, zoom: Math.min(6, Math.max(0.3, p.zoom * factor)) });
  };

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomBy(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)));
      if (t) clearTimeout(t);
      t = setTimeout(() => onCommit?.(), 250);
    };
    c.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      c.removeEventListener('wheel', onWheel);
      if (t) clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCommit]);

  const display = target.aspect >= 1 ? { width: maxDisplay, height: maxDisplay / target.aspect } : { width: maxDisplay * target.aspect, height: maxDisplay };

  return (
    <div className={cn('relative mx-auto max-w-full', className)} style={{ width: display.width, aspectRatio: `${target.aspect}` }}>
      <div className="absolute inset-0 overflow-hidden rounded-md" style={{ background: CHECKER }} aria-hidden="true" />
      <canvas
        ref={ref}
        width={w}
        height={h}
        tabIndex={0}
        role="img"
        aria-label={`${label}. Drag to reposition, scroll to zoom, arrow keys to nudge, plus and minus to zoom.`}
        className={cn('relative block size-full touch-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent', dragging ? 'cursor-grabbing' : 'cursor-grab')}
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, start: latest.current, w: r.width, h: r.height };
          setDragging(true);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          onPlacement({ ...d.start, panX: d.start.panX + (e.clientX - d.x) / d.w, panY: d.start.panY + (e.clientY - d.y) / d.h });
        }}
        onPointerUp={() => {
          drag.current = null;
          setDragging(false);
          onCommit?.();
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
        }}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 0.05 : 0.01;
          const p = latest.current;
          let next: Placement | null = null;
          if (e.key === 'ArrowLeft') next = { ...p, panX: p.panX - step };
          else if (e.key === 'ArrowRight') next = { ...p, panX: p.panX + step };
          else if (e.key === 'ArrowUp') next = { ...p, panY: p.panY - step };
          else if (e.key === 'ArrowDown') next = { ...p, panY: p.panY + step };
          else if (e.key === '+' || e.key === '=') next = { ...p, zoom: Math.min(6, p.zoom * 1.06) };
          else if (e.key === '-' || e.key === '_') next = { ...p, zoom: Math.max(0.3, p.zoom / 1.06) };
          if (next) {
            e.preventDefault();
            onPlacement(next);
            onCommit?.();
          }
        }}
      />
      {showGrid && dragging && (
        <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 3 3" preserveAspectRatio="none" aria-hidden="true">
          <path d="M1 0V3M2 0V3M0 1H3M0 2H3" stroke="white" strokeOpacity=".7" strokeWidth=".01" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
    </div>
  );
}

/** Static render (thumbnails) using the same paint routine. */
export function StaticVariant({ source, edit, target, placement, size = 72, className, title }: { source: Decoded; edit: ImageEdit; target: RenderTarget; placement: Placement; size?: number; className?: string; title?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const px = 160;
  const w = target.aspect >= 1 ? px : Math.round(px * target.aspect);
  const h = target.aspect >= 1 ? Math.round(px / target.aspect) : px;
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const ctx = ref.current?.getContext('2d');
      if (ctx) paintVariant(ctx, source as CanvasImageSource & { width: number; height: number }, edit, target, w, h, placement);
    });
    return () => cancelAnimationFrame(id);
  }, [source, edit, target, placement, w, h]);
  const dw = target.aspect >= 1 ? size : size * target.aspect;
  return (
    <span className={cn('relative inline-block overflow-hidden rounded', className)} style={{ width: dw, aspectRatio: `${target.aspect}`, background: CHECKER }} title={title}>
      <canvas ref={ref} width={w} height={h} className="block size-full" aria-hidden="true" />
    </span>
  );
}
