import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ChevronDown, ChevronUp, Copy, Eraser, Search, Square } from 'lucide-react';
import { IconButton } from '@/components/ui/Button';
import { toast } from '@/stores/ui';
import { cn } from '@/utils/cn';
import { stripAnsi } from './commands';
import type { RunState } from './useRunner';

/** Colour test and build lines by their own markers; everything else stays plain. */
function lineTone(line: string): string {
  if (/^\s*(✓|√|PASS\b)/.test(line)) return 'text-ok';
  if (/^\s*(✕|×|✗|FAIL\b)|\b(error|Error)\b.*:/.test(line)) return 'text-danger';
  if (/^\s*(⚠|warn(ing)?\b)/i.test(line)) return 'text-warn';
  if (/^\s*>/.test(line)) return 'text-fg-subtle';
  return '';
}

export function OutputPanel({ run, output, onClear, onStop }: { run: RunState | null; output: string; onClear: () => void; onStop: () => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);
  const [query, setQuery] = useState('');
  const [hit, setHit] = useState(0);
  const lines = useMemo(() => stripAnsi(output).replace(/\r(?!\n)/g, '\n').split(/\r?\n/), [output]);
  const q = query.trim().toLowerCase();
  const matches = useMemo(() => (q ? lines.flatMap((l, i) => (l.toLowerCase().includes(q) ? [i] : [])) : []), [lines, q]);

  // Stick to the bottom while new output arrives, unless the user scrolled up.
  useLayoutEffect(() => {
    if (follow && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [lines, follow]);

  useEffect(() => setHit(0), [q]);
  useEffect(() => {
    const line = matches[hit];
    if (line === undefined) return;
    setFollow(false);
    scroller.current?.querySelector(`[data-line="${line}"]`)?.scrollIntoView({ block: 'center' });
  }, [hit, matches]);

  const copy = async () => {
    const text = `${run ? `$ ${run.command}\n\n` : ''}${stripAnsi(output)}`;
    try {
      await navigator.clipboard.writeText(text);
      toast({ tone: 'success', title: 'Output copied' });
    } catch {
      toast({ tone: 'error', title: 'Could not copy', description: 'The clipboard is not available here.' });
    }
  };

  const mark = (line: string) => {
    if (!q) return line;
    const out: Array<string | React.ReactElement> = [];
    const lower = line.toLowerCase();
    let at = 0;
    for (let i = lower.indexOf(q); i !== -1; i = lower.indexOf(q, at)) {
      out.push(line.slice(at, i), <mark key={i} className="rounded-sm bg-warn/40 text-fg">{line.slice(i, i + q.length)}</mark>);
      at = i + q.length;
    }
    out.push(line.slice(at));
    return out;
  };

  const empty = !run && !output;
  return (
    <section aria-label="Output" className="flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-[#0b0b0f]">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <p className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-fg-muted" title={run?.command}>
          {run ? <><span className="text-fg-subtle">$</span> {run.command}</> : 'Output'}
        </p>
        <label className="flex h-7 items-center gap-1.5 rounded-md border border-line bg-panel px-2 focus-within:border-accent">
          <Search className="size-3.5 text-fg-subtle" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && matches.length) setHit((h) => (e.shiftKey ? (h - 1 + matches.length) % matches.length : (h + 1) % matches.length));
              if (e.key === 'Escape') {
                e.stopPropagation();
                setQuery('');
              }
            }}
            placeholder="Search output"
            aria-label="Search output"
            className="w-28 bg-transparent text-[12px] outline-none placeholder:text-fg-subtle sm:w-36"
          />
          {q && <span className="text-[11px] tabular-nums text-fg-subtle">{matches.length ? `${hit + 1}/${matches.length}` : '0'}</span>}
        </label>
        {q && matches.length > 1 && (
          <>
            <IconButton size="xs" label="Previous match" onClick={() => setHit((h) => (h - 1 + matches.length) % matches.length)}>
              <ChevronUp className="size-3.5" />
            </IconButton>
            <IconButton size="xs" label="Next match" onClick={() => setHit((h) => (h + 1) % matches.length)}>
              <ChevronDown className="size-3.5" />
            </IconButton>
          </>
        )}
        <IconButton size="xs" label="Copy output" onClick={() => void copy()} disabled={empty}>
          <Copy className="size-3.5" />
        </IconButton>
        <IconButton size="xs" label="Clear output (⌘K)" onClick={onClear} disabled={!output}>
          <Eraser className="size-3.5" />
        </IconButton>
        {run?.status === 'running' && (
          <button type="button" onClick={onStop} className="inline-flex h-7 items-center gap-1.5 rounded-md border border-danger/30 bg-danger/10 px-2.5 text-[12px] font-medium text-danger hover:bg-danger/20">
            <Square className="size-3 fill-current" /> Stop
          </button>
        )}
      </div>
      <div className="relative min-h-0 flex-1">
        <div
          ref={scroller}
          tabIndex={0}
          aria-label="Command output"
          aria-live={run?.status === 'running' ? 'off' : 'polite'}
          onScroll={(e) => {
            const el = e.currentTarget;
            setFollow(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
          }}
          className="absolute inset-0 overflow-auto px-4 py-3 font-mono text-[12.5px] leading-[1.6] text-[#d6d7de] outline-none"
        >
          {empty ? (
            <p className="text-fg-subtle">Run a script to see its output here.</p>
          ) : (
            <pre className="whitespace-pre-wrap break-words">
              {lines.map((l, i) => (
                <div key={i} data-line={i} className={cn(lineTone(l), matches[hit] === i && 'bg-warn/10')}>
                  {l ? mark(l) : ' '}
                </div>
              ))}
            </pre>
          )}
        </div>
        {!follow && run?.status === 'running' && (
          <button type="button" onClick={() => setFollow(true)} className="absolute bottom-3 right-4 inline-flex items-center gap-1 rounded-full border border-line bg-panel px-2.5 py-1 text-[11.5px] text-fg-muted shadow-float hover:text-fg">
            <ArrowDown className="size-3" /> Follow output
          </button>
        )}
      </div>
    </section>
  );
}
