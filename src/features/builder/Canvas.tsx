import { forwardRef, useEffect, useRef, useState } from 'react';
import type { Portfolio } from '@/types/portfolio';
import { useUI, VIEWPORTS } from '@/stores/ui';
import { useEditor } from '@/stores/editor';
import { PreviewFrame, type PreviewFrameHandle } from '@/features/preview/PreviewFrame';
import { CodeView } from './CodeView';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { cn } from '@/utils/cn';

export function breakpointOf(width: number): { name: string; range: string } {
  if (width <= 640) return { name: 'Mobile', range: '≤ 640px' };
  if (width <= 1024) return { name: 'Tablet', range: '641–1024px' };
  return { name: 'Desktop', range: '≥ 1025px' };
}

export function useViewportSize(): { width: number; height: number } {
  const viewport = useUI((s) => s.viewport);
  const custom = useUI((s) => s.customSize);
  return viewport === 'custom' ? custom : VIEWPORTS[viewport];
}

export const Canvas = forwardRef<PreviewFrameHandle, { portfolio: Portfolio; onSelect: (id: string) => void; onPresentExit: () => void }>(function Canvas({ portfolio, onSelect, onPresentExit }, ref) {
  const devView = useUI((s) => s.devView);
  const zoom = useUI((s) => s.zoom);
  const focusMode = useUI((s) => s.focusMode);
  const selected = useEditor((s) => s.selectedSectionId);
  const size = useViewportSize();
  const wrap = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = focusMode ? 0 : 32;
  const fit = box.w ? Math.min(1, (box.w - pad) / size.width) : 1;
  const scale = zoom === 'fit' ? fit : zoom;
  const isFull = size.width >= 1025;
  // Desktop-like viewports fill the available height; devices keep their aspect.
  const frameH = isFull ? Math.max(size.height, (box.h - pad) / scale) : size.height;
  const bp = breakpointOf(size.width);

  if (devView !== 'preview') {
    return (
      <ErrorBoundary area="Code view" compact>
        <CodeView portfolio={portfolio} kind={devView} />
      </ErrorBoundary>
    );
  }

  return (
    <div ref={wrap} className={cn('relative h-full min-h-0 overflow-auto', !focusMode && 'bg-canvas [background-image:radial-gradient(var(--app-line)_1px,transparent_1px)] [background-size:18px_18px]')}>
      <div className="flex min-h-full min-w-full items-start justify-center" style={{ padding: pad / 2 }}>
        <div
          className={cn('relative shrink-0 origin-top overflow-hidden bg-white', !focusMode && 'rounded-[10px] shadow-[0_0_0_1px_var(--app-line-strong),0_30px_80px_-30px_rgba(0,0,0,.6)]', !isFull && !focusMode && 'rounded-[22px]')}
          style={{ width: size.width * scale, height: frameH * scale }}
        >
          <div style={{ width: size.width, height: frameH, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
            <ErrorBoundary area="Preview" compact>
              <PreviewFrame ref={ref} portfolio={portfolio} editing selectedId={selected} onSelect={onSelect} onPresentExit={onPresentExit} title="Live portfolio canvas" />
            </ErrorBoundary>
          </div>
        </div>
      </div>
      {!focusMode && (
        <div className="pointer-events-none sticky bottom-3 left-0 flex justify-center">
          <span className="rounded-full border border-line bg-panel/90 px-3 py-1 font-mono text-[10.5px] text-fg-subtle shadow-float backdrop-blur">
            {size.width}×{size.height} · {bp.name} breakpoint ({bp.range}) · {Math.round(scale * 100)}%
          </span>
        </div>
      )}
    </div>
  );
});
