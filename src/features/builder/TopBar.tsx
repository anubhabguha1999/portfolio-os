import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Check,
  Cloud,
  CloudOff,
  Code2,
  Command as CommandIcon,
  Download,
  Eye,
  History,
  Laptop,
  Loader2,
  Maximize,
  Monitor,
  MoreHorizontal,
  Presentation,
  Printer,
  Rocket,
  Redo2,
  Ruler,
  Share2,
  Smartphone,
  Tablet,
  Undo2,
  Upload,
  FileJson,
  Keyboard,
  Settings,
} from 'lucide-react';
import { useEditor } from '@/stores/editor';
import { useUI, type ViewportPreset } from '@/stores/ui';
import { renameProject } from '@/lib/storage/projects';
import { Button, IconButton } from '@/components/ui/Button';
import { Menu } from '@/components/ui/Menu';
import { LogoMark } from '@/components/Logo';
import { cn } from '@/utils/cn';
import { timeAgo } from '@/utils/format';
import { modKey } from '@/utils/download';
import { ProfileLinkButton } from '@/features/studio/sync/ProfileLink';

export interface TopBarActions {
  onPreview: () => void;
  onExport: () => void;
  onDeploy: () => void;
  onPresent: () => void;
  onPrint: () => void;
  onExportJson: () => void;
  onOpenSettings: () => void;
}

const VIEWPORT_OPTIONS: Array<{ value: ViewportPreset; label: string; icon: typeof Monitor }> = [
  { value: 'desktop', label: 'Desktop · 1440', icon: Monitor },
  { value: 'laptop', label: 'Laptop · 1280', icon: Laptop },
  { value: 'tablet', label: 'Tablet · 820', icon: Tablet },
  { value: 'mobile', label: 'Mobile · 390', icon: Smartphone },
  { value: 'custom', label: 'Custom size', icon: Ruler },
];

function SaveIndicator() {
  const state = useEditor((s) => s.saveState);
  const at = useEditor((s) => s.lastSavedAt);
  const error = useEditor((s) => s.saveError);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const map = {
    idle: { icon: Cloud, text: 'Local', cls: 'text-fg-subtle' },
    dirty: { icon: Loader2, text: 'Unsaved', cls: 'text-fg-subtle' },
    saving: { icon: Loader2, text: 'Saving…', cls: 'text-fg-subtle [&_svg]:animate-spin' },
    saved: { icon: Check, text: at ? `Saved ${timeAgo(at)}` : 'Saved', cls: 'text-fg-subtle' },
    error: { icon: CloudOff, text: 'Save failed', cls: 'text-danger' },
  } as const;
  const m = map[state];
  const Icon = m.icon;
  return (
    <span className={cn('hidden items-center gap-1.5 text-[11.5px] md:inline-flex', m.cls)} title={error ?? 'Saved in this browser (IndexedDB)'} role="status" aria-live="polite">
      <Icon className="size-3.5" /> {m.text}
    </span>
  );
}

function ProjectName() {
  const name = useEditor((s) => s.projectName);
  const id = useEditor((s) => s.projectId);
  const setName = useEditor((s) => s.setProjectName);
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);
  const commit = async () => {
    const v = draft.trim();
    if (!id || !v || v === name) return setDraft(name);
    setName(v);
    await renameProject(id, v);
  };
  return (
    <input
      value={draft}
      aria-label="Project name"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setDraft(name);
          e.currentTarget.blur();
        }
      }}
      className="h-8 w-[clamp(90px,16vw,220px)] truncate rounded-md border border-transparent bg-transparent px-2 text-[13px] font-medium hover:border-line focus:border-accent focus:bg-bg focus:outline-none"
    />
  );
}

export function TopBar(a: TopBarActions) {
  const projectId = useEditor((s) => s.projectId);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const nextUndo = useEditor((s) => s.past[s.past.length - 1]?.label);
  const nextRedo = useEditor((s) => s.future[0]?.label);
  const ui = useUI();
  const [customOpen, setCustomOpen] = useState(false);

  return (
    <header className="relative z-30 flex h-[52px] shrink-0 items-center gap-2 border-b border-line bg-panel px-2 sm:px-3">
      <Link to="/projects" className="grid size-8 place-items-center rounded-lg hover:bg-hover" aria-label="All portfolios">
        <LogoMark className="size-[22px]" />
      </Link>
      <ProjectName />
      <SaveIndicator />
      {projectId && <ProfileLinkButton projectId={projectId} />}
      <div className="mx-1 hidden h-5 w-px bg-line sm:block" />
      <IconButton label={canUndo ? `Undo ${nextUndo ?? ''} (${modKey}+Z)` : 'Nothing to undo'} disabled={!canUndo} onClick={undo}>
        <Undo2 className="size-4" />
      </IconButton>
      <IconButton label={canRedo ? `Redo ${nextRedo ?? ''} (${modKey}+Shift+Z)` : 'Nothing to redo'} disabled={!canRedo} onClick={redo}>
        <Redo2 className="size-4" />
      </IconButton>

      <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-2 xl:flex">
        <div role="radiogroup" aria-label="Viewport" className="flex rounded-[10px] border border-line bg-bg p-0.5">
          {VIEWPORT_OPTIONS.map((v) => (
            <button
              key={v.value}
              role="radio"
              aria-checked={ui.viewport === v.value}
              title={v.label}
              aria-label={v.label}
              onClick={() => {
                if (v.value === 'custom') setCustomOpen((o) => !o);
                else ui.setViewport(v.value);
              }}
              className={cn('grid h-7 w-8 place-items-center rounded-lg transition-colors', ui.viewport === v.value ? 'bg-elevated text-fg shadow-[0_0_0_1px_var(--app-line-strong)]' : 'text-fg-subtle hover:text-fg')}
            >
              <v.icon className="size-3.5" />
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label="Developer view" className="flex rounded-[10px] border border-line bg-bg p-0.5">
          {(['preview', 'html', 'css', 'json'] as const).map((d) => (
            <button
              key={d}
              role="radio"
              aria-checked={ui.devView === d}
              onClick={() => ui.setDevView(d)}
              className={cn('h-7 rounded-lg px-2.5 text-[11.5px] font-medium transition-colors', ui.devView === d ? 'bg-elevated text-fg shadow-[0_0_0_1px_var(--app-line-strong)]' : 'text-fg-subtle hover:text-fg')}
            >
              {d === 'preview' ? 'Canvas' : d.toUpperCase()}
            </button>
          ))}
        </div>
        {customOpen && (
          <form
            className="absolute left-0 top-10 flex items-end gap-2 rounded-xl border border-line bg-elevated p-3 shadow-float"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const w = Math.min(3840, Math.max(280, Number(f.get('w')) || 1024));
              const h = Math.min(2400, Math.max(320, Number(f.get('h')) || 768));
              ui.setCustomSize({ width: w, height: h });
              setCustomOpen(false);
            }}
          >
            <label className="text-[11px] text-fg-muted">
              Width
              <input name="w" type="number" min={280} max={3840} defaultValue={ui.customSize.width} className="app-input mt-1 !w-24" autoFocus />
            </label>
            <label className="text-[11px] text-fg-muted">
              Height
              <input name="h" type="number" min={320} max={2400} defaultValue={ui.customSize.height} className="app-input mt-1 !w-24" />
            </label>
            <Button type="submit" size="sm" variant="primary">
              Apply
            </Button>
          </form>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <div className="hidden items-center gap-1 sm:flex">
          <IconButton label={`Command palette (${modKey}+K)`} onClick={() => ui.setCommandPalette(true)}>
            <CommandIcon className="size-4" />
          </IconButton>
          <IconButton label="Insights: accessibility, performance, content" active={ui.insightsOpen} onClick={() => ui.setInsightsOpen(!ui.insightsOpen)}>
            <Activity className="size-4" />
          </IconButton>
          <IconButton label="Version history" onClick={() => ui.setHistoryOpen(true)}>
            <History className="size-4" />
          </IconButton>
          <IconButton label="Share link" onClick={() => ui.setShareOpen(true)}>
            <Share2 className="size-4" />
          </IconButton>
        </div>
        <Menu
          label="More"
          trigger={(p) => (
            <IconButton label="More" {...p}>
              <MoreHorizontal className="size-4" />
            </IconButton>
          )}
          items={[
            { label: 'Command palette', icon: <CommandIcon />, hint: `${modKey}K`, onSelect: () => ui.setCommandPalette(true) },
            { label: 'Insights', icon: <Activity />, onSelect: () => ui.setInsightsOpen(true) },
            { label: 'Version history', icon: <History />, onSelect: () => ui.setHistoryOpen(true) },
            { label: 'Share link', icon: <Share2 />, onSelect: () => ui.setShareOpen(true) },
            { label: 'Deploy website', icon: <Rocket />, onSelect: a.onDeploy },
            'separator',
            { label: 'Focus mode', icon: <Maximize />, hint: `${modKey}.`, onSelect: () => ui.setFocusMode(true) },
            { label: 'Presentation mode', icon: <Presentation />, onSelect: a.onPresent },
            { label: 'Print', icon: <Printer />, onSelect: a.onPrint },
            { label: 'Code view', icon: <Code2 />, onSelect: () => ui.setDevView(ui.devView === 'preview' ? 'html' : 'preview') },
            'separator',
            { label: 'Import project…', icon: <Upload />, onSelect: () => ui.setImportOpen(true) },
            { label: 'Export project JSON', icon: <FileJson />, onSelect: a.onExportJson },
            { label: 'Keyboard shortcuts', icon: <Keyboard />, hint: `${modKey}/`, onSelect: () => ui.setShortcutsOpen(true) },
            { label: 'App settings', icon: <Settings />, onSelect: a.onOpenSettings },
          ]}
        />
        <Button size="sm" variant="secondary" icon={<Eye className="size-3.5" />} onClick={a.onPreview} className="max-sm:hidden!" title={`Preview (${modKey}+P)`}>
          Preview
        </Button>
        <Button size="sm" variant="primary" icon={<Download className="size-3.5" />} onClick={a.onExport} title={`Export (${modKey}+E)`}>
          Export
        </Button>
      </div>
    </header>
  );
}
