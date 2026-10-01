import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CopyPlus, Link2Off, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { renderPortfolio } from '@/lib/engine/render';
import { createProject } from '@/lib/storage/projects';
import { toast } from '@/stores/ui';
import { uid } from '@/utils/id';
import { BRAND } from '@/config/brand';
import type { Portfolio } from '@/types/portfolio';
import { decodeShare, ShareDecodeError } from './share-codec';

type Decoded = { ok: true; portfolio: Portfolio; html: string } | { ok: false; message: string; issues: string[] };

function decode(payload: string | null): Decoded {
  if (!payload) return { ok: false, message: 'This link does not contain a portfolio.', issues: [] };
  try {
    const portfolio = decodeShare(payload);
    const { html } = renderPortfolio(portfolio, { mode: 'export' });
    return { ok: true, portfolio, html };
  } catch (err) {
    if (err instanceof ShareDecodeError) return { ok: false, message: err.message, issues: err.issues };
    return { ok: false, message: err instanceof Error ? err.message : 'The shared portfolio could not be displayed.', issues: [] };
  }
}

/** `/view#p=<payload>` — renders a shared portfolio entirely from the URL fragment. */
export default function ViewPage() {
  const [params] = useSearchParams();
  const { hash } = useLocation();
  // The fragment is the current format; `?p=` is accepted for links made before clean URLs.
  const payload = new URLSearchParams(hash.replace(/^#/, '')).get('p') ?? params.get('p');
  const result = useMemo(() => decode(payload), [payload]);
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [toolbar, setToolbar] = useState(true);

  useEffect(() => {
    const prev = document.title;
    document.title = result.ok ? `${result.portfolio.metadata.title || 'Shared portfolio'} · ${BRAND.name}` : `Broken link · ${BRAND.name}`;
    return () => {
      document.title = prev;
    };
  }, [result]);

  if (!result.ok) {
    return (
      <main className="grid min-h-dvh place-items-center bg-bg px-4 py-10 text-fg">
        <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-6 text-center shadow-float">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl border border-line bg-elevated text-fg-muted">
            <Link2Off className="size-5" aria-hidden="true" />
          </div>
          <h1 className="text-[16px] font-semibold tracking-tight">This share link can’t be opened</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">{result.message}</p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-fg-subtle">Links sometimes get cut off when pasted into chat apps or emails. Ask the sender to copy the full link again, or to send an exported file instead.</p>
          {result.issues.length > 0 && (
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-[12px] text-fg-subtle hover:text-fg-muted">Technical details</summary>
              <ul className="mt-2 max-h-40 space-y-1 overflow-auto rounded-lg border border-line bg-bg p-2.5 font-mono text-[11px] text-fg-muted">
                {result.issues.slice(0, 20).map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="mt-6 flex justify-center gap-2">
            <Link to="/" className="inline-flex h-9 items-center rounded-lg bg-accent px-3.5 text-[13px] font-semibold text-accent-fg hover:bg-accent-strong">
              Go to {BRAND.name}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const saveCopy = async () => {
    setSaving(true);
    try {
      const copy: Portfolio = { ...structuredClone(result.portfolio), id: uid('pf') };
      const rec = await createProject(copy, copy.metadata.title || 'Shared portfolio');
      toast({ title: 'Saved to your projects', description: 'It is stored only in this browser.', tone: 'success' });
      navigate(`/builder/${rec.id}`);
    } catch (err) {
      toast({ title: 'Could not save a copy', description: err instanceof Error ? err.message : String(err), tone: 'error' });
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white">
      <iframe
        title={result.portfolio.metadata.title || 'Shared portfolio'}
        srcDoc={result.html}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
        className="size-full border-0"
      />
      {toolbar ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-10 flex justify-center px-3">
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-line bg-panel/90 py-1.5 pl-3.5 pr-1.5 text-fg shadow-float backdrop-blur-md" role="toolbar" aria-label="Shared portfolio">
            <Link to="/" className="mr-1 text-[12px] font-medium text-fg-muted hover:text-fg">
              Shared via <span className="text-fg">{BRAND.name}</span>
            </Link>
            <Button size="sm" variant="primary" className="rounded-full" onClick={saveCopy} loading={saving} icon={<CopyPlus className="size-4" aria-hidden="true" />}>
              Save a copy
            </Button>
            <button type="button" onClick={() => setToolbar(false)} className="grid size-8 place-items-center rounded-full text-fg-subtle hover:bg-hover hover:text-fg" aria-label="Hide toolbar">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setToolbar(true)} className="fixed bottom-4 right-4 z-10 rounded-full border border-line bg-panel/90 px-3 py-1.5 text-[12px] font-medium text-fg-muted shadow-float backdrop-blur-md hover:text-fg">
          {BRAND.name}
        </button>
      )}
    </div>
  );
}
