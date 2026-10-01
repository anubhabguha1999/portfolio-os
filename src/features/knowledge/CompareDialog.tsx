import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Segmented } from '@/components/ui/Field';
import { compareExtractions, type Change } from '@/knowledge/analysis/compare';
import { currentExtraction, getDoc, getExtraction } from '@/knowledge/storage/repo';
import type { Extraction } from '@/knowledge/types';
import { cn } from '@/utils/cn';

const tone: Record<Change, string> = {
  added: 'bg-ok/10 text-ok',
  removed: 'bg-danger/10 text-danger line-through decoration-danger/50',
  same: 'text-fg-muted',
};
const mark: Record<Change, string> = { added: '+', removed: '−', same: ' ' };

/** Compare the current extraction of two documents, or two extraction versions (ids prefixed "v:"). */
export function CompareDialog({ open, onClose, docA, docB, title }: { open: boolean; onClose: () => void; docA: string; docB: string; title?: string }) {
  const [pair, setPair] = useState<{ a: Extraction; b: Extraction; la: string; lb: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'data' | 'text'>('data');

  useEffect(() => {
    if (!open) return;
    let live = true;
    void (async () => {
      const load = async (ref: string): Promise<[Extraction | null, string]> => {
        if (ref.startsWith('v:')) {
          const e = (await getExtraction(ref.slice(2))) ?? null;
          return [e, e ? `v${e.version} · ${e.label}` : ''];
        }
        const d = await getDoc(ref);
        return [d ? await currentExtraction(d) : null, d?.name ?? ''];
      };
      const [[a, la], [b, lb]] = await Promise.all([load(docA), load(docB)]);
      if (!live) return;
      if (!a || !b) setError('Both versions need an extraction to compare.');
      else setPair({ a, b, la, lb });
    })();
    return () => {
      live = false;
    };
  }, [open, docA, docB]);

  const diff = pair ? compareExtractions(pair.a, pair.b) : null;
  const changes = diff ? diff.lists.reduce((n, l) => n + l.rows.filter((r) => r.change !== 'same').length, 0) + diff.fields.length : 0;

  return (
    <Dialog open={open} onClose={onClose} size="xl" title={title ?? 'Compare versions'} description={pair ? `${pair.la}  →  ${pair.lb}` : undefined}>
      {error && <p className="text-[13px] text-danger">{error}</p>}
      {diff && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented value={view} onChange={setView} options={[{ value: 'data', label: 'Structured data' }, { value: 'text', label: 'Text' }]} />
            <p className="text-[12px] text-fg-subtle">{view === 'data' ? `${changes} change${changes === 1 ? '' : 's'} in structured data` : `${diff.text.filter((t) => t.change !== 'same').length} changed lines`}</p>
          </div>
          {view === 'data' ? (
            <div className="mt-4 grid gap-5">
              {diff.fields.length > 0 && (
                <section>
                  <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">Profile</h3>
                  <dl className="mt-2 grid gap-2">
                    {diff.fields.map((f) => (
                      <div key={f.label} className="grid gap-1 rounded-lg border border-line p-2.5 text-[12.5px] sm:grid-cols-[110px_1fr_1fr]">
                        <dt className="font-medium">{f.label}</dt>
                        <dd className={cn('rounded px-1.5', tone.removed)}>{f.before || '—'}</dd>
                        <dd className={cn('rounded px-1.5', tone.added)}>{f.after || '—'}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}
              <div className="grid gap-5 sm:grid-cols-2">
                {diff.lists.map((l) => (
                  <section key={l.label}>
                    <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">{l.label}</h3>
                    <ul className="mt-2 grid gap-0.5 font-mono text-[12px]">
                      {l.rows.map((r, i) => (
                        <li key={i} className={cn('flex gap-2 rounded px-2 py-0.5', tone[r.change])}>
                          <span aria-hidden="true">{mark[r.change]}</span>
                          <span className="min-w-0 flex-1">{r.text}</span>
                          {r.change !== 'same' && <span className="text-[10.5px] uppercase">{r.change === 'added' ? '↑ Added' : 'Removed'}</span>}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
              {!diff.lists.length && !diff.fields.length && <p className="text-[13px] text-fg-muted">No structured data to compare. Switch to Text.</p>}
            </div>
          ) : (
            <pre className="mt-4 max-h-[60vh] overflow-auto rounded-xl border border-line bg-bg p-3 font-mono text-[12px] leading-relaxed">
              {diff.text.map((t, i) => (
                <div key={i} className={cn('whitespace-pre-wrap px-1', tone[t.change])}>
                  {mark[t.change]} {t.text}
                </div>
              ))}
            </pre>
          )}
        </>
      )}
    </Dialog>
  );
}
