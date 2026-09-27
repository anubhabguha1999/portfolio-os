import { useRef, useState } from 'react';
import { AlertTriangle, Crop, ImagePlus, Link2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { ImageRef } from '@/types/portfolio';
import { useAssets } from '@/stores/assets';
import { toast } from '@/stores/ui';
import { assetIdOf, assetRef, isAssetRef } from '@/lib/engine/assets';
import { ACCEPTED_IMAGE_TYPES, autoOptimize, imageWarnings } from '@/lib/image';
import { safeMediaSrc } from '@/utils/url';
import { formatBytes } from '@/utils/format';
import { FieldShell } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import { ImageEditorDialog } from './ImageEditorDialog';

export function useResolvedSrc(src: string): string {
  const urls = useAssets((s) => s.urls);
  if (!src) return '';
  if (isAssetRef(src)) return urls[assetIdOf(src)] ?? '';
  return safeMediaSrc(src);
}

export async function uploadImageFile(file: File): Promise<string> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) throw new Error(`Unsupported file type (${file.type || 'unknown'}). Use JPG, PNG, WebP, GIF, AVIF or SVG.`);
  if (file.size > 40 * 1024 * 1024) throw new Error('Images larger than 40 MB are not supported.');
  const optimized = await autoOptimize(file);
  const rec = await useAssets.getState().add(optimized.blob, { name: file.name, width: optimized.width, height: optimized.height });
  if (optimized.blob !== file) {
    toast({ tone: 'info', title: 'Image optimised', description: `${formatBytes(file.size)} → ${formatBytes(optimized.blob.size)} (${optimized.width}×${optimized.height}). Stored locally.` });
  }
  const warn = imageWarnings({ size: rec.size, width: rec.width, height: rec.height });
  if (warn.length) toast({ tone: 'warning', title: 'Large image', description: warn.join(' ') });
  return assetRef(rec.id);
}

function useImageDrop(onFile: (f: File) => void) {
  const [over, setOver] = useState(false);
  return {
    over,
    props: {
      onDragOver: (e: React.DragEvent) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setOver(true);
        }
      },
      onDragLeave: () => setOver(false),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      },
    },
  };
}

export function ImageField({ label, help, value, onChange, disabled }: { label: string; help?: string; value: ImageRef; onChange: (v: ImageRef) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [urlMode, setUrlMode] = useState(false);
  const src = useResolvedSrc(value.src);
  const meta = useAssets((s) => (isAssetRef(value.src) ? s.meta[assetIdOf(value.src)] : undefined));
  const missing = isAssetRef(value.src) && !src;

  const handle = async (file: File) => {
    setBusy(true);
    try {
      const ref = await uploadImageFile(file);
      onChange({ src: ref, alt: value.alt || file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ') });
    } catch (err) {
      toast({ tone: 'error', title: 'Upload failed', description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };
  const drop = useImageDrop((f) => !disabled && void handle(f));
  const warnings = meta ? imageWarnings(meta) : [];

  return (
    <FieldShell label={label} help={help}>
      <input ref={input} type="file" accept={ACCEPTED_IMAGE_TYPES.join(',')} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void handle(f); }} />
      {value.src ? (
        <div className="overflow-hidden rounded-xl border border-line bg-bg/60" {...drop.props}>
          <div className={cn('relative grid aspect-[16/9] place-items-center overflow-hidden bg-[repeating-conic-gradient(#8881_0_25%,transparent_0_50%)] bg-[length:14px_14px]', drop.over && 'ring-2 ring-accent ring-inset')}>
            {src ? <img src={src} alt="" className="max-h-full max-w-full object-contain" /> : <span className="flex items-center gap-1.5 text-[12px] text-danger"><AlertTriangle className="size-3.5" /> {missing ? 'Image missing from local storage' : 'Invalid image URL'}</span>}
            {busy && <div className="absolute inset-0 grid place-items-center bg-bg/70 text-[12px]">Processing…</div>}
          </div>
          <div className="flex items-center gap-1 border-t border-line px-2 py-1.5">
            <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-fg-subtle">{meta ? `${meta.width}×${meta.height} · ${formatBytes(meta.size)}` : isAssetRef(value.src) ? '' : 'External URL'}</span>
            {isAssetRef(value.src) && src && (
              <IconButton size="xs" label="Crop, resize & compress" disabled={disabled} onClick={() => setEditing(true)}>
                <Crop className="size-3.5" />
              </IconButton>
            )}
            <IconButton size="xs" label="Replace image" disabled={disabled || busy} onClick={() => input.current?.click()}>
              <RefreshCw className="size-3.5" />
            </IconButton>
            <IconButton size="xs" label="Remove image" disabled={disabled} onClick={() => onChange({ src: '', alt: '' })} className="hover:!text-danger">
              <Trash2 className="size-3.5" />
            </IconButton>
          </div>
          {warnings.length > 0 && (
            <p className="flex gap-1.5 border-t border-line bg-warn/5 px-2.5 py-1.5 text-[11px] text-warn">
              <AlertTriangle className="mt-px size-3 shrink-0" /> {warnings[0]}
            </p>
          )}
        </div>
      ) : urlMode ? (
        <div className="flex gap-1.5">
          <input
            autoFocus
            placeholder="https://… image URL"
            className="app-input"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setUrlMode(false);
              if (e.key === 'Enter') {
                const v = e.currentTarget.value.trim();
                if (!safeMediaSrc(v)) return toast({ tone: 'error', title: 'Only https:// image URLs are allowed' });
                onChange({ src: v, alt: value.alt });
                setUrlMode(false);
              }
            }}
          />
          <IconButton label="Cancel" onClick={() => setUrlMode(false)}>
            ✕
          </IconButton>
        </div>
      ) : (
        <div
          {...drop.props}
          className={cn('flex items-center gap-2 rounded-xl border border-dashed border-line-strong p-2 transition-colors', drop.over && 'border-accent bg-accent-soft')}
        >
          <button type="button" disabled={disabled || busy} onClick={() => input.current?.click()} className="flex flex-1 items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-hover disabled:opacity-50">
            <span className="grid size-8 place-items-center rounded-lg bg-accent-soft text-accent">
              <ImagePlus className="size-4" />
            </span>
            <span>
              <span className="block text-[12.5px] font-medium">{busy ? 'Processing…' : 'Upload image'}</span>
              <span className="block text-[11px] text-fg-subtle">or drop a file · stays on this device</span>
            </span>
          </button>
          <IconButton label="Use image URL" onClick={() => setUrlMode(true)} disabled={disabled}>
            <Link2 className="size-4" />
          </IconButton>
        </div>
      )}
      {value.src && (
        <div className="mt-2">
          <input
            aria-label={`${label} alt text`}
            value={value.alt}
            disabled={disabled}
            placeholder="Alt text — describe the image for screen readers"
            onChange={(e) => onChange({ ...value, alt: e.target.value })}
            aria-invalid={!value.alt.trim() || undefined}
            className="app-input"
          />
          {!value.alt.trim() && <p className="mt-1 text-[11px] text-warn">Missing alt text — required for accessibility.</p>}
        </div>
      )}
      {editing && isAssetRef(value.src) && (
        <ImageEditorDialog
          assetId={assetIdOf(value.src)}
          onClose={() => setEditing(false)}
          onApply={(newRef) => {
            onChange({ ...value, src: newRef });
            setEditing(false);
          }}
        />
      )}
    </FieldShell>
  );
}

export function ImageListField({ label, value, onChange, disabled }: { label: string; value: ImageRef[]; onChange: (v: ImageRef[]) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const add = async (files: FileList | File[]) => {
    setBusy(true);
    const out: ImageRef[] = [];
    for (const f of Array.from(files)) {
      try {
        out.push({ src: await uploadImageFile(f), alt: f.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ') });
      } catch (err) {
        toast({ tone: 'error', title: `Could not add ${f.name}`, description: err instanceof Error ? err.message : String(err) });
      }
    }
    onChange([...value, ...out]);
    setBusy(false);
  };
  return (
    <FieldShell label={`${label} · ${value.length}`}>
      <input ref={input} type="file" multiple accept={ACCEPTED_IMAGE_TYPES.join(',')} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { const f = e.target.files; if (f) void add(f); e.target.value = ''; }} />
      <div className="grid grid-cols-3 gap-1.5">
        {value.map((img, i) => (
          <Thumb key={`${img.src}-${i}`} img={img} disabled={disabled} onAlt={(alt) => onChange(value.map((v, j) => (j === i ? { ...v, alt } : v)))} onRemove={() => onChange(value.filter((_, j) => j !== i))} />
        ))}
        <button type="button" disabled={disabled || busy} onClick={() => input.current?.click()} className="grid aspect-square place-items-center rounded-lg border border-dashed border-line-strong text-fg-subtle hover:border-accent hover:text-accent" aria-label={`Add images to ${label}`}>
          {busy ? <span className="text-[11px]">…</span> : <Plus className="size-4" />}
        </button>
      </div>
    </FieldShell>
  );
}

function Thumb({ img, onRemove, onAlt, disabled }: { img: ImageRef; onRemove: () => void; onAlt: (alt: string) => void; disabled?: boolean }) {
  const src = useResolvedSrc(img.src);
  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-bg">
      {src && <img src={src} alt="" className="size-full object-cover" />}
      <button type="button" disabled={disabled} onClick={onRemove} aria-label="Remove image" className="absolute right-1 top-1 grid size-5 place-items-center rounded bg-black/60 text-white opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
        <Trash2 className="size-3" />
      </button>
      <input
        value={img.alt}
        disabled={disabled}
        onChange={(e) => onAlt(e.target.value)}
        placeholder="Alt text"
        aria-label="Alt text"
        className={cn('absolute inset-x-0 bottom-0 bg-black/65 px-1.5 py-1 text-[10.5px] text-white outline-none placeholder:text-white/60', !img.alt && 'bg-warn/80')}
      />
    </div>
  );
}
