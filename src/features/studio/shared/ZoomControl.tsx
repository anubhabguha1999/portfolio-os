import { Minus, Plus } from 'lucide-react';
import { IconButton } from '@/components/ui/Button';
import { Menu } from '@/components/ui/Menu';
import { ZOOM_STEPS, type ZoomMode } from './PagedCanvas';

export function zoomLabel(z: ZoomMode): string {
  return z === 'fit-width' ? 'Fit width' : z === 'fit-page' ? 'Fit page' : `${Math.round(z * 100)}%`;
}

export function ZoomControl({ zoom, onChange, effective }: { zoom: ZoomMode; onChange: (z: ZoomMode) => void; effective: number }) {
  const step = (dir: 1 | -1) => {
    const cur = effective;
    const next = dir > 0 ? ZOOM_STEPS.find((s) => s > cur + 0.01) ?? Math.min(3, cur * 1.2) : [...ZOOM_STEPS].reverse().find((s) => s < cur - 0.01) ?? Math.max(0.3, cur / 1.2);
    onChange(next);
  };
  return (
    <div className="flex items-center rounded-lg border border-line bg-bg">
      <IconButton label="Zoom out" size="xs" onClick={() => step(-1)}>
        <Minus className="size-3.5" />
      </IconButton>
      <Menu
        label="Zoom"
        align="end"
        trigger={(p) => (
          <button {...p} type="button" className="h-7 min-w-[64px] px-1.5 font-mono text-[11.5px] tabular-nums text-fg-muted hover:text-fg">
            {typeof zoom === 'number' ? `${Math.round(zoom * 100)}%` : zoomLabel(zoom)}
          </button>
        )}
        items={[
          ...ZOOM_STEPS.map((z) => ({ label: `${Math.round(z * 100)}%`, onSelect: () => onChange(z) })),
          'separator' as const,
          { label: 'Fit width', onSelect: () => onChange('fit-width') },
          { label: 'Fit page', onSelect: () => onChange('fit-page') },
          { label: 'Actual size', onSelect: () => onChange(1) },
        ]}
      />
      <IconButton label="Zoom in" size="xs" onClick={() => step(1)}>
        <Plus className="size-3.5" />
      </IconButton>
    </div>
  );
}
