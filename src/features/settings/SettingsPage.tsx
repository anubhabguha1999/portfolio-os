import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, Download, HardDrive, Keyboard, Monitor, Moon, Sun, Trash2, WifiOff } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Badge, ProgressBar, Shortcut } from '@/components/ui/misc';
import { useAppTheme, type AppTheme } from '@/hooks/useAppTheme';
import { requestPersistence, resetDbConnection, storageEstimate } from '@/lib/storage/db';
import { BRAND } from '@/config/brand';
import { toast } from '@/stores/ui';
import { formatBytes } from '@/utils/format';
import { promptInstall, usePwa } from './pwa';
import { cn } from '@/utils/cn';

const SHORTCUTS: Array<[keys: string, action: string]> = [
  ['mod+k', 'Open the command palette'],
  ['mod+s', 'Save a named version'],
  ['mod+z', 'Undo'],
  ['mod+shift+z', 'Redo'],
  ['mod+p', 'Open the full preview'],
  ['mod+e', 'Open the export studio'],
  ['esc', 'Close dialogs, panels and menus'],
  ['↑+↓', 'Move through lists and menus'],
];

const THEME_OPTIONS: Array<{ value: AppTheme; label: string; icon: typeof Sun }> = [
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'System', icon: Monitor },
];

type Persist = 'unsupported' | 'persisted' | 'best-effort';

async function readPersist(): Promise<Persist> {
  try {
    if (!navigator.storage?.persisted) return 'unsupported';
    return (await navigator.storage.persisted()) ? 'persisted' : 'best-effort';
  } catch {
    return 'unsupported';
  }
}

interface SwStatus {
  supported: boolean;
  registered: boolean;
  controlling: boolean;
}

async function readSw(): Promise<SwStatus> {
  if (!('serviceWorker' in navigator)) return { supported: false, registered: false, controlling: false };
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    return { supported: true, registered: Boolean(reg), controlling: Boolean(navigator.serviceWorker.controller) };
  } catch {
    return { supported: true, registered: false, controlling: Boolean(navigator.serviceWorker.controller) };
  }
}

export default function SettingsPage() {
  const [theme, setTheme] = useAppTheme();
  const pwa = usePwa();
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [persist, setPersist] = useState<Persist | null>(null);
  const [sw, setSw] = useState<SwStatus | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [wiping, setWiping] = useState(false);

  const refresh = useCallback(async () => {
    const [u, p, s] = await Promise.all([storageEstimate(), readPersist(), readSw()]);
    setUsage(u);
    setPersist(p);
    setSw(s);
  }, []);

  useEffect(() => {
    document.title = `Settings — ${BRAND.name}`;
    void refresh();
    const on = () => setOnline(navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    const onCtl = () => void refresh();
    navigator.serviceWorker?.addEventListener('controllerchange', onCtl);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', on);
      navigator.serviceWorker?.removeEventListener('controllerchange', onCtl);
    };
  }, [refresh]);

  const askPersist = async () => {
    const granted = await requestPersistence();
    await refresh();
    toast(
      granted
        ? { title: 'Persistent storage granted', description: 'The browser will not clear your portfolios to free up space.', tone: 'success' }
        : { title: 'Request not granted', description: 'Browsers decide this automatically — installing the app or bookmarking it often helps.', tone: 'warning' },
    );
  };

  const install = async () => {
    const accepted = await promptInstall();
    if (accepted) toast({ title: `${BRAND.name} installed`, tone: 'success' });
  };

  const wipe = async () => {
    setWiping(true);
    try {
      await resetDbConnection();
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase(BRAND.storageNamespace);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error ?? new Error('Could not delete the database.'));
        req.onblocked = () => reject(new Error('Close other tabs of this app and try again.'));
      });
      try {
        for (const key of Object.keys(localStorage)) if (key.startsWith('pos-')) localStorage.removeItem(key);
      } catch {
        /* storage unavailable */
      }
      window.location.reload();
    } catch (err) {
      setWiping(false);
      toast({ title: 'Could not delete local data', description: err instanceof Error ? err.message : undefined, tone: 'error' });
    }
  };

  const offlineReady = Boolean(sw?.controlling) || pwa.offlineReady;
  const persistLabel = persist === 'persisted' ? 'Persistent' : persist === 'best-effort' ? 'Best effort' : persist === 'unsupported' ? 'Not supported' : '…';

  return (
    <div className="min-h-full bg-bg text-fg">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6 sm:pt-14">
        <h1 className="text-[clamp(1.9rem,4.4vw,2.6rem)] font-semibold tracking-[-0.03em]">Settings</h1>
        <p className="mt-1.5 text-[14px] text-fg-muted">Preferences for this browser. Portfolio-specific options live inside the builder.</p>

        <div className="mt-10 space-y-6">
          <Panel title="Appearance" description="The colour scheme of the app itself. Your portfolio’s theme is set per project.">
            <div role="radiogroup" aria-label="App colour scheme" className="grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={theme === o.value}
                  onClick={() => setTheme(o.value)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-[13px] transition-colors',
                    theme === o.value ? 'border-accent bg-accent-soft text-fg' : 'border-line text-fg-muted hover:border-line-strong hover:text-fg',
                  )}
                >
                  <o.icon className="size-5" aria-hidden="true" />
                  {o.label}
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Storage" description="Everything is kept in this browser’s IndexedDB. Nothing is sent anywhere.">
            <div className="flex items-start gap-3">
              <HardDrive className="mt-0.5 size-5 shrink-0 text-fg-muted" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                {usage && usage.quota > 0 ? (
                  <>
                    <ProgressBar value={(usage.usage / usage.quota) * 100} label="Local storage used" />
                    <p className="mt-2 text-[13px] text-fg-muted">
                      {formatBytes(usage.usage)} used of {formatBytes(usage.quota)} available to this site
                    </p>
                  </>
                ) : (
                  <p className="text-[13px] text-fg-muted">{usage ? 'Usage is not reported by this browser.' : 'Checking…'}</p>
                )}
              </div>
            </div>
            <Row
              label="Persistence"
              help={
                persist === 'persisted'
                  ? 'The browser will keep your data even when disk space runs low.'
                  : 'Without persistence the browser may clear site data under storage pressure. Keep JSON backups either way.'
              }
            >
              <Badge tone={persist === 'persisted' ? 'ok' : persist === 'best-effort' ? 'warn' : 'neutral'}>{persistLabel}</Badge>
              {persist === 'best-effort' && (
                <Button size="sm" onClick={() => void askPersist()}>
                  Request persistent storage
                </Button>
              )}
            </Row>
          </Panel>

          <Panel title="Offline & install" description="The app caches itself so it opens without a connection.">
            <Row
              label="Offline readiness"
              help={
                !sw
                  ? 'Checking…'
                  : !sw.supported
                    ? 'This browser does not support service workers, so offline use is unavailable.'
                    : offlineReady
                      ? 'The app shell is cached. You can open it without a network connection.'
                      : sw.registered
                        ? 'Service worker registered. Reload once to finish caching.'
                        : 'Not cached yet. Offline support activates in the production build after the first visit.'
              }
            >
              {offlineReady ? (
                <Badge tone="ok">
                  <CheckCircle2 className="size-3" aria-hidden="true" /> Ready
                </Badge>
              ) : (
                <Badge tone="warn">
                  <WifiOff className="size-3" aria-hidden="true" /> Not ready
                </Badge>
              )}
            </Row>
            <Row label="Network" help="Nothing in the app needs the network. Optional web fonts in exports load when viewed online.">
              <Badge tone={online ? 'ok' : 'neutral'}>{online ? 'Online' : 'Offline'}</Badge>
            </Row>
            {pwa.installed ? (
              <Row label="Installed" help={`${BRAND.name} is running as an installed app.`}>
                <Badge tone="ok">Installed</Badge>
              </Row>
            ) : (
              pwa.canInstall && (
                <Row label="Install app" help="Adds an app icon and opens in its own window. Same data, same browser storage.">
                  <Button size="sm" variant="primary" icon={<Download className="size-3.5" aria-hidden="true" />} onClick={() => void install()}>
                    Install app
                  </Button>
                </Row>
              )
            )}
          </Panel>

          <Panel title="Keyboard shortcuts" description="Available inside the builder. ⌘ on macOS, Ctrl elsewhere." icon={<Keyboard className="size-4" aria-hidden="true" />}>
            <table className="w-full text-left text-[13px]">
              <caption className="sr-only">Keyboard shortcuts</caption>
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.12em] text-fg-subtle">
                  <th scope="col" className="pb-2 font-semibold">
                    Action
                  </th>
                  <th scope="col" className="pb-2 text-right font-semibold">
                    Shortcut
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {SHORTCUTS.map(([keys, action]) => (
                  <tr key={keys}>
                    <td className="py-2.5 text-fg-muted">{action}</td>
                    <td className="py-2.5 text-right">
                      {keys === '↑+↓' ? (
                        <span className="inline-flex gap-0.5" aria-label="Arrow up or down">
                          <kbd className="app-kbd">↑</kbd>
                          <kbd className="app-kbd">↓</kbd>
                        </span>
                      ) : (
                        <Shortcut keys={keys} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title="Danger zone" tone="danger" description="Permanently removes every portfolio, image, version and preference stored by this app in this browser.">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-fg-muted">Download JSON backups from My Portfolios first. This cannot be undone.</p>
              <Button variant="danger" loading={wiping} icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setConfirmWipe(true)}>
                Delete all local data
              </Button>
            </div>
          </Panel>
        </div>
      </main>
      <ConfirmDialog
        open={confirmWipe}
        onClose={() => setConfirmWipe(false)}
        onConfirm={() => void wipe()}
        title="Delete all local data?"
        description={`Every portfolio, image and version history stored by ${BRAND.name} in this browser will be erased and the app will reload. There is no server copy to recover from.`}
        confirmLabel="Delete everything"
      />
    </div>
  );
}

function Panel({ title, description, children, tone, icon }: { title: string; description: string; children: ReactNode; tone?: 'danger'; icon?: ReactNode }) {
  const id = `panel-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  return (
    <section aria-labelledby={id} className={cn('rounded-2xl border bg-panel p-5 sm:p-6', tone === 'danger' ? 'border-danger/30' : 'border-line')}>
      <h2 id={id} className={cn('flex items-center gap-2 text-[15px] font-semibold', tone === 'danger' && 'text-danger')}>
        {icon}
        {title}
      </h2>
      <p className="mt-1 text-[13px] text-fg-muted">{description}</p>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function Row({ label, help, children }: { label: string; help: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 first:border-t-0 first:pt-0">
      <div className="min-w-0 max-w-md">
        <p className="text-[13.5px] font-medium">{label}</p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-subtle">{help}</p>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
