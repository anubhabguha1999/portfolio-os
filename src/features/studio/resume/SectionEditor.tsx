import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, BookPlus, ChevronDown, Copy, Eye, EyeOff, GripVertical, Link2, Library as LibraryIcon, MoreHorizontal, Plus, Trash2, Unlink, ImageIcon } from 'lucide-react';
import { restrictToVerticalAxis } from '@/features/builder/dnd-modifiers';
import { TagsInput } from '@/features/builder/fields/TagsInput';
import { StringListField } from '@/features/builder/fields/StringListField';
import { Button, IconButton } from '@/components/ui/Button';
import { FieldShell, Segmented, Select, Slider, Switch, TextArea, TextInput } from '@/components/ui/Field';
import { Menu } from '@/components/ui/Menu';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Badge, SectionLabel } from '@/components/ui/misc';
import type { ItemRef, Library, LibraryKind, LocalEntry, PhotoMode, ResumeSection } from '@/studio/model/types';
import { sectionInfo } from '@/studio/model/defaults';
import { refValue, sectionRefs } from '@/studio/model/resolve';
import { useResumeEditor } from '@/studio/store/resume-editor';
import { useWorkspace } from '@/studio/store/workspace';
import { getResumeTemplate } from '@/studio/templates/resume';
import { cn } from '@/utils/cn';
import { PhotoUploader } from '../shared/PhotoUploader';
import { InsertFromLibraryDialog, type InsertPick } from '@/features/knowledge/InsertFromLibrary';
import { ProvenanceNote } from '@/features/knowledge/Provenance';
import { adoptCandidates } from '@/knowledge/import/library-source';
import { addProvenance } from '@/knowledge/storage/repo';

/* ------------------------------------------------------------------ */
/* Field definitions                                                   */
/* ------------------------------------------------------------------ */

type FieldKind = 'text' | 'textarea' | 'month' | 'bool' | 'list' | 'tags' | 'url';

interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  help?: string;
  half?: boolean;
  /** Resume-specific copy that coexists with the portfolio version. */
  resumeCopy?: boolean;
  advanced?: boolean;
}

const LIB_FIELDS: Record<Exclude<LibraryKind, 'skills'>, FieldDef[]> = {
  experience: [
    { key: 'role', label: 'Role', kind: 'text', half: true },
    { key: 'company', label: 'Company', kind: 'text', half: true },
    { key: 'start', label: 'Start', kind: 'month', half: true },
    { key: 'end', label: 'End', kind: 'month', half: true },
    { key: 'current', label: 'I currently work here', kind: 'bool' },
    { key: 'location', label: 'Location', kind: 'text', half: true },
    { key: 'url', label: 'Company URL', kind: 'url', half: true },
    { key: 'description', label: 'Summary', kind: 'textarea', help: 'One or two lines of context.' },
    { key: 'achievements', label: 'Achievements', kind: 'list', help: 'Lead with a verb and a number: “Cut load time 60%…”. Enter adds a bullet.' },
    { key: 'technologies', label: 'Technologies', kind: 'tags' },
  ],
  projects: [
    { key: 'title', label: 'Project title', kind: 'text' },
    { key: 'role', label: 'Your role', kind: 'text', half: true },
    { key: 'duration', label: 'Dates / duration', kind: 'text', half: true },
    { key: 'technologies', label: 'Technologies', kind: 'tags' },
    { key: 'resumeSummary', label: 'Resume summary', kind: 'textarea', resumeCopy: true, help: 'One line for resumes. The long portfolio description is kept separately.' },
    { key: 'resumeBullets', label: 'Resume bullet points', kind: 'list', resumeCopy: true, help: 'Up to three achievements work best.' },
    { key: 'live', label: 'Live URL', kind: 'url', half: true },
    { key: 'github', label: 'Source URL', kind: 'url', half: true },
    { key: 'description', label: 'Portfolio description (long)', kind: 'textarea', advanced: true, help: 'Used by your portfolio website; the resume uses the summary above when set.' },
  ],
  education: [
    { key: 'degree', label: 'Degree', kind: 'text', half: true },
    { key: 'field', label: 'Field of study', kind: 'text', half: true },
    { key: 'institution', label: 'Institution', kind: 'text' },
    { key: 'start', label: 'Start', kind: 'month', half: true },
    { key: 'end', label: 'End', kind: 'month', half: true },
    { key: 'location', label: 'Location', kind: 'text', half: true },
    { key: 'grade', label: 'Grade / honours', kind: 'text', half: true },
    { key: 'description', label: 'Notes', kind: 'textarea' },
  ],
  certifications: [
    { key: 'name', label: 'Certification', kind: 'text' },
    { key: 'issuer', label: 'Issuer', kind: 'text', half: true },
    { key: 'date', label: 'Date', kind: 'month', half: true },
    { key: 'credentialId', label: 'Credential ID', kind: 'text', half: true },
    { key: 'url', label: 'Verification URL', kind: 'url', half: true },
  ],
  achievements: [
    { key: 'title', label: 'Achievement', kind: 'text' },
    { key: 'date', label: 'Date', kind: 'month', half: true },
    { key: 'url', label: 'Link', kind: 'url', half: true },
    { key: 'description', label: 'Description', kind: 'textarea' },
  ],
};

const LOCAL_LABELS: Partial<Record<ResumeSection['kind'], Partial<Record<keyof LocalEntry, string>> & { hide?: Array<keyof LocalEntry> }>> = {
  languages: { title: 'Language', subtitle: 'Proficiency', hide: ['date', 'location', 'url', 'bullets', 'description'] },
  interests: { title: 'Interest', hide: ['subtitle', 'date', 'location', 'url', 'bullets'] },
  awards: { title: 'Award', subtitle: 'Awarded by', hide: ['location', 'bullets'] },
  publications: { title: 'Title', subtitle: 'Venue / publisher', description: 'Authors / note', hide: ['location', 'bullets'] },
  'open-source': { title: 'Project', subtitle: 'Your role', date: 'Dates' },
  volunteer: { title: 'Role', subtitle: 'Organisation', date: 'Dates' },
  references: { title: 'Name', subtitle: 'Position & company', description: 'Contact details', hide: ['date', 'location', 'url', 'bullets'] },
};

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function ShareToggle({ shared, onToggle, resumeCopy }: { shared: boolean; onToggle: () => void; resumeCopy?: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={shared ? (resumeCopy ? 'Shared by all resumes (separate from the portfolio copy). Click to make it specific to this resume.' : 'Shared: edits update your portfolio and every resume. Click to detach for this resume only.') : 'Resume-only: edits affect this resume only. Click to share again (uses the library value).'}
      className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium', shared ? 'text-fg-subtle hover:bg-hover hover:text-fg' : 'bg-warn/10 text-warn hover:bg-warn/20')}
    >
      {shared ? <Link2 className="size-3" /> : <Unlink className="size-3" />}
      {shared ? (resumeCopy ? 'All resumes' : 'Shared') : 'This resume'}
    </button>
  );
}

function Field({ def, value, onChange, trailing, id }: { def: FieldDef; value: unknown; onChange: (v: unknown) => void; trailing?: ReactNode; id: string }) {
  switch (def.kind) {
    case 'bool':
      return (
        <div className="flex items-center justify-between gap-2">
          <Switch id={id} label={def.label} checked={!!value} onChange={onChange} />
          {trailing}
        </div>
      );
    case 'textarea':
      return (
        <FieldShell label={def.label} help={def.help} htmlFor={id} trailing={trailing}>
          <textarea id={id} className="app-input resize-y [field-sizing:content] min-h-16" value={String(value ?? '')} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} />
        </FieldShell>
      );
    case 'list':
      return (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="app-label !mb-0">{def.label}</span>
            {trailing}
          </div>
          <StringListField label="" help={def.help} itemLabel="Bullet" value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} />
          <Button size="xs" variant="ghost" className="mt-1" icon={<Plus className="size-3" />} onClick={() => onChange([...(Array.isArray(value) ? (value as string[]) : []), ''])}>
            Add bullet
          </Button>
        </div>
      );
    case 'tags':
      return (
        <FieldShell label={def.label} help={def.help} htmlFor={id} trailing={trailing}>
          <TagsInput id={id} value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} />
        </FieldShell>
      );
    default:
      return (
        <FieldShell label={def.label} help={def.help} htmlFor={id} trailing={trailing}>
          <input id={id} type={def.kind === 'month' ? 'month' : def.kind === 'url' ? 'url' : 'text'} className="app-input" value={String(value ?? '')} placeholder={def.placeholder ?? (def.kind === 'month' ? 'YYYY-MM' : def.kind === 'url' ? 'https://' : '')} onChange={(e) => onChange(e.target.value)} />
        </FieldShell>
      );
  }
}

function SortableItem({ id, title, subtitle, hidden, open, onToggle, onHide, menu, children }: { id: string; title: string; subtitle: string; hidden: boolean; open: boolean; onToggle: () => void; onHide: () => void; menu: ReactNode; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn('rounded-xl border bg-bg', open ? 'border-accent/50' : 'border-line', isDragging && 'z-10 shadow-float')}>
      <div className={cn('group flex items-center gap-1 px-1.5 py-1.5', hidden && 'opacity-55')}>
        <button type="button" className="grid size-6 cursor-grab place-items-center rounded text-fg-subtle hover:bg-hover" aria-label={`Drag ${title}`} {...attributes} {...listeners}>
          <GripVertical className="size-3.5" />
        </button>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onToggle} aria-expanded={open}>
          <p className="truncate text-[12.5px] font-medium">{title || 'Untitled'}</p>
          {subtitle && <p className="truncate text-[11px] text-fg-subtle">{subtitle}</p>}
        </button>
        <IconButton size="xs" label={hidden ? 'Show on this resume' : 'Hide on this resume'} onClick={onHide}>
          {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </IconButton>
        {menu}
        <ChevronDown className={cn('size-3.5 text-fg-subtle transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </div>
      {open && <div className="space-y-3 border-t border-line px-3 pb-3 pt-3">{children}</div>}
    </li>
  );
}

function useSortSensors() {
  return useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
}

/* ------------------------------------------------------------------ */
/* Library-backed sections                                             */
/* ------------------------------------------------------------------ */

function LibraryItemFields({ section, ref: itemRef, item, kind }: { section: ResumeSection; ref: ItemRef; item: Record<string, unknown>; kind: Exclude<LibraryKind, 'skills'> }) {
  const ed = useResumeEditor.getState();
  const [advanced, setAdvanced] = useState(false);
  const fields = LIB_FIELDS[kind].filter((f) => advanced || !f.advanced);
  const rows: FieldDef[][] = [];
  for (const f of fields) {
    const last = rows[rows.length - 1];
    if (f.half && last && last.length === 1 && last[0]!.half) last.push(f);
    else rows.push([f]);
  }
  return (
    <>
      {rows.map((row, i) => (
        <div key={i} className={cn('grid gap-3', row.length === 2 && 'grid-cols-2')}>
          {row.map((f) => {
            const detached = itemRef.detached.includes(f.key);
            const value = refValue(itemRef, item as never, f.key as never);
            return (
              <Field
                key={f.key}
                id={`${itemRef.id}-${f.key}`}
                def={f}
                value={value}
                onChange={(v) => ed.setItemField(section.id, itemRef.id, f.key, v)}
                trailing={<ShareToggle shared={!detached} resumeCopy={!!f.resumeCopy} onToggle={() => ed.toggleDetach(section.id, itemRef.id, f.key, !detached)} />}
              />
            );
          })}
        </div>
      ))}
      {LIB_FIELDS[kind].some((f) => f.advanced) && (
        <button type="button" className="text-[11.5px] text-accent hover:underline" onClick={() => setAdvanced((v) => !v)}>
          {advanced ? 'Hide portfolio-only fields' : 'Show portfolio fields'}
        </button>
      )}
    </>
  );
}

function titleOf(kind: LibraryKind, item: Record<string, unknown>, ref: ItemRef): { title: string; subtitle: string } {
  const v = (k: string) => String(refValue(ref, item as never, k as never) ?? '');
  switch (kind) {
    case 'experience':
      return { title: v('role'), subtitle: v('company') };
    case 'projects':
      return { title: v('title'), subtitle: (refValue(ref, item as never, 'technologies' as never) as string[] | undefined)?.slice(0, 4).join(' · ') ?? '' };
    case 'education':
      return { title: [v('degree'), v('field')].filter(Boolean).join(', '), subtitle: v('institution') };
    case 'certifications':
      return { title: v('name'), subtitle: v('issuer') };
    case 'achievements':
      return { title: v('title'), subtitle: v('date') };
    default:
      return { title: v('name'), subtitle: '' };
  }
}

function LibrarySectionItems({ section, kind, selectedItem }: { section: ResumeSection; kind: Exclude<LibraryKind, 'skills'>; selectedItem: string | null }) {
  const library = useWorkspace((s) => s.library);
  const ed = useResumeEditor.getState();
  const sensors = useSortSensors();
  const [confirm, setConfirm] = useState<{ libId: string; title: string } | null>(null);
  const [inserting, setInserting] = useState(false);
  const all = sectionRefs(section, library, kind);
  const hiddenRefs = section.refs.filter((r) => r.hidden);
  const visible = all.filter((x) => !x.ref.hidden);
  const hiddenItems = all.filter((x) => x.ref.hidden);
  const unattached = (library[kind] as unknown as Array<Record<string, unknown> & { id: string }>).filter((i) => !all.some((x) => x.item.id === i.id));
  void hiddenRefs;
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    ed.moveRef(section.id, String(e.active.id), visible.findIndex((x) => x.ref.id === e.over!.id));
  };
  const renderItem = ({ ref, item }: { ref: ItemRef; item: unknown }) => {
    const rec = item as Record<string, unknown> & { id: string };
    const t = titleOf(kind, rec, ref);
    const open = selectedItem === ref.id;
    return (
      <SortableItem
        key={ref.id}
        id={ref.id}
        title={t.title}
        subtitle={t.subtitle}
        hidden={ref.hidden}
        open={open}
        onToggle={() => ed.select({ sectionId: section.id, itemId: open ? null : ref.id })}
        onHide={() => ed.hideRef(section.id, ref.id, !ref.hidden)}
        menu={
          <Menu
            label="Item actions"
            trigger={(p) => (
              <IconButton {...p} size="xs" label="Item actions">
                <MoreHorizontal className="size-3.5" />
              </IconButton>
            )}
            items={[
              { label: 'Duplicate', icon: <Copy />, onSelect: () => ed.duplicateLibraryItem(section.id, ref.id) },
              { label: ref.hidden ? 'Show on this resume' : 'Hide on this resume', icon: ref.hidden ? <Eye /> : <EyeOff />, onSelect: () => ed.hideRef(section.id, ref.id, !ref.hidden) },
              'separator',
              { label: 'Delete everywhere…', icon: <Trash2 />, danger: true, onSelect: () => setConfirm({ libId: rec.id, title: t.title }) },
            ]}
          />
        }
      >
        {ref.detached.length > 0 && (
          <p className="flex items-center gap-1.5 rounded-lg bg-warn/10 px-2 py-1.5 text-[11.5px] text-warn">
            <Unlink className="size-3" /> {ref.detached.length} field{ref.detached.length === 1 ? ' is' : 's are'} specific to this resume.
          </p>
        )}
        <ProvenanceNote kind={kind} itemId={rec.id} item={rec} />
        <LibraryItemFields section={section} ref={ref} item={rec} kind={kind} />
      </SortableItem>
    );
  };
  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis]}>
        <SortableContext items={visible.map((x) => x.ref.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1.5">{visible.map(renderItem)}</ul>
        </SortableContext>
      </DndContext>
      {hiddenItems.length > 0 && (
        <details className="rounded-lg border border-dashed border-line px-2.5 py-1.5">
          <summary className="cursor-pointer text-[11.5px] text-fg-subtle">{hiddenItems.length} hidden on this resume</summary>
          <ul className="mt-1.5 space-y-1">
            {hiddenItems.map(({ ref, item }) => (
              <li key={ref.id} className="flex items-center justify-between gap-2 text-[12px]">
                <span className="truncate text-fg-muted">{titleOf(kind, item as unknown as Record<string, unknown>, ref).title || 'Untitled'}</span>
                <Button size="xs" variant="ghost" onClick={() => ed.hideRef(section.id, ref.id, false)}>
                  Show
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => ed.addLibraryItem(section.id)}>
          New {sectionInfo(section.kind).label.toLowerCase().replace(/s$/, '')}
        </Button>
        {unattached.length > 0 && (
          <Menu
            label="Add from library"
            align="start"
            trigger={(p) => (
              <Button {...p} size="sm" variant="ghost" icon={<LibraryIcon className="size-3.5" />}>
                From library ({unattached.length})
              </Button>
            )}
            items={unattached.map((i) => ({ label: titleOf(kind, i, { id: '', libId: i.id, hidden: false, detached: [], overrides: {} }).title || 'Untitled', onSelect: () => ed.attachLibraryItem(section.id, i.id) }))}
          />
        )}
        <Button size="sm" variant="ghost" icon={<BookPlus className="size-3.5" />} onClick={() => setInserting(true)}>
          Insert from Library
        </Button>
      </div>
      <InsertFromLibraryDialog
        open={inserting}
        onClose={() => setInserting(false)}
        kinds={[kind]}
        title={`Insert ${sectionInfo(section.kind).label.toLowerCase()} from Library`}
        used={visible.map((x) => x.ref.libId)}
        onInsert={(pick) => insertPicked(section.id, pick)}
      />
      <Switch label="Include new library items automatically" help="Items you add in your portfolio or another resume appear here too." checked={section.autoInclude} onChange={(v) => ed.patchSection(section.id, { autoInclude: v })} />
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && ed.deleteLibraryItem(kind, confirm.libId)}
        title={`Delete “${confirm?.title || 'item'}” everywhere?`}
        description="This removes the item from your shared library: every resume and linked portfolio loses it. To remove it from this resume only, hide it instead."
        confirmLabel="Delete everywhere"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Skills                                                              */
/* ------------------------------------------------------------------ */

function SkillsEditor({ section }: { section: ResumeSection }) {
  const skills = useWorkspace((s) => s.library.skills);
  const ed = useResumeEditor.getState();
  const [draft, setDraft] = useState({ name: '', category: '' });
  const [inserting, setInserting] = useState(false);
  const included = (id: string) => (section.skillIds ? section.skillIds.includes(id) : true);
  const toggle = (id: string) => {
    const all = skills.map((s) => s.id);
    const current = section.skillIds ?? all;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    ed.patchSection(section.id, { skillIds: next.length === all.length ? null : next });
  };
  const categories = [...new Set(skills.map((s) => s.category.trim()).filter(Boolean))];
  const setSkill = (id: string, patch: Record<string, unknown>) => ed.applyShared('Edit skill', { library: (l: Library) => ({ ...l, skills: l.skills.map((s) => (s.id === id ? { ...s, ...patch } : s)) }) }, `skill:${id}:${Object.keys(patch).join()}`);
  const add = () => {
    if (!draft.name.trim()) return;
    const names = draft.name.split(',').map((n) => n.trim()).filter(Boolean);
    ed.applyShared('Add skills', { library: (l: Library) => ({ ...l, skills: [...l.skills, ...names.map((name) => ({ id: `skl_${Math.random().toString(36).slice(2, 12)}`, name, category: draft.category.trim(), level: 0 }))] }) });
    setDraft({ name: '', category: draft.category });
  };
  return (
    <div className="space-y-3">
      <p className="text-[11.5px] leading-snug text-fg-subtle">Skills live in your shared library. Untick a skill to leave it off this resume only.</p>
      <ul className="space-y-1">
        {skills.map((s) => (
          <li key={s.id} className={cn('grid grid-cols-[auto_1fr_110px_auto] items-center gap-1.5', !included(s.id) && 'opacity-55')}>
            <input type="checkbox" aria-label={`Include ${s.name}`} checked={included(s.id)} onChange={() => toggle(s.id)} className="size-4 accent-[var(--app-accent)]" />
            <input aria-label="Skill" className="app-input !py-1" value={s.name} onChange={(e) => setSkill(s.id, { name: e.target.value })} />
            <input aria-label="Category" list="skill-cats" className="app-input !py-1" placeholder="Category" value={s.category} onChange={(e) => setSkill(s.id, { category: e.target.value })} />
            <Menu
              label="Skill actions"
              trigger={(p) => (
                <IconButton {...p} size="xs" label="Skill actions">
                  <MoreHorizontal className="size-3.5" />
                </IconButton>
              )}
              items={[
                ...[0, 1, 2, 3, 4, 5].map((lvl) => ({ label: lvl === 0 ? 'Level: not specified' : `Level: ${'●'.repeat(lvl)}${'○'.repeat(5 - lvl)}`, onSelect: () => setSkill(s.id, { level: lvl }) })),
                'separator' as const,
                { label: 'Delete everywhere', icon: <Trash2 />, danger: true, onSelect: () => ed.deleteLibraryItem('skills', s.id) },
              ]}
            />
          </li>
        ))}
      </ul>
      <datalist id="skill-cats">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div className="grid grid-cols-[1fr_110px_auto] gap-1.5">
        <input className="app-input" placeholder="Add skills (comma separated)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && add()} aria-label="New skills" />
        <input className="app-input" list="skill-cats" placeholder="Category" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} aria-label="New skill category" />
        <Button size="md" icon={<Plus className="size-3.5" />} onClick={add}>
          Add
        </Button>
      </div>
      <Button size="sm" variant="ghost" icon={<BookPlus className="size-3.5" />} onClick={() => setInserting(true)}>
        Insert skills from Library
      </Button>
      <InsertFromLibraryDialog open={inserting} onClose={() => setInserting(false)} kinds={['skills']} title="Insert skills from Library" used={skills.filter((x) => included(x.id)).map((x) => x.id)} onInsert={(pick) => insertPicked(section.id, pick)} />
    </div>
  );
}

/** Adopt picked knowledge into the shared library and attach it to the section (one undo step). */
function insertPicked(sectionId: string, pick: InsertPick) {
  if (!pick.items.length) return;
  const adopted = adoptCandidates(useWorkspace.getState().library, pick.items);
  useResumeEditor.getState().insertLibraryItems(sectionId, adopted.library, adopted.picks.map((p) => p.id));
  void addProvenance(adopted.provenance);
}

/* ------------------------------------------------------------------ */
/* Local entries                                                       */
/* ------------------------------------------------------------------ */

function LocalEntries({ section, selectedItem }: { section: ResumeSection; selectedItem: string | null }) {
  const ed = useResumeEditor.getState();
  const sensors = useSortSensors();
  const labels = LOCAL_LABELS[section.kind] ?? {};
  const hide = new Set(labels.hide ?? []);
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    ed.moveEntry(section.id, String(e.active.id), section.entries.findIndex((x) => x.id === e.over!.id));
  };
  const L = (k: keyof LocalEntry, d: string) => (labels[k] as string | undefined) ?? d;
  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis]}>
        <SortableContext items={section.entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1.5">
            {section.entries.map((e) => {
              const open = selectedItem === e.id;
              const set = (patch: Partial<LocalEntry>) => ed.patchEntry(section.id, e.id, patch);
              return (
                <SortableItem
                  key={e.id}
                  id={e.id}
                  title={e.title}
                  subtitle={e.subtitle}
                  hidden={e.hidden}
                  open={open}
                  onToggle={() => ed.select({ sectionId: section.id, itemId: open ? null : e.id })}
                  onHide={() => set({ hidden: !e.hidden })}
                  menu={
                    <Menu
                      label="Entry actions"
                      trigger={(p) => (
                        <IconButton {...p} size="xs" label="Entry actions">
                          <MoreHorizontal className="size-3.5" />
                        </IconButton>
                      )}
                      items={[
                        { label: 'Duplicate', icon: <Copy />, onSelect: () => ed.duplicateEntry(section.id, e.id) },
                        { label: 'Delete', icon: <Trash2 />, danger: true, onSelect: () => ed.removeEntry(section.id, e.id) },
                      ]}
                    />
                  }
                >
                  <div className={cn('grid gap-3', !hide.has('subtitle') && 'grid-cols-2')}>
                    <TextInput label={L('title', 'Title')} value={e.title} onChange={(ev) => set({ title: ev.target.value })} />
                    {!hide.has('subtitle') && <TextInput label={L('subtitle', 'Subtitle')} value={e.subtitle} onChange={(ev) => set({ subtitle: ev.target.value })} />}
                  </div>
                  {(!hide.has('date') || !hide.has('location')) && (
                    <div className="grid grid-cols-2 gap-3">
                      {!hide.has('date') && <TextInput label={L('date', 'Date')} placeholder="2024 or 2021-03" value={e.date} onChange={(ev) => set({ date: ev.target.value })} />}
                      {!hide.has('location') && <TextInput label="Location" value={e.location} onChange={(ev) => set({ location: ev.target.value })} />}
                    </div>
                  )}
                  {!hide.has('url') && <TextInput label="Link" type="url" placeholder="https://" value={e.url} onChange={(ev) => set({ url: ev.target.value })} />}
                  {!hide.has('description') && <TextArea label={L('description', 'Description')} rows={2} value={e.description} onChange={(ev) => set({ description: ev.target.value })} />}
                  {!hide.has('bullets') && (
                    <>
                      <StringListField label="Bullet points" itemLabel="Bullet" value={e.bullets} onChange={(v) => set({ bullets: v })} />
                      <Button size="xs" variant="ghost" icon={<Plus className="size-3" />} onClick={() => set({ bullets: [...e.bullets, ''] })}>
                        Add bullet
                      </Button>
                    </>
                  )}
                </SortableItem>
              );
            })}
          </ul>
        </SortableContext>
      </DndContext>
      <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => ed.addEntry(section.id)}>
        Add {L('title', 'entry').toLowerCase()}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Profile & summary                                                   */
/* ------------------------------------------------------------------ */

const PHOTO_OPTIONS: Array<{ value: PhotoMode; label: string }> = [
  { value: 'none', label: 'No photo' },
  { value: 'circle', label: 'Circle' },
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'small-portrait', label: 'Small portrait' },
  { value: 'large-portrait', label: 'Large portrait' },
];

function ProfileEditor() {
  const resume = useResumeEditor((s) => s.resume)!;
  const profile = useWorkspace((s) => s.profile);
  const ed = useResumeEditor.getState();
  const tpl = getResumeTemplate(resume.templateId);
  const setProfile = (patch: Record<string, string>) => ed.applyShared('Edit profile', { profile: (p) => ({ ...p, ...patch }) }, `profile:${Object.keys(patch).join()}`);
  const variants = profile.profileImage?.variants ?? [];
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line p-3">
        <SectionLabel className="mb-2">Photo</SectionLabel>
        <PhotoUploader
          variantId={resume.photoVariant}
          // Uploading here means "put it on this resume": switch the photo on if the template can show one.
          onUploaded={() => {
            const r = useResumeEditor.getState().resume;
            if (r && tpl.supportsPhoto && r.style.photo === 'none' && !r.style.atsSafe) ed.setStyle({ photo: tpl.defaults.photo ?? 'circle' });
          }}
        />
        {profile.profileImage && (
          <div className="mt-3 space-y-3">
            <Select label="Photo style" value={resume.style.photo} onChange={(e) => ed.setStyle({ photo: e.target.value as PhotoMode })} options={PHOTO_OPTIONS} />
            {variants.length > 1 && (
              <Select label="Image variant" value={resume.photoVariant ?? ''} onChange={(e) => ed.apply('Photo variant', (r) => ({ ...r, photoVariant: e.target.value || null }))} options={[{ value: '', label: 'Default (resume)' }, ...variants.map((v) => ({ value: v.id, label: v.name }))]} />
            )}
            {!tpl.supportsPhoto && resume.style.photo !== 'none' && <p className="text-[11.5px] text-warn">The {tpl.name} template does not show photos.</p>}
            {resume.style.atsSafe && resume.style.photo !== 'none' && <p className="text-[11.5px] text-warn">ATS-safe mode is on, so the photo is hidden.</p>}
          </div>
        )}
        <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-snug text-fg-subtle">
          <AlertTriangle className="mt-px size-3 shrink-0 text-warn" />
          Photos are common in some countries and discouraged in others (e.g. US/UK). Many applicant-tracking systems ignore images. Photos are off unless you choose one.
        </p>
      </div>
      <p className="flex items-start gap-1.5 text-[11.5px] leading-snug text-fg-subtle">
        <Link2 className="mt-px size-3 shrink-0" /> Name and contact details are shared with your portfolio, every resume and your documents. Change them once, everywhere updates.
      </p>
      <TextInput label="Full name" value={profile.name} onChange={(e) => setProfile({ name: e.target.value })} />
      <FieldShell
        label="Headline"
        trailing={
          <ShareToggle
            shared={resume.headline === null}
            onToggle={() => ed.apply('Headline sharing', (r) => ({ ...r, headline: r.headline === null ? profile.headline : null }))}
          />
        }
      >
        <input className="app-input" value={resume.headline ?? profile.headline} placeholder="e.g. Senior Full-Stack Engineer" onChange={(e) => (resume.headline === null ? setProfile({ headline: e.target.value }) : ed.apply('Edit headline', (r) => ({ ...r, headline: e.target.value }), 'headline'))} />
      </FieldShell>
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="Email" type="email" value={profile.email} onChange={(e) => setProfile({ email: e.target.value })} />
        <TextInput label="Phone" value={profile.phone ?? ''} onChange={(e) => setProfile({ phone: e.target.value })} />
        <TextInput label="Location" value={profile.location ?? ''} onChange={(e) => setProfile({ location: e.target.value })} />
        <TextInput label="Website" type="url" value={profile.website ?? ''} onChange={(e) => setProfile({ website: e.target.value })} />
      </div>
      <div className="rounded-xl border border-line p-3">
        <SectionLabel className="mb-2">Show on this resume</SectionLabel>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {(['email', 'phone', 'location', 'website', 'social'] as const).map((k) => (
            <Switch key={k} label={k === 'social' ? `Social links (${profile.socialLinks.length})` : k[0]!.toUpperCase() + k.slice(1)} checked={resume.contact[k]} onChange={(v) => ed.apply('Contact visibility', (r) => ({ ...r, contact: { ...r.contact, [k]: v } }))} />
          ))}
        </div>
        <Link to="/profile" className="mt-2.5 inline-block text-[11.5px] text-accent hover:underline">
          Manage social links in Profile Studio →
        </Link>
      </div>
    </div>
  );
}

function SummaryEditor({ section }: { section: ResumeSection }) {
  const bio = useWorkspace((s) => s.profile.bio);
  const ed = useResumeEditor.getState();
  const shared = section.text === null;
  const words = (shared ? bio : section.text ?? '').trim().split(/\s+/).filter(Boolean).length;
  return (
    <div className="space-y-3">
      <Segmented
        label="Source"
        value={shared ? 'shared' : 'own'}
        onChange={(v) => ed.patchSection(section.id, { text: v === 'shared' ? null : bio })}
        options={[
          { value: 'shared', label: 'Shared bio' },
          { value: 'own', label: 'This resume only' },
        ]}
      />
      <FieldShell label={shared ? 'Bio (shared with your portfolio)' : 'Resume summary'} help={`${words} words · 40–80 words reads best.`}>
        <textarea
          className="app-input min-h-28 resize-y [field-sizing:content]"
          value={shared ? bio : section.text ?? ''}
          onChange={(e) => (shared ? ed.applyShared('Edit bio', { profile: (p) => ({ ...p, bio: e.target.value }) }, 'bio') : ed.patchSection(section.id, { text: e.target.value }, `sum:${section.id}`))}
        />
      </FieldShell>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section editor                                                      */
/* ------------------------------------------------------------------ */

export function SectionEditor({ sectionId }: { sectionId: string }) {
  const section = useResumeEditor((s) => s.resume?.sections.find((x) => x.id === sectionId));
  const templateId = useResumeEditor((s) => s.resume?.templateId ?? '');
  const selectedItem = useResumeEditor((s) => s.selection.itemId);
  const ed = useResumeEditor.getState();
  const info = useMemo(() => (section ? sectionInfo(section.kind) : null), [section]);
  if (!section || !info) return null;
  if (section.kind === 'profile') return <ProfileEditor />;
  const tpl = getResumeTemplate(templateId);
  const lib = info.library;
  const entryLike = !['summary', 'skills', 'technical-skills'].includes(section.kind);
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <TextInput className="flex-1" label="Section heading" value={section.title} onChange={(e) => ed.patchSection(section.id, { title: e.target.value })} />
          <div className="pt-5">
            <IconButton label={section.hidden ? 'Show section' : 'Hide section'} variant="secondary" onClick={() => ed.patchSection(section.id, { hidden: !section.hidden })}>
              {section.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </IconButton>
          </div>
        </div>
        {info.standard.length > 0 && !info.standard.includes(section.title.trim().toLowerCase()) && (
          <p className="flex items-start gap-1.5 text-[11.5px] text-warn">
            <AlertTriangle className="mt-px size-3 shrink-0" /> Non-standard heading. Parsers recognise “{info.standard[0]!.replace(/\b\w/g, (c) => c.toUpperCase())}” more reliably.
          </p>
        )}
        {section.hidden && <Badge tone="warn">Hidden on this resume</Badge>}
      </div>

      {section.kind === 'summary' && <SummaryEditor section={section} />}
      {(section.kind === 'skills' || section.kind === 'technical-skills') && <SkillsEditor section={section} />}
      {lib && lib !== 'skills' && <LibrarySectionItems section={section} kind={lib} selectedItem={selectedItem} />}
      {!lib && entryLike && (
        <>
          {(section.kind === 'custom' || section.kind === 'references') && <TextArea label="Text" rows={3} value={section.text ?? ''} onChange={(e) => ed.patchSection(section.id, { text: e.target.value }, `txt:${section.id}`)} help="Optional paragraph. **bold**, *italic* and [links](https://…) work." />}
          <LocalEntries section={section} selectedItem={selectedItem} />
        </>
      )}

      <div className="space-y-3 border-t border-line pt-4">
        <SectionLabel>Display</SectionLabel>
        <Select
          label="Layout"
          value={section.display}
          onChange={(e) => ed.patchSection(section.id, { display: e.target.value as ResumeSection['display'] })}
          options={[
            { value: 'auto', label: 'Template default' },
            { value: 'entries', label: 'Entries' },
            { value: 'list', label: 'Simple list' },
            { value: 'inline', label: 'Compact lines' },
            { value: 'tags', label: 'Tags / chips' },
            { value: 'grid', label: 'Two-column grid' },
          ]}
        />
        {tpl.columns === 2 && (
          <Segmented label="Column" value={section.placement} onChange={(v) => ed.patchSection(section.id, { placement: v })} options={[{ value: 'auto', label: 'Auto' }, { value: 'main', label: 'Main' }, { value: 'side', label: 'Sidebar' }]} />
        )}
        {entryLike && section.kind !== 'languages' && section.kind !== 'interests' && <Slider label="Max bullets per item" min={0} max={8} value={section.maxBullets} onChange={(v) => ed.patchSection(section.id, { maxBullets: v })} format={(v) => (v === 0 ? 'All' : String(v))} />}
      </div>
    </div>
  );
}

export { ImageIcon };
