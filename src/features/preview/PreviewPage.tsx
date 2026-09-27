import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Maximize2, Monitor, Moon, Presentation, Printer, Share2, Smartphone, Sun, Tablet } from 'lucide-react';
import { useProject } from '@/hooks/useProject';
import { useAutosave } from '@/hooks/useAutosave';
import { useEditor } from '@/stores/editor';
import { useHotkeys } from '@/hooks/useHotkeys';
import { PreviewFrame, type PreviewFrameHandle } from './PreviewFrame';
import { ShareDialog } from '@/features/share/ShareDialog';
import { Button, IconButton, Spinner } from '@/components/ui/Button';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { cn } from '@/utils/cn';

type Device = 'full' | 'desktop' | 'tablet' | 'mobile';
const DEVICES: Record<Exclude<Device, 'full'>, { w: number; h: number }> = { desktop: { w: 1440, h: 900 }, tablet: { w: 820, h: 1180 }, mobile: { w: 390, h: 844 } };

export default function PreviewPage() {
  const { projectId } = useParams();
  const state = useProject(projectId);
  if (state.status === 'loading') return <div className="grid h-dvh place-items-center" role="status"><Spinner /></div>;
  if (state.status !== 'ready')
    return (
      <div className="grid h-dvh place-items-center text-center">
        <div>
          <p className="text-[15px] font-semibold">Portfolio not available</p>
          <Link className="mt-3 inline-block text-[13px] text-accent" to="/projects">Back to my portfolios</Link>
        </div>
      </div>
    );
  return <Preview projectId={projectId!} />;
}

function Preview({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const portfolio = useEditor((s) => s.portfolio)!;
  const updateSettings = useEditor((s) => s.updateSettings);
  useAutosave();
  const [device, setDevice] = useState<Device>('full');
  const [share, setShare] = useState(false);
  const frame = useRef<PreviewFrameHandle>(null);
  const shell = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useHotkeys([
    { combo: 'mod+p', handler: (e) => { e.preventDefault(); navigate(`/builder/${projectId}`); } },
    { combo: 'mod+e', handler: (e) => { e.preventDefault(); navigate(`/export/${projectId}`); } },
    { combo: 'escape', allowInInputs: false, handler: () => !share && navigate(`/builder/${projectId}`) },
  ]);

  const scheme = portfolio.settings.colorScheme === 'system' ? portfolio.theme.defaultScheme : portfolio.settings.colorScheme;
  const present = async () => {
    try {
      await shell.current?.requestFullscreen?.();
    } catch {
      /* not permitted — continue in-page */
    }
    setDevice('full');
    window.setTimeout(() => {
      frame.current?.present(true);
      frame.current?.focus();
    }, 150);
  };

  const d = device === 'full' ? null : DEVICES[device];
  const scale = d ? Math.min(1, (box.w - 48) / d.w, device === 'desktop' ? 1 : (box.h - 48) / d.h) : 1;

  return (
    <div ref={shell} className="flex h-dvh flex-col bg-bg">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-panel px-2 sm:px-3">
        <Button size="sm" variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={() => navigate(`/builder/${projectId}`)}>
          <span className="hidden sm:inline">Back to builder</span>
        </Button>
        <div role="radiogroup" aria-label="Device" className="mx-auto flex rounded-[10px] border border-line bg-bg p-0.5">
          {([
            ['full', 'Full width', Maximize2],
            ['desktop', 'Desktop', Monitor],
            ['tablet', 'Tablet', Tablet],
            ['mobile', 'Mobile', Smartphone],
          ] as const).map(([k, label, Icon]) => (
            <button key={k} role="radio" aria-checked={device === k} aria-label={label} title={label} onClick={() => setDevice(k)} className={cn('grid h-7 w-9 place-items-center rounded-lg', device === k ? 'bg-elevated text-fg shadow-[0_0_0_1px_var(--app-line-strong)]' : 'text-fg-subtle hover:text-fg')}>
              <Icon className="size-3.5" />
            </button>
          ))}
        </div>
        <IconButton label={scheme === 'dark' ? 'Switch portfolio to light' : 'Switch portfolio to dark'} onClick={() => updateSettings('colorScheme', scheme === 'dark' ? 'light' : 'dark')}>
          {scheme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </IconButton>
        <IconButton label="Presentation mode" onClick={() => void present()}>
          <Presentation className="size-4" />
        </IconButton>
        <IconButton label="Print" onClick={() => frame.current?.print()} className="max-sm:hidden!">
          <Printer className="size-4" />
        </IconButton>
        <IconButton label="Share link" onClick={() => setShare(true)} className="max-sm:hidden!">
          <Share2 className="size-4" />
        </IconButton>
        <Button size="sm" variant="primary" icon={<Download className="size-3.5" />} onClick={() => navigate(`/export/${projectId}`)}>
          Export
        </Button>
      </header>
      <div ref={area} className={cn('relative min-h-0 flex-1 overflow-auto', d && 'bg-canvas')}>
        <ErrorBoundary area="Preview">
          {d ? (
            <div className="flex min-h-full justify-center p-6">
              <div className="shrink-0 overflow-hidden rounded-[18px] bg-white shadow-[0_0_0_1px_var(--app-line-strong),0_30px_80px_-30px_rgba(0,0,0,.6)]" style={{ width: d.w * scale, height: d.h * scale }}>
                <div style={{ width: d.w, height: d.h, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
                  <PreviewFrame ref={frame} portfolio={portfolio} allowPopups title="Portfolio preview" onPresentExit={() => document.fullscreenElement && void document.exitFullscreen()} />
                </div>
              </div>
            </div>
          ) : (
            <PreviewFrame ref={frame} portfolio={portfolio} allowPopups title="Portfolio preview" onPresentExit={() => document.fullscreenElement && void document.exitFullscreen()} />
          )}
        </ErrorBoundary>
      </div>
      {share && <ShareDialog open onClose={() => setShare(false)} portfolio={portfolio} />}
    </div>
  );
}
