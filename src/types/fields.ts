/**
 * Declarative field descriptors. The inspector renders editing UIs from
 * these, so a new section type needs no bespoke form component.
 */
export interface FieldOption {
  value: string;
  label: string;
}

interface FieldBase {
  key: string;
  label: string;
  help?: string;
  placeholder?: string;
  /** Only show the field when another field (sibling key) equals one of these values. */
  showWhen?: { key: string; equals: ReadonlyArray<string | boolean> };
}

export type FieldDef =
  | (FieldBase & { kind: 'text' | 'url' | 'email' | 'tel' | 'month' | 'color' | 'icon' })
  | (FieldBase & { kind: 'textarea'; rows?: number })
  | (FieldBase & { kind: 'markdown' | 'code'; language?: 'html' | 'css' | 'markdown' })
  | (FieldBase & { kind: 'number'; min?: number; max?: number; step?: number })
  | (FieldBase & { kind: 'toggle' })
  | (FieldBase & { kind: 'select' | 'segmented'; options: FieldOption[] })
  | (FieldBase & { kind: 'image' })
  | (FieldBase & { kind: 'tags' })
  | (FieldBase & { kind: 'stringList'; itemLabel?: string })
  | (FieldBase & { kind: 'imageList' })
  | (FieldBase & {
      kind: 'list';
      itemLabel: string;
      /** Key of the item property used as the collapsed row title. */
      titleKey: string;
      subtitleKey?: string;
      fields: FieldDef[];
      createItem: () => Record<string, unknown>;
    });

export type FieldKind = FieldDef['kind'];
