import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, CornerDownLeft, Search } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Shortcut } from '@/components/ui/misc';

export interface Command {
  id: string;
  label: string;
  group: string;
  icon?: ReactNode;
  shortcut?: string;
  keywords?: string;
  /** Run the command; return a sub-page of commands to drill into instead. */
  run: () => void | Command[];
}

function score(cmd: Command, q: string): number {
  if (!q) return 1;
  const hay = `${cmd.label} ${cmd.keywords ?? ''} ${cmd.group}`.toLowerCase();
  const needle = q.toLowerCase().trim();
  if (cmd.label.toLowerCase().startsWith(needle)) return 100;
  if (hay.includes(needle)) return 60;
  // subsequence match on the label only; across keywords it matches nearly everything
  let i = 0;
  for (const ch of cmd.label.toLowerCase()) if (ch === needle[i]) i++;
  return i === needle.length ? 20 : 0;
}

export function CommandPalette({
  open,
  onClose,
  commands,
  placeholder = 'Type a command or search…',
  label = 'Command palette',
}: {
  open: boolean;
  onClose: () => void;
  commands: Command[];
  placeholder?: string;
  label?: string;
}) {
  const [q, setQ] = useState('');
  const [stack, setStack] = useState<Array<{ title: string; commands: Command[] }>>([]);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const page = stack[stack.length - 1];
  const source = page ? page.commands : commands;

  const results = useMemo(
    () =>
      source
        .map((c) => ({ c, s: score(c, q) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.c)
        .slice(0, 60),
    [source, q],
  );

  useEffect(() => {
    if (open) {
      setQ('');
      setStack([]);
      setActive(0);
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [open]);
  useEffect(() => setActive(0), [q, stack.length]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const exec = (c: Command) => {
    const sub = c.run();
    if (Array.isArray(sub)) {
      setStack((s) => [...s, { title: c.label, commands: sub }]);
      setQ('');
    } else onClose();
  };

  const groups: Array<[string, Command[]]> = [];
  for (const c of results) {
    const g = groups.find((x) => x[0] === c.group);
    if (g) g[1].push(c);
    else groups.push([c.group, [c]]);
  }
  let idx = -1;

  return (
    <div className="fixed inset-0 z-[950] flex items-start justify-center bg-black/45 px-3 pt-[12vh] backdrop-blur-md [animation:app-fade_.12s_ease-out]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={label} className="w-full max-w-[600px] overflow-hidden rounded-2xl border border-line-strong bg-panel shadow-float [animation:app-pop_.18s_var(--ease-out-expo)]">
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          {page ? (
            <button aria-label="Back" onClick={() => setStack((s) => s.slice(0, -1))} className="grid size-6 place-items-center rounded-md text-fg-subtle hover:bg-hover hover:text-fg">
              <ArrowLeft className="size-4" />
            </button>
          ) : (
            <Search className="size-4 text-fg-subtle" aria-hidden="true" />
          )}
          {page && <span className="rounded-md bg-hover px-1.5 py-0.5 text-[11.5px] text-fg-muted">{page.title}</span>}
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={page ? 'Filter…' : placeholder}
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-activedescendant={results[active] ? `cmd-${results[active]!.id}` : undefined}
            className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-fg-subtle"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(results.length - 1, a + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const c = results[active];
                if (c) exec(c);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                if (stack.length) setStack((s) => s.slice(0, -1));
                else onClose();
              } else if (e.key === 'Backspace' && !q && stack.length) {
                setStack((s) => s.slice(0, -1));
              }
            }}
          />
          <kbd className="app-kbd">Esc</kbd>
        </div>
        <ul id="cmdk-list" ref={listRef} role="listbox" aria-label="Commands" className="max-h-[min(420px,60vh)] overflow-y-auto p-1.5">
          {results.length === 0 && <li className="px-3 py-8 text-center text-[13px] text-fg-subtle">No matches</li>}
          {groups.map(([g, cmds]) => (
            <li key={g} role="presentation">
              <p className="px-2.5 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">{g}</p>
              <ul role="presentation">
                {cmds.map((c) => {
                  idx++;
                  const i = idx;
                  return (
                    <li
                      key={c.id}
                      id={`cmd-${c.id}`}
                      role="option"
                      aria-selected={i === active}
                      data-idx={i}
                      onMouseMove={() => setActive(i)}
                      onClick={() => exec(c)}
                      className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-[13px]', i === active ? 'bg-accent-soft text-fg' : 'text-fg-muted')}
                    >
                      <span className={cn('grid size-6 place-items-center rounded-md [&_svg]:size-3.5', i === active ? 'text-accent' : 'text-fg-subtle')}>{c.icon}</span>
                      <span className="flex-1 truncate">{c.label}</span>
                      {c.shortcut && <Shortcut keys={c.shortcut} />}
                      {i === active && !c.shortcut && <CornerDownLeft className="size-3.5 text-fg-subtle" />}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
