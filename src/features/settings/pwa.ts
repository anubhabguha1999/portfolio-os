/**
 * PWA runtime state shared by the prompt and the Settings page:
 * - captures `beforeinstallprompt` as early as possible (it fires once, at load)
 * - tracks whether a service-worker update is waiting.
 * Exposed as tiny external stores for `useSyncExternalStore`.
 */
import { useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface PwaState {
  /** An install prompt is available (Chromium browsers, not yet installed). */
  canInstall: boolean;
  /** Running as an installed app (standalone display mode). */
  installed: boolean;
  /** A new service worker is waiting to take over. */
  updateReady: boolean;
  /** The app shell has been precached for offline use during this session. */
  offlineReady: boolean;
}

let deferred: BeforeInstallPromptEvent | null = null;
let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null;
let state: PwaState = { canInstall: false, installed: isStandalone(), updateReady: false, offlineReady: false };
const listeners = new Set<() => void>();

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true;
}

function set(patch: Partial<PwaState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    set({ canInstall: true });
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    set({ canInstall: false, installed: true });
  });
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function usePwa(): PwaState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** Show the browser's install dialog. Resolves to true when the user accepts. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const ev = deferred;
  deferred = null;
  set({ canInstall: false });
  await ev.prompt();
  const choice = await ev.userChoice;
  if (choice.outcome === 'accepted') set({ installed: true });
  return choice.outcome === 'accepted';
}

export function markUpdateReady(apply: (reload?: boolean) => Promise<void>): void {
  applyUpdate = apply;
  set({ updateReady: true });
}

export function markOfflineReady(): void {
  set({ offlineReady: true });
}

export function dismissUpdate(): void {
  set({ updateReady: false });
}

/** Activate the waiting service worker and reload into the new version. */
export async function reloadToUpdate(): Promise<void> {
  if (applyUpdate) await applyUpdate(true);
  else window.location.reload();
}
