import { useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, FileText, GripVertical, Library as LibraryIcon, Plus, Search, UploadCloud } from 'lucide-react';
import { IconButton } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/misc';
import { useEditor } from '@/stores/editor';
import { cn } from '@/utils/cn';
import { KIND_LABELS, KNOWLEDGE_MIME, LIBRARY_KINDS, type Candidate } from '@/knowledge/import/library-source';
import { startKnowledgeDrag, useKnowledgeDrag, useKnowledgeSources } from '@/features/knowledge/InsertFromLibrary';
import { ConfidenceBadge } from '@/features/knowledge/shared';
import { insertKnowledgeIntoBuilder, sectionTypeFor } from './knowledge';

/**
 * Builder sidebar: everything in Extract Your Data, ready to drag onto the canvas (or add with +).
 * Items land in the matching section, or a new one is created for them.
 */
export function KnowledgePanel() {
  const sources = useKnowledgeSources(LIBRARY_KINDS, true);
  const selected = useEditor((s) => s.selectedSectionId);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({ library: true });
  const needle = q.trim().toLowerCase();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-3 pb-2 pt-3">
        <SectionLabel>Extract Your Data</SectionLabel>
        <p className="mt-1 text-[11.5px] leading-snug text-fg-subtle">Drag an item onto the canvas, or press + to add it to the matching section.</p>
        <label className="relative mt-2 block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" />
          <input className="app-input !py-1.5 !pl-8" placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter knowledge" />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {!sources ? (
          <p className="px-2 py-4 text-[12px] text-fg-subtle">Loading…</p>
        ) : (
          sources.map((src) => {
            const items = src.items.filter((c) => !needle || `${c.label} ${c.sublabel}`.toLowerCase().includes(needle));
            if (src.type === 'doc' && !items.length) return null;
            const isOpen = open[src.id] ?? !!needle;
            return (
              <div key={src.id} className="mb-1">
                <button type="button" onClick={() => setOpen((o) => ({ ...o, [src.id]: !isOpen }))} aria-expanded={isOpen} className="flex w-full items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-left hover:bg-hover">
                  <ChevronRight className={cn('size-3.5 shrink-0 text-fg-subtle transition-transform', isOpen && 'rotate-90')} />
                  {src.type === 'library' ? <LibraryIcon className="size-3.5 shrink-0 text-accent" /> : <FileText className="size-3.5 shrink-0 text-[#ff6b6b]" />}
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{src.name}</span>
                  <span className="text-[11px] text-fg-subtle">{items.length}</span>
                </button>
                {isOpen &&
                  (items.length ? (
                    LIBRARY_KINDS.filter((k) => items.some((c) => c.kind === k)).map((k) => (
                      <div key={k} className="pb-1 pl-5">
                        <p className="px-1 pb-0.5 pt-1 text-[10.5px] font-semibold uppercase tracking-wider text-fg-subtle">{KIND_LABELS[k]}</p>
                        <ul className="space-y-0.5">
                          {items
                            .filter((c) => c.kind === k)
                            .map((c) => (
                              <KnowledgeRow key={c.key} c={c} fromDoc={src.type === 'doc'} onAdd={() => insertKnowledgeIntoBuilder([c], selected)} />
                            ))}
                        </ul>
                      </div>
                    ))
                  ) : (
                    <p className="px-7 py-1.5 text-[11.5px] text-fg-subtle">Empty — import a PDF to fill it.</p>
                  ))}
              </div>
            );
          })
        )}
        <Link to="/knowledge" className="mt-2 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong py-2.5 text-[12px] font-medium text-fg-muted transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent">
          <UploadCloud className="size-3.5" /> Import PDFs
        </Link>
      </div>
    </div>
  );
}

function KnowledgeRow({ c, fromDoc, onAdd }: { c: Candidate; fromDoc: boolean; onAdd: () => void }) {
  return (
    <li
      draggable
      onDragStart={(e) => startKnowledgeDrag(e, c)}
      onDragEnd={() => useKnowledgeDrag.setState({ dragging: null })}
      className="group flex cursor-grab items-center gap-1 rounded-lg border border-transparent px-1 py-1 hover:border-line hover:bg-bg active:cursor-grabbing"
      title={fromDoc && c.source ? `${c.source.docName} — Page ${c.source.page}` : undefined}
    >
      <GripVertical className="size-3.5 shrink-0 text-fg-subtle opacity-50 group-hover:opacity-100" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px]">{c.label || 'Untitled'}</span>
        {(c.sublabel || fromDoc) && (
          <span className="flex items-center gap-2">
            {c.sublabel && <span className="truncate text-[11px] text-fg-subtle">{c.sublabel}</span>}
            {fromDoc && c.confidence < 0.75 && <ConfidenceBadge value={c.confidence} />}
          </span>
        )}
      </span>
      <IconButton size="xs" label={`Add ${c.label} to ${KIND_LABELS[c.kind]}`} onClick={onAdd}>
        <Plus className="size-3.5" />
      </IconButton>
    </li>
  );
}

/**
 * Covers the canvas while a knowledge item is dragged (the preview is an iframe, which would
 * swallow the drop). Drops go to the selected section when it matches, else the matching one.
 */
export function KnowledgeDropOverlay() {
  const dragging = useKnowledgeDrag((s) => s.dragging);
  const selected = useEditor((s) => s.selectedSectionId);
  const sections = useEditor((s) => s.portfolio?.sections ?? []);
  const [over, setOver] = useState(false);
  if (!dragging) return null;
  const type = sectionTypeFor(dragging.kind);
  const target = sections.find((s) => s.id === selected && s.type === type) ?? sections.find((s) => s.type === type);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    useKnowledgeDrag.setState({ dragging: null });
    let c: Candidate | null = null;
    try {
      c = JSON.parse(e.dataTransfer.getData(KNOWLEDGE_MIME)) as Candidate;
    } catch {
      c = dragging;
    }
    if (c) insertKnowledgeIntoBuilder([c], selected);
  };
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setOver(true);
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOver(false)}
      onDrop={onDrop}
      className={cn('absolute inset-3 z-30 grid place-items-center rounded-2xl border-2 border-dashed backdrop-blur-[2px] transition-colors', over ? 'border-accent bg-accent-soft/70' : 'border-accent/50 bg-bg/40')}
    >
      <div className="rounded-2xl border border-line bg-panel px-5 py-4 text-center shadow-float">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">{KIND_LABELS[dragging.kind]}</p>
        <p className="mt-1 text-[14px] font-semibold">{dragging.label || 'Untitled'}</p>
        <p className="mt-1 text-[12px] text-fg-muted">{target ? `Drop to add it to “${target.name}”` : `Drop to create a ${KIND_LABELS[dragging.kind]} section`}</p>
      </div>
    </div>
  );
}
