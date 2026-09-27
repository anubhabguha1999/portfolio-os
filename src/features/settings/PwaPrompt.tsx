import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { RefreshCw, WifiOff, X } from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';
import { dismissUpdate, markOfflineReady, markUpdateReady, reloadToUpdate, usePwa } from './pwa';

const OFFLINE_NOTICE_KEY = 'pos-offline-ready-shown';
let registered = false;

function register(): void {
  if (registered || typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  registered = true;
  try {
    const update = registerSW({
      immediate: true,
      onNeedRefresh() {
        markUpdateReady(update);
      },
      onOfflineReady() {
        markOfflineReady();
      },
      onRegisterError(error: unknown) {
        console.warn('Service worker registration failed', error);
      },
    });
  } catch (err) {
    console.warn('Service worker unavailable', err);
  }
}

function alreadyShown(): boolean {
  try {
    return localStorage.getItem(OFFLINE_NOTICE_KEY) === '1';
  } catch {
    return true;
  }
}

/** Update-available and ready-offline notices. Registers the service worker once. */
export function PwaPrompt() {
  const { updateReady, offlineReady } = usePwa();
  const reduced = useReducedMotion() ?? false;
  const [showOffline, setShowOffline] = useState(false);
  const [reloading, setReloading] = useState(false);

  useEffect(register, []);

  useEffect(() => {
    if (!offlineReady || alreadyShown()) return;
    setShowOffline(true);
    try {
      localStorage.setItem(OFFLINE_NOTICE_KEY, '1');
    } catch {
      /* storage unavailable */
    }
    const id = window.setTimeout(() => setShowOffline(false), 7000);
    return () => window.clearTimeout(id);
  }, [offlineReady]);

  const card = reduced ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } } : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 8 } };

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-[60] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2" aria-live="polite">
      <AnimatePresence>
        {updateReady && (
          <motion.div key="update" {...card} role="status" className="pointer-events-auto flex items-center gap-3 rounded-xl border border-line bg-elevated p-3 shadow-float">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
              <RefreshCw className="size-4" aria-hidden="true" />
            </span>
            <p className="min-w-0 flex-1 text-[13px]">New version available</p>
            <button
              type="button"
              disabled={reloading}
              onClick={() => {
                setReloading(true);
                void reloadToUpdate();
              }}
              className="h-8 rounded-lg bg-accent px-3 text-[12.5px] font-semibold text-accent-fg hover:bg-accent-strong disabled:opacity-60"
            >
              {reloading ? 'Reloading…' : 'Reload'}
            </button>
            <button type="button" onClick={dismissUpdate} aria-label="Dismiss update notice" className="grid size-7 place-items-center rounded-md text-fg-subtle hover:bg-hover hover:text-fg">
              <X className="size-3.5" />
            </button>
          </motion.div>
        )}
        {showOffline && (
          <motion.div key="offline" {...card} role="status" className="pointer-events-auto flex items-center gap-3 rounded-xl border border-line bg-elevated p-3 shadow-float">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ok/10 text-ok">
              <WifiOff className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium">Ready to work offline</p>
              <p className="text-[12px] text-fg-muted">The app is cached on this device.</p>
            </div>
            <button type="button" onClick={() => setShowOffline(false)} aria-label="Dismiss offline notice" className="grid size-7 place-items-center rounded-md text-fg-subtle hover:bg-hover hover:text-fg">
              <X className="size-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
