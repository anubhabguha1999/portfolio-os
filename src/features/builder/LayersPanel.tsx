import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, GripVertical, Lock, MoreHorizontal, Pencil, Plus, Trash2, Unlock } from 'lucide-react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from './dnd-modifiers';
import { CSS } from '@dnd-kit/utilities';
import { useEditor, selectSortedSections } from '@/stores/editor';
import { useShallow } from 'zustand/react/shallow';
import type { PortfolioSection } from '@/types/portfolio';
import { getDefinition } from '@/sections/registry';
import { IconButton } from '@/components/ui/Button';
import { Menu } from '@/components/ui/Menu';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { SectionLabel } from '@/components/ui/misc';
import { SectionIcon } from './SectionIcon';
import { AddSectionDialog } from './AddSectionDialog';
import { cn } from '@/utils/cn';

export function LayersPanel({ onPicked }: { onPicked?: () => void }) {
  const sections = useEditor(useShallow(selectSortedSections));
  const selected = useEditor((s) => s.selectedSectionId);
  const select = useEditor((s) => s.select);
  const move = useEditor((s) => s.moveSection);
  const [adding, setAdding] = useState<{ index?: number } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const to = sections.findIndex((s) => s.id === e.over!.id);
    move(String(e.active.id), to);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <SectionLabel>Sections · {sections.length}</SectionLabel>
        <IconButton label="Add section" size="xs" onClick={() => setAdding({})}>
          <Plus className="size-3.5" />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis]}>
          <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-0.5" aria-label="Sections — drag or use the move actions to reorder">
              {sections.map((s, i) => (
                <LayerRow
                  key={s.id}
                  section={s}
                  index={i}
                  count={sections.length}
                  selected={s.id === selected}
                  onSelect={() => {
                    select(s.id);
                    onPicked?.();
                  }}
                  onInsertBelow={() => setAdding({ index: i + 1 })}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        <button
          type="button"
          onClick={() => setAdding({})}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong py-2.5 text-[12px] font-medium text-fg-muted transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent"
        >
          <Plus className="size-3.5" /> Add section
        </button>
      </div>
      <AddSectionDialog open={adding !== null} index={adding?.index} onClose={() => setAdding(null)} />
    </div>
  );
}

function LayerRow({ section: s, index, count, selected, onSelect, onInsertBelow }: { section: PortfolioSection; index: number; count: number; selected: boolean; onSelect: () => void; onInsertBelow: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: s.id, disabled: s.locked });
  const toggleEnabled = useEditor((st) => st.toggleEnabled);
  const toggleLocked = useEditor((st) => st.toggleLocked);
  const duplicate = useEditor((st) => st.duplicateSection);
  const remove = useEditor((st) => st.removeSection);
  const rename = useEditor((st) => st.renameSection);
  const move = useEditor((st) => st.moveSection);
  const [renaming, setRenaming] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLLIElement | null>(null);
  const def = getDefinition(s.type);
  const mergedRef = useCallback(
    (el: HTMLLIElement | null) => {
      setNodeRef(el);
      rowRef.current = el;
    },
    [setNodeRef],
  );

  useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);
  useEffect(() => {
    if (selected) rowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  return (
    <li
      ref={mergedRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'group relative flex items-center gap-0.5 rounded-lg pr-1 transition-colors',
        selected ? 'bg-accent-soft' : 'hover:bg-hover',
        isDragging && 'z-20 bg-elevated shadow-float',
        !s.enabled && 'opacity-55',
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={s.locked ? `${s.name} is locked` : `Drag to reorder ${s.name}`}
        disabled={s.locked}
        className="grid h-8 w-5 shrink-0 cursor-grab place-items-center text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>
      {renaming ? (
        <input
          ref={inputRef}
          defaultValue={s.name}
          aria-label="Section name"
          className="app-input !h-7 !py-0 !text-[12.5px]"
          onBlur={(e) => {
            rename(s.id, e.target.value);
            setRenaming(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') setRenaming(false);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={onSelect}
          onDoubleClick={() => setRenaming(true)}
          onKeyDown={(e) => {
            if (e.altKey && e.key === 'ArrowUp' && index > 0) {
              e.preventDefault();
              move(s.id, index - 1);
            } else if (e.altKey && e.key === 'ArrowDown' && index < count - 1) {
              e.preventDefault();
              move(s.id, index + 1);
            } else if (e.key === 'F2') setRenaming(true);
            else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              const list = (e.currentTarget.closest('ul')?.querySelectorAll<HTMLButtonElement>('[data-layer-btn]')) ?? [];
              const arr = Array.from(list);
              const i = arr.indexOf(e.currentTarget);
              arr[e.key === 'ArrowDown' ? Math.min(arr.length - 1, i + 1) : Math.max(0, i - 1)]?.focus();
            }
          }}
          data-layer-btn
          aria-current={selected || undefined}
          className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-1 text-left"
        >
          <SectionIcon name={def.icon} className={cn('size-3.5 shrink-0', selected ? 'text-accent' : 'text-fg-subtle')} />
          <span className={cn('truncate text-[12.5px]', selected ? 'font-medium text-fg' : 'text-fg-muted group-hover:text-fg')}>{s.name}</span>
          {s.locked && <Lock className="size-3 shrink-0 text-fg-subtle" aria-label="Locked" />}
        </button>
      )}
      <IconButton size="xs" label={s.enabled ? `Hide ${s.name}` : `Show ${s.name}`} onClick={() => toggleEnabled(s.id)} className={cn(s.enabled && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100')}>
        {s.enabled ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
      </IconButton>
      <Menu
        label={`${s.name} actions`}
        trigger={(p) => (
          <IconButton size="xs" label={`More actions for ${s.name}`} {...p} className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100">
            <MoreHorizontal className="size-3.5" />
          </IconButton>
        )}
        items={[
          { label: 'Rename', icon: <Pencil />, hint: 'F2', onSelect: () => setRenaming(true) },
          { label: 'Duplicate', icon: <Copy />, onSelect: () => duplicate(s.id), disabled: def.singleton === true },
          { label: s.locked ? 'Unlock' : 'Lock', icon: s.locked ? <Unlock /> : <Lock />, onSelect: () => toggleLocked(s.id) },
          { label: 'Insert section below', icon: <Plus />, onSelect: onInsertBelow },
          'separator',
          { label: 'Move up', icon: <ArrowUp />, hint: 'Alt ↑', disabled: index === 0 || s.locked, onSelect: () => move(s.id, index - 1) },
          { label: 'Move down', icon: <ArrowDown />, hint: 'Alt ↓', disabled: index === count - 1 || s.locked, onSelect: () => move(s.id, index + 1) },
          'separator',
          { label: 'Delete', icon: <Trash2 />, danger: true, disabled: s.locked, onSelect: () => setConfirm(true) },
        ]}
      />
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={() => remove(s.id)} title={`Delete “${s.name}”?`} description="You can undo this with ⌘/Ctrl+Z or restore an earlier version from history." confirmLabel="Delete section" />
    </li>
  );
}
