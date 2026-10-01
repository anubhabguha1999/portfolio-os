import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Download, Eye, LayoutTemplate, ListChecks, Palette, PanelLeft, PanelRight, PencilLine, Ruler, Sparkles, FileText } from 'lucide-react';
import { Button, Spinner } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/misc';
import { useHotkeys } from '@/hooks/useHotkeys';
import { toast } from '@/stores/ui';
import { BRAND } from '@/config/brand';
import { useResumeEditor } from '@/studio/store/resume-editor';
import { useWorkspace } from '@/studio/store/workspace';
import { useImageUrls } from '@/studio/images/service';
import { fitLabel, fitToPages } from '@/studio/engine/fit';
import { sectionInfo } from '@/studio/model/defaults';
import { StudioTopBar, EditableTitle } from '../shared/StudioTopBar';
import { PagedCanvas, resolveZoom, useContainerSize, type ZoomMode } from '../shared/PagedCanvas';
import { ZoomControl } from '../shared/ZoomControl';
import { PrintPreviewDialog } from '../shared/PrintPreviewDialog';
import { ExportDialog } from '../shared/ExportDialog';
import { ExportQueuePanel } from '../shared/ExportQueuePanel';
import { SectionsPanel, SECTION_ICONS } from './SectionsPanel';
import { SectionEditor } from './SectionEditor';
import { ChecksPanel, DesignPanel, PagePanel } from './DesignPanels';
import { TemplateBrowser, applyTemplateStyle } from './TemplateBrowser';
import { composeResume, useResumeLayout } from './useResumeLayout';
import { cn } from '@/utils/cn';

type Tab = 'content' | 'design' | 'page' | 'checks';
type MobilePane = 'sections' | 'canvas' | 'properties';

const TABS: Array<{ id: Tab; label: string; icon: typeof PencilLine }> = [
  { id: 'content', label: 'Content', icon: PencilLine },
  { id: 'design', label: 'Design', icon: Palette },
  { id: 'page', label: 'Page', icon: Ruler },
  { id: 'checks', label: 'Checks', icon: ListChecks },
];

export default function ResumeStudioPage() {
  const { resumeId } = useParams();
  const status = useResumeEditor((s) => s.status);
  const resume = useResumeEditor((s) => s.resume);
  const load = useResumeEditor((s) => s.load);
  const selection = useResumeEditor((s) => s.selection);
  const saveState = useResumeEditor((s) => s.saveState);
  const canUndo = useResumeEditor((s) => s.past.length > 0);
  const canRedo = useResumeEditor((s) => s.future.length > 0);
  const ed = useResumeEditor.getState();
  const profile = useWorkspace((s) => s.profile);
  const library = useWorkspace((s) => s.library);

  const [tab, setTab] = useState<Tab>('content');
  const [zoom, setZoom] = useState<ZoomMode>('fit-width');
  const [preview, setPreview] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [fitting, setFitting] = useState(false);
  const [mobile, setMobile] = useState<MobilePane>('canvas');
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [canvasRef, canvasSize] = useContainerSize<HTMLDivElement>();

  useEffect(() => {
    if (resumeId) void load(resumeId);
  }, [resumeId, load]);

  useEffect(() => {
    if (resume) document.title = `${resume.name} — Resume Studio — ${BRAND.name}`;
  }, [resume?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => void useResumeEditor.getState().flush(), []);

  const layout = useResumeLayout(resume);
  const imageUrl = useImageUrls(layout?.imageKeys ?? []);
  const pages = layout?.laid.pages.length ?? 0;
  const limit = resume?.style.pageLimit ?? 0;

  const runFit = useCallback(
    (target: number) => {
      const r = useResumeEditor.getState().resume;
      if (!r) return;
      setFitting(true);
      // Let the spinner paint; fitting re-lays the document several times.
      setTimeout(() => {
        try {
          const { library: lib, profile: prof } = useWorkspace.getState();
          const res = fitToPages((fit) => composeResume(r, lib, prof, r.templateId, fit).flow, target);
          ed.setStyle({ fit: res.fit, ...(r.style.pageLimit === 0 ? {} : { pageLimit: target }) });
          toast({ tone: res.fits ? 'success' : 'warning', title: fitLabel(res), ...(res.fits ? {} : { description: 'Hide a section, trim bullets or choose the Compact template.' }) });
        } finally {
          setFitting(false);
        }
      }, 16);
    },
    [ed],
  );

  useHotkeys([
    { combo: 'mod+z', handler: (e) => (e.preventDefault(), ed.undo()) },
    { combo: 'mod+shift+z', handler: (e) => (e.preventDefault(), ed.redo()) },
    { combo: 'mod+y', handler: (e) => (e.preventDefault(), ed.redo()) },
    { combo: 'mod+s', handler: (e) => (e.preventDefault(), void ed.flush().then(() => toast({ tone: 'success', title: 'Saved on this device' }))) },
    { combo: 'mod+p', handler: (e) => (e.preventDefault(), setPreview(true)) },
    { combo: 'mod+e', handler: (e) => (e.preventDefault(), setExporting(true)) },
  ]);

  const selectedRef = selection.itemId ?? selection.sectionId;
  const selectedSection = resume?.sections.find((s) => s.id === selection.sectionId) ?? null;
  const effectiveZoom = layout ? resolveZoom(zoom, layout.laid, canvasSize) : 1;

  const pageStatus = useMemo(() => {
    if (!layout) return null;
    if (limit > 0 && pages <= limit)
      return (
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ok">
          <CheckCircle2 className="size-3.5" /> Fits on {pages} page{pages === 1 ? '' : 's'}
        </span>
      );
    if (limit > 0)
      return (
        <span className="inline-flex items-center gap-2 text-[12px] font-medium text-warn">
          <AlertTriangle className="size-3.5" /> {pages} pages required
          <Button size="xs" variant="primary" loading={fitting} icon={<Sparkles className="size-3" />} onClick={() => runFit(limit)}>
            Optimize
          </Button>
        </span>
      );
    return (
      <span className="text-[12px] text-fg-muted">
        {pages} page{pages === 1 ? '' : 's'}
      </span>
    );
  }, [layout, limit, pages, fitting, runFit]);

  if (status === 'loading' || status === 'idle')
    return (
      <div className="grid h-dvh place-items-center bg-bg" role="status" aria-label="Loading resume">
        <Spinner className="size-5 text-fg-subtle" />
      </div>
    );
  if (status !== 'ready' || !resume)
    return (
      <div className="grid h-dvh place-items-center bg-bg">
        <EmptyState icon={<FileText className="size-5" />} title="Resume not found" description="It may have been deleted on this device." action={<Link to="/resumes" className="inline-flex h-9 items-center rounded-lg bg-accent px-3.5 text-[13px] font-semibold text-accent-fg">All resumes</Link>} />
      </div>
    );

  const properties = (
    <div className="flex h-full min-h-0 flex-col">
      <div role="tablist" aria-label="Properties" className="flex shrink-0 gap-0.5 border-b border-line px-2 pt-2">
        {TABS.map((t) => (
          <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn('relative inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-t-lg text-[12.5px] font-medium', tab === t.id ? 'text-fg after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent' : 'text-fg-subtle hover:text-fg')}>
            <t.icon className="size-3.5" />
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {tab === 'content' &&
          (selectedSection ? (
            <>
              <div className="mb-4 flex items-center gap-2">
                {(() => {
                  const Icon = SECTION_ICONS[selectedSection.kind];
                  return <Icon className="size-4 text-accent" />;
                })()}
                <h2 className="text-[14px] font-semibold">{selectedSection.kind === 'profile' ? 'Profile & contact' : sectionInfo(selectedSection.kind).label}</h2>
              </div>
              <SectionEditor sectionId={selectedSection.id} />
            </>
          ) : (
            <EmptyState icon={<PencilLine className="size-5" />} title="Select something to edit" description="Click a section on the left, or click directly on the page." />
          ))}
        {tab === 'design' && <DesignPanel onBrowse={() => setBrowsing(true)} />}
        {tab === 'page' && <PagePanel layout={layout} onFit={runFit} fitting={fitting} />}
        {tab === 'checks' && <ChecksPanel layout={layout} resume={resume} />}
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh flex-col bg-bg text-fg">
      <StudioTopBar
        studio="Resume Studio"
        back={{ to: '/resumes', label: 'All resumes' }}
        title={<EditableTitle label="Resume name" value={resume.name} onChange={(v) => ed.apply('Rename', (r) => ({ ...r, name: v }))} />}
        save={saveState}
        undo={{ canUndo, canRedo, onUndo: ed.undo, onRedo: ed.redo }}
        center={
          <>
            {pageStatus}
            <span className="h-4 w-px bg-line" aria-hidden="true" />
            <ZoomControl zoom={zoom} onChange={setZoom} effective={effectiveZoom} />
          </>
        }
        actions={
          <>
            <Button size="sm" variant="ghost" icon={<LayoutTemplate className="size-4" />} onClick={() => setBrowsing(true)} className="max-sm:hidden">
              Templates
            </Button>
            <Button size="sm" variant="ghost" icon={<Eye className="size-4" />} onClick={() => setPreview(true)} className="max-sm:hidden">
              Preview
            </Button>
            <Button size="sm" variant="primary" icon={<Download className="size-4" />} onClick={() => setExporting(true)}>
              Export
            </Button>
          </>
        }
      />
      <div className="relative flex min-h-0 flex-1">
        <aside className={cn('w-[248px] shrink-0 border-r border-line bg-panel', leftOpen ? 'hidden md:block' : 'hidden', mobile === 'sections' && '!block absolute inset-0 z-20 w-full md:static md:w-[248px]')} aria-label="Sections">
          <SectionsPanel />
        </aside>
        <main className={cn('relative min-w-0 flex-1', mobile !== 'canvas' && 'max-md:hidden')}>
          <div className="absolute left-3 top-3 z-10 hidden gap-1 md:flex">
            <button type="button" onClick={() => setLeftOpen((v) => !v)} className="grid size-8 place-items-center rounded-lg border border-line bg-panel/90 text-fg-muted backdrop-blur hover:text-fg" aria-label={leftOpen ? 'Hide sections' : 'Show sections'} title={leftOpen ? 'Hide sections' : 'Show sections'}>
              <PanelLeft className="size-4" />
            </button>
          </div>
          <div className="absolute right-3 top-3 z-10 hidden md:block">
            <button type="button" onClick={() => setRightOpen((v) => !v)} className="grid size-8 place-items-center rounded-lg border border-line bg-panel/90 text-fg-muted backdrop-blur hover:text-fg" aria-label={rightOpen ? 'Hide properties' : 'Show properties'} title={rightOpen ? 'Hide properties' : 'Show properties'}>
              <PanelRight className="size-4" />
            </button>
          </div>
          <div ref={canvasRef} className="h-full">
            {layout ? (
              <PagedCanvas
                laid={layout.laid}
                zoom={zoom}
                onZoomChange={setZoom}
                imageUrl={imageUrl}
                selectedRef={selectedRef}
                pageLimit={limit}
                onSelectRef={(ref) => {
                  ed.selectRef(ref);
                  if (ref) {
                    setTab('content');
                    setRightOpen(true);
                  }
                }}
              />
            ) : (
              <div className="grid h-full place-items-center">
                <Spinner className="size-5 text-fg-subtle" />
              </div>
            )}
          </div>
        </main>
        <aside className={cn('w-[372px] shrink-0 border-l border-line bg-panel', rightOpen ? 'hidden md:block' : 'hidden', mobile === 'properties' && '!block absolute inset-0 z-20 w-full md:static md:w-[372px]')} aria-label="Properties">
          {properties}
        </aside>
      </div>
      <nav className="flex shrink-0 border-t border-line bg-panel md:hidden" aria-label="Studio panes">
        {(['sections', 'canvas', 'properties'] as const).map((p) => (
          <button key={p} type="button" onClick={() => setMobile(p)} className={cn('flex h-12 flex-1 items-center justify-center text-[12.5px] font-medium capitalize', mobile === p ? 'text-accent' : 'text-fg-muted')}>
            {p === 'canvas' ? 'Page' : p}
          </button>
        ))}
      </nav>

      <TemplateBrowser
        open={browsing}
        onClose={() => setBrowsing(false)}
        resume={resume}
        onUse={(t) => {
          ed.apply(`Template: ${t.name}`, (r) => ({ ...r, templateId: t.id, style: applyTemplateStyle(r.style, t) }));
          setBrowsing(false);
          toast({ tone: 'success', title: `${t.name} applied`, description: 'Your content is unchanged. Undo with ⌘Z.' });
        }}
      />
      {preview && layout && <PrintPreviewDialog laid={layout.laid} imageUrl={imageUrl} onClose={() => setPreview(false)} title={`${resume.name} — print preview`} actions={<Button size="sm" variant="primary" icon={<Download className="size-3.5" />} onClick={() => (setPreview(false), setExporting(true))}>Export</Button>} />}
      {layout && (
        <ExportDialog
          open={exporting}
          onClose={() => setExporting(false)}
          title="Export resume"
          label={resume.kind === 'cv' ? 'CV' : 'Resume'}
          personName={profile.name}
          fileName={resume.fileName}
          onFileName={(v) => ed.apply('File name', (r) => ({ ...r, fileName: v }), 'filename')}
          page={{ paper: resume.style.paper, margins: resume.style.margins, pageNumbers: resume.style.pageNumbers }}
          onPage={(patch) => ed.setStyle(patch)}
          meta={resume.meta}
          metaDefaults={layout.resolved.meta}
          onMeta={(patch) => ed.apply('Metadata', (r) => ({ ...r, meta: { ...r.meta, ...patch } }), 'meta')}
          hasPhoto={!!layout.resolved.photo}
          laid={layout.laid}
          getFlow={() => layout.flow}
          getJson={() => ({ format: 'portfolio-os-resume', version: 1, exportedAt: new Date().toISOString(), resume, profile: { ...profile, profileImage: undefined }, library, resolved: layout.resolved })}
          formats={['pdf', 'docx', 'txt', 'json']}
          pageLimit={limit}
          onFix={() => runFit(limit || 1)}
        />
      )}
      <ExportQueuePanel />
    </div>
  );
}
