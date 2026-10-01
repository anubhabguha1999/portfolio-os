import { useState } from 'react';
import { Crop, RotateCcw } from 'lucide-react';
import type { ProfileImage } from '@/studio/model/types';
import { placementFor, targetFor, useImageUrls } from '@/studio/images/service';
import { aspectOf, smartFit, type Placement } from '@/studio/images/pipeline';
import { mutateProfileImage, placementKey, setPlacement, updateVariantEdit, usageVariant, type System } from '@/studio/images/profile-image';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Slider } from '@/components/ui/Field';
import { Badge } from '@/components/ui/misc';
import { CHECKER, EditCanvas, type Decoded } from './EditCanvas';

interface Slot {
  id: string;
  label: string;
  hint: string;
  system: System;
  mode: string;
}

const SLOTS: Slot[] = [
  { id: 'resume', label: 'Resume', hint: 'Portrait crop', system: 'resume', mode: 'large-portrait' },
  { id: 'hero', label: 'Portfolio hero', hint: 'Wide crop', system: 'portfolio', mode: 'hero' },
  { id: 'avatar', label: 'Circular avatar', hint: 'Centred face', system: 'portfolio', mode: 'circle' },
];

/** Smart-fit renders for each place the photo appears, each with a manual override. */
export function PlacementPreviews({ img, source }: { img: ProfileImage; source: Decoded | null }) {
  const keys = SLOTS.map((s) => `profile:${usageVariant(img, s.system).id}:${s.mode}`);
  const url = useImageUrls(keys);
  const [editing, setEditing] = useState<Slot | null>(null);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        {SLOTS.map((s, i) => {
          const variant = usageVariant(img, s.system);
          const target = targetFor(s.mode, variant);
          const manual = !!variant.placements[placementKey(target.aspect)];
          const src = url(keys[i]!);
          return (
            <figure key={s.id} className="rounded-xl border border-line bg-panel p-3">
              <div className="grid h-36 place-items-center rounded-lg bg-canvas p-2">
                <div className="relative h-full max-w-full overflow-hidden rounded" style={{ aspectRatio: `${target.aspect}`, background: CHECKER }}>
                  {src ? <img src={src} alt={`${s.label} preview`} className="size-full object-cover" /> : <div className="size-full animate-pulse bg-hover" />}
                </div>
              </div>
              <figcaption className="mt-2.5 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-semibold">{s.label}</p>
                  <p className="truncate text-[11px] text-fg-subtle">
                    {variant.name} · {s.hint}
                  </p>
                </div>
                <Badge tone={manual ? 'accent' : 'neutral'}>{manual ? 'Manual' : 'Smart fit'}</Badge>
              </figcaption>
              <Button size="xs" className="mt-2 w-full" icon={<Crop className="size-3.5" />} disabled={!source} onClick={() => setEditing(s)}>
                Adjust crop
              </Button>
            </figure>
          );
        })}
      </div>
      {editing && source && <PlacementDialog img={img} slot={editing} source={source} onClose={() => setEditing(null)} />}
    </>
  );
}

function PlacementDialog({ img, slot, source, onClose }: { img: ProfileImage; slot: Slot; source: Decoded; onClose: () => void }) {
  const variant = usageVariant(img, slot.system);
  const target = targetFor(slot.mode, variant);
  // When the placement has the variant's own aspect, its framing *is* the variant crop.
  const own = Math.abs(aspectOf(variant.edit) - target.aspect) < 0.01;
  const [p, setP] = useState<Placement>(() => placementFor(img, variant, target));

  const save = () => {
    mutateProfileImage((cur) => (own ? updateVariantEdit(cur, variant.id, { ...variant.edit, ...p }) : setPlacement(cur, variant.id, target.aspect, p)));
    onClose();
  };
  const reset = () => {
    const fit = smartFit(img.asset, target.aspect, target.shape);
    if (own) {
      setP(fit);
      return;
    }
    mutateProfileImage((cur) => setPlacement(cur, variant.id, target.aspect, null));
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Adjust ${slot.label.toLowerCase()} crop`}
      description={`Variant “${variant.name}”. This only changes how the photo is framed here.`}
      size="md"
      footer={
        <>
          <Button variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={reset}>
            Reset to smart fit
          </Button>
          <Button variant="primary" onClick={save}>
            Save crop
          </Button>
        </>
      }
    >
      <div className="rounded-xl bg-canvas p-5">
        <EditCanvas source={source} edit={variant.edit} target={target} placement={p} onPlacement={setP} label={`${slot.label} crop`} maxDisplay={target.aspect >= 1 ? 440 : 300} />
      </div>
      <div className="mt-4">
        <Slider label="Zoom" value={Math.round(p.zoom * 100)} min={30} max={600} format={(v) => `${v}%`} onChange={(v) => setP({ ...p, zoom: v / 100 })} />
      </div>
    </Dialog>
  );
}
