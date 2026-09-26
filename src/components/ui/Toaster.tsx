import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { useUI } from '@/stores/ui';
import { cn } from '@/utils/cn';

const icons = { info: Info, success: CheckCircle2, warning: AlertTriangle, error: XCircle };
const tones = { info: 'text-accent', success: 'text-ok', warning: 'text-warn', error: 'text-danger' };

export function Toaster() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[1000] flex flex-col items-center gap-2 px-3 sm:bottom-6 sm:items-end sm:pr-6" aria-live="polite" role="status">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = icons[t.tone];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-elevated/95 px-3.5 py-3 shadow-float backdrop-blur"
            >
              <Icon className={cn('mt-0.5 size-4 shrink-0', tones[t.tone])} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">{t.title}</p>
                {t.description && <p className="mt-0.5 text-[12px] leading-snug text-fg-muted">{t.description}</p>}
                {t.action && (
                  <button
                    className="mt-2 text-[12px] font-semibold text-accent hover:underline"
                    onClick={() => {
                      t.action?.run();
                      dismiss(t.id);
                    }}
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
              <button className="text-fg-subtle hover:text-fg" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
                <X className="size-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
