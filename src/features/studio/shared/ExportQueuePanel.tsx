import { CheckCircle2, Download, Loader2, X, XCircle, ListChecks, Clock } from 'lucide-react';
import { Truncate } from 'dead-lock-react-lib';
import { useExportQueue } from '@/studio/export/queue';
import { ProgressBar } from '@/components/ui/misc';
import { IconButton } from '@/components/ui/Button';
import { formatBytes } from '@/utils/format';
import { cn } from '@/utils/cn';

/** Floating list of exports; each runs off the main thread with live progress. */
export function ExportQueuePanel() {
  const jobs = useExportQueue((s) => s.jobs);
  const open = useExportQueue((s) => s.open);
  const setOpen = useExportQueue((s) => s.setOpen);
  const download = useExportQueue((s) => s.download);
  const remove = useExportQueue((s) => s.remove);
  const clear = useExportQueue((s) => s.clearFinished);
  if (!jobs.length) return null;
  const active = jobs.filter((j) => j.status === 'running' || j.status === 'queued').length;

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-[800] inline-flex h-9 items-center gap-2 rounded-full border border-line bg-elevated px-3.5 text-[12.5px] font-medium shadow-float hover:border-line-strong"
      >
        {active ? <Loader2 className="size-3.5 animate-spin text-accent" /> : <ListChecks className="size-3.5 text-ok" />}
        Export queue · {active ? `${active} running` : `${jobs.length} done`}
      </button>
    );

  return (
    <section aria-label="Export queue" className="fixed bottom-4 left-4 z-[800] w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-line bg-elevated shadow-float">
      <header className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
        <h2 className="text-[12.5px] font-semibold">Export queue</h2>
        <div className="flex items-center gap-1">
          <button type="button" onClick={clear} className="rounded-md px-2 py-1 text-[11.5px] text-fg-muted hover:bg-hover hover:text-fg">
            Clear finished
          </button>
          <IconButton label="Minimise" size="xs" onClick={() => setOpen(false)}>
            <X className="size-3.5" />
          </IconButton>
        </div>
      </header>
      <ul className="max-h-[320px] divide-y divide-line overflow-y-auto">
        {jobs
          .slice()
          .reverse()
          .map((j) => (
            <li key={j.id} className="px-3.5 py-2.5">
              <div className="flex items-center gap-2.5">
                {j.status === 'done' ? (
                  <CheckCircle2 className="size-4 shrink-0 text-ok" />
                ) : j.status === 'error' ? (
                  <XCircle className="size-4 shrink-0 text-danger" />
                ) : j.status === 'queued' ? (
                  <Clock className="size-4 shrink-0 text-fg-subtle" />
                ) : (
                  <Loader2 className="size-4 shrink-0 animate-spin text-accent" />
                )}
                <div className="min-w-0 flex-1">
                  <Truncate className="text-[12.5px] font-medium" style={{ display: 'block', maxWidth: '100%' }}>
                    {j.filename}
                  </Truncate>
                  <p className={cn('truncate text-[11px]', j.status === 'error' ? 'text-danger' : 'text-fg-subtle')}>
                    {j.status === 'error' ? j.error : j.status === 'done' ? `${formatBytes(j.size ?? 0)}${j.warnings.length ? ` · ${j.warnings[0]}` : ''}` : j.stage}
                  </p>
                </div>
                {j.status === 'done' && (
                  <IconButton label={`Download ${j.filename}`} size="xs" onClick={() => download(j.id)}>
                    <Download className="size-3.5" />
                  </IconButton>
                )}
                {(j.status === 'done' || j.status === 'error') && (
                  <IconButton label="Remove" size="xs" onClick={() => remove(j.id)}>
                    <X className="size-3.5" />
                  </IconButton>
                )}
              </div>
              {(j.status === 'running' || j.status === 'queued') && <ProgressBar value={j.progress * 100} className="mt-2" label={`${j.filename} progress`} />}
            </li>
          ))}
      </ul>
    </section>
  );
}
