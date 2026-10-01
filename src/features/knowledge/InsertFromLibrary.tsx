import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Check, FileText, GripVertical, Heading, Library as LibraryIcon, List, Search, Table } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Segmented } from '@/components/ui/Field';
import { Badge, EmptyState } from '@/components/ui/misc';
import { create } from 'zustand';
import { useWorkspace } from '@/studio/store/workspace';
import type { LibraryKind } from '@/studio/model/types';
import { cn } from '@/utils/cn';
import { KIND_LABELS, KNOWLEDGE_MIME, loadKnowledgeSources, type Candidate, type KnowledgeSource, type TextCandidate } from '@/knowledge/import/library-source';
import { ConfidenceBadge, docTypeLabel } from './shared';
import type { DocumentType } from '@/knowledge/types';

/** Loads the sources once per open; reloads when the shared library changes. */
export function useKnowledgeSources(kinds: LibraryKind[], active: boolean, text = false) {
  const profile = useWorkspace((s) => s.profile);
  const library = useWorkspace((s) => s.library);
  const [sources, setSources] = useState<KnowledgeSource[] | null>(null);
  const kindKey = kinds.join();
  useEffect(() => {
    if (!active) return;
    let live = true;
    void useWorkspace
      .getState()
      .init()
      .then(() => loadKnowledgeSources(kindKey.split(',') as LibraryKind[], useWorkspace.getState().profile, useWorkspace.getState().library, { text }))
      .then((s) => live && setSources(s))
      .catch(() => live && setSources([]));
    return () => {
      live = false;
    };
  }, [active, kindKey, text, profile, library]);
  return sources;
}

/** The item being dragged from a Knowledge list: drop targets behind iframes need it to show. */
export const useKnowledgeDrag = create<{ dragging: Candidate | null }>()(() => ({ dragging: null }));

export function startKnowledgeDrag(e: DragEvent, c: Candidate) {
  useKnowledgeDrag.setState({ dragging: c });
  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData(KNOWLEDGE_MIME, JSON.stringify(c));
  e.dataTransfer.setData('text/plain', [c.label, c.sublabel].filter(Boolean).join(' — '));
}

export function SourceLine({ source, className }: { source: Candidate['source']; className?: string }) {
  if (!source) return null;
  return (
    <Link to={`/knowledge/${source.docId}?page=${source.page}${source.blockId ? `&block=${source.blockId}` : ''}`} className={cn('inline-flex items-center gap-1 text-[11px] text-fg-subtle hover:text-accent hover:underline', className)} title="Open the source page">
      <FileText className="size-3" aria-hidden="true" /> {source.docName} — Page {source.page}
    </Link>
  );
}

const TEXT_ICON: Record<TextCandidate['type'], ReactNode> = { heading: <Heading className="size-3.5" />, paragraph: <FileText className="size-3.5" />, list: <List className="size-3.5" />, table: <Table className="size-3.5" /> };

export interface InsertPick {
  items: Candidate[];
  text: TextCandidate[];
}

/**
 * "+ Insert from Library": pick approved library items, detections from any extracted document,
 * or (with `text`) raw text blocks. Already-used items are marked; nothing is written until Insert.
 */
export function InsertFromLibraryDialog({
  open,
  onClose,
  kinds,
  title = 'Insert from Library',
  text = false,
  used = [],
  onInsert,
}: {
  open: boolean;
  onClose: () => void;
  kinds: LibraryKind[];
  title?: string;
  /** Offer document text blocks too (documents, cover letters). */
  text?: boolean;
  /** Library ids already in the target; shown as "Added". */
  used?: string[];
  onInsert: (pick: InsertPick) => void;
}) {
  const sources = useKnowledgeSources(kinds, open, text);
  const [sourceId, setSourceId] = useState<string>('library');
  const [mode, setMode] = useState<'items' | 'text'>('items');
  const [kind, setKind] = useState<LibraryKind | 'all'>('all');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setPicked(new Set());
    setQ('');
  }, [open]);
  // Start on the first document when the library has nothing to offer.
  useEffect(() => {
    if (!sources) return;
    const lib = sources.find((s) => s.id === 'library');
    if (!sources.some((s) => s.id === sourceId)) setSourceId('library');
    else if (sourceId === 'library' && !lib?.items.length && sources[1]) setSourceId(sources[1].id);
  }, [sources]);

  const source = sources?.find((s) => s.id === sourceId) ?? null;
  const usedSet = useMemo(() => new Set(used), [used]);
  const needle = q.trim().toLowerCase();
  const items = (source?.items ?? []).filter((c) => (kind === 'all' || c.kind === kind) && (!needle || `${c.label} ${c.sublabel}`.toLowerCase().includes(needle)));
  const texts = (source?.text ?? []).filter((t) => !needle || t.text.toLowerCase().includes(needle));
  const showText = text && source?.type === 'doc' && mode === 'text';
  const allPicked = [...(sources ?? []).flatMap((s) => s.items), ...(sources ?? []).flatMap((s) => s.text)].filter((x) => picked.has(x.key));

  const toggle = (key: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const insert = () => {
    const all = sources ?? [];
    onInsert({ items: all.flatMap((s) => s.items).filter((c) => picked.has(c.key)), text: all.flatMap((s) => s.text).filter((t) => picked.has(t.key)) });
    onClose();
  };

  const kindsPresent = kinds.filter((k) => source?.items.some((c) => c.kind === k));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description="Reuse approved library items or information extracted from your local documents. Everything stays on this device."
      size="xl"
      bodyClassName="!p-0"
      footer={
        <>
          <Link to="/knowledge" className="mr-auto text-[12px] font-medium text-accent hover:underline">
            Open Extract Your Data
          </Link>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!allPicked.length} onClick={insert}>
            Insert{allPicked.length ? ` ${allPicked.length}` : ''}
          </Button>
        </>
      }
    >
      {!sources ? (
        <p className="px-5 py-10 text-center text-[12.5px] text-fg-subtle">Loading local knowledge…</p>
      ) : (
        <div className="grid min-h-[420px] md:grid-cols-[220px_minmax(0,1fr)]">
          <nav aria-label="Sources" className="border-b border-line p-2 md:border-b-0 md:border-r">
            <p className="px-2 pb-1.5 pt-1 text-[10.5px] font-semibold uppercase tracking-wider text-fg-subtle">Sources</p>
            <ul className="flex gap-1 overflow-x-auto md:block md:space-y-0.5">
              {sources.map((s) => {
                const n = s.items.length + (text ? s.text.length : 0);
                const sel = picked.size ? [...s.items, ...s.text].filter((x) => picked.has(x.key)).length : 0;
                return (
                  <li key={s.id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => setSourceId(s.id)}
                      aria-current={s.id === sourceId || undefined}
                      className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left', s.id === sourceId ? 'bg-accent-soft text-accent' : 'hover:bg-hover')}
                    >
                      {s.type === 'library' ? <LibraryIcon className="size-4 shrink-0" /> : <FileText className="size-4 shrink-0 text-[#ff6b6b]" />}
                      <span className="min-w-0 flex-1">
                        <span className="block max-w-[160px] truncate text-[12.5px] font-medium">{s.name}</span>
                        <span className="block text-[11px] text-fg-subtle">
                          {s.docType ? `${docTypeLabel(s.docType as DocumentType)} · ` : ''}
                          {n} item{n === 1 ? '' : 's'}
                        </span>
                      </span>
                      {sel > 0 && <Badge tone="accent">{sel}</Badge>}
                    </button>
                  </li>
                );
              })}
            </ul>
            {sources.length === 1 && (
              <p className="px-2 pt-3 text-[11.5px] leading-snug text-fg-subtle">
                No extracted documents yet.{' '}
                <Link to="/knowledge" className="font-medium text-accent hover:underline">
                  Import a PDF
                </Link>{' '}
                to reuse its experience, projects and skills here.
              </p>
            )}
          </nav>
          <div className="flex min-h-0 flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
              <label className="relative min-w-[180px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" />
                <input className="app-input !pl-8" placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter items" />
              </label>
              {text && source?.type === 'doc' && (
                <Segmented
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: 'items', label: 'Structured' },
                    { value: 'text', label: 'Text' },
                  ]}
                />
              )}
              {!showText && kindsPresent.length > 1 && (
                <Segmented value={kind} onChange={setKind} options={[{ value: 'all' as const, label: 'All' }, ...kindsPresent.map((k) => ({ value: k, label: KIND_LABELS[k] }))]} />
              )}
            </div>
            <div className="max-h-[56dvh] min-h-0 flex-1 overflow-y-auto p-2">
              {showText ? (
                texts.length ? (
                  <ul className="space-y-1">
                    {texts.map((t) => (
                      <Row key={t.key} checked={picked.has(t.key)} onToggle={() => toggle(t.key)} icon={TEXT_ICON[t.type]}>
                        <span className={cn('block whitespace-pre-line text-[12.5px] leading-snug', t.type === 'heading' && 'font-semibold')}>{t.text.length > 360 ? `${t.text.slice(0, 360)}…` : t.text}</span>
                        <SourceLine source={t.source} />
                      </Row>
                    ))}
                  </ul>
                ) : (
                  <EmptyState icon={<FileText className="size-5" />} title="No text blocks" description="This extraction has no paragraphs, lists or tables." />
                )
              ) : items.length ? (
                <ul className="space-y-1">
                  {items.map((c) => {
                    const isUsed = !!c.libraryId && usedSet.has(c.libraryId);
                    return (
                      <Row key={c.key} checked={picked.has(c.key)} onToggle={() => toggle(c.key)} draggable onDragStart={(e) => startKnowledgeDrag(e, c)}>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="truncate text-[13px] font-medium">{c.label || 'Untitled'}</span>
                          {kinds.length > 1 && <span className="text-[10.5px] uppercase tracking-wide text-fg-subtle">{KIND_LABELS[c.kind]}</span>}
                          {isUsed ? (
                            <Badge tone="ok">
                              <Check className="size-3" /> Added
                            </Badge>
                          ) : (
                            source?.type === 'doc' && c.libraryId && <Badge>In library</Badge>
                          )}
                        </span>
                        {c.sublabel && <span className="block truncate text-[11.5px] text-fg-muted">{c.sublabel}</span>}
                        {source?.type === 'doc' && (
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-3">
                            <ConfidenceBadge value={c.confidence} />
                            <SourceLine source={c.source} />
                          </span>
                        )}
                      </Row>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState
                  icon={<BookOpen className="size-5" />}
                  title={source?.type === 'library' ? 'Nothing in your library yet' : 'Nothing detected here'}
                  description={source?.type === 'library' ? 'Pick a document on the left, or import a PDF to start your library.' : `No ${kinds.map((k) => KIND_LABELS[k].toLowerCase()).join(' or ')} were detected in this document.`}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function Row({ checked, onToggle, icon, children, draggable, onDragStart }: { checked: boolean; onToggle: () => void; icon?: ReactNode; children: ReactNode; draggable?: boolean; onDragStart?: (e: DragEvent) => void }) {
  return (
    <li draggable={draggable} onDragStart={onDragStart} onDragEnd={() => useKnowledgeDrag.setState({ dragging: null })} className={cn('group flex items-start gap-2 rounded-xl border px-2.5 py-2 transition-colors', checked ? 'border-accent/50 bg-accent-soft/50' : 'border-line hover:border-line-strong')}>
      <input type="checkbox" checked={checked} onChange={onToggle} className="mt-0.5 size-4 shrink-0 accent-[var(--app-accent)]" aria-label="Select" />
      {icon && <span className="mt-0.5 shrink-0 text-fg-subtle">{icon}</span>}
      {/* The checkbox is the control; the body is a larger click target that keeps source links usable. */}
      <div onClick={(e) => !(e.target as HTMLElement).closest('a') && onToggle()} className="min-w-0 flex-1 cursor-pointer text-left">
        {children}
      </div>
      {draggable && <GripVertical className="mt-0.5 size-3.5 shrink-0 cursor-grab text-fg-subtle opacity-0 group-hover:opacity-100" aria-hidden="true" />}
    </li>
  );
}
