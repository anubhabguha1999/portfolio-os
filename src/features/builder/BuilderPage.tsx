import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Layers as LayersIcon, Minimize, SlidersHorizontal, Eye, Download, X, Activity } from 'lucide-react';
import { useEditor } from '@/stores/editor';
import { useUI, toast } from '@/stores/ui';
import { useProject } from '@/hooks/useProject';
import { useAutosave } from '@/hooks/useAutosave';
import { useHotkeys } from '@/hooks/useHotkeys';
import { downloadBlob } from '@/utils/download';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Button, IconButton, Spinner } from '@/components/ui/Button';
import { TopBar } from './TopBar';
import { LayersPanel } from './LayersPanel';
import { KnowledgeDropOverlay, KnowledgePanel } from './KnowledgePanel';
import { Segmented } from '@/components/ui/Field';
import { Inspector } from './Inspector';
import { Canvas } from './Canvas';
import { CommandPalette } from './CommandPalette';
import { VersionHistoryDialog } from './VersionHistoryDialog';
import { ShortcutsDialog } from './ShortcutsDialog';
import { useBuilderCommands } from './useBuilderCommands';
import { ShareDialog } from '@/features/share/ShareDialog';
import { InsightsPanel } from '@/features/analysis/InsightsPanel';
import { ImportDialog } from '@/features/importers/ImportDialog';
import type { PreviewFrameHandle } from '@/features/preview/PreviewFrame';
import { cn } from '@/utils/cn';
import { usePortfolioProfileSync } from '@/features/studio/sync/ProfileLink';

export default function BuilderPage() {
  const { projectId } = useParams();
  const state = useProject(projectId);

  if (state.status === 'loading') {
    return (
      <div className="grid h-dvh place-items-center text-fg-subtle" role="status">
        <span className="flex items-center gap-2 text-[13px]">
          <Spinner /> Opening portfolio…
        </span>
      </div>
    );
  }
  if (state.status !== 'ready') {
    return (
      <div className="grid h-dvh place-items-center px-6">
        <div className="max-w-md text-center">
          <AlertTriangle className="mx-auto mb-3 size-7 text-warn" />
          <h1 className="text-[16px] font-semibold">{state.status === 'missing' ? 'Portfolio not found' : 'This portfolio could not be opened'}</h1>
          <p className="mt-2 text-[13px] text-fg-muted">
            {state.status === 'missing' ? 'It may have been deleted, or it was created in a different browser. Projects are stored locally on each device.' : state.message}
          </p>
          {state.status === 'error' && state.issues && (
            <pre className="mt-3 max-h-40 overflow-auto rounded-lg border border-line bg-bg p-3 text-left font-mono text-[11px] text-fg-muted">{state.issues.slice(0, 12).join('\n')}</pre>
          )}
          <Link to="/projects" className="mt-5 inline-flex h-9 items-center rounded-lg bg-accent px-4 text-[13px] font-semibold text-accent-fg">
            Back to my portfolios
          </Link>
        </div>
      </div>
    );
  }
  return <Builder projectId={projectId!} />;
}

function Builder({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const portfolio = useEditor((s) => s.portfolio)!;
  const projectName = useEditor((s) => s.projectName);
  const select = useEditor((s) => s.select);
  const rejection = useEditor((s) => s.rejection);
  const ui = useUI();
  const { saveNow } = useAutosave();
  usePortfolioProfileSync(projectId);
  const frame = useRef<PreviewFrameHandle>(null);
  const shell = useRef<HTMLDivElement>(null);

  // Rejected edits (e.g. locked sections) surface as a toast.
  useEffect(() => {
    if (rejection) toast({ tone: 'warning', title: rejection.message });
  }, [rejection]);

  // Deep link from the health check: /builder/:id?section=<id>
  useEffect(() => {
    const sec = params.get('section');
    if (sec && portfolio.sections.some((s) => s.id === sec)) {
      select(sec);
      ui.setInspectorTab('content');
      window.setTimeout(() => frame.current?.scrollToSection(sec), 400);
      params.delete('section');
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Selecting from the layers list / palette scrolls the canvas; canvas clicks don't.
  const selectedId = useEditor((s) => s.selectedSectionId);
  const pickedInCanvas = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedId) return;
    if (pickedInCanvas.current === selectedId) {
      pickedInCanvas.current = null;
      return;
    }
    frame.current?.scrollToSection(selectedId);
  }, [selectedId]);

  const onSelectFromCanvas = useCallback(
    (id: string) => {
      pickedInCanvas.current = id;
      select(id);
      if (ui.inspectorTab !== 'content' && ui.inspectorTab !== 'style') ui.setInspectorTab('content');
      if (window.matchMedia('(max-width: 1023px)').matches) ui.setMobilePanel('inspector');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [select, ui.inspectorTab],
  );

  const present = async () => {
    ui.setDevView('preview');
    ui.setFocusMode(true);
    try {
      await shell.current?.requestFullscreen?.();
    } catch {
      /* fullscreen not permitted — presentation still works in-page */
    }
    window.setTimeout(() => {
      frame.current?.present(true);
      frame.current?.focus();
    }, 150);
  };
  const exitPresent = () => {
    frame.current?.present(false);
    ui.setFocusMode(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  };
  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement && useUI.getState().focusMode) {
        frame.current?.present(false);
      }
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const exportJson = async () => {
    try {
      const { exportProjectJson } = await import('@/lib/export');
      const r = await exportProjectJson(useEditor.getState().portfolio!, projectName);
      downloadBlob(r.blob, r.filename);
      toast({ tone: 'success', title: 'Project exported', description: r.filename });
    } catch (err) {
      toast({ tone: 'error', title: 'Export failed', description: err instanceof Error ? err.message : String(err) });
    }
  };

  const commands = useBuilderCommands({ navigate, projectId, saveNow, present: () => void present(), print: () => frame.current?.print(), exportJson: () => void exportJson() });

  const anyDialog = ui.commandPaletteOpen || ui.historyOpen || ui.shareOpen || ui.importOpen || ui.shortcutsOpen;
  useHotkeys([
    { combo: 'mod+k', handler: (e) => { e.preventDefault(); ui.setCommandPalette(!ui.commandPaletteOpen); } },
    { combo: 'mod+s', handler: (e) => { e.preventDefault(); void saveNow(); } },
    { combo: 'mod+shift+z', handler: (e) => { if (anyDialog) return; e.preventDefault(); useEditor.getState().redo(); } },
    { combo: 'mod+y', handler: (e) => { if (anyDialog) return; e.preventDefault(); useEditor.getState().redo(); } },
    { combo: 'mod+z', handler: (e) => { if (anyDialog) return; e.preventDefault(); useEditor.getState().undo(); } },
    { combo: 'mod+p', handler: (e) => { e.preventDefault(); navigate(`/preview/${projectId}`); } },
    { combo: 'mod+e', handler: (e) => { e.preventDefault(); navigate(`/export/${projectId}`); } },
    { combo: 'mod+.', handler: (e) => { e.preventDefault(); ui.setFocusMode(!ui.focusMode); } },
    { combo: 'mod+/', handler: (e) => { e.preventDefault(); ui.setShortcutsOpen(true); } },
    {
      combo: 'escape',
      allowInInputs: false,
      handler: () => {
        if (anyDialog) return;
        if (ui.mobilePanel !== 'none') ui.setMobilePanel('none');
        else if (ui.focusMode) exitPresent();
        else if (ui.insightsOpen) ui.setInsightsOpen(false);
      },
    },
  ]);

  const rightPanel = ui.insightsOpen ? (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="flex items-center gap-2 text-[13px] font-semibold"><Activity className="size-4 text-accent" /> Insights</span>
        <IconButton size="xs" label="Close insights" onClick={() => ui.setInsightsOpen(false)}>
          <X className="size-3.5" />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ErrorBoundary area="Insights" compact>
          <InsightsPanel
            portfolio={portfolio}
            onSelectSection={(id) => {
              select(id);
              ui.setInsightsOpen(false);
              ui.setInspectorTab('content');
              frame.current?.scrollToSection(id);
            }}
          />
        </ErrorBoundary>
      </div>
    </div>
  ) : (
    <Inspector />
  );

  return (
    <div ref={shell} className="flex h-dvh flex-col overflow-hidden bg-bg">
      {!ui.focusMode && (
        <TopBar
          onPreview={() => navigate(`/preview/${projectId}`)}
          onExport={() => navigate(`/export/${projectId}`)}
          onDeploy={() => navigate(`/deploy/${projectId}`)}
          onPresent={() => void present()}
          onPrint={() => frame.current?.print()}
          onExportJson={() => void exportJson()}
          onOpenSettings={() => navigate('/settings')}
        />
      )}
      <div className={cn('grid min-h-0 flex-1', ui.focusMode ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-[248px_minmax(0,1fr)_340px] 2xl:grid-cols-[272px_minmax(0,1fr)_368px]')}>
        {!ui.focusMode && (
          <aside aria-label="Sections" className="hidden min-h-0 border-r border-line bg-panel lg:block">
            <ErrorBoundary area="Sections" compact>
              <LeftPanel />
            </ErrorBoundary>
          </aside>
        )}
        <main aria-label="Canvas" className="relative min-h-0 min-w-0 pb-[60px] lg:pb-0">
          <Canvas ref={frame} portfolio={portfolio} onSelect={onSelectFromCanvas} onPresentExit={exitPresent} />
          {!ui.focusMode && <KnowledgeDropOverlay />}
          {ui.focusMode && (
            <button onClick={exitPresent} className="absolute right-4 top-4 z-40 inline-flex items-center gap-1.5 rounded-full border border-line bg-panel/90 px-3 py-1.5 text-[12px] font-medium shadow-float backdrop-blur hover:bg-hover">
              <Minimize className="size-3.5" /> Exit <kbd className="app-kbd">Esc</kbd>
            </button>
          )}
        </main>
        {!ui.focusMode && (
          <aside aria-label="Inspector" className="hidden min-h-0 border-l border-line bg-panel lg:block">
            {rightPanel}
          </aside>
        )}
      </div>

      {/* Mobile: bottom toolbar + sheets instead of a squeezed desktop layout */}
      {!ui.focusMode && (
        <nav aria-label="Editor" className="fixed inset-x-0 bottom-0 z-40 flex h-[60px] items-stretch border-t border-line bg-panel/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
          {([
            ['sections', 'Sections', LayersIcon, () => ui.setMobilePanel(ui.mobilePanel === 'sections' ? 'none' : 'sections')],
            ['inspector', 'Edit', SlidersHorizontal, () => ui.setMobilePanel(ui.mobilePanel === 'inspector' ? 'none' : 'inspector')],
            ['preview', 'Preview', Eye, () => navigate(`/preview/${projectId}`)],
            ['export', 'Export', Download, () => navigate(`/export/${projectId}`)],
          ] as const).map(([key, label, Icon, onClick]) => (
            <button key={key} onClick={onClick} aria-pressed={ui.mobilePanel === key} className={cn('flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-medium', ui.mobilePanel === key ? 'text-accent' : 'text-fg-muted')}>
              <Icon className="size-[18px]" /> {label}
            </button>
          ))}
        </nav>
      )}
      {ui.mobilePanel !== 'none' && !ui.focusMode && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={ui.mobilePanel === 'sections' ? 'Sections' : 'Edit section'}>
          <button className="absolute inset-0 bg-black/45 backdrop-blur-sm" aria-label="Close panel" onClick={() => ui.setMobilePanel('none')} />
          <div className="absolute inset-x-0 bottom-0 flex h-[78dvh] flex-col rounded-t-2xl border-t border-line bg-panel shadow-float [animation:app-sheet_.28s_var(--ease-out-expo)]">
            <div className="flex items-center justify-between px-4 pt-2">
              <span className="mx-auto h-1 w-10 rounded-full bg-line-strong" aria-hidden="true" />
            </div>
            <div className="flex items-center justify-between px-4 pb-1">
              <span className="text-[13px] font-semibold">{ui.mobilePanel === 'sections' ? 'Sections' : 'Edit'}</span>
              <IconButton size="sm" label="Close" onClick={() => ui.setMobilePanel('none')}>
                <X className="size-4" />
              </IconButton>
            </div>
            <div className="min-h-0 flex-1">
              {ui.mobilePanel === 'sections' ? (
                <LayersPanel onPicked={() => ui.setMobilePanel('inspector')} />
              ) : (
                rightPanel
              )}
            </div>
          </div>
        </div>
      )}

      <CommandPalette open={ui.commandPaletteOpen} onClose={() => ui.setCommandPalette(false)} commands={commands} />
      <VersionHistoryDialog open={ui.historyOpen} onClose={() => ui.setHistoryOpen(false)} onSaveVersion={saveNow} />
      <ShortcutsDialog open={ui.shortcutsOpen} onClose={() => ui.setShortcutsOpen(false)} />
      {ui.shareOpen && <ShareDialog open onClose={() => ui.setShareOpen(false)} portfolio={portfolio} />}
      <ImportDialog open={ui.importOpen} onClose={() => ui.setImportOpen(false)} />
      <span className="sr-only" aria-live="polite">{`Editing ${projectName}`}</span>
      <Button className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[999]" onClick={() => ui.setCommandPalette(true)}>
        Open command palette
      </Button>
    </div>
  );
}

/** Desktop sidebar: the section list, or Extract Your Data items to drag onto the canvas. */
function LeftPanel() {
  const [tab, setTab] = useState<'sections' | 'knowledge'>('sections');
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-3 pt-2.5">
        <Segmented
          className="w-full [&>button]:flex-1"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'sections', label: 'Sections' },
            { value: 'knowledge', label: 'Extract Your Data' },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1">{tab === 'sections' ? <LayersPanel /> : <KnowledgePanel />}</div>
    </div>
  );
}
