import { useState } from 'react';
import { ChevronRight, Copy, GripVertical, Plus, Trash2 } from 'lucide-react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { FieldDef } from '@/types/fields';
import type { PathKey } from '@/utils/path';
import { moveItem } from '@/utils/path';
import { uid } from '@/utils/id';
import { IconButton } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import { FieldRenderer, type FieldChange } from './FieldRenderer';

type ListDef = Extract<FieldDef, { kind: 'list' }>;
type Item = Record<string, unknown>;

function keyOf(item: Item, index: number): string {
  return typeof item.id === 'string' && item.id ? item.id : `idx-${index}`;
}

export function ListField({ field, items, path, onChange, disabled }: { field: ListDef; items: Item[]; path: PathKey[]; onChange: FieldChange; disabled?: boolean }) {
  const [open, setOpen] = useState<string | null>(items.length === 1 ? keyOf(items[0]!, 0) : null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const keys = items.map(keyOf);

  const setItems = (next: Item[]) => onChange(path, next);

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = keys.indexOf(String(e.active.id));
    const to = keys.indexOf(String(e.over.id));
    if (from >= 0 && to >= 0) setItems(moveItem(items, from, to));
  };

  const add = () => {
    const item = field.createItem();
    setItems([...items, item]);
    setOpen(keyOf(item, items.length));
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="app-label !mb-0">
          {field.label} <span className="font-normal text-fg-subtle">· {items.length}</span>
        </span>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={keys} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1.5">
            {items.map((item, i) => (
              <SortableItem
                key={keys[i]}
                id={keys[i]!}
                field={field}
                item={item}
                index={i}
                open={open === keys[i]}
                onToggle={() => setOpen(open === keys[i] ? null : keys[i]!)}
                path={[...path, i]}
                onChange={onChange}
                disabled={disabled}
                onDuplicate={() => {
                  const copy = { ...structuredClone(item), ...('id' in item ? { id: uid('itm') } : {}) };
                  const next = [...items];
                  next.splice(i + 1, 0, copy);
                  setItems(next);
                }}
                onDelete={() => setItems(items.filter((_, j) => j !== i))}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <button
        type="button"
        disabled={disabled}
        onClick={add}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line-strong py-2 text-[12px] font-medium text-fg-muted transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent disabled:opacity-40"
      >
        <Plus className="size-3.5" /> Add {field.itemLabel.toLowerCase()}
      </button>
    </div>
  );
}

function SortableItem({
  id,
  field,
  item,
  index,
  open,
  onToggle,
  path,
  onChange,
  disabled,
  onDuplicate,
  onDelete,
}: {
  id: string;
  field: ListDef;
  item: Item;
  index: number;
  open: boolean;
  onToggle: () => void;
  path: PathKey[];
  onChange: FieldChange;
  disabled?: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const title = String(item[field.titleKey] ?? '').trim() || `${field.itemLabel} ${index + 1}`;
  const subtitle = field.subtitleKey ? String(item[field.subtitleKey] ?? '').trim() : '';
  const bodyId = `list-body-${id}`;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('rounded-xl border bg-bg/60 transition-colors', open ? 'border-line-strong' : 'border-line', isDragging && 'relative z-10 shadow-float')}
    >
      <div className="flex items-center gap-1 py-1 pl-1 pr-1.5">
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="grid size-7 shrink-0 cursor-grab place-items-center rounded-md text-fg-subtle hover:bg-hover hover:text-fg active:cursor-grabbing"
          aria-label={`Reorder ${title}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
        <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={bodyId} className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-1 text-left hover:bg-hover">
          <ChevronRight className={cn('size-3.5 shrink-0 text-fg-subtle transition-transform', open && 'rotate-90')} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium">{title}</span>
            {subtitle && <span className="block truncate text-[11.5px] text-fg-subtle">{subtitle}</span>}
          </span>
        </button>
        <IconButton size="xs" label={`Duplicate ${title}`} onClick={onDuplicate} disabled={disabled}>
          <Copy className="size-3" />
        </IconButton>
        <IconButton size="xs" label={`Delete ${title}`} onClick={onDelete} disabled={disabled} className="hover:!text-danger">
          <Trash2 className="size-3" />
        </IconButton>
      </div>
      {open && (
        <div id={bodyId} className="border-t border-line px-3 pb-3 pt-3">
          <FieldRenderer fields={field.fields} value={item} basePath={path} onChange={onChange} disabled={disabled} />
        </div>
      )}
    </li>
  );
}
