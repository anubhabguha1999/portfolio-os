import { useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Award,
  BookOpen,
  Briefcase,
  Code2,
  Copy,
  Eye,
  EyeOff,
  FileText,
  FolderGit2,
  GitFork,
  GraduationCap,
  GripVertical,
  HandHeart,
  Heart,
  Languages,
  MoreHorizontal,
  Pencil,
  Plus,
  ScrollText,
  Sparkles,
  Trash2,
  Trophy,
  UserRound,
  Users,
  Wrench,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { restrictToVerticalAxis } from '@/features/builder/dnd-modifiers';
import { IconButton } from '@/components/ui/Button';
import { Menu } from '@/components/ui/Menu';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { SectionLabel } from '@/components/ui/misc';
import type { ResumeSection, ResumeSectionKind } from '@/studio/model/types';
import { SECTION_KINDS, sectionInfo } from '@/studio/model/defaults';
import { useResumeEditor } from '@/studio/store/resume-editor';
import { cn } from '@/utils/cn';

export const SECTION_ICONS: Record<ResumeSectionKind, typeof Briefcase> = {
  profile: UserRound,
  summary: FileText,
  experience: Briefcase,
  projects: FolderGit2,
  skills: Wrench,
  'technical-skills': Code2,
  education: GraduationCap,
  certifications: ScrollText,
  achievements: Trophy,
  awards: Award,
  languages: Languages,
  interests: Heart,
  publications: BookOpen,
  'open-source': GitFork,
  volunteer: HandHeart,
  references: Users,
  custom: Sparkles,
};

function Row({ s, index, count, selected }: { s: ResumeSection; index: number; count: number; selected: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id, disabled: s.kind === 'profile' });
  const ed = useResumeEditor.getState();
  const [renaming, setRenaming] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const Icon = SECTION_ICONS[s.kind];
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('group relative flex h-9 items-center gap-1 rounded-lg pl-1 pr-1 text-[13px]', selected ? 'bg-accent-soft text-fg' : 'text-fg-muted hover:bg-hover hover:text-fg', isDragging && 'z-10 shadow-float', s.hidden && 'opacity-55')}
    >
      <button type="button" className={cn('grid size-6 shrink-0 cursor-grab place-items-center rounded text-fg-subtle opacity-0 group-hover:opacity-100 focus-visible:opacity-100', s.kind === 'profile' && 'invisible')} aria-label={`Drag ${s.title}`} {...attributes} {...listeners}>
        <GripVertical className="size-3.5" />
      </button>
      <Icon className={cn('size-3.5 shrink-0', selected ? 'text-accent' : 'text-fg-subtle')} aria-hidden="true" />
      {renaming ? (
        <input
          autoFocus
          defaultValue={s.title}
          aria-label="Section title"
          className="app-input h-7 flex-1 !py-0.5"
          onBlur={(e) => {
            if (e.target.value.trim()) ed.patchSection(s.id, { title: e.target.value.trim() });
            setRenaming(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') setRenaming(false);
          }}
        />
      ) : (
        <button type="button" className="min-w-0 flex-1 truncate py-1.5 text-left" onClick={() => ed.select({ sectionId: s.id, itemId: null })} onDoubleClick={() => s.kind !== 'profile' && setRenaming(true)}>
          {s.kind === 'profile' ? 'Profile & contact' : s.title}
        </button>
      )}
      {s.kind !== 'profile' && (
        <div className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100">
          <IconButton size="xs" label={s.hidden ? 'Show section' : 'Hide section'} onClick={() => ed.patchSection(s.id, { hidden: !s.hidden })}>
            {s.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </IconButton>
          <Menu
            label={`${s.title} actions`}
            trigger={(p) => (
              <IconButton {...p} size="xs" label="Section actions">
                <MoreHorizontal className="size-3.5" />
              </IconButton>
            )}
            items={[
              { label: 'Rename', icon: <Pencil />, onSelect: () => setRenaming(true) },
              { label: 'Duplicate', icon: <Copy />, onSelect: () => ed.duplicateSection(s.id) },
              { label: 'Move up', icon: <ArrowUp />, disabled: index <= 1, onSelect: () => ed.moveSection(s.id, index - 1) },
              { label: 'Move down', icon: <ArrowDown />, disabled: index >= count - 1, onSelect: () => ed.moveSection(s.id, index + 1) },
              'separator',
              { label: 'Delete section', icon: <Trash2 />, danger: true, onSelect: () => setConfirm(true) },
            ]}
          />
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => ed.removeSection(s.id)}
        title={`Delete “${s.title}”?`}
        description="The section is removed from this resume only. Shared library items (experience, projects…) are kept and remain available to your portfolio and other resumes. Undo is available."
        confirmLabel="Delete section"
      />
    </li>
  );
}

export function SectionsPanel() {
  const sections = useResumeEditor((s) => s.resume?.sections ?? []);
  const selected = useResumeEditor((s) => s.selection.sectionId);
  const addSection = useResumeEditor((s) => s.addSection);
  const moveSection = useResumeEditor((s) => s.moveSection);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const present = new Set(sections.map((s) => s.kind));
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const to = sections.findIndex((s) => s.id === e.over!.id);
    if (to <= 0 && sections[0]?.kind === 'profile') return moveSection(String(e.active.id), 1);
    moveSection(String(e.active.id), to);
  };
  const addable = SECTION_KINDS.filter((k) => k.kind !== 'profile' && (k.kind === 'custom' || !present.has(k.kind)));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <SectionLabel>Sections · {sections.filter((s) => !s.hidden).length}</SectionLabel>
        <Menu
          label="Add section"
          trigger={(p) => (
            <IconButton {...p} size="xs" label="Add section">
              <Plus className="size-3.5" />
            </IconButton>
          )}
          items={addable.map((k) => {
            const Icon = SECTION_ICONS[k.kind];
            return { label: k.label, icon: <Icon />, onSelect: () => addSection(k.kind) };
          })}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis]}>
          <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-0.5" aria-label="Resume sections — drag to reorder">
              {sections.map((s, i) => (
                <Row key={s.id} s={s} index={i} count={sections.length} selected={s.id === selected} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        <div className="mt-4 px-1">
          <SectionLabel className="mb-2">Add a section</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {addable.slice(0, 10).map((k) => (
              <button key={k.kind} type="button" title={k.description} onClick={() => addSection(k.kind)} className="rounded-md border border-dashed border-line px-2 py-1 text-[11.5px] text-fg-muted hover:border-accent hover:text-fg">
                + {sectionInfo(k.kind).label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
