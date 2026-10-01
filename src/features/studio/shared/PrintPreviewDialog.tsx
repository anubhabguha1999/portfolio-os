import { useState } from 'react';
import { X } from 'lucide-react';
import type { LaidDocument } from '@/studio/engine/flow';
import { PagedCanvas, type ZoomMode } from './PagedCanvas';
import { Segmented } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/Button';
import { ZoomControl } from './ZoomControl';

/** Full-screen print preview: every page with realistic spacing, zoom and fit modes. */
export function PrintPreviewDialog({ laid, imageUrl, onClose, title, actions }: { laid: LaidDocument; imageUrl: (src: string) => string | undefined; onClose: () => void; title: string; actions?: React.ReactNode }) {
  const [zoom, setZoom] = useState<ZoomMode>('fit-page');
  const [spread, setSpread] = useState<'single' | 'grid'>('single');
  return (
    <div role="dialog" aria-modal="true" aria-label="Print preview" className="fixed inset-0 z-[950] flex flex-col bg-[#1b1b22]" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-white/10 bg-[#121218] px-3 text-white">
        <IconButton label="Close preview" onClick={onClose} className="text-white/70 hover:bg-white/10 hover:text-white">
          <X className="size-4" />
        </IconButton>
        <h2 className="truncate text-[13px] font-semibold">{title}</h2>
        <span className="font-mono text-[11px] text-white/50">
          {laid.pages.length} page{laid.pages.length === 1 ? '' : 's'} · {Math.round(laid.width)}×{Math.round(laid.height)} mm
        </span>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-[150px]">
            <Segmented value={spread} onChange={setSpread} size="xs" options={[{ value: 'single', label: 'Pages' }, { value: 'grid', label: 'Overview' }]} />
          </div>
          <ZoomControl zoom={zoom} onChange={setZoom} effective={typeof zoom === 'number' ? zoom : 0.8} />
          {actions}
        </div>
      </header>
      {spread === 'single' ? (
        <PagedCanvas laid={laid} zoom={zoom} imageUrl={imageUrl} mode="print" className="!bg-[#1b1b22]" gap={36} onZoomChange={setZoom} />
      ) : (
        <div className="flex-1 overflow-auto p-8">
          <div className="mx-auto grid max-w-6xl grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-8">
            {laid.pages.map((p) => (
              <PagedCanvas key={p.index} laid={{ ...laid, pages: [p] }} totalPages={laid.pages.length} zoom={0.36} imageUrl={imageUrl} mode="print" className="!h-auto !overflow-visible !bg-transparent [&>div]:!p-0" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
