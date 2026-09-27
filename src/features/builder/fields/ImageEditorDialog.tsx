import { useEffect, useRef, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Segmented, Select, Slider } from '@/components/ui/Field';
import { useAssets } from '@/stores/assets';
import { processImage, type CropRect } from '@/lib/image';
import { assetRef } from '@/lib/engine/assets';
import { formatBytes } from '@/utils/format';
import { toast } from '@/stores/ui';

type Aspect = 'free' | '1:1' | '4:3' | '16:9' | '4:5' | '3:2';
const ASPECTS: Record<Exclude<Aspect, 'free'>, number> = { '1:1': 1, '4:3': 4 / 3, '16:9': 16 / 9, '4:5': 4 / 5, '3:2': 3 / 2 };

function fitAspect(ratio: number, imgRatio: number): CropRect {
  // ratio = w/h in pixels; convert to fractions of the image.
  let w = 1;
  let h = imgRatio / ratio;
  if (h > 1) {
    h = 1;
    w = ratio / imgRatio;
  }
  return { x: (1 - w) / 2, y: (1 - h) / 2, width: w, height: h };
}

export function ImageEditorDialog({ assetId, onClose, onApply }: { assetId: string; onClose: () => void; onApply: (ref: string) => void }) {
  const url = useAssets((s) => s.urls[assetId]);
  const blob = useAssets((s) => s.blobs[assetId]);
  const meta = useAssets((s) => s.meta[assetId]);
  const [aspect, setAspect] = useState<Aspect>('free');
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, width: 1, height: 1 });
  const [maxWidth, setMaxWidth] = useState<number>(Math.min(meta?.width ?? 1600, 1600));
  const [format, setFormat] = useState<'image/webp' | 'image/jpeg' | 'image/png' | 'original'>('image/webp');
  const [quality, setQuality] = useState(0.82);
  const [busy, setBusy] = useState(false);
  const [estimate, setEstimate] = useState<{ size: number; width: number; height: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; start: CropRect } | null>(null);
  const imgRatio = meta && meta.height ? meta.width / meta.height : 1;

  useEffect(() => {
    if (aspect === 'free') return;
    setCrop(fitAspect(ASPECTS[aspect], imgRatio));
  }, [aspect, imgRatio]);

  // Real output-size estimate (debounced re-encode).
  useEffect(() => {
    if (!blob) return;
    const t = window.setTimeout(async () => {
      try {
        const out = await processImage(blob, { crop, maxWidth, format, quality });
        setEstimate({ size: out.blob.size, width: out.width, height: out.height });
      } catch {
        setEstimate(null);
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [blob, crop, maxWidth, format, quality]);

  const onPointerDown = (mode: 'move' | 'resize') => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { mode, startX: e.clientX, startY: e.clientY, start: crop };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const box = boxRef.current?.getBoundingClientRect();
    if (!d || !box) return;
    const dx = (e.clientX - d.startX) / box.width;
    const dy = (e.clientY - d.startY) / box.height;
    if (d.mode === 'move') {
      setCrop({ ...d.start, x: Math.min(1 - d.start.width, Math.max(0, d.start.x + dx)), y: Math.min(1 - d.start.height, Math.max(0, d.start.y + dy)) });
    } else {
      let w = Math.min(1 - d.start.x, Math.max(0.05, d.start.width + dx));
      let h = Math.min(1 - d.start.y, Math.max(0.05, d.start.height + dy));
      if (aspect !== 'free') {
        const r = ASPECTS[aspect] / imgRatio; // w/h in fraction space
        h = w / r;
        if (d.start.y + h > 1) {
          h = 1 - d.start.y;
          w = h * r;
        }
      }
      setCrop({ ...d.start, width: w, height: h });
    }
  };
  const nudge = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    const map: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const m = map[e.key];
    if (!m) return;
    e.preventDefault();
    setCrop((c) => ({ ...c, x: Math.min(1 - c.width, Math.max(0, c.x + m[0])), y: Math.min(1 - c.height, Math.max(0, c.y + m[1])) }));
  };

  const apply = async () => {
    if (!blob || !meta) return;
    setBusy(true);
    try {
      const out = await processImage(blob, { crop, maxWidth, format, quality });
      const rec = await useAssets.getState().add(out.blob, { name: meta.name, width: out.width, height: out.height });
      toast({ tone: 'success', title: 'Image updated', description: `${formatBytes(meta.size)} → ${formatBytes(out.blob.size)} · ${out.width}×${out.height}` });
      onApply(assetRef(rec.id));
    } catch (err) {
      toast({ tone: 'error', title: 'Could not process image', description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const widths = [640, 960, 1280, 1600, 1920, 2400].filter((w) => !meta || w <= meta.width);
  if (meta && !widths.includes(meta.width)) widths.push(meta.width);

  return (
    <Dialog
      open
      onClose={onClose}
      title="Edit image"
      description="Crop, resize and compress locally. The original is kept until you remove it."
      size="lg"
      footer={
        <>
          <span className="mr-auto font-mono text-[11px] text-fg-subtle">
            {meta && `Original ${meta.width}×${meta.height} · ${formatBytes(meta.size)}`}
            {estimate && `  →  ${estimate.width}×${estimate.height} · ${formatBytes(estimate.size)}`}
          </span>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={() => void apply()}>Apply</Button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[1fr_220px]">
        <div className="grid place-items-center rounded-xl bg-[repeating-conic-gradient(#8881_0_25%,transparent_0_50%)] bg-[length:16px_16px] p-3">
          {url && (
            <div ref={boxRef} className="relative inline-block max-h-[52vh] touch-none select-none" onPointerMove={onPointerMove} onPointerUp={() => (drag.current = null)}>
              <img src={url} alt="" className="block max-h-[52vh] max-w-full" draggable={false} />
              <div
                role="slider"
                tabIndex={0}
                aria-label="Crop area — use arrow keys to move"
                aria-valuetext={`${Math.round(crop.width * 100)}% × ${Math.round(crop.height * 100)}%`}
                onKeyDown={nudge}
                onPointerDown={onPointerDown('move')}
                className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,.55)] outline-none focus-visible:border-accent"
                style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` }}
              >
                <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                  {Array.from({ length: 9 }).map((_, i) => <span key={i} className="border border-white/25" />)}
                </div>
                <span onPointerDown={onPointerDown('resize')} className="absolute -bottom-1.5 -right-1.5 size-3.5 cursor-nwse-resize rounded-sm border-2 border-white bg-accent" aria-hidden="true" />
              </div>
            </div>
          )}
        </div>
        <div className="space-y-4">
          <Segmented<Aspect> label="Aspect" size="xs" value={aspect} onChange={setAspect} options={(['free', '1:1', '4:5', '4:3', '3:2', '16:9'] as Aspect[]).map((a) => ({ value: a, label: a === 'free' ? 'Free' : a }))} />
          <button type="button" className="text-[12px] text-accent hover:underline" onClick={() => { setAspect('free'); setCrop({ x: 0, y: 0, width: 1, height: 1 }); }}>Reset crop</button>
          <Select label="Max width" value={String(maxWidth)} onChange={(e) => setMaxWidth(Number(e.target.value))} options={widths.sort((a, b) => a - b).map((w) => ({ value: String(w), label: `${w}px${meta && w === meta.width ? ' (original)' : ''}` }))} />
          <Select label="Format" value={format} onChange={(e) => setFormat(e.target.value as typeof format)} options={[{ value: 'image/webp', label: 'WebP (smallest)' }, { value: 'image/jpeg', label: 'JPEG' }, { value: 'image/png', label: 'PNG (lossless)' }, { value: 'original', label: 'Keep original format' }]} />
          {format !== 'image/png' && <Slider label="Quality" value={quality} min={0.4} max={1} step={0.02} onChange={setQuality} format={(v) => `${Math.round(v * 100)}%`} />}
        </div>
      </div>
    </Dialog>
  );
}
