import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Archive, ArrowDownToLine, Check, CloudDownload, CloudUpload, FileUp, FolderSync, Info, KeyRound, Lock, RefreshCw, RotateCcw, TriangleAlert, Unplug } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { Button } from '@/components/ui/Button';
import { Badge, Card, SectionLabel } from '@/components/ui/misc';
import { Segmented, Switch, TextInput } from '@/components/ui/Field';
import { toast } from '@/stores/ui';
import { BRAND } from '@/config/brand';
import { downloadBlob } from '@/utils/download';
import { formatBytes, formatTimestamp, timeAgo } from '@/utils/format';
import { cn } from '@/utils/cn';
import {
  backupFileName,
  backupIsStale,
  BackupError,
  chooseSyncFolder,
  countLocalStores,
  createBackup,
  ensureFolderPermission,
  findLatestInFolder,
  forgetSyncFolder,
  getLastBackup,
  getLastPull,
  getPrefs,
  getSyncFolder,
  isEncryptedBackup,
  isSyncFolderSupported,
  previewBackup,
  readBackup,
  recordBackup,
  recordPull,
  REMINDER_DAYS,
  restoreBackup,
  setPrefs,
  syncFileName,
  writeToFolder,
  type BackupPreview,
  type LastBackup,
  type LastPull,
  type ParsedBackup,
  type RestoreMode,
  type RestoreReport,
  type SyncDirHandle,
} from '@/lib/backup';

const STORE_LABELS: Record<string, string> = {
  projects: 'Portfolios',
  snapshots: 'Portfolio versions',
  assets: 'Portfolio images',
  meta: 'App settings',
  studio: 'Profile & library',
  images: 'Photos',
  resumes: 'Resumes',
  documents: 'Documents & letters',
  kdocs: 'Extracted documents',
  kblobs: 'Original PDFs',
  kextractions: 'Extraction results',
  applications: 'Applications',
};

const storeLabel = (name: string) => STORE_LABELS[name] ?? name;

const REPLACE_WORD = 'REPLACE';
const MIN_PASSPHRASE = 8;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

function toBlob(bytes: Uint8Array, encrypted: boolean): Blob {
  return new Blob([bytes as BlobPart], { type: encrypted ? 'application/octet-stream' : 'application/zip' });
}

export default function BackupPage() {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [last, setLast] = useState<LastBackup | undefined>();
  const [lastPull, setLastPull] = useState<LastPull | undefined>();
  const [folder, setFolder] = useState<SyncDirHandle | undefined>();
  const [loaded, setLoaded] = useState(false);

  const [encrypt, setEncrypt] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');

  const [busy, setBusy] = useState<Busy>(null);
  const [pullReport, setPullReport] = useState<RestoreReport | null>(null);
  const folderSupported = isSyncFolderSupported();

  const refresh = useCallback(async () => {
    const [c, l, p, f, prefs] = await Promise.all([countLocalStores(), getLastBackup(), getLastPull(), getSyncFolder(), getPrefs()]);
    setCounts(c);
    setLast(l);
    setLastPull(p);
    setFolder(f);
    setEncrypt(prefs.encrypt);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  const stale = loaded && total > 0 && backupIsStale(last);

  const passError = !encrypt
    ? null
    : passphrase.length < MIN_PASSPHRASE
      ? `Use at least ${MIN_PASSPHRASE} characters.`
      : confirm !== passphrase
        ? 'The two passphrases do not match.'
        : null;

  const toggleEncrypt = (v: boolean) => {
    setEncrypt(v);
    void setPrefs({ encrypt: v });
  };

  /** Returns the passphrase to encrypt with, `undefined` for plain, or `null` if the form is invalid. */
  function exportPassphrase(): string | undefined | null {
    if (!encrypt) return undefined;
    if (passError) {
      toast({ title: 'Check the passphrase', description: passError, tone: 'warning' });
      return null;
    }
    return passphrase;
  }

  async function download() {
    const pass = exportPassphrase();
    if (pass === null) return;
    setBusy('download');
    try {
      const { bytes, manifest } = await createBackup({ passphrase: pass });
      const encrypted = Boolean(pass);
      downloadBlob(toBlob(bytes, encrypted), backupFileName(encrypted));
      await recordBackup({ at: manifest.createdAt, target: 'download', encrypted, size: bytes.byteLength });
      toast({ title: 'Backup downloaded', description: `${formatBytes(bytes.byteLength)}${manifest.skipped.length ? ` · ${manifest.skipped.length} record(s) could not be included` : ''}`, tone: 'success' });
      await refresh();
    } catch (err) {
      toast({ title: 'Backup failed', description: errorMessage(err), tone: 'error' });
    } finally {
      setBusy(null);
    }
  }

  async function pickFolder() {
    setBusy('pick');
    try {
      const h = await chooseSyncFolder();
      setFolder(h);
      toast({ title: `Sync folder set to “${h.name}”`, tone: 'success' });
    } catch (err) {
      if (!isAbort(err)) toast({ title: 'Could not open the folder', description: errorMessage(err), tone: 'error' });
    } finally {
      setBusy(null);
    }
  }

  async function withFolder(): Promise<SyncDirHandle | null> {
    if (!folder) return null;
    try {
      if (await ensureFolderPermission(folder)) return folder;
      toast({ title: 'Permission needed', description: `Allow ${BRAND.name} to use “${folder.name}”, or choose the folder again.`, tone: 'warning' });
    } catch (err) {
      toast({ title: 'The sync folder is unavailable', description: `${errorMessage(err)} Choose the folder again.`, tone: 'error' });
    }
    return null;
  }

  async function push() {
    const pass = exportPassphrase();
    if (pass === null) return;
    setBusy('push');
    try {
      const dir = await withFolder();
      if (!dir) return;
      const { bytes, manifest } = await createBackup({ passphrase: pass });
      const encrypted = Boolean(pass);
      const name = syncFileName(encrypted);
      await writeToFolder(dir, name, bytes);
      await recordBackup({ at: manifest.createdAt, target: 'folder', encrypted, size: bytes.byteLength });
      toast({ title: `Saved to “${dir.name}”`, description: `${name} · ${formatBytes(bytes.byteLength)}`, tone: 'success' });
      await refresh();
    } catch (err) {
      toast({ title: 'Could not write to the sync folder', description: errorMessage(err), tone: 'error' });
    } finally {
      setBusy(null);
    }
  }

  async function pull() {
    setBusy('pull');
    setPullReport(null);
    try {
      const dir = await withFolder();
      if (!dir) return;
      const latest = await findLatestInFolder(dir);
      if (!latest) {
        toast({ title: 'No backup in this folder yet', description: 'Push from another device first.', tone: 'warning' });
        return;
      }
      const bytes = new Uint8Array(await latest.file.arrayBuffer());
      if (isEncryptedBackup(bytes) && !passphrase) {
        toast({ title: 'This backup is encrypted', description: 'Enter its passphrase under Encryption, then pull again.', tone: 'warning' });
        return;
      }
      const parsed = await readBackup(bytes, passphrase || undefined);
      const report = await restoreBackup(parsed, 'merge');
      await recordPull(latest);
      setPullReport(report);
      toast({ title: `Pulled ${latest.name}`, description: `${report.added} added · ${report.updated} updated`, tone: 'success' });
      await refresh();
    } catch (err) {
      toast({ title: 'Pull failed', description: errorMessage(err), tone: 'error' });
    } finally {
      setBusy(null);
    }
  }

  async function forget() {
    await forgetSyncFolder();
    setFolder(undefined);
    toast({ title: 'Sync folder forgotten', description: 'Files already in the folder are not deleted.' });
  }

  return (
    <div className="min-h-full bg-bg text-fg">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6 sm:pt-14">
        <h1 className="text-[clamp(1.9rem,4.4vw,2.6rem)] font-semibold tracking-[-0.03em]">Backup &amp; sync</h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-fg-muted">
          Save everything in this browser — portfolios, versions, images, profile, resumes, documents and extracted PDFs — to one file, and restore it here or on another device. Nothing is uploaded.
        </p>

        {stale && (
          <div role="status" className="mt-6 flex items-start gap-3 rounded-2xl border border-warn/30 bg-warn/10 p-4">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
            <div className="min-w-0 text-[13px] leading-relaxed">
              <p className="font-medium">{last ? `Your last backup was ${timeAgo(last.at)}.` : 'You have not made a backup yet.'}</p>
              <p className="text-fg-muted">Browsers can clear site data when space runs low. A backup every {REMINDER_DAYS} days keeps your work safe.</p>
            </div>
          </div>
        )}

        <div className="mt-8 space-y-6">
          <Panel title="This browser" icon={<Archive className="size-4 text-fg-subtle" />} description="What a backup will contain right now.">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              {counts
                ? Object.entries(counts).map(([name, n]) => (
                    <div key={name} className="min-w-0">
                      <dt className="truncate text-[11.5px] text-fg-subtle">{storeLabel(name)}</dt>
                      <dd className="text-[15px] font-semibold tabular-nums">{n}</dd>
                    </div>
                  ))
                : Array.from({ length: 6 }, (_, i) => <div key={i} className="h-9 animate-pulse rounded-lg bg-hover" />)}
            </dl>
            <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-line pt-4 text-[12.5px] text-fg-muted">
              <span>
                Last backup:{' '}
                {last ? (
                  <span className="text-fg" title={new Date(last.at).toLocaleString()}>
                    {formatTimestamp(last.at)} · {last.target === 'folder' ? 'sync folder' : 'download'}
                    {last.encrypted ? ' · encrypted' : ''}
                  </span>
                ) : (
                  <span className="text-fg">never</span>
                )}
              </span>
              {lastPull && (
                <span>
                  Last pull: <span className="text-fg" title={lastPull.file}>{formatTimestamp(lastPull.at)}</span>
                </span>
              )}
            </div>
          </Panel>

          <Panel title="Encryption" icon={<Lock className="size-4 text-fg-subtle" />} description="Optional. Encrypted backups use a .pobackup file and can only be opened with the passphrase. There is no way to recover a forgotten passphrase.">
            <Switch checked={encrypt} onChange={toggleEncrypt} label="Encrypt backups with a passphrase" help="AES-256-GCM with a key derived from your passphrase (PBKDF2). Applies to downloads and the sync folder." />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput
                label="Passphrase"
                type="password"
                autoComplete="new-password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                help={encrypt ? 'Kept in memory only — never saved.' : 'Also used to unlock encrypted files when pulling from the sync folder.'}
              />
              {encrypt && <TextInput label="Repeat passphrase" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={passphrase && confirm ? (passError ?? undefined) : undefined} />}
            </div>
          </Panel>

          <Panel title="Back up" icon={<ArrowDownToLine className="size-4 text-fg-subtle" />} description="Download one file with everything. Keep it somewhere safe, such as a cloud drive or a USB stick.">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" icon={encrypt ? <KeyRound className="size-4" /> : <ArrowDownToLine className="size-4" />} loading={busy === 'download'} disabled={busy !== null || total === 0} onClick={() => void download()}>
                {encrypt ? 'Download encrypted backup' : 'Download backup'}
              </Button>
              <span className="text-[12px] text-fg-subtle">{encrypt ? '.pobackup' : '.zip'} · cached image renders and saved deploy tokens are left out</span>
            </div>
          </Panel>

          <Panel title="Sync folder" icon={<FolderSync className="size-4 text-fg-subtle" />} description="Pick a folder that iCloud Drive, Dropbox, OneDrive or Google Drive syncs. Push here, then pull on your other device — the newest backup in the folder is merged in.">
            {folderSupported ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {folder ? (
                    <Badge tone="ok">
                      <Check className="size-3" aria-hidden="true" /> {folder.name}
                    </Badge>
                  ) : (
                    <Badge>No folder chosen</Badge>
                  )}
                  <Button size="sm" variant={folder ? 'ghost' : 'secondary'} icon={<FolderSync className="size-4" />} loading={busy === 'pick'} disabled={busy !== null} onClick={() => void pickFolder()}>
                    {folder ? 'Change folder' : 'Choose folder'}
                  </Button>
                  {folder && (
                    <Button size="sm" variant="ghost" icon={<Unplug className="size-4" />} disabled={busy !== null} onClick={() => void forget()}>
                      Forget
                    </Button>
                  )}
                </div>
                {folder && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="primary" icon={<CloudUpload className="size-4" />} loading={busy === 'push'} disabled={busy !== null || total === 0} onClick={() => void push()}>
                      Push to folder
                    </Button>
                    <Button variant="secondary" icon={<CloudDownload className="size-4" />} loading={busy === 'pull'} disabled={busy !== null} onClick={() => void pull()}>
                      Pull latest
                    </Button>
                  </div>
                )}
                {pullReport && <ReportSummary report={pullReport} />}
              </>
            ) : (
              <div className="flex items-start gap-3 rounded-xl border border-line bg-bg p-4 text-[13px] leading-relaxed text-fg-muted">
                <Info className="mt-0.5 size-4 shrink-0 text-fg-subtle" aria-hidden="true" />
                <p>
                  This browser cannot write to folders directly (folder sync works in Chrome and Edge on desktop). Instead, use <strong className="font-medium text-fg">Download backup</strong>, save the file into your cloud drive, and use{' '}
                  <strong className="font-medium text-fg">Restore</strong> below on the other device with <em>Merge</em>.
                </p>
              </div>
            )}
          </Panel>

          <RestorePanel busy={busy} setBusy={setBusy} onRestored={() => void refresh()} encryptPass={encrypt && !passError ? passphrase : undefined} />
        </div>
      </main>
    </div>
  );
}

type Busy = null | 'download' | 'push' | 'pull' | 'pick' | 'restore' | 'read';

function RestorePanel({ busy, setBusy, onRestored, encryptPass }: { busy: Busy; setBusy: (b: Busy) => void; onRestored: () => void; encryptPass?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [needsPass, setNeedsPass] = useState(false);
  const [pass, setPass] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedBackup | null>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [mode, setMode] = useState<RestoreMode>('merge');
  const [typed, setTyped] = useState('');
  const [safety, setSafety] = useState(true);
  const [report, setReport] = useState<RestoreReport | null>(null);

  const reset = () => {
    setFile(null);
    setNeedsPass(false);
    setPass('');
    setError(null);
    setParsed(null);
    setPreview(null);
    setTyped('');
    setReport(null);
    if (input.current) input.current.value = '';
  };

  async function open(bytes: Uint8Array, passphrase?: string) {
    setBusy('read');
    setError(null);
    try {
      const p = await readBackup(bytes, passphrase);
      setParsed(p);
      setPreview(await previewBackup(p));
      setNeedsPass(false);
    } catch (err) {
      if (err instanceof BackupError && (err.code === 'needs-passphrase' || err.code === 'decrypt')) setNeedsPass(true);
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function onFile(f: File | undefined) {
    reset();
    if (!f) return;
    const bytes = new Uint8Array(await f.arrayBuffer());
    setFile({ name: f.name, bytes });
    if (isEncryptedBackup(bytes)) setNeedsPass(true);
    else await open(bytes);
  }

  const replaceArmed = mode === 'merge' || typed.trim() === REPLACE_WORD;

  async function restore() {
    if (!parsed || !replaceArmed) return;
    setBusy('restore');
    try {
      if (mode === 'replace' && safety) {
        const { bytes, manifest } = await createBackup({ passphrase: encryptPass });
        const encrypted = Boolean(encryptPass);
        downloadBlob(toBlob(bytes, encrypted), backupFileName(encrypted).replace('-backup-', '-before-restore-backup-'));
        await recordBackup({ at: manifest.createdAt, target: 'download', encrypted, size: bytes.byteLength });
      }
      const r = await restoreBackup(parsed, mode);
      setReport(r);
      setTyped('');
      toast({ title: mode === 'replace' ? 'Data replaced from backup' : 'Backup merged', description: `${r.added} added · ${r.updated} updated`, tone: 'success' });
      onRestored();
    } catch (err) {
      toast({ title: 'Restore failed — nothing was changed', description: errorMessage(err), tone: 'error' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel title="Restore" icon={<RotateCcw className="size-4 text-fg-subtle" />} description="Open a .zip or .pobackup file to see what is inside before anything changes.">
      <input ref={input} type="file" accept=".zip,.pobackup,application/zip,application/octet-stream" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} aria-label="Backup file" />
      <div className="flex flex-wrap items-center gap-2">
        <Button icon={<FileUp className="size-4" />} disabled={busy !== null} loading={busy === 'read'} onClick={() => input.current?.click()}>
          {file ? 'Choose another file' : 'Choose backup file'}
        </Button>
        {file && <span className="min-w-0 max-w-full truncate text-[12.5px] text-fg-muted">{file.name}</span>}
      </div>

      {file && needsPass && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void open(file.bytes, pass);
          }}
        >
          <TextInput className="min-w-0 flex-1" label="Passphrase for this backup" type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus />
          <Button type="submit" variant="secondary" icon={<KeyRound className="size-4" />} disabled={!pass || busy !== null} loading={busy === 'read'}>
            Unlock
          </Button>
        </form>
      )}

      {error && (
        <p className="flex items-start gap-2 text-[12.5px] text-danger" role="alert">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {preview && !report && (
        <Card className="space-y-4 bg-bg p-4">
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-fg-muted">
            <span className="text-fg">Made {new Date(preview.createdAt).toLocaleString()}</span>
            <span aria-hidden="true">·</span>
            <span>{formatBytes(preview.byteSize)}</span>
            {preview.encrypted && (
              <Badge tone="accent">
                <Lock className="size-3" aria-hidden="true" /> Encrypted
              </Badge>
            )}
            {preview.dbVersion > preview.currentDbVersion && <Badge tone="warn">From a newer app version</Badge>}
          </div>
          <SectionLabel>Contents · {preview.total} records</SectionLabel>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            {preview.stores.map((s) => (
              <li key={s.name} className={cn('min-w-0', !s.known && 'opacity-60')}>
                <p className="truncate text-[11.5px] text-fg-subtle">{storeLabel(s.name)}</p>
                <p className="text-[14px] font-semibold tabular-nums">
                  {s.count}
                  {!s.known && <span className="ml-1.5 text-[11px] font-normal text-warn">skipped</span>}
                </p>
              </li>
            ))}
          </ul>
          {preview.unknownStores.length > 0 && (
            <p className="text-[12px] leading-relaxed text-warn">
              {preview.unknownStores.length === 1 ? 'One kind of data' : `${preview.unknownStores.length} kinds of data`} ({preview.unknownStores.join(', ')}) came from a newer version of {BRAND.name} and will be skipped. Reload the app to update, then restore again to include them.
            </p>
          )}

          <Segmented<RestoreMode>
            label="How to restore"
            value={mode}
            onChange={(m) => {
              setMode(m);
              setTyped('');
            }}
            options={[
              { value: 'merge', label: 'Merge' },
              { value: 'replace', label: 'Replace everything' },
            ]}
          />
          {mode === 'merge' ? (
            <p className="text-[12.5px] leading-relaxed text-fg-muted">Adds anything missing here. When both sides have the same item, the one edited most recently wins. Nothing is deleted.</p>
          ) : (
            <div className="space-y-3 rounded-xl border border-danger/30 bg-danger/5 p-3">
              <p className="text-[12.5px] leading-relaxed text-fg-muted">
                <strong className="font-medium text-danger">Deletes all data in this browser</strong> and replaces it with the backup. Your sync folder choice stays.
              </p>
              <Switch checked={safety} onChange={setSafety} label="Download a copy of the current data first" help={encryptPass ? 'Encrypted with your passphrase.' : 'Saved as an unencrypted .zip.'} />
              <TextInput label={`Type ${REPLACE_WORD} to confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant={mode === 'replace' ? 'danger' : 'primary'} icon={<RotateCcw className="size-4" />} loading={busy === 'restore'} disabled={busy !== null || !replaceArmed} onClick={() => void restore()}>
              {mode === 'replace' ? 'Replace all data' : 'Merge into this browser'}
            </Button>
            <Button variant="ghost" disabled={busy !== null} onClick={reset}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {report && (
        <>
          <ReportSummary report={report} />
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={<RefreshCw className="size-4" />} onClick={() => window.location.reload()}>
              Reload app
            </Button>
            <Button variant="ghost" onClick={reset}>
              Done
            </Button>
          </div>
        </>
      )}
    </Panel>
  );
}

function ReportSummary({ report }: { report: RestoreReport }) {
  const rows = Object.entries(report.stores).filter(([, s]) => s.added || s.updated || s.removed || s.unchanged);
  return (
    <Card className="space-y-3 bg-bg p-4" as="section">
      <p className="flex items-center gap-2 text-[13px] font-medium">
        <Check className="size-4 text-ok" aria-hidden="true" />
        {report.mode === 'replace' ? 'Replaced' : 'Merged'}: {report.added} added · {report.updated} updated
      </p>
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-0 text-left text-[12px]">
            <thead className="text-fg-subtle">
              <tr>
                <th className="py-1 pr-2 font-medium">Data</th>
                <th className="px-2 py-1 text-right font-medium">Added</th>
                <th className="px-2 py-1 text-right font-medium">Updated</th>
                <th className="py-1 pl-2 text-right font-medium">{report.mode === 'replace' ? 'Removed' : 'Kept'}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map(([name, s]) => (
                <tr key={name} className="border-t border-line">
                  <td className="max-w-[9rem] truncate py-1 pr-2 text-fg-muted">{storeLabel(name)}</td>
                  <td className="px-2 py-1 text-right">{s.added}</td>
                  <td className="px-2 py-1 text-right">{s.updated}</td>
                  <td className="py-1 pl-2 text-right">{report.mode === 'replace' ? s.removed : s.unchanged}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {report.unknownStores.length > 0 && <p className="text-[12px] text-warn">Skipped data from a newer app version: {report.unknownStores.join(', ')}.</p>}
      {report.skipped.length > 0 && <p className="text-[12px] text-warn">{report.skipped.length} record(s) could not be restored.</p>}
      <p className="text-[12px] text-fg-subtle">Reload the app so open pages pick up the restored data.</p>
    </Card>
  );
}

function Panel({ title, description, children, icon }: { title: string; description: string; children: ReactNode; icon?: ReactNode }) {
  const id = `panel-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
      <h2 id={id} className="flex items-center gap-2 text-[15px] font-semibold">
        {icon}
        {title}
      </h2>
      <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{description}</p>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}
