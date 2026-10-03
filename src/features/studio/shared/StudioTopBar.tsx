import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Cloud, CloudOff, Loader2, Redo2, Search, Undo2 } from 'lucide-react';
import { IconButton } from '@/components/ui/Button';
import { LogoMark } from '@/components/Logo';
import { cn } from '@/utils/cn';
import { modKey } from '@/utils/download';
import { useGlobalSearch } from '@/features/search/GlobalSearch';

export function SaveBadge({ state }: { state: 'idle' | 'dirty' | 'saving' | 'saved' | 'error' }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px]', state === 'error' ? 'text-danger' : 'text-fg-subtle')} aria-live="polite">
      {state === 'saving' || state === 'dirty' ? <Loader2 className="size-3 animate-spin" /> : state === 'error' ? <CloudOff className="size-3" /> : <Cloud className="size-3" />}
      {state === 'saving' || state === 'dirty' ? 'Saving…' : state === 'error' ? 'Not saved' : 'Saved locally'}
    </span>
  );
}

export function EditableTitle({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      aria-label={label}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft.trim() && draft !== value && onChange(draft.trim())}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setDraft(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="w-[min(260px,40vw)] truncate rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-[13px] font-semibold hover:border-line focus:border-accent focus:outline-none"
    />
  );
}

export interface StudioTopBarProps {
  studio: string;
  back: { to: string; label: string };
  title?: ReactNode;
  save?: 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
  undo?: { canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void };
  center?: ReactNode;
  actions?: ReactNode;
}

export function StudioTopBar({ studio, back, title, save, undo, center, actions }: StudioTopBarProps) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-panel px-2 sm:px-3">
      <Link to={back.to} className="grid size-8 place-items-center rounded-lg text-fg-muted hover:bg-hover hover:text-fg" aria-label={back.label} title={back.label}>
        <ChevronLeft className="size-4" />
      </Link>
      <Link to="/studio" className="hidden items-center gap-2 rounded-md pr-1 sm:inline-flex" aria-label="Dashboard">
        <LogoMark className="size-5" />
        <span className="text-[12.5px] font-semibold tracking-tight text-fg-muted">{studio}</span>
      </Link>
      <span className="hidden h-4 w-px bg-line sm:block" aria-hidden="true" />
      <div className="flex min-w-0 items-center gap-2">
        {title}
        {save && <SaveBadge state={save} />}
      </div>
      {undo && (
        <div className="ml-1 hidden items-center md:flex">
          <IconButton label="Undo (⌘Z)" size="sm" disabled={!undo.canUndo} onClick={undo.onUndo}>
            <Undo2 className="size-4" />
          </IconButton>
          <IconButton label="Redo (⌘⇧Z)" size="sm" disabled={!undo.canRedo} onClick={undo.onRedo}>
            <Redo2 className="size-4" />
          </IconButton>
        </div>
      )}
      <div className="mx-auto hidden min-w-0 items-center gap-2 lg:flex">{center}</div>
      <div className="ml-auto flex items-center gap-1.5">
        <IconButton label={`Search (${modKey}+K)`} size="sm" onClick={() => useGlobalSearch.getState().setOpen(true)}>
          <Search className="size-4" />
        </IconButton>
        {actions}
      </div>
    </header>
  );
}
