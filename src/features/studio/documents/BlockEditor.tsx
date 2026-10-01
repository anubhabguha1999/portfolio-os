import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowDown, ArrowUp, Copy, ImagePlus, Link2, Plus, Trash2, Unlink, X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import { Segmented, Select, Slider, Switch, TextArea, TextInput } from '@/components/ui/Field';
import { SectionLabel } from '@/components/ui/misc';
import type { BlockStyle, DocBlockNode } from '@/studio/model/types';
import { useDocumentEditor } from '@/studio/store/document-editor';
import { useWorkspace } from '@/studio/store/workspace';
import { putImage } from '@/studio/storage/repo';
import { useImageUrls } from '@/studio/images/service';
import { registerImageAspect } from '@/studio/templates/document/blocks';
import { readImageInfo, ACCEPTED_IMAGE_TYPES, autoOptimize } from '@/lib/image';
import { toast } from '@/stores/ui';
import { uid } from '@/utils/id';
import { BLOCK_ICONS, blockLabel } from './BlocksPanel';

type Of<K extends DocBlockNode['kind']> = Extract<DocBlockNode, { kind: K }>;

function Group({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="space-y-3 border-b border-line px-4 py-4 last:border-b-0">
      <SectionLabel action={action}>{title}</SectionLabel>
      {children}
    </section>
  );
}

const MD_HELP = 'Markdown: **bold**, *italic*, [link](https://…). Blank line = new paragraph; lines starting with "- " become bullets.';

export function BlockEditor({ block }: { block: DocBlockNode }) {
  const update = useDocumentEditor((s) => s.updateBlock);
  const updateStyle = useDocumentEditor((s) => s.updateBlockStyle);
  const duplicate = useDocumentEditor((s) => s.duplicateBlock);
  const remove = useDocumentEditor((s) => s.removeBlock);
  const move = useDocumentEditor((s) => s.moveBlock);
  const blocks = useDocumentEditor((s) => s.doc?.blocks ?? []);
  const select = useDocumentEditor((s) => s.select);
  const index = blocks.findIndex((b) => b.id === block.id);
  const set = (patch: Partial<DocBlockNode>, key?: string) => update(block.id, patch, key);

  return (
    <div>
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="grid size-7 place-items-center rounded-lg bg-accent-soft text-accent [&_svg]:size-3.5">{BLOCK_ICONS[block.kind]}</span>
        <h2 className="flex-1 text-[13px] font-semibold">{blockLabel(block.kind)}</h2>
        <IconButton label="Move up" size="xs" disabled={index <= 0} onClick={() => move(block.id, index - 1)}>
          <ArrowUp className="size-3.5" />
        </IconButton>
        <IconButton label="Move down" size="xs" disabled={index >= blocks.length - 1} onClick={() => move(block.id, index + 1)}>
          <ArrowDown className="size-3.5" />
        </IconButton>
        <IconButton label="Duplicate (⌘D)" size="xs" onClick={() => duplicate(block.id)}>
          <Copy className="size-3.5" />
        </IconButton>
        <IconButton label="Delete block" size="xs" onClick={() => remove(block.id)}>
          <Trash2 className="size-3.5" />
        </IconButton>
        <IconButton label="Deselect" size="xs" onClick={() => select(null)}>
          <X className="size-3.5" />
        </IconButton>
      </header>
      <Group title="Content">
        <ContentFields block={block} set={set} />
      </Group>
      {block.kind !== 'pageBreak' && block.kind !== 'spacer' && (
        <Group title="Style">
          <StyleFields style={block.style} kind={block.kind} onChange={(patch, key) => updateStyle(block.id, patch, key)} />
        </Group>
      )}
    </div>
  );
}

function StyleFields({ style, kind, onChange }: { style: BlockStyle; kind: DocBlockNode['kind']; onChange: (p: Partial<BlockStyle>, key?: string) => void }) {
  return (
    <div className="space-y-3">
      <Segmented
        label="Alignment"
        value={style.align}
        onChange={(v) => onChange({ align: v })}
        options={[
          { value: 'left', label: <AlignLeft className="size-3.5" />, title: 'Left' },
          { value: 'center', label: <AlignCenter className="size-3.5" />, title: 'Centre' },
          { value: 'right', label: <AlignRight className="size-3.5" />, title: 'Right' },
          ...(kind === 'heading' ? [] : [{ value: 'justify' as const, label: <AlignJustify className="size-3.5" />, title: 'Justify' }]),
        ]}
      />
      <Segmented label="Size" value={style.size} onChange={(v) => onChange({ size: v })} options={[{ value: 'sm', label: 'S' }, { value: 'md', label: 'M' }, { value: 'lg', label: 'L' }, { value: 'xl', label: 'XL' }]} />
      <Segmented label="Tone" value={style.tone} onChange={(v) => onChange({ tone: v })} options={[{ value: 'default', label: 'Default' }, { value: 'muted', label: 'Muted' }, { value: 'accent', label: 'Accent' }]} />
      <Slider label="Space before" value={style.spaceBefore} min={0} max={40} step={1} unit=" mm" onChange={(v) => onChange({ spaceBefore: v }, 'before')} />
      <Slider label="Space after" value={style.spaceAfter} min={0} max={40} step={1} unit=" mm" onChange={(v) => onChange({ spaceAfter: v }, 'after')} />
    </div>
  );
}

/** One item per line textarea for simple string lists. */
function LinesField({ label, value, onChange, help }: { label: string; value: string[]; onChange: (v: string[]) => void; help?: string }) {
  return <TextArea label={label} rows={Math.min(12, Math.max(4, value.length + 1))} value={value.join('\n')} onChange={(e) => onChange(e.target.value.split('\n'))} help={help ?? 'One item per line.'} />;
}

function ItemRows<T extends { id: string }>({ items, onChange, create, render, addLabel }: { items: T[]; onChange: (v: T[]) => void; create: () => T; render: (item: T, patch: (p: Partial<T>) => void) => ReactNode; addLabel: string }) {
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={it.id} className="space-y-2 rounded-xl border border-line bg-bg p-2.5">
          {render(it, (p) => onChange(items.map((x) => (x.id === it.id ? { ...x, ...p } : x))))}
          <div className="flex justify-end gap-0.5">
            <IconButton label="Move up" size="xs" disabled={i === 0} onClick={() => onChange(swap(items, i, i - 1))}>
              <ArrowUp className="size-3" />
            </IconButton>
            <IconButton label="Move down" size="xs" disabled={i === items.length - 1} onClick={() => onChange(swap(items, i, i + 1))}>
              <ArrowDown className="size-3" />
            </IconButton>
            <IconButton label="Remove" size="xs" onClick={() => onChange(items.filter((x) => x.id !== it.id))}>
              <Trash2 className="size-3" />
            </IconButton>
          </div>
        </div>
      ))}
      <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => onChange([...items, create()])} className="w-full">
        {addLabel}
      </Button>
    </div>
  );
}

function swap<T>(arr: T[], a: number, b: number): T[] {
  const out = [...arr];
  [out[a], out[b]] = [out[b]!, out[a]!];
  return out;
}

function ContentFields({ block: b, set }: { block: DocBlockNode; set: (patch: Partial<DocBlockNode>, key?: string) => void }) {
  const library = useWorkspace((s) => s.library);
  switch (b.kind) {
    case 'heading':
      return (
        <>
          <TextInput label="Text" value={b.text} onChange={(e) => set({ text: e.target.value }, 'text')} />
          <Segmented label="Level" value={String(b.level) as '1' | '2' | '3'} onChange={(v) => set({ level: Number(v) as 1 | 2 | 3 })} options={[{ value: '1', label: 'H1' }, { value: '2', label: 'H2' }, { value: '3', label: 'H3' }]} />
        </>
      );
    case 'paragraph':
      return <TextArea label="Text" rows={9} value={b.text} onChange={(e) => set({ text: e.target.value }, 'text')} help={MD_HELP} />;
    case 'footer':
      return <TextArea label="Footer text" rows={3} value={b.text} onChange={(e) => set({ text: e.target.value }, 'text')} help="Placed at the end of the flow. For a footer on every page use Page settings." />;
    case 'quote':
      return (
        <>
          <TextArea label="Quote" rows={4} value={b.text} onChange={(e) => set({ text: e.target.value }, 'text')} />
          <TextInput label="Attribution" value={b.cite} onChange={(e) => set({ cite: e.target.value }, 'cite')} />
        </>
      );
    case 'list':
      return (
        <>
          <Switch label="Numbered list" checked={b.ordered} onChange={(v) => set({ ordered: v })} />
          <LinesField label="Items" value={b.items} onChange={(v) => set({ items: v }, 'items')} />
        </>
      );
    case 'image':
      return <ImageFields block={b} set={set} />;
    case 'profile':
      return (
        <>
          <p className="text-[12px] leading-relaxed text-fg-muted">
            Name, headline, contact details and photo come from your shared profile.{' '}
            <Link to="/profile" className="font-medium text-accent hover:underline">
              Edit in Profile Studio
            </Link>
          </p>
          <Switch label="Show photo" checked={b.showPhoto} onChange={(v) => set({ showPhoto: v })} />
          <Switch label="Show contact details" checked={b.showContact} onChange={(v) => set({ showContact: v })} />
          <Switch label="Show bio" checked={b.showBio} onChange={(v) => set({ showBio: v })} />
        </>
      );
    case 'table':
      return <TableFields block={b} set={set} />;
    case 'divider':
      return <Segmented label="Style" value={b.variant} onChange={(v) => set({ variant: v })} options={[{ value: 'line', label: 'Line' }, { value: 'dots', label: 'Dots' }, { value: 'thick', label: 'Thick' }]} />;
    case 'timeline':
      return (
        <ItemRows
          items={b.items}
          addLabel="Add milestone"
          onChange={(items) => set({ items }, 'items')}
          create={() => ({ id: uid('tl'), date: '', title: 'Milestone', text: '' })}
          render={(it, patch) => (
            <>
              <div className="grid grid-cols-[90px_1fr] gap-2">
                <TextInput aria-label="Date" placeholder="2024" value={it.date} onChange={(e) => patch({ date: e.target.value })} />
                <TextInput aria-label="Title" placeholder="Title" value={it.title} onChange={(e) => patch({ title: e.target.value })} />
              </div>
              <TextArea aria-label="Description" rows={2} placeholder="Description" value={it.text} onChange={(e) => patch({ text: e.target.value })} />
            </>
          )}
        />
      );
    case 'columns':
      return (
        <>
          <Segmented
            label="Columns"
            value={String(b.count) as '2' | '3'}
            onChange={(v) => {
              const count = Number(v) as 2 | 3;
              const columns = [...b.columns];
              while (columns.length < count) columns.push({ id: uid('col'), heading: `Column ${columns.length + 1}`, text: '' });
              set({ count, columns });
            }}
            options={[{ value: '2', label: 'Two' }, { value: '3', label: 'Three' }]}
          />
          {b.columns.slice(0, b.count).map((c, i) => (
            <div key={c.id} className="space-y-2 rounded-xl border border-line bg-bg p-2.5">
              <TextInput label={`Column ${i + 1} heading`} value={c.heading} onChange={(e) => set({ columns: b.columns.map((x) => (x.id === c.id ? { ...x, heading: e.target.value } : x)) }, `col${i}h`)} />
              <TextArea aria-label={`Column ${i + 1} text`} rows={4} value={c.text} onChange={(e) => set({ columns: b.columns.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)) }, `col${i}t`)} />
            </div>
          ))}
        </>
      );
    case 'callout':
      return (
        <>
          <Segmented label="Variant" value={b.variant} onChange={(v) => set({ variant: v })} options={[{ value: 'info', label: 'Info' }, { value: 'success', label: 'Success' }, { value: 'warning', label: 'Warning' }, { value: 'note', label: 'Note' }]} />
          <TextInput label="Title" value={b.title} onChange={(e) => set({ title: e.target.value }, 'title')} />
          <TextArea label="Text" rows={4} value={b.text} onChange={(e) => set({ text: e.target.value }, 'text')} help={MD_HELP} />
        </>
      );
    case 'code':
      return (
        <>
          <TextInput label="Language label" value={b.language} onChange={(e) => set({ language: e.target.value }, 'lang')} />
          <TextArea label="Code" rows={10} mono value={b.code} onChange={(e) => set({ code: e.target.value }, 'code')} help="Leading indentation is preserved." />
        </>
      );
    case 'stats':
      return (
        <ItemRows
          items={b.items}
          addLabel="Add statistic"
          onChange={(items) => set({ items: items.slice(0, 6) }, 'items')}
          create={() => ({ id: uid('st'), value: '0', label: 'Label' })}
          render={(it, patch) => (
            <div className="grid grid-cols-[90px_1fr] gap-2">
              <TextInput aria-label="Value" value={it.value} onChange={(e) => patch({ value: e.target.value })} />
              <TextInput aria-label="Label" value={it.label} onChange={(e) => patch({ label: e.target.value })} />
            </div>
          )}
        />
      );
    case 'project': {
      const linked = b.libId ? library.projects.find((p) => p.id === b.libId) : undefined;
      return (
        <>
          <LibraryLink
            label="Shared project"
            value={b.libId}
            options={library.projects.map((p) => ({ value: p.id, label: p.title || 'Untitled project' }))}
            onChange={(libId) => set({ libId, ...(libId ? {} : { title: linked?.title ?? b.title }) })}
            emptyHint="Add projects in Portfolio or Resume Studio to link them here."
          />
          {!linked && <TextInput label="Title" value={b.title} onChange={(e) => set({ title: e.target.value }, 'title')} />}
          <TextArea label={linked ? 'Description (overrides the shared summary)' : 'Description'} rows={4} placeholder={linked?.resumeSummary || linked?.description} value={b.text} onChange={(e) => set({ text: e.target.value }, 'text')} />
          <TextInput label="Tags" placeholder={linked?.technologies.join(', ')} value={b.tags.join(', ')} onChange={(e) => set({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) }, 'tags')} help="Comma separated." />
          <TextInput label="Link" placeholder={linked?.live || linked?.github || 'https://'} value={b.url} onChange={(e) => set({ url: e.target.value }, 'url')} />
        </>
      );
    }
    case 'experience': {
      const linked = b.libId ? library.experience.find((e) => e.id === b.libId) : undefined;
      return (
        <>
          <LibraryLink
            label="Shared experience"
            value={b.libId}
            options={library.experience.map((e) => ({ value: e.id, label: [e.role, e.company].filter(Boolean).join(' · ') || 'Untitled role' }))}
            onChange={(libId) => set({ libId, ...(libId ? {} : linked ? { role: linked.role, company: linked.company } : {}) })}
            emptyHint="Add experience in Resume Studio to link it here."
          />
          {!linked && (
            <>
              <TextInput label="Role" value={b.role} onChange={(e) => set({ role: e.target.value }, 'role')} />
              <TextInput label="Company" value={b.company} onChange={(e) => set({ company: e.target.value }, 'company')} />
            </>
          )}
          <TextInput label="Dates" placeholder={linked ? 'From the shared entry' : '2021 – Present'} value={b.dates} onChange={(e) => set({ dates: e.target.value }, 'dates')} />
          <TextArea label={linked ? 'Description (overrides shared achievements)' : 'Description'} rows={4} value={b.text} onChange={(e) => set({ text: e.target.value }, 'text')} help={MD_HELP} />
        </>
      );
    }
    case 'signature':
      return (
        <>
          <TextInput label="Name" placeholder="From your profile" value={b.name} onChange={(e) => set({ name: e.target.value }, 'name')} />
          <TextInput label="Title" value={b.title} onChange={(e) => set({ title: e.target.value }, 'title')} />
          <TextInput label="Date" value={b.date} onChange={(e) => set({ date: e.target.value }, 'date')} />
        </>
      );
    case 'spacer':
      return <Slider label="Height" value={b.height} min={2} max={80} unit=" mm" onChange={(v) => set({ height: v }, 'h')} />;
    case 'pageBreak':
      return <p className="text-[12px] leading-relaxed text-fg-muted">Everything after this block starts on a new page — in the preview, the PDF and the Word document.</p>;
  }
}

function LibraryLink({ label, value, options, onChange, emptyHint }: { label: string; value: string | null; options: Array<{ value: string; label: string }>; onChange: (v: string | null) => void; emptyHint: string }) {
  if (!options.length) return <p className="rounded-lg border border-dashed border-line px-3 py-2 text-[11.5px] text-fg-subtle">{emptyHint}</p>;
  return (
    <div className="space-y-1.5">
      <Select label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} options={[{ value: '', label: 'Not linked — local content' }, ...options]} />
      {value && (
        <p className="flex items-center gap-1.5 text-[11.5px] text-ok">
          <Link2 className="size-3" /> Synced: changes to the shared item update this card.
          <button type="button" onClick={() => onChange(null)} className="ml-auto inline-flex items-center gap-1 text-fg-muted hover:text-fg">
            <Unlink className="size-3" /> Detach
          </button>
        </p>
      )}
    </div>
  );
}

function ImageFields({ block: b, set }: { block: Of<'image'>; set: (patch: Partial<DocBlockNode>, key?: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const url = useImageUrls(b.src ? [b.src] : [])(b.src);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return toast({ tone: 'error', title: 'Unsupported image', description: 'Use JPG, PNG, WebP, GIF, AVIF or SVG.' });
    setBusy(true);
    try {
      const opt = await autoOptimize(file);
      const info = opt.width ? opt : { ...opt, ...(await readImageInfo(opt.blob)) };
      const rec = await putImage(opt.blob, { name: file.name, width: info.width, height: info.height });
      const src = `simg:${rec.id}`;
      const aspect = info.width && info.height ? info.width / info.height : 4 / 3;
      registerImageAspect(src, aspect);
      set({ src, ...({ aspect } as object) } as Partial<DocBlockNode>);
    } catch (err) {
      toast({ tone: 'error', title: 'Image could not be added', description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div
        className="grid min-h-[120px] place-items-center overflow-hidden rounded-xl border border-dashed border-line-strong bg-bg"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void upload(e.dataTransfer.files[0]);
        }}
      >
        {url ? <img src={url} alt={b.caption || 'Selected image'} className="max-h-[200px] w-full object-contain" /> : <p className="px-4 text-center text-[12px] text-fg-subtle">Drop an image here</p>}
      </div>
      <div className="flex gap-2">
        <Button size="sm" loading={busy} icon={<ImagePlus className="size-3.5" />} onClick={() => input.current?.click()}>
          {b.src ? 'Replace image' : 'Upload image'}
        </Button>
        {b.src && (
          <Button size="sm" variant="ghost" onClick={() => set({ src: '' })}>
            Remove
          </Button>
        )}
      </div>
      <input ref={input} type="file" accept={ACCEPTED_IMAGE_TYPES.join(',')} className="hidden" onChange={(e) => void upload(e.target.files?.[0] ?? undefined)} />
      <p className="text-[11px] text-fg-subtle">Stored on this device only.</p>
      <TextInput label="Caption" value={b.caption} onChange={(e) => set({ caption: e.target.value }, 'caption')} />
      <Slider label="Width" value={Math.round((b.width || 1) * 100)} min={15} max={100} unit="%" onChange={(v) => set({ width: v / 100 }, 'width')} />
    </>
  );
}

function TableFields({ block: b, set }: { block: Of<'table'>; set: (patch: Partial<DocBlockNode>, key?: string) => void }) {
  const cols = Math.max(b.header.length, ...b.rows.map((r) => r.length), 1);
  const norm = (r: string[]) => Array.from({ length: cols }, (_, i) => r[i] ?? '');
  const header = norm(b.header);
  const rows = b.rows.map(norm);
  const setCell = (ri: number, ci: number, v: string) => set({ rows: rows.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? v : c)) : r)) }, `cell${ri}-${ci}`);
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1 text-[12px]">
          <thead>
            <tr>
              {header.map((h, ci) => (
                <th key={ci} className="min-w-[90px]">
                  <input aria-label={`Header ${ci + 1}`} className="app-input !py-1 font-semibold" value={h} onChange={(e) => set({ header: header.map((x, j) => (j === ci ? e.target.value : x)) }, `h${ci}`)} />
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                {r.map((c, ci) => (
                  <td key={ci}>
                    <input aria-label={`Row ${ri + 1} column ${ci + 1}`} className="app-input !py-1" value={c} onChange={(e) => setCell(ri, ci, e.target.value)} />
                  </td>
                ))}
                <td>
                  <IconButton label={`Remove row ${ri + 1}`} size="xs" onClick={() => set({ rows: rows.filter((_, i) => i !== ri) })}>
                    <Trash2 className="size-3" />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button size="xs" icon={<Plus className="size-3" />} onClick={() => set({ rows: [...rows, Array.from({ length: cols }, () => '')] })}>
          Row
        </Button>
        <Button size="xs" icon={<Plus className="size-3" />} disabled={cols >= 6} onClick={() => set({ header: [...header, ''], rows: rows.map((r) => [...r, '']) })}>
          Column
        </Button>
        <Button size="xs" variant="ghost" disabled={cols <= 1} onClick={() => set({ header: header.slice(0, -1), rows: rows.map((r) => r.slice(0, -1)) })}>
          Remove last column
        </Button>
      </div>
    </div>
  );
}
