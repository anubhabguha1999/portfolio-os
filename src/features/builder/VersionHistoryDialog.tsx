import { useEffect, useState } from 'react';
import { History, RotateCcw, Save, Trash2 } from 'lucide-react';
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState, Badge } from '@/components/ui/misc';
import { listSnapshots, loadSnapshot, deleteSnapshot, createSnapshot, type SnapshotSummary } from '@/lib/storage/projects';
import { useEditor } from '@/stores/editor';
import { toast } from '@/stores/ui';
import { formatBytes, formatTimestamp } from '@/utils/format';

export function VersionHistoryDialog({ open, onClose, onSaveVersion }: { open: boolean; onClose: () => void; onSaveVersion: (label?: string) => Promise<void> }) {
  const projectId = useEditor((s) => s.projectId);
  const [list, setList] = useState<SnapshotSummary[] | null>(null);
  const [label, setLabel] = useState('');
  const [restoring, setRestoring] = useState<SnapshotSummary | null>(null);

  const refresh = async () => {
    if (projectId) setList(await listSnapshots(projectId));
  };
  useEffect(() => {
    if (open) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId]);

  const restore = async (snap: SnapshotSummary) => {
    const cur = useEditor.getState().portfolio;
    if (!cur) return;
    try {
      const p = await loadSnapshot(snap.id);
      await createSnapshot(cur, 'restore', `Before restoring v${snap.version}`);
      useEditor.getState().replacePortfolio(p, `Restore v${snap.version}`);
      toast({ tone: 'success', title: `Restored v${snap.version}`, description: 'Your previous state was saved as a new version, and Undo works too.' });
      onClose();
    } catch (err) {
      toast({ tone: 'error', title: 'Restore failed', description: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Version history" description="Snapshots are compressed and stored locally in this browser." size="md">
      <form
        className="mb-4 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          await onSaveVersion(label.trim() || undefined);
          setLabel('');
          await refresh();
        }}
      >
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name this version (optional)" className="app-input" aria-label="Version name" />
        <Button type="submit" variant="primary" icon={<Save className="size-3.5" />}>
          Save version
        </Button>
      </form>
      {!list ? (
        <p className="py-6 text-center text-[13px] text-fg-subtle">Loading…</p>
      ) : list.length === 0 ? (
        <EmptyState icon={<History className="size-5" />} title="No versions yet" description="Press ⌘/Ctrl+S to save a version. Checkpoints are also created automatically while you work." />
      ) : (
        <ol className="relative space-y-1 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-line">
          {list.map((s, i) => (
            <li key={s.id} className="group relative flex items-center gap-3 rounded-xl py-2 pl-1 pr-2 hover:bg-hover">
              <span className={`relative z-10 grid size-[30px] shrink-0 place-items-center rounded-full border font-mono text-[10.5px] ${i === 0 ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-panel text-fg-muted'}`}>v{s.version}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">
                  {s.label} {s.kind === 'auto' && <Badge className="ml-1">auto</Badge>}
                  {s.kind === 'restore' && <Badge tone="warn" className="ml-1">safety copy</Badge>}
                </p>
                <p className="text-[11.5px] text-fg-subtle">
                  {formatTimestamp(s.createdAt)} · {formatBytes(s.size)}
                </p>
              </div>
              <Button size="xs" variant="secondary" icon={<RotateCcw className="size-3" />} onClick={() => setRestoring(s)}>
                Restore
              </Button>
              <IconButton
                size="xs"
                label={`Delete v${s.version}`}
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                onClick={async () => {
                  await deleteSnapshot(s.id);
                  await refresh();
                }}
              >
                <Trash2 className="size-3" />
              </IconButton>
            </li>
          ))}
        </ol>
      )}
      <ConfirmDialog
        open={restoring !== null}
        onClose={() => setRestoring(null)}
        onConfirm={() => restoring && void restore(restoring)}
        tone="primary"
        title={`Restore v${restoring?.version ?? ''}?`}
        description="Your current work is saved as a safety version first, so nothing is lost."
        confirmLabel="Restore version"
      />
    </Dialog>
  );
}
