import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { IconButton } from './Button';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Render as a bottom sheet on small screens. */
  sheetOnMobile?: boolean;
  className?: string;
  bodyClassName?: string;
}

const widths = { sm: 'w-[min(420px,calc(100vw-24px))]', md: 'w-[min(560px,calc(100vw-24px))]', lg: 'w-[min(760px,calc(100vw-24px))]', xl: 'w-[min(1040px,calc(100vw-24px))]', full: 'w-[calc(100vw-24px)] h-[calc(100dvh-24px)]' };

/**
 * Native <dialog> modal: focus trapping, Escape handling and inert background come
 * from the platform.
 */
export function Dialog({ open, onClose, title, description, children, footer, size = 'md', sheetOnMobile = true, className, bodyClassName }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      try {
        d.showModal();
      } catch {
        d.setAttribute('open', '');
      }
    } else if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      closeRef.current();
    };
    d.addEventListener('cancel', onCancel);
    return () => d.removeEventListener('cancel', onCancel);
  }, []);

  return (
    <dialog
      ref={ref}
      className={cn('app-dialog', sheetOnMobile && 'max-sm:m-0 max-sm:mt-auto max-sm:w-full')}
      aria-labelledby="dlg-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open && (
        <div
          className={cn(
            'app-dialog-panel flex max-h-[calc(100dvh-24px)] flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-float',
            widths[size],
            sheetOnMobile && 'max-sm:w-screen max-sm:max-h-[88dvh] max-sm:rounded-b-none max-sm:[animation:app-sheet_.28s_var(--ease-out-expo)]',
            className,
          )}
        >
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 id="dlg-title" className="text-[15px] font-semibold tracking-tight">
                {title}
              </h2>
              {description && <p className="mt-1 text-[13px] text-fg-muted">{description}</p>}
            </div>
            <IconButton label="Close" onClick={onClose} className="-mr-1.5 -mt-1">
              <X className="size-4" />
            </IconButton>
          </header>
          <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4', bodyClassName)}>{children}</div>
          {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-bg/40 px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  tone = 'danger',
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button className="h-9 rounded-lg px-3.5 text-[13px] font-medium text-fg-muted hover:bg-hover hover:text-fg" onClick={onClose}>
            Cancel
          </button>
          <button
            autoFocus
            className={cn('h-9 rounded-lg px-3.5 text-[13px] font-semibold', tone === 'danger' ? 'bg-danger text-white hover:opacity-90' : 'bg-accent text-accent-fg hover:bg-accent-strong')}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-[13px] leading-relaxed text-fg-muted">{description}</div>
    </Dialog>
  );
}
