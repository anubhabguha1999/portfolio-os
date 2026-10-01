/**
 * Profile photo lifecycle: validate → store the original once → derive variants.
 * The pure helpers (no I/O) are exported separately so they can be tested.
 */
import { uid } from '@/utils/id';
import type { ImageAsset, ImageEdit, ImageVariant, ProfileImage, VariantPurpose } from '@/studio/model/types';
import { deleteImage, deleteRendersWithPrefix, putImage } from '@/studio/storage/repo';
import { useWorkspace } from '@/studio/store/workspace';
import { defaultVariantEdits, presetEdit, IMAGE_PRESETS } from './presets';
import { clearImageCache } from './service';
import type { Placement } from './pipeline';

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const ACCEPTED_PROFILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const ACCEPT_ATTR = '.jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif';

export type System = keyof ProfileImage['usage'];

export type Validation = { ok: true; mime: string; note?: string } | { ok: false; error: string };

export function mimeFromName(name: string): string {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  return ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : '';
}

export function validateImageFile(file: { name: string; type: string; size: number }): Validation {
  const mime = (file.type || mimeFromName(file.name)).toLowerCase().replace('image/jpg', 'image/jpeg');
  if (!ACCEPTED_PROFILE_TYPES.includes(mime)) return { ok: false, error: `“${file.name}” isn’t a supported image. Use JPG, PNG, WebP or GIF.` };
  if (file.size <= 0) return { ok: false, error: 'This file is empty.' };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: `This image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 25 MB.` };
  return mime === 'image/gif' ? { ok: true, mime, note: 'GIFs are edited from their first frame; animation isn’t kept in derived images.' } : { ok: true, mime };
}

/* ------------------------------ pure ops ----------------------------- */

const stamp = () => new Date().toISOString();

export function makeVariant(name: string, purpose: VariantPurpose, edit: ImageEdit): ImageVariant {
  return { id: uid('var'), name, purpose, edit: structuredClone(edit), placements: {}, updatedAt: stamp() };
}

export function createProfileImage(asset: ImageAsset): ProfileImage {
  const variants = defaultVariantEdits().map((v) => makeVariant(v.name, v.purpose, v.edit));
  const by = (p: VariantPurpose) => variants.find((v) => v.purpose === p)?.id ?? variants[0]!.id;
  return { asset, variants, usage: { portfolio: by('portfolio'), resume: by('resume'), documents: by('professional') } };
}

function fixUsage(img: ProfileImage): ProfileImage {
  const ids = new Set(img.variants.map((v) => v.id));
  const first = img.variants[0]!.id;
  const u = img.usage;
  return { ...img, usage: { portfolio: ids.has(u.portfolio) ? u.portfolio : first, resume: ids.has(u.resume) ? u.resume : first, documents: ids.has(u.documents) ? u.documents : first } };
}

export function usageVariant(img: ProfileImage, system: System): ImageVariant {
  return img.variants.find((v) => v.id === img.usage[system]) ?? img.variants[0]!;
}

export function addVariantFromPreset(img: ProfileImage, presetId: string, fromId?: string): { img: ProfileImage; id: string } {
  const base = img.variants.find((v) => v.id === fromId)?.edit;
  const preset = IMAGE_PRESETS.find((p) => p.id === presetId);
  const v = makeVariant(preset?.label ?? 'Custom', 'custom', presetEdit(presetId, base));
  return { img: { ...img, variants: [...img.variants, v] }, id: v.id };
}

export function duplicateVariant(img: ProfileImage, id: string): { img: ProfileImage; id: string } {
  const src = img.variants.find((v) => v.id === id);
  if (!src) return { img, id };
  const copy: ImageVariant = { ...structuredClone(src), id: uid('var'), name: `${src.name} copy`, purpose: 'custom', updatedAt: stamp() };
  const i = img.variants.indexOf(src);
  const variants = [...img.variants];
  variants.splice(i + 1, 0, copy);
  return { img: { ...img, variants }, id: copy.id };
}

export function renameVariant(img: ProfileImage, id: string, name: string): ProfileImage {
  return { ...img, variants: img.variants.map((v) => (v.id === id ? { ...v, name: name.trim() || v.name, updatedAt: stamp() } : v)) };
}

/** Deleting never leaves zero variants; usage falls back to the first remaining one. */
export function deleteVariant(img: ProfileImage, id: string): ProfileImage {
  if (img.variants.length <= 1) return img;
  return fixUsage({ ...img, variants: img.variants.filter((v) => v.id !== id) });
}

export function updateVariantEdit(img: ProfileImage, id: string, edit: ImageEdit): ProfileImage {
  return { ...img, variants: img.variants.map((v) => (v.id === id ? { ...v, edit, updatedAt: stamp() } : v)) };
}

export function setUsage(img: ProfileImage, system: System, id: string): ProfileImage {
  return img.variants.some((v) => v.id === id) ? { ...img, usage: { ...img.usage, [system]: id } } : img;
}

/** Key must match service.placementFor: aspect.toFixed(3). */
export function placementKey(aspect: number): string {
  return aspect.toFixed(3);
}

export function setPlacement(img: ProfileImage, id: string, aspect: number, placement: Placement | null): ProfileImage {
  return {
    ...img,
    variants: img.variants.map((v) => {
      if (v.id !== id) return v;
      const placements = { ...v.placements };
      if (placement) placements[placementKey(aspect)] = placement;
      else delete placements[placementKey(aspect)];
      return { ...v, placements, updatedAt: stamp() };
    }),
  };
}

export function setFocal(img: ProfileImage, focal: { x: number; y: number }): ProfileImage {
  const c = (n: number) => Math.min(1, Math.max(0, n));
  // A manual focus point overrides any detected face.
  return { ...img, asset: { ...img.asset, focal: { x: c(focal.x), y: c(focal.y) }, face: null } };
}

/* ------------------------------ decoding ----------------------------- */

export async function imageSize(blob: Blob): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const b = await createImageBitmap(blob);
      const out = { width: b.width, height: b.height };
      b.close();
      return out;
    } catch {
      /* fall back */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

interface FaceDetectorLike {
  detect(src: ImageBitmapSource): Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
}

export function faceDetectionSupported(): boolean {
  return typeof window !== 'undefined' && 'FaceDetector' in window;
}

/** Shape Detection API where available (Chrome with the feature enabled). Never throws. */
export async function detectFace(blob: Blob, width: number, height: number): Promise<ImageAsset['face']> {
  if (!faceDetectionSupported() || typeof createImageBitmap !== 'function') return null;
  try {
    const Ctor = (window as unknown as { FaceDetector: new (o: { fastMode: boolean; maxDetectedFaces: number }) => FaceDetectorLike }).FaceDetector;
    const det = new Ctor({ fastMode: true, maxDetectedFaces: 3 });
    const bmp = await createImageBitmap(blob);
    const faces = await det.detect(bmp);
    bmp.close();
    const f = faces.sort((a, b) => b.boundingBox.width * b.boundingBox.height - a.boundingBox.width * a.boundingBox.height)[0];
    if (!f) return null;
    const bb = f.boundingBox;
    return { x: bb.x / width, y: bb.y / height, w: bb.width / width, h: bb.height / height };
  } catch {
    return null;
  }
}

/* ------------------------------ lifecycle ---------------------------- */

/** Validate and store an upload, replacing any existing photo. Returns an optional note. */
export async function uploadProfilePhoto(file: File): Promise<{ note?: string }> {
  const v = validateImageFile(file);
  if (!v.ok) throw new Error(v.error);
  let size: { width: number; height: number };
  try {
    size = await imageSize(file);
  } catch {
    throw new Error('This image could not be decoded. Try a different file.');
  }
  if (!size.width || !size.height) throw new Error('This image has no readable dimensions.');
  const blob = file.type ? file : new Blob([file], { type: v.mime });
  const rec = await putImage(blob, { name: file.name, width: size.width, height: size.height });
  const face = await detectFace(blob, size.width, size.height);
  const asset: ImageAsset = { id: rec.id, name: rec.name, mime: rec.mime, width: size.width, height: size.height, size: rec.size, createdAt: rec.createdAt, focal: face ? { x: face.x + face.w / 2, y: face.y + face.h / 2 } : { x: 0.5, y: 0.4 }, face };
  const previous = useWorkspace.getState().profile.profileImage;
  const img = createProfileImage(asset);
  useWorkspace.getState().setProfileImage(img);
  if (previous) await deleteImage(previous.asset.id).catch(() => undefined);
  await deleteRendersWithPrefix('profile:').catch(() => undefined);
  clearImageCache();
  return v.note ? { note: v.note } : {};
}

export async function deleteProfilePhoto(): Promise<void> {
  const img = useWorkspace.getState().profile.profileImage;
  useWorkspace.getState().setProfileImage(undefined);
  if (img) await deleteImage(img.asset.id).catch(() => undefined);
  await deleteRendersWithPrefix('profile:').catch(() => undefined);
  clearImageCache();
}

/** Apply a pure op to the current photo and persist it. */
export function mutateProfileImage(fn: (img: ProfileImage) => ProfileImage): void {
  const img = useWorkspace.getState().profile.profileImage;
  if (img) useWorkspace.getState().setProfileImage(fn(img));
}
