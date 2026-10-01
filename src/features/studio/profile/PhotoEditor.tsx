import { useCallback, useEffect, useRef, useState } from 'react';
import { FlipHorizontal2, FlipVertical2, RotateCcw, ScanFace, Wand2 } from 'lucide-react';
import type { AspectKey, BackgroundKind, ImageEdit, ImageFilter, ProfileImage, ProfileShape } from '@/studio/model/types';
import { defaultImageEdit } from '@/studio/model/defaults';
import { aspectOf, smartFit, type Placement, type RenderTarget } from '@/studio/images/pipeline';
import { IMAGE_PRESETS, presetEdit } from '@/studio/images/presets';
import { Segmented, Slider } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/misc';
import { ColorField } from '@/features/builder/fields/ColorField';
import { cn } from '@/utils/cn';
import { EditCanvas, StaticVariant, type Decoded } from './EditCanvas';

type Tab = 'crop' | 'adjust' | 'style';

const ASPECT_OPTIONS: Array<{ value: AspectKey; label: string }> = [
  { value: '1:1', label: '1:1' },
  { value: '4:5', label: '4:5' },
  { value: '3:4', label: '3:4' },
  { value: '16:9', label: '16:9' },
  { value: 'custom', label: 'Custom' },
];

const SHAPES: Array<{ value: ProfileShape; label: string; path: string }> = [
  { value: 'circle', label: 'Circle', path: 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20Z' },
  { value: 'rounded', label: 'Rounded square', path: 'M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Z' },
  { value: 'square', label: 'Square', path: 'M2 2h20v20H2Z' },
  { value: 'portrait', label: 'Portrait', path: 'M5 1h14v22H5Z' },
  { value: 'hexagon', label: 'Hexagon', path: 'M12 1l9.5 5.5v11L12 23l-9.5-5.5v-11Z' },
  { value: 'diamond', label: 'Diamond', path: 'M12 1l11 11-11 11L1 12Z' },
  { value: 'custom', label: 'Custom radius', path: 'M4 2h16a2 2 0 0 1 2 2v12a6 6 0 0 1-6 6H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z' },
];

const BACKGROUNDS: Array<{ value: BackgroundKind; label: string }> = [
  { value: 'original', label: 'Original' },
  { value: 'transparent', label: 'Transparent' },
  { value: 'white', label: 'White' },
  { value: 'black', label: 'Black' },
  { value: 'color', label: 'Custom' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'blurred', label: 'Blurred' },
];

const ADJUSTMENTS: Array<{ key: keyof ImageEdit['adjustments']; label: string; min: number }> = [
  { key: 'brightness', label: 'Brightness', min: -100 },
  { key: 'contrast', label: 'Contrast', min: -100 },
  { key: 'saturation', label: 'Saturation', min: -100 },
  { key: 'exposure', label: 'Exposure', min: -100 },
  { key: 'blur', label: 'Blur', min: 0 },
  { key: 'sharpness', label: 'Sharpness', min: 0 },
];

export function editTarget(edit: ImageEdit): RenderTarget {
  return { aspect: aspectOf(edit), shape: edit.shape === 'portrait' ? 'square' : edit.shape, px: 1024 };
}

export interface PhotoEditorProps {
  img: ProfileImage;
  variantId: string;
  source: Decoded;
  onChange: (edit: ImageEdit) => void;
}

/** Full editor for one variant. Local draft for smoothness; commits are debounced. */
export function PhotoEditor({ img, variantId, source, onChange }: PhotoEditorProps) {
  const variant = img.variants.find((v) => v.id === variantId) ?? img.variants[0]!;
  const [draft, setDraft] = useState<ImageEdit>(variant.edit);
  const [tab, setTab] = useState<Tab>('crop');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<ImageEdit | null>(null);

  // Reset the draft when switching variants (or when an outside change lands).
  useEffect(() => {
    setDraft(variant.edit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant.id]);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (pending.current) onChange(pending.current);
    pending.current = null;
  }, [onChange]);

  useEffect(() => () => flush(), [flush]);

  const update = (patch: Partial<ImageEdit> | ((e: ImageEdit) => ImageEdit), immediate = false) => {
    setDraft((cur) => {
      const next = typeof patch === 'function' ? patch(cur) : { ...cur, ...patch };
      pending.current = next;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, immediate ? 0 : 450);
      return next;
    });
  };

  const target = editTarget(draft);
  const placement: Placement = { zoom: draft.zoom, panX: draft.panX, panY: draft.panY };
  const fit = () => update((e) => ({ ...e, ...smartFit(img.asset, aspectOf(e), editTarget(e).shape), rotation: e.rotation }), true);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <div className="rounded-xl border border-line bg-canvas p-4 sm:p-6">
          <EditCanvas source={source} edit={draft} target={target} placement={placement} onPlacement={(p) => update(p)} onCommit={flush} label={`${variant.name} crop preview`} maxDisplay={target.aspect >= 1 ? 460 : 380} />
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11.5px] text-fg-subtle">
            <span>Drag to reposition · Scroll to zoom</span>
            <span aria-hidden="true">·</span>
            <button type="button" onClick={fit} className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
              <ScanFace className="size-3.5" /> Smart fit{img.asset.face ? ' (face)' : ''}
            </button>
          </div>
        </div>
        <div className="mt-3">
          <SectionLabel>Presets</SectionLabel>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {IMAGE_PRESETS.map((p) => {
              const e = presetEdit(p.id, draft);
              return (
                <button key={p.id} type="button" onClick={() => update(e, true)} title={p.description} className="flex shrink-0 flex-col items-center gap-1.5 rounded-lg border border-line bg-panel p-2 hover:border-line-strong">
                  <StaticVariant source={source} edit={e} target={editTarget(e)} placement={{ zoom: e.zoom, panX: e.panX, panY: e.panY }} size={56} />
                  <span className="text-[11px] text-fg-muted">{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="min-w-0 space-y-4">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'crop', label: 'Crop' }, { value: 'adjust', label: 'Adjust' }, { value: 'style', label: 'Style' }]} />
        {tab === 'crop' && (
          <div className="space-y-4">
            <Segmented
              label="Aspect ratio"
              size="xs"
              value={draft.aspect}
              onChange={(v) => update((e) => ({ ...e, aspect: v, shape: v !== '3:4' && v !== '4:5' && e.shape === 'portrait' ? 'square' : e.shape, ...smartFit(img.asset, aspectOf({ aspect: v, customRatio: e.customRatio }), e.shape) }), true)}
              options={ASPECT_OPTIONS}
            />
            {draft.aspect === 'custom' && (
              <CustomRatio ratio={draft.customRatio} onChange={(r) => update({ customRatio: r }, true)} />
            )}
            <Slider label="Zoom" value={Math.round(draft.zoom * 100)} min={30} max={600} step={1} format={(v) => `${v}%`} onChange={(v) => update({ zoom: v / 100 })} />
            <div>
              <p className="mb-1.5 text-[12px] font-medium text-fg-muted">Rotate</p>
              <div className="grid grid-cols-5 gap-1">
                {[-90, -45, 0, 45, 90].map((deg) => (
                  <button key={deg} type="button" onClick={() => update({ rotation: deg }, true)} aria-pressed={Math.round(draft.rotation) === deg} className={cn('h-7 rounded-md border text-[11.5px] font-medium', Math.round(draft.rotation) === deg ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-bg text-fg-muted hover:border-line-strong')}>
                    {deg}°
                  </button>
                ))}
              </div>
              <div className="mt-2.5">
                <Slider label="Fine rotation" value={Math.round(draft.rotation)} min={-180} max={180} unit="°" onChange={(v) => update({ rotation: v })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" icon={<FlipHorizontal2 className="size-3.5" />} aria-pressed={draft.flipH} className={cn(draft.flipH && '!border-accent !text-accent')} onClick={() => update({ flipH: !draft.flipH }, true)}>
                Flip horizontal
              </Button>
              <Button size="sm" icon={<FlipVertical2 className="size-3.5" />} aria-pressed={draft.flipV} className={cn(draft.flipV && '!border-accent !text-accent')} onClick={() => update({ flipV: !draft.flipV }, true)}>
                Flip vertical
              </Button>
            </div>
            <div className="flex gap-2">
              <Button size="sm" icon={<Wand2 className="size-3.5" />} onClick={fit}>
                Smart fit
              </Button>
              <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => update((e) => ({ ...e, zoom: 1, panX: 0, panY: 0, rotation: 0, flipH: false, flipV: false }), true)}>
                Reset crop
              </Button>
            </div>
          </div>
        )}
        {tab === 'adjust' && (
          <div className="space-y-3.5">
            {ADJUSTMENTS.map((a) => (
              <Slider key={a.key} label={a.label} value={draft.adjustments[a.key]} min={a.min} max={100} format={(v) => (a.min < 0 && v > 0 ? `+${v}` : `${v}`)} onChange={(v) => update((e) => ({ ...e, adjustments: { ...e.adjustments, [a.key]: v } }))} />
            ))}
            <Segmented<ImageFilter>
              label="Filter"
              size="xs"
              value={draft.filter}
              onChange={(v) => update({ filter: v }, true)}
              options={[{ value: 'none', label: 'None' }, { value: 'mono', label: 'Mono' }, { value: 'sepia', label: 'Sepia' }, { value: 'duotone', label: 'Duotone' }]}
            />
            {draft.filter === 'duotone' && (
              <div className="grid grid-cols-2 gap-2">
                <ColorField label="Shadows" value={draft.duotone[0]} onChange={(v) => update((e) => ({ ...e, duotone: [v, e.duotone[1]] }))} />
                <ColorField label="Highlights" value={draft.duotone[1]} onChange={(v) => update((e) => ({ ...e, duotone: [e.duotone[0], v] }))} />
              </div>
            )}
            <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => update((e) => ({ ...e, adjustments: defaultImageEdit().adjustments, filter: 'none' }), true)}>
              Reset adjustments
            </Button>
          </div>
        )}
        {tab === 'style' && (
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-[12px] font-medium text-fg-muted">Shape</p>
              <div role="radiogroup" aria-label="Shape" className="grid grid-cols-4 gap-1.5">
                {SHAPES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    role="radio"
                    aria-checked={draft.shape === s.value}
                    title={s.label}
                    onClick={() => update((e) => ({ ...e, shape: s.value, ...(s.value === 'portrait' ? { aspect: '3:4' as const, ...smartFit(img.asset, 3 / 4, 'square') } : {}) }), true)}
                    className={cn('flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[10.5px]', draft.shape === s.value ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-bg text-fg-muted hover:border-line-strong')}
                  >
                    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
                      <path d={s.path} fill="currentColor" fillOpacity=".25" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                    <span className="truncate">{s.label.replace(' square', '').replace('Custom radius', 'Custom')}</span>
                  </button>
                ))}
              </div>
            </div>
            {(draft.shape === 'rounded' || draft.shape === 'custom') && <Slider label="Corner radius" value={Math.round(draft.radius * 100)} min={0} max={50} unit="%" onChange={(v) => update({ radius: v / 100 })} />}
            <div>
              <p className="mb-1.5 text-[12px] font-medium text-fg-muted">Background</p>
              <div className="grid grid-cols-4 gap-1.5">
                {BACKGROUNDS.map((b) => (
                  <button key={b.value} type="button" aria-pressed={draft.background.kind === b.value} onClick={() => update((e) => ({ ...e, background: { ...e.background, kind: b.value } }), true)} className={cn('h-8 rounded-md border text-[11px] font-medium', draft.background.kind === b.value ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-bg text-fg-muted hover:border-line-strong')}>
                    {b.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-fg-subtle">Fills space the photo doesn’t cover (zoom out or rotate) and transparent pixels.</p>
            </div>
            {draft.background.kind === 'color' && <ColorField label="Background colour" value={draft.background.color} onChange={(v) => update((e) => ({ ...e, background: { ...e.background, color: v } }))} />}
            {draft.background.kind === 'gradient' && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <ColorField label="From" value={draft.background.gradient[0]} onChange={(v) => update((e) => ({ ...e, background: { ...e.background, gradient: [v, e.background.gradient[1]] } }))} />
                  <ColorField label="To" value={draft.background.gradient[1]} onChange={(v) => update((e) => ({ ...e, background: { ...e.background, gradient: [e.background.gradient[0], v] } }))} />
                </div>
                <Slider label="Angle" value={draft.background.angle} min={0} max={360} unit="°" onChange={(v) => update((e) => ({ ...e, background: { ...e.background, angle: v } }))} />
              </div>
            )}
            <Slider label="Ring" value={draft.ring} min={0} max={60} format={(v) => (v ? `${v}` : 'Off')} onChange={(v) => update({ ring: v })} />
            {draft.ring > 0 && <ColorField label="Ring colour" value={draft.ringColor} onChange={(v) => update({ ringColor: v })} />}
          </div>
        )}
      </div>
    </div>
  );
}

function CustomRatio({ ratio, onChange }: { ratio: number; onChange: (r: number) => void }) {
  const [w, setW] = useState(() => String(Math.round(ratio * 100) / 100));
  const [h, setH] = useState('1');
  const apply = (ws: string, hs: string) => {
    const a = Number(ws);
    const b = Number(hs);
    if (a > 0 && b > 0) onChange(Math.min(4, Math.max(0.25, a / b)));
  };
  return (
    <div className="flex items-end gap-2">
      <label className="flex-1">
        <span className="app-label">Width</span>
        <input className="app-input" inputMode="decimal" value={w} onChange={(e) => (setW(e.target.value), apply(e.target.value, h))} />
      </label>
      <span className="pb-2 text-fg-subtle">:</span>
      <label className="flex-1">
        <span className="app-label">Height</span>
        <input className="app-input" inputMode="decimal" value={h} onChange={(e) => (setH(e.target.value), apply(w, e.target.value))} />
      </label>
    </div>
  );
}
