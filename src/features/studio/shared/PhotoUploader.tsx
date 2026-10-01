import { useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { ImagePlus, Loader2, Pencil, RefreshCw, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { ACCEPT_ATTR, deleteProfilePhoto, uploadProfilePhoto } from '@/studio/images/profile-image';
import { useImageUrls } from '@/studio/images/service';
import { photoKey } from '@/studio/model/resolve';
import { useWorkspace } from '@/studio/store/workspace';
import { toast } from '@/stores/ui';
import { cn } from '@/utils/cn';

/**
 * Upload, replace or remove the shared profile photo without leaving the editor.
 * The photo is the same one Profile Studio manages, so every resume, document and
 * linked portfolio picks it up.
 */
export function PhotoUploader({ variantId, onUploaded }: { variantId?: string | null; onUploaded?: () => void }) {
  const img = useWorkspace((s) => s.profile.profileImage);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const variant = img ? (img.variants.find((v) => v.id === (variantId ?? img.usage.resume)) ?? img.variants[0]) : undefined;
  const key = variant ? photoKey(variant.id, 'circle') : '';
  const url = useImageUrls(key ? [key] : [])(key);

  const run = async (file: File | undefined | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const { note } = await uploadProfilePhoto(file);
      onUploaded?.();
      toast({ tone: 'success', title: img ? 'Photo replaced' : 'Photo added', description: note ?? 'Stored on this device and shared with your other resumes and documents.' });
    } catch (err) {
      toast({ tone: 'error', title: 'Could not use this image', description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void run(e.dataTransfer.files[0]);
  };
  const dragProps = {
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes('Files')) return;
      e.preventDefault();
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop,
  };
  const picker = <input ref={input} type="file" accept={ACCEPT_ATTR} className="sr-only" aria-label={img ? 'Replace profile photo' : 'Upload profile photo'} onChange={(e) => (void run(e.target.files?.[0]), (e.target.value = ''))} />;

  if (!img) {
    return (
      <div {...dragProps} className={cn('flex items-center gap-3 rounded-lg border border-dashed p-3 transition-colors', over ? 'border-accent bg-accent-soft' : 'border-line-strong bg-canvas')}>
        <span className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-elevated text-fg-muted">{busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-medium">Add a profile photo</p>
          <p className="text-[11px] text-fg-subtle">Drop an image or browse. JPG, PNG, WebP or GIF up to 25 MB.</p>
        </div>
        <Button size="sm" variant="primary" icon={<Upload className="size-3.5" />} loading={busy} onClick={() => input.current?.click()}>
          Upload
        </Button>
        {picker}
      </div>
    );
  }

  return (
    <div {...dragProps} className={cn('flex items-center gap-3 rounded-lg border p-2.5 transition-colors', over ? 'border-accent bg-accent-soft' : 'border-line bg-canvas')}>
      <span className="relative size-12 shrink-0 overflow-hidden rounded-full border border-line bg-elevated">
        {url ? <img src={url} alt="Profile photo" className="size-full object-cover" /> : <Loader2 className="absolute inset-0 m-auto size-4 animate-spin text-fg-subtle" />}
        {busy && <Loader2 className="absolute inset-0 m-auto size-4 animate-spin text-white drop-shadow" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-medium" title={img.asset.name}>
          {img.asset.name}
        </p>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px]">
          <button type="button" className="inline-flex items-center gap-1 text-accent hover:underline" onClick={() => input.current?.click()} disabled={busy}>
            <RefreshCw className="size-3" /> Replace
          </button>
          <Link to="/profile" className="inline-flex items-center gap-1 text-fg-muted hover:text-fg">
            <Pencil className="size-3" /> Crop &amp; edit
          </Link>
          <button type="button" className="inline-flex items-center gap-1 text-fg-muted hover:text-danger" onClick={() => setConfirm(true)} disabled={busy}>
            <Trash2 className="size-3" /> Remove
          </button>
        </div>
      </div>
      {picker}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          await deleteProfilePhoto();
          toast({ title: 'Photo removed', description: 'Removed from your profile, resumes and documents.' });
        }}
        title="Remove your profile photo?"
        description="The photo is shared, so it disappears from every resume, document and linked portfolio. You can upload a new one any time."
        confirmLabel="Remove photo"
      />
    </div>
  );
}
