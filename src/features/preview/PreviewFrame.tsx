import { forwardRef, useDeferredValue, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { Portfolio } from '@/types/portfolio';
import { renderPortfolio } from '@/lib/engine/render';
import { useAssets } from '@/stores/assets';
import { cn } from '@/utils/cn';

export interface PreviewFrameHandle {
  present(on: boolean): void;
  print(): void;
  scrollToSection(id: string): void;
  focus(): void;
}

export interface PreviewFrameProps {
  portfolio: Portfolio;
  /** Editing aids: hover outlines, click-to-select, disabled navigation. */
  editing?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onPresentExit?: () => void;
  className?: string;
  title?: string;
  /** Allow links to open new tabs (full preview mode). */
  allowPopups?: boolean;
}

type InMessage = { type: 'pos:ready' } | { type: 'pos:select'; id: string } | { type: 'pos:present-exit' };

function isInMessage(v: unknown): v is InMessage {
  if (!v || typeof v !== 'object') return false;
  const t = (v as { type?: unknown }).type;
  if (t === 'pos:select') return typeof (v as { id?: unknown }).id === 'string';
  return t === 'pos:ready' || t === 'pos:present-exit';
}

/**
 * Live preview. The iframe is sandboxed WITHOUT allow-same-origin, so portfolio
 * markup runs in an opaque origin and can never touch the app or its storage.
 * The document is created once; afterwards only the body/CSS are patched via
 * postMessage, so edits apply instantly without reloads or scroll jumps.
 */
export const PreviewFrame = forwardRef<PreviewFrameHandle, PreviewFrameProps>(function PreviewFrame(
  { portfolio, editing = false, selectedId = null, onSelect, onPresentExit, className, title = 'Portfolio preview', allowPopups = false },
  ref,
) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const deferred = useDeferredValue(portfolio);
  const blobs = useAssets((s) => s.blobs);
  const handlers = useRef({ onSelect, onPresentExit });
  handlers.current = { onSelect, onPresentExit };

  // Initial document — built once per mount / sandbox mode.
  const [srcDoc] = useState(() => renderPortfolio(portfolio, { mode: 'preview', editing }).html);

  const rendered = useMemo(() => renderPortfolio(deferred, { mode: 'preview', editing }), [deferred, editing]);

  // The iframe element paints this until the document inside repaints (e.g. right after the
  // canvas grows), so it must match the page — a white default shows up as a white bar.
  const pageBg = useMemo(() => {
    const { theme, settings } = deferred;
    const prefersDark = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const scheme = settings.colorScheme === 'system' ? (prefersDark ? 'dark' : 'light') : settings.colorScheme;
    return (theme.palettes[scheme] ?? theme.palettes[theme.defaultScheme])?.background;
  }, [deferred]);

  const post = (msg: unknown) => iframeRef.current?.contentWindow?.postMessage(msg, '*');

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow || !isInMessage(e.data)) return;
      if (e.data.type === 'pos:ready') setReady(true);
      else if (e.data.type === 'pos:select') handlers.current.onSelect?.(e.data.id);
      else if (e.data.type === 'pos:present-exit') handlers.current.onPresentExit?.();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Assets are sent as Blobs; the iframe creates its own object URLs.
  useEffect(() => {
    if (ready) post({ type: 'pos:assets', assets: blobs });
  }, [ready, blobs]);

  useEffect(() => {
    if (!ready) return;
    const scheme = deferred.settings.colorScheme === 'system' ? null : deferred.settings.colorScheme;
    post({ type: 'pos:render', css: rendered.css, body: rendered.body, rootClass: rendered.rootClass, scheme, config: rendered.config, editing });
  }, [ready, rendered, deferred.settings.colorScheme, editing]);

  useEffect(() => {
    if (ready) post({ type: 'pos:select', id: selectedId, scroll: false });
  }, [ready, selectedId, rendered]);

  useImperativeHandle(ref, () => ({
    present: (on) => post({ type: 'pos:present', on }),
    print: () => post({ type: 'pos:print' }),
    scrollToSection: (id) => post({ type: 'pos:select', id, scroll: true }),
    focus: () => iframeRef.current?.focus(),
  }));

  return (
    <iframe
      ref={iframeRef}
      title={title}
      srcDoc={srcDoc}
      sandbox={cn('allow-scripts allow-modals', allowPopups && 'allow-popups allow-popups-to-escape-sandbox')}
      referrerPolicy="no-referrer"
      className={cn('block h-full w-full border-0 bg-white', className)}
      style={pageBg ? { background: pageBg } : undefined}
    />
  );
});
