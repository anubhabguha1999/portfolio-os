import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, Eye, FileText, LayoutPanelLeft, Mail, Settings2, SlidersHorizontal } from 'lucide-react';
import { Button, Spinner } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/misc';
import { BRAND } from '@/config/brand';
import { useDocumentEditor } from '@/studio/store/document-editor';
import { ensureWorkspace, useWorkspace } from '@/studio/store/workspace';
import { composeStudioDocument, documentMetaDefaults } from '@/studio/model/compose-document';
import { kindLabel } from '@/studio/templates/document';
import { registerImageAspect } from '@/studio/templates/document/blocks';
import { getImage } from '@/studio/storage/repo';
import { PagedCanvas, resolveZoom, useContainerSize, type ZoomMode } from '../shared/PagedCanvas';
import { ZoomControl } from '../shared/ZoomControl';
import { StudioTopBar, EditableTitle } from '../shared/StudioTopBar';
import { PrintPreviewDialog } from '../shared/PrintPreviewDialog';
import { ExportDialog } from '../shared/ExportDialog';
import { ExportQueuePanel } from '../shared/ExportQueuePanel';
import { BlockOutline, BlockPalette } from './BlocksPanel';
import { BlockEditor } from './BlockEditor';
import { DocSettingsPanel } from './DocSettingsPanel';
import { LETTER_PARTS, LetterForm } from './LetterForm';
import { useDocumentLayout } from './useDocumentLayout';
import { templateName } from './templateName';
import { cn } from '@/utils/cn';

type MobilePane = 'blocks' | 'canvas' | 'props';

function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

export default function DocumentStudioPage() {
  const { id } = useParams();
  const status = useDocumentEditor((s) => s.status);
  const doc = useDocumentEditor((s) => s.doc);
  const error = useDocumentEditor((s) => s.error);
  const load = useDocumentEditor((s) => s.load);
  const [wsReady, setWsReady] = useState(useWorkspace.getState().loaded);

  useEffect(() => {
    void ensureWorkspace().then(() => setWsReady(true));
  }, []);
  useEffect(() => {
    if (id) void load(id);
    return () => void useDocumentEditor.getState().flush();
  }, [id, load]);

  useEffect(() => {
    if (doc) document.title = `${doc.name} — Document Studio — ${BRAND.name}`;
  }, [doc?.name, doc]);

  // Older image blocks may lack an aspect ratio; read it from the stored original.
  useEffect(() => {
    if (!doc) return;
    for (const b of doc.blocks) {
      if (b.kind !== 'image' || !b.src.startsWith('simg:') || (b as { aspect?: number }).aspect) continue;
      void getImage(b.src.slice(5)).then((rec) => rec && rec.height && registerImageAspect(b.src, rec.width / rec.height));
    }
  }, [doc]);

  if (status === 'missing' || status === 'error')
    return (
      <div className="grid h-dvh place-items-center bg-bg px-6 text-center">
        <div>
          <p className="text-[15px] font-semibold">{status === 'missing' ? 'Document not found' : 'This document could not be opened'}</p>
          {error && <p className="mt-1 text-[13px] text-fg-muted">{error}</p>}
          <Link to="/documents" className="mt-5 inline-flex h-9 items-center rounded-lg bg-accent px-4 text-[13px] font-semibold text-accent-fg">
            Back to documents
          </Link>
        </div>
      </div>
    );
  if (!doc || !wsReady || doc.id !== id)
    return (
      <div className="grid h-dvh place-items-center bg-bg text-fg-subtle" role="status" aria-label="Loading document">
        <Spinner className="size-5" />
      </div>
    );
  return <Editor />;
}

function Editor() {
  const doc = useDocumentEditor((s) => s.doc)!;
  const selected = useDocumentEditor((s) => s.selected);
  const select = useDocumentEditor((s) => s.select);
  const saveState = useDocumentEditor((s) => s.saveState);
  const past = useDocumentEditor((s) => s.past.length);
  const future = useDocumentEditor((s) => s.future.length);
  const undo = useDocumentEditor((s) => s.undo);
  const redo = useDocumentEditor((s) => s.redo);
  const rename = useDocumentEditor((s) => s.rename);
  const updatePage = useDocumentEditor((s) => s.updatePage);
  const updateMeta = useDocumentEditor((s) => s.updateMeta);
  const setFileName = useDocumentEditor((s) => s.setFileName);
  const profile = useWorkspace((s) => s.profile);
  const library = useWorkspace((s) => s.library);
  const isLetter = doc.kind === 'cover-letter';
  const { laid, imageUrl } = useDocumentLayout(doc);
  const [zoom, setZoom] = useState<ZoomMode>('fit-width');
  const [preview, setPreview] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [rightTab, setRightTab] = useState<'block' | 'document'>('document');
  const [pane, setPane] = useState<MobilePane>('canvas');
  const [canvasRef, canvasSize] = useContainerSize<HTMLDivElement>();

  const selectedBlock = useMemo(() => doc.blocks.find((b) => b.id === selected) ?? null, [doc.blocks, selected]);
  useEffect(() => {
    setRightTab(selected ? 'block' : 'document');
  }, [selected]);

  const exportFlow = useCallback(() => composeStudioDocument(useDocumentEditor.getState().doc!, useWorkspace.getState().profile, useWorkspace.getState().library), []);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const st = useDocumentEditor.getState();
      if (mod && e.key.toLowerCase() === 'z' && !isTyping(e.target)) {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
      } else if (mod && e.key.toLowerCase() === 'y' && !isTyping(e.target)) {
        e.preventDefault();
        st.redo();
      } else if (mod && e.key.toLowerCase() === 'd' && st.selected && !isTyping(e.target) && !isLetter) {
        e.preventDefault();
        st.duplicateBlock(st.selected);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && st.selected && !isTyping(e.target) && !isLetter && st.doc?.blocks.some((b) => b.id === st.selected)) {
        e.preventDefault();
        st.removeBlock(st.selected);
      } else if (e.key === 'Escape' && !isTyping(e.target) && !preview) st.select(null);
      else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.altKey && st.selected && !isTyping(e.target) && st.doc) {
        e.preventDefault();
        const i = st.doc.blocks.findIndex((b) => b.id === st.selected);
        if (i >= 0) st.moveBlock(st.selected, i + (e.key === 'ArrowDown' ? 1 : -1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isLetter, preview]);

  const effectiveZoom = laid ? resolveZoom(zoom, laid, canvasSize) : 1;
  const label = isLetter ? 'Cover_Letter' : doc.name;

  const left = (
    <div className="space-y-5 p-3">
      {isLetter ? (
        <div>
          <SectionLabel className="mb-2 px-1">Letter</SectionLabel>
          <ul className="space-y-0.5">
            {LETTER_PARTS.map((p) => (
              <li key={p.ref}>
                <button
                  type="button"
                  onClick={() => {
                    select(p.ref);
                    setPane('props');
                  }}
                  className={cn('flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px]', selected === p.ref ? 'bg-accent-soft text-accent' : 'text-fg-muted hover:bg-hover hover:text-fg')}
                >
                  <Mail className="size-3.5 opacity-60" /> {p.label}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 px-1 text-[11.5px] leading-snug text-fg-subtle">Click any part of the letter on the page to edit it.</p>
        </div>
      ) : (
        <>
          <BlockPalette onAdded={() => setPane('props')} />
          <div>
            <SectionLabel className="mb-1.5 px-1">Outline · {doc.blocks.length}</SectionLabel>
            <BlockOutline onPicked={() => setPane('props')} />
          </div>
        </>
      )}
    </div>
  );

  const right = (
    <div className="flex h-full min-h-0 flex-col">
      {!isLetter && (
        <div role="tablist" aria-label="Properties" className="flex shrink-0 border-b border-line px-2">
          {(
            [
              ['block', 'Block', <SlidersHorizontal key="b" className="size-3.5" />],
              ['document', 'Document', <Settings2 key="d" className="size-3.5" />],
            ] as const
          ).map(([v, l, icon]) => (
            <button key={v} role="tab" aria-selected={rightTab === v} onClick={() => setRightTab(v)} className={cn('-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[12.5px]', rightTab === v ? 'border-accent text-fg' : 'border-transparent text-fg-muted hover:text-fg')}>
              {icon}
              {l}
            </button>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLetter ? (
          <>
            <LetterForm doc={doc} />
            <DocSettingsPanel doc={doc} />
          </>
        ) : rightTab === 'block' ? (
          selectedBlock ? (
            <BlockEditor key={selectedBlock.id} block={selectedBlock} />
          ) : (
            <div className="px-5 py-10 text-center text-[12.5px] leading-relaxed text-fg-subtle">
              Select a block on the page or in the outline to edit it.
              <br />
              <span className="text-[11.5px]">Tip: ⌘D duplicates, Delete removes, ⌥↑/↓ moves.</span>
            </div>
          )
        ) : (
          <DocSettingsPanel doc={doc} />
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh flex-col bg-bg text-fg">
      <StudioTopBar
        studio="Document Studio"
        back={{ to: '/documents', label: 'All documents' }}
        title={<EditableTitle value={doc.name} onChange={rename} label="Document name" />}
        save={saveState}
        undo={{ canUndo: past > 0, canRedo: future > 0, onUndo: undo, onRedo: redo }}
        center={
          <span className="text-[11.5px] text-fg-subtle">
            {kindLabel(doc.kind)} · {templateName(doc)} · {laid ? `${laid.pages.length} page${laid.pages.length === 1 ? '' : 's'}` : '…'}
          </span>
        }
        actions={
          <>
            <Button size="sm" variant="ghost" icon={<Eye className="size-4" />} onClick={() => setPreview(true)} disabled={!laid}>
              <span className="hidden sm:inline">Preview</span>
            </Button>
            <Button size="sm" variant="primary" icon={<Download className="size-4" />} onClick={() => setExporting(true)} disabled={!laid}>
              Export
            </Button>
          </>
        }
      />
      <div className="flex min-h-0 flex-1">
        <aside aria-label={isLetter ? 'Letter parts' : 'Blocks'} className={cn('w-[268px] shrink-0 overflow-y-auto border-r border-line bg-panel', pane === 'blocks' ? 'max-lg:flex-1 max-lg:w-auto' : 'max-lg:hidden')}>
          {left}
        </aside>
        <main className={cn('relative flex min-w-0 flex-1 flex-col', pane !== 'canvas' && 'max-lg:hidden')}>
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-line bg-panel/60 px-3">
            <span className="font-mono text-[11px] text-fg-subtle">
              {laid ? `${Math.round(laid.width)} × ${Math.round(laid.height)} mm · ${laid.pages.length} page${laid.pages.length === 1 ? '' : 's'}` : ''}
            </span>
            <ZoomControl zoom={zoom} onChange={setZoom} effective={effectiveZoom} />
          </div>
          <div ref={canvasRef} className="min-h-0 flex-1">
            {laid ? (
              <PagedCanvas
                laid={laid}
                zoom={zoom}
                imageUrl={imageUrl}
                selectedRef={selected}
                onSelectRef={(ref) => {
                  select(ref);
                  if (ref) setPane('props');
                }}
                onZoomChange={setZoom}
              />
            ) : (
              <div className="grid h-full place-items-center">
                <Spinner />
              </div>
            )}
          </div>
        </main>
        <aside aria-label="Properties" className={cn('w-[340px] shrink-0 border-l border-line bg-panel', pane === 'props' ? 'max-lg:flex-1 max-lg:w-auto' : 'max-lg:hidden')}>
          {right}
        </aside>
      </div>
      <nav aria-label="Panels" className="grid shrink-0 grid-cols-3 border-t border-line bg-panel lg:hidden">
        {(
          [
            ['blocks', isLetter ? 'Parts' : 'Blocks', <LayoutPanelLeft key="a" className="size-4" />],
            ['canvas', 'Page', <FileText key="b" className="size-4" />],
            ['props', 'Properties', <SlidersHorizontal key="c" className="size-4" />],
          ] as const
        ).map(([v, l, icon]) => (
          <button key={v} type="button" onClick={() => setPane(v)} aria-pressed={pane === v} className={cn('flex h-12 flex-col items-center justify-center gap-0.5 text-[11px]', pane === v ? 'text-accent' : 'text-fg-muted')}>
            {icon}
            {l}
          </button>
        ))}
      </nav>

      {preview && laid && (
        <PrintPreviewDialog
          laid={laid}
          imageUrl={imageUrl}
          title={doc.name}
          onClose={() => setPreview(false)}
          actions={
            <Button
              size="sm"
              variant="primary"
              icon={<Download className="size-4" />}
              onClick={() => {
                setPreview(false);
                setExporting(true);
              }}
            >
              Export
            </Button>
          }
        />
      )}
      {laid && (
        <ExportDialog
          open={exporting}
          onClose={() => setExporting(false)}
          title={`Export ${kindLabel(doc.kind)}`}
          label={label}
          personName={profile.name}
          fileName={doc.fileName}
          onFileName={setFileName}
          page={{ paper: doc.page.paper, orientation: doc.page.orientation, margins: doc.page.margins, pageNumbers: doc.page.pageNumbers }}
          onPage={(p) => updatePage(p)}
          allowOrientation={!isLetter}
          meta={doc.meta}
          metaDefaults={documentMetaDefaults(doc, profile)}
          onMeta={updateMeta}
          hasPhoto={laid.stats.images > 0}
          laid={laid}
          getFlow={exportFlow}
          getJson={() => ({ format: 'portfolio-os-document', version: 1, document: useDocumentEditor.getState().doc, library: library })}
          formats={['pdf', 'docx', 'txt']}
        />
      )}
      <ExportQueuePanel />
    </div>
  );
}
