import type { ReactNode } from 'react';
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Briefcase,
  Code2,
  Columns3,
  Copy,
  FolderKanban,
  GripVertical,
  Heading,
  Image as ImageIcon,
  List,
  Megaphone,
  Minus,
  MoveVertical,
  PenLine,
  Quote,
  Scissors,
  Table2,
  Trash2,
  UserCircle2,
  Milestone,
  PanelBottom,
} from 'lucide-react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@/features/builder/dnd-modifiers';
import { IconButton } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/misc';
import { BLOCK_KINDS } from '@/studio/model/defaults';
import type { BlockKind, DocBlockNode } from '@/studio/model/types';
import { useDocumentEditor } from '@/studio/store/document-editor';
import { cn } from '@/utils/cn';
import { DocumentInsertFromLibrary } from './KnowledgeInsert';

export const BLOCK_ICONS: Record<BlockKind, ReactNode> = {
  heading: <Heading />,
  paragraph: <AlignLeft />,
  list: <List />,
  quote: <Quote />,
  callout: <Megaphone />,
  code: <Code2 />,
  image: <ImageIcon />,
  profile: <UserCircle2 />,
  table: <Table2 />,
  columns: <Columns3 />,
  divider: <Minus />,
  spacer: <MoveVertical />,
  pageBreak: <Scissors />,
  footer: <PanelBottom />,
  stats: <BarChart3 />,
  timeline: <Milestone />,
  project: <FolderKanban />,
  experience: <Briefcase />,
  signature: <PenLine />,
};

export function blockLabel(kind: BlockKind): string {
  return BLOCK_KINDS.find((k) => k.kind === kind)?.label ?? kind;
}

/** Short human summary for the outline. */
export function blockSummary(b: DocBlockNode): string {
  const clip = (s: string) => s.replace(/[*_[\]()#`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
  switch (b.kind) {
    case 'heading':
      return clip(b.text) || 'Heading';
    case 'paragraph':
    case 'quote':
    case 'footer':
      return clip(b.text) || '(empty)';
    case 'list':
      return `${b.items.length} item${b.items.length === 1 ? '' : 's'}`;
    case 'table':
      return `${b.rows.length} × ${Math.max(b.header.length, ...b.rows.map((r) => r.length))}`;
    case 'callout':
      return clip(b.title || b.text);
    case 'code':
      return b.language || 'code';
    case 'image':
      return b.caption || (b.src ? 'Image' : 'No image yet');
    case 'project':
      return b.libId ? 'Linked project' : clip(b.title);
    case 'experience':
      return b.libId ? 'Linked experience' : clip(`${b.role} · ${b.company}`);
    case 'timeline':
    case 'stats':
      return `${b.items.length} item${b.items.length === 1 ? '' : 's'}`;
    case 'columns':
      return `${b.count} columns`;
    case 'spacer':
      return `${b.height} mm`;
    case 'signature':
      return b.name || 'Signature';
    default:
      return '';
  }
}

export function BlockPalette({ onAdded }: { onAdded?: () => void }) {
  const add = useDocumentEditor((s) => s.addBlock);
  const selected = useDocumentEditor((s) => s.selected);
  const blocks = useDocumentEditor((s) => s.doc?.blocks ?? []);
  const groups = ['Text', 'Media', 'Layout', 'Career'] as const;
  const insertAt = () => {
    const i = blocks.findIndex((b) => b.id === selected);
    return i >= 0 ? i + 1 : undefined;
  };
  return (
    <div className="space-y-3.5">
      <DocumentInsertFromLibrary onDone={onAdded} />
      {groups.map((g) => (
        <div key={g}>
          <SectionLabel className="mb-1.5 px-1">{g}</SectionLabel>
          <div className="grid grid-cols-3 gap-1">
            {BLOCK_KINDS.filter((k) => k.group === g).map((k) => (
              <button
                key={k.kind}
                type="button"
                title={`Add ${k.label}${selected ? ' below selection' : ''}`}
                onClick={() => {
                  add(k.kind, insertAt());
                  onAdded?.();
                }}
                className="flex flex-col items-center gap-1 rounded-lg border border-line bg-bg px-1 py-2 text-[10.5px] text-fg-muted transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent [&_svg]:size-4"
              >
                {BLOCK_ICONS[k.kind]}
                <span className="w-full truncate text-center">{k.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function BlockOutline({ onPicked }: { onPicked?: () => void }) {
  const blocks = useDocumentEditor((s) => s.doc?.blocks ?? []);
  const selected = useDocumentEditor((s) => s.selected);
  const select = useDocumentEditor((s) => s.select);
  const move = useDocumentEditor((s) => s.moveBlock);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    move(String(e.active.id), blocks.findIndex((b) => b.id === e.over!.id));
  };
  if (!blocks.length) return <p className="px-1 py-3 text-[12px] leading-relaxed text-fg-subtle">No blocks yet. Add one from the palette above.</p>;
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis]}>
      <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-0.5" aria-label="Blocks — drag or use the move buttons to reorder">
          {blocks.map((b, i) => (
            <OutlineRow
              key={b.id}
              block={b}
              index={i}
              count={blocks.length}
              selected={b.id === selected}
              onSelect={() => {
                select(b.id);
                onPicked?.();
              }}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function OutlineRow({ block: b, index, count, selected, onSelect }: { block: DocBlockNode; index: number; count: number; selected: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: b.id });
  const move = useDocumentEditor((s) => s.moveBlock);
  const duplicate = useDocumentEditor((s) => s.duplicateBlock);
  const remove = useDocumentEditor((s) => s.removeBlock);
  const summary = blockSummary(b);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('group flex items-center gap-1 rounded-lg border px-1 py-1', selected ? 'border-accent/50 bg-accent-soft' : 'border-transparent hover:bg-hover', isDragging && 'z-10 border-line-strong bg-elevated shadow-float', b.kind === 'pageBreak' && 'border-dashed border-line')}
    >
      <button ref={setActivatorNodeRef} type="button" {...attributes} {...listeners} aria-label={`Drag ${blockLabel(b.kind)}`} className="grid size-6 shrink-0 cursor-grab place-items-center rounded text-fg-subtle hover:text-fg active:cursor-grabbing">
        <GripVertical className="size-3.5" />
      </button>
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-current={selected || undefined}>
        <span className={cn('shrink-0 [&_svg]:size-3.5', selected ? 'text-accent' : 'text-fg-subtle')}>{BLOCK_ICONS[b.kind]}</span>
        <span className="min-w-0">
          <span className="block truncate text-[12px] font-medium">{blockLabel(b.kind)}</span>
          {summary && <span className="block truncate text-[11px] text-fg-subtle">{summary}</span>}
        </span>
      </button>
      <div className={cn('flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100', selected && 'opacity-100')}>
        <IconButton label="Move up" size="xs" disabled={index === 0} onClick={() => move(b.id, index - 1)}>
          <ArrowUp className="size-3" />
        </IconButton>
        <IconButton label="Move down" size="xs" disabled={index === count - 1} onClick={() => move(b.id, index + 1)}>
          <ArrowDown className="size-3" />
        </IconButton>
        <IconButton label="Duplicate" size="xs" onClick={() => duplicate(b.id)}>
          <Copy className="size-3" />
        </IconButton>
        <IconButton label="Delete" size="xs" onClick={() => remove(b.id)}>
          <Trash2 className="size-3" />
        </IconButton>
      </div>
    </li>
  );
}
