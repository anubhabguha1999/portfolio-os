import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Crosshair, ImagePlus, Info, Loader2, Pencil, Plus, RefreshCw, ScanFace, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { useWorkspace } from '@/studio/store/workspace';
import type { ProfileImage } from '@/studio/model/types';
import { deleteAllStudioData, studioUsage } from '@/studio/storage/repo';
import { clearImageCache } from '@/studio/images/service';
import { IMAGE_PRESETS } from '@/studio/images/presets';
import {
  ACCEPT_ATTR,
  addVariantFromPreset,
  deleteProfilePhoto,
  deleteVariant,
  duplicateVariant,
  faceDetectionSupported,
  mutateProfileImage,
  renameVariant,
  setFocal,
  setUsage,
  updateVariantEdit,
  uploadProfilePhoto,
  type System,
} from '@/studio/images/profile-image';
import { StudioTopBar } from '@/features/studio/shared/StudioTopBar';
import { Button, IconButton } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Menu } from '@/components/ui/Menu';
import { Badge, Card, SectionLabel } from '@/components/ui/misc';
import { toast } from '@/stores/ui';
import { formatBytes } from '@/utils/format';
import { cn } from '@/utils/cn';
import { BRAND } from '@/config/brand';
import { IdentityForm } from './IdentityForm';
import { PhotoEditor, editTarget } from './PhotoEditor';
import { PlacementPreviews } from './PlacementPreviews';
import { StaticVariant, useOriginal, type Decoded } from './EditCanvas';

export default function ProfileStudioPage() {
  const loaded = useWorkspace((s) => s.loaded);
  const saveState = useWorkspace((s) => s.saveState);
  const img = useWorkspace((s) => s.profile.profileImage);
  const name = useWorkspace((s) => s.profile.name);

  useEffect(() => {
    document.title = `Profile Studio — ${BRAND.name}`;
    void useWorkspace.getState().init();
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg text-fg">
      <StudioTopBar
        studio="Profile Studio"
        back={{ to: '/studio', label: 'Back to dashboard' }}
        title={<span className="truncate text-[13px] font-semibold">{name.trim() || 'Your profile'}</span>}
        save={saveState}
        actions={
          <span className="hidden items-center gap-1.5 rounded-full border border-ok/25 bg-ok/10 px-2.5 py-1 text-[11.5px] font-medium text-ok sm:inline-flex">
            <ShieldCheck className="size-3.5" /> Your images stay on this device
          </span>
        }
      />
      {!loaded ? (
        <div className="grid flex-1 place-items-center text-fg-subtle" role="status" aria-label="Loading">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-6 lg:self-start">
              <Card className="p-4 sm:p-5">
                <h1 className="text-[15px] font-semibold tracking-tight">Profile</h1>
                <p className="mb-5 mt-1 text-[12px] leading-relaxed text-fg-muted">Edit once — your portfolio, resumes, cover letters and documents all update.</p>
                <IdentityForm />
              </Card>
            </aside>
            <main className="min-w-0 space-y-6" id="main">
              {img ? <PhotoWorkspace img={img} /> : <UploadZone />}
              <PrivacyCard hasImage={!!img} />
            </main>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ upload ------------------------------ */

function useUpload() {
  const [busy, setBusy] = useState(false);
  const run = async (file: File | undefined | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const { note } = await uploadProfilePhoto(file);
      toast({ tone: 'success', title: 'Photo added', description: note ?? 'Six variants were created from your original. Nothing was uploaded.' });
    } catch (err) {
      toast({ tone: 'error', title: 'Could not use this image', description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

function UploadZone() {
  const input = useRef<HTMLInputElement>(null);
  const { busy, run } = useUpload();
  const [over, setOver] = useState(false);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void run(e.dataTransfer.files[0]);
  };
  return (
    <Card className="p-4 sm:p-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn('flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-16 text-center transition-colors', over ? 'border-accent bg-accent-soft' : 'border-line-strong bg-canvas')}
      >
        <div className="mb-5 grid size-16 place-items-center rounded-full border border-line bg-elevated text-fg-muted shadow-float">{busy ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}</div>
        <h2 className="text-[16px] font-semibold">Add your profile picture</h2>
        <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-fg-muted">Crop, adjust and shape it once, then use tailored versions in your portfolio, resumes and documents. JPG, PNG, WebP or GIF up to 25 MB.</p>
        <Button variant="primary" size="lg" className="mt-6" icon={<Upload className="size-4" />} loading={busy} onClick={() => input.current?.click()}>
          Upload Profile Picture
        </Button>
        <p className="mt-3 text-[11.5px] text-fg-subtle">or drop an image here</p>
        <input ref={input} type="file" accept={ACCEPT_ATTR} className="sr-only" aria-label="Choose a profile picture" onChange={(e) => (void run(e.target.files?.[0]), (e.target.value = ''))} />
      </div>
    </Card>
  );
}

/* ----------------------------- workspace ---------------------------- */

const SYSTEMS: Array<{ id: System; label: string }> = [
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'resume', label: 'Resume' },
  { id: 'documents', label: 'Documents' },
];

function PhotoWorkspace({ img }: { img: ProfileImage }) {
  const { source, url, error } = useOriginal(img.asset.id);
  const [selected, setSelected] = useState(img.variants[0]!.id);
  const input = useRef<HTMLInputElement>(null);
  const { busy, run } = useUpload();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const variant = img.variants.find((v) => v.id === selected) ?? img.variants[0]!;

  useEffect(() => {
    if (!img.variants.some((v) => v.id === selected)) setSelected(img.variants[0]!.id);
  }, [img.variants, selected]);

  return (
    <>
      <Card className="p-4 sm:p-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight">Profile picture</h2>
            <p className="mt-0.5 truncate text-[12px] text-fg-subtle">
              {img.asset.name} · {img.asset.width}×{img.asset.height} · {formatBytes(img.asset.size)} · original stored once
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" icon={<RefreshCw className="size-3.5" />} loading={busy} onClick={() => input.current?.click()}>
              Replace
            </Button>
            <Button size="sm" variant="danger" icon={<Trash2 className="size-3.5" />} onClick={() => setConfirmDelete(true)}>
              Delete image
            </Button>
            <input ref={input} type="file" accept={ACCEPT_ATTR} className="sr-only" aria-label="Replace profile picture" onChange={(e) => (void run(e.target.files?.[0]), (e.target.value = ''))} />
          </div>
        </header>

        {error && <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 p-3 text-[12.5px] text-danger">The original image could not be read from local storage. Replace it to continue.</p>}

        <div className="mt-5">
          <VariantStrip img={img} source={source} selected={variant.id} onSelect={setSelected} />
        </div>

        <div className="mt-5 border-t border-line pt-5">{source ? <PhotoEditor key={variant.id} img={img} variantId={variant.id} source={source} onChange={(edit) => mutateProfileImage((cur) => updateVariantEdit(cur, variant.id, edit))} /> : !error && <div className="grid h-64 place-items-center text-fg-subtle"><Loader2 className="size-5 animate-spin" /></div>}</div>
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
          <FocusPoint img={img} url={url} />
          <div className="min-w-0">
            <SectionLabel>Where it’s used</SectionLabel>
            <p className="mb-3 mt-1 text-[12px] leading-relaxed text-fg-muted">Each placement is cropped automatically around your focus point. Adjust any of them by hand.</p>
            <PlacementPreviews img={img} source={source} />
            <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-snug text-fg-subtle">
              <Info className="mt-px size-3.5 shrink-0" />
              Photos are off by default on resumes. Many applicant-tracking systems and some regions (US, UK) discourage them — turn a photo on per resume in Resume Studio.
            </p>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void deleteProfilePhoto().then(() => toast({ title: 'Photo deleted', description: 'The original and all variants were removed from this device.' }))}
        title="Delete profile picture?"
        description="The original and every variant are removed from this device. Portfolios keep the copy they already use."
        confirmLabel="Delete image"
      />
    </>
  );
}

function VariantStrip({ img, source, selected, onSelect }: { img: ProfileImage; source: Decoded | null; selected: string; onSelect: (id: string) => void }) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const current = img.variants.find((v) => v.id === selected) ?? img.variants[0]!;

  const add = (presetId: string) => {
    let id = '';
    mutateProfileImage((cur) => {
      const r = addVariantFromPreset(cur, presetId, selected);
      id = r.id;
      return r.img;
    });
    if (id) onSelect(id);
  };

  return (
    <div>
      <SectionLabel
        action={
          <Menu
            label="Add variant"
            trigger={(p) => (
              <Button {...p} size="xs" icon={<Plus className="size-3.5" />}>
                New variant
              </Button>
            )}
            items={IMAGE_PRESETS.map((p) => ({ label: p.label, onSelect: () => add(p.id) }))}
          />
        }
      >
        Variants · {img.variants.length}
      </SectionLabel>
      <div className="mt-2.5 flex gap-2.5 overflow-x-auto pb-2" role="listbox" aria-label="Image variants">
        {img.variants.map((v) => {
          const t = editTarget(v.edit);
          const uses = SYSTEMS.filter((s) => img.usage[s.id] === v.id);
          return (
            <button
              key={v.id}
              type="button"
              role="option"
              aria-selected={v.id === selected}
              onClick={() => onSelect(v.id)}
              className={cn('flex w-[104px] shrink-0 flex-col items-center gap-1.5 rounded-xl border p-2 text-left transition-colors', v.id === selected ? 'border-accent bg-accent-soft' : 'border-line bg-bg hover:border-line-strong')}
            >
              <div className="grid size-[76px] place-items-center">{source ? <StaticVariant source={source} edit={v.edit} target={t} placement={{ zoom: v.edit.zoom, panX: v.edit.panX, panY: v.edit.panY }} size={t.aspect >= 1 ? 76 : 76 * t.aspect} /> : <div className="size-16 animate-pulse rounded bg-hover" />}</div>
              <span className="w-full truncate text-center text-[11.5px] font-medium">{v.name}</span>
              <span className="flex h-3.5 gap-0.5">
                {uses.map((u) => (
                  <span key={u.id} title={`Used for ${u.label}`} className="rounded bg-accent/20 px-1 text-[9px] font-semibold uppercase leading-[14px] text-accent">
                    {u.label.slice(0, 3)}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {renaming === current.id ? (
          <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              mutateProfileImage((cur) => renameVariant(cur, current.id, draft));
              setRenaming(null);
            }}
          >
            <input autoFocus aria-label="Variant name" className="app-input !h-7 !w-40 !py-0 text-[12px]" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => setRenaming(null)} onKeyDown={(e) => e.key === 'Escape' && setRenaming(null)} />
          </form>
        ) : (
          <span className="text-[12.5px] font-semibold">{current.name}</span>
        )}
        <IconButton
          label="Rename variant"
          size="xs"
          onClick={() => {
            setDraft(current.name);
            setRenaming(current.id);
          }}
        >
          <Pencil className="size-3.5" />
        </IconButton>
        <IconButton
          label="Duplicate variant"
          size="xs"
          onClick={() => {
            let id = '';
            mutateProfileImage((cur) => {
              const r = duplicateVariant(cur, current.id);
              id = r.id;
              return r.img;
            });
            if (id) onSelect(id);
          }}
        >
          <Copy className="size-3.5" />
        </IconButton>
        <IconButton label="Delete variant" size="xs" disabled={img.variants.length <= 1} onClick={() => mutateProfileImage((cur) => deleteVariant(cur, current.id))}>
          <Trash2 className="size-3.5" />
        </IconButton>
        <span className="mx-1 hidden h-4 w-px bg-line sm:block" aria-hidden="true" />
        <span className="text-[11.5px] text-fg-subtle">Use for</span>
        {SYSTEMS.map((s) => {
          const on = img.usage[s.id] === current.id;
          return (
            <button key={s.id} type="button" aria-pressed={on} onClick={() => mutateProfileImage((cur) => setUsage(cur, s.id, current.id))} className={cn('h-7 rounded-full border px-2.5 text-[11.5px] font-medium', on ? 'border-accent bg-accent-soft text-accent' : 'border-line text-fg-muted hover:border-line-strong hover:text-fg')}>
              {on ? '✓ ' : ''}
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FocusPoint({ img, url }: { img: ProfileImage; url: string | null }) {
  const [picking, setPicking] = useState(false);
  const f = img.asset.face;
  const focal = img.asset.focal;
  return (
    <div>
      <SectionLabel>Focus point</SectionLabel>
      <p className="mb-3 mt-1 text-[12px] leading-relaxed text-fg-muted">Smart fit keeps this point centred in every crop.</p>
      <div className={cn('relative overflow-hidden rounded-lg border bg-canvas', picking ? 'cursor-crosshair border-accent' : 'border-line')} style={{ aspectRatio: `${img.asset.width / Math.max(1, img.asset.height)}` }}>
        {url && (
          <img
            src={url}
            alt="Original upload"
            className="size-full object-contain"
            draggable={false}
            onClick={(e) => {
              if (!picking) return;
              const r = e.currentTarget.getBoundingClientRect();
              mutateProfileImage((cur) => setFocal(cur, { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }));
              setPicking(false);
            }}
          />
        )}
        {f && <span className="pointer-events-none absolute border-2 border-ok/80" style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.w * 100}%`, height: `${f.h * 100}%` }} />}
        <span className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent/70 shadow" style={{ left: `${focal.x * 100}%`, top: `${focal.y * 100}%` }} />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Button size="xs" icon={<Crosshair className="size-3.5" />} aria-pressed={picking} className={cn(picking && '!border-accent !text-accent')} onClick={() => setPicking((p) => !p)}>
          {picking ? 'Click the photo…' : 'Set focus point'}
        </Button>
        {f ? (
          <Badge tone="ok">
            <ScanFace className="size-3" /> Face detected
          </Badge>
        ) : (
          <span className="text-[11px] text-fg-subtle">{faceDetectionSupported() ? 'No face detected.' : 'Automatic face detection isn’t available in this browser.'}</span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ privacy ----------------------------- */

function PrivacyCard({ hasImage }: { hasImage: boolean }) {
  const [usage, setUsageState] = useState<{ images: number; imageBytes: number; resumes: number; documents: number } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const img = useWorkspace((s) => s.profile.profileImage);
  useEffect(() => {
    void studioUsage()
      .then(setUsageState)
      .catch(() => setUsageState(null));
  }, [img?.asset.id]);

  const wipe = async () => {
    try {
      await deleteAllStudioData();
      clearImageCache();
      useWorkspace.getState().reset();
      setUsageState(await studioUsage());
      toast({ tone: 'success', title: 'Local studio data deleted', description: 'Profile, images, resumes and documents were removed. Portfolios were not touched.' });
    } catch (err) {
      toast({ tone: 'error', title: 'Could not delete local data', description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-4">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-ok/10 text-ok">
          <ShieldCheck className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold tracking-tight">Your images stay on this device.</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-fg-muted">
            Photos are processed in your browser and stored in this browser’s local database (IndexedDB). There is no upload endpoint — nothing is sent to a server.
          </p>
          {usage && (
            <p className="mt-2 font-mono text-[11.5px] text-fg-subtle">
              {usage.images} image{usage.images === 1 ? '' : 's'} · {formatBytes(usage.imageBytes)} · {usage.resumes} resume{usage.resumes === 1 ? '' : 's'} · {usage.documents} document{usage.documents === 1 ? '' : 's'}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {hasImage && (
            <Button size="sm" variant="secondary" icon={<Trash2 className="size-3.5" />} onClick={() => void deleteProfilePhoto().then(() => toast({ title: 'Photo deleted' }))}>
              Delete image
            </Button>
          )}
          <Button size="sm" variant="danger" icon={<Trash2 className="size-3.5" />} onClick={() => setConfirm(true)}>
            Delete all local data
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => void wipe()}
        title="Delete all local studio data?"
        description={
          <>
            This permanently removes your profile, photo and variants, shared library, resumes, cover letters and documents from this browser. Portfolios are not affected. To erase everything including portfolios, use{' '}
            <Link to="/settings" className="text-accent underline">
              Settings
            </Link>
            .
          </>
        }
        confirmLabel="Delete studio data"
      />
    </Card>
  );
}
