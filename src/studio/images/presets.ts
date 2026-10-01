/**
 * Look presets and the default variant set created on upload. Every variant is a
 * non-destructive edit of the single stored original.
 */
import { defaultImageEdit } from '@/studio/model/defaults';
import type { ImageEdit, VariantPurpose } from '@/studio/model/types';

export interface ImagePreset {
  id: string;
  label: string;
  description: string;
  edit: (base: ImageEdit) => ImageEdit;
}

const adj = (base: ImageEdit, a: Partial<ImageEdit['adjustments']>) => ({ ...base.adjustments, ...a });

export const IMAGE_PRESETS: ImagePreset[] = [
  {
    id: 'professional',
    label: 'Professional',
    description: 'Neutral backdrop, crisp and slightly desaturated.',
    edit: (b) => ({ ...b, aspect: '1:1', shape: 'rounded', radius: 0.14, filter: 'none', adjustments: adj(b, { contrast: 8, saturation: -8, sharpness: 18, brightness: 3 }), background: { ...b.background, kind: 'color', color: '#e5e7eb' } }),
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Clean white background, square crop.',
    edit: (b) => ({ ...b, aspect: '1:1', shape: 'square', filter: 'none', adjustments: adj(b, { brightness: 4, contrast: 4 }), background: { ...b.background, kind: 'white' } }),
  },
  {
    id: 'circular',
    label: 'Circular',
    description: 'Centred circular avatar.',
    edit: (b) => ({ ...b, aspect: '1:1', shape: 'circle', background: { ...b.background, kind: 'transparent' } }),
  },
  {
    id: 'monochrome',
    label: 'Monochrome',
    description: 'Timeless black and white.',
    edit: (b) => ({ ...b, filter: 'mono', adjustments: adj(b, { contrast: 14, sharpness: 12 }) }),
  },
  {
    id: 'duotone',
    label: 'Duotone',
    description: 'Two-colour graphic treatment.',
    edit: (b) => ({ ...b, filter: 'duotone', duotone: ['#1e1b4b', '#a5b4fc'], adjustments: adj(b, { contrast: 12 }) }),
  },
  {
    id: 'gradient',
    label: 'Gradient background',
    description: 'Colourful gradient fills uncovered space.',
    edit: (b) => ({ ...b, shape: 'circle', zoom: Math.min(b.zoom, 0.86), background: { ...b.background, kind: 'gradient', gradient: ['#6366f1', '#ec4899'], angle: 135 } }),
  },
];

export function presetEdit(id: string, base: ImageEdit = defaultImageEdit()): ImageEdit {
  const p = IMAGE_PRESETS.find((x) => x.id === id);
  return p ? p.edit(structuredClone(base)) : structuredClone(base);
}

export const PURPOSE_LABEL: Record<VariantPurpose, string> = {
  original: 'Original',
  professional: 'Professional',
  portfolio: 'Portfolio',
  resume: 'Resume',
  dark: 'Dark Theme',
  light: 'Light Theme',
  custom: 'Custom',
};

/** The variants every new upload starts with. */
export function defaultVariantEdits(): Array<{ purpose: VariantPurpose; name: string; edit: ImageEdit }> {
  const base = defaultImageEdit();
  return [
    { purpose: 'original', name: 'Original', edit: { ...base, shape: 'square', background: { ...base.background, kind: 'original' } } },
    { purpose: 'professional', name: 'Professional', edit: presetEdit('professional', base) },
    { purpose: 'portfolio', name: 'Portfolio', edit: { ...base, shape: 'circle', background: { ...base.background, kind: 'transparent' }, adjustments: { ...base.adjustments, saturation: 6, contrast: 4 } } },
    { purpose: 'resume', name: 'Resume', edit: { ...base, aspect: '3:4', shape: 'square', adjustments: { ...base.adjustments, contrast: 6, saturation: -6, sharpness: 12 }, background: { ...base.background, kind: 'white' } } },
    { purpose: 'dark', name: 'Dark Theme', edit: { ...base, shape: 'circle', background: { ...base.background, kind: 'color', color: '#111827' }, ring: 18, ringColor: '#1f2937', adjustments: { ...base.adjustments, contrast: 10, exposure: 4 } } },
    { purpose: 'light', name: 'Light Theme', edit: { ...base, shape: 'circle', background: { ...base.background, kind: 'color', color: '#f8fafc' }, ring: 18, ringColor: '#ffffff', adjustments: { ...base.adjustments, brightness: 6 } } },
  ];
}
