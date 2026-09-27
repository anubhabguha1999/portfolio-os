import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/utils/cn';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  hint?: ReactNode;
}

/** Accessible dropdown menu (roving focus, Escape, click-outside), rendered in a portal. */
export function Menu({ trigger, items, align = 'end', label }: { trigger: (props: { ref: (el: HTMLButtonElement | null) => void; onClick: () => void; 'aria-haspopup': 'menu'; 'aria-expanded': boolean; 'aria-controls': string }) => ReactNode; items: Array<MenuItem | 'separator'>; align?: 'start' | 'end'; label: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const width = 220;
    const left = align === 'end' ? Math.max(8, r.right - width) : Math.min(window.innerWidth - width - 8, r.left);
    const below = r.bottom + 6;
    const estimated = items.length * 32 + 12;
    setPos({ top: below + estimated > window.innerHeight ? Math.max(8, r.top - estimated - 6) : below, left });
  }, [open, align, items.length]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])')?.focus());
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !triggerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const els = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? []);
    const i = els.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      els[(i + 1) % els.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      els[(i - 1 + els.length) % els.length]?.focus();
    } else if (e.key === 'Home') els[0]?.focus();
    else if (e.key === 'End') els[els.length - 1]?.focus();
    else if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };

  return (
    <>
      {trigger({ ref: (el) => (triggerRef.current = el), onClick: () => setOpen((o) => !o), 'aria-haspopup': 'menu', 'aria-expanded': open, 'aria-controls': id })}
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            id={id}
            role="menu"
            aria-label={label}
            onKeyDown={onKeyDown}
            style={{ top: pos.top, left: pos.left }}
            className="fixed z-[900] w-[220px] rounded-xl border border-line bg-elevated p-1 shadow-float [animation:app-pop_.14s_var(--ease-out-expo)]"
          >
            {items.map((it, i) =>
              it === 'separator' ? (
                <div key={`sep-${i}`} role="separator" className="my-1 h-px bg-line" />
              ) : (
                <button
                  key={it.label}
                  role="menuitem"
                  type="button"
                  disabled={it.disabled}
                  onClick={() => {
                    close(false);
                    it.onSelect();
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] outline-none disabled:opacity-40',
                    it.danger ? 'text-danger hover:bg-danger/10 focus:bg-danger/10' : 'text-fg hover:bg-hover focus:bg-hover',
                  )}
                >
                  <span className="text-fg-subtle [&_svg]:size-3.5">{it.icon}</span>
                  <span className="flex-1">{it.label}</span>
                  {it.hint && <span className="text-[11px] text-fg-subtle">{it.hint}</span>}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
