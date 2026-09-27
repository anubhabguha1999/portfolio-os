import { AlertTriangle, XCircle } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import type { CheckResult } from '@/lib/analysis/types';
import { cn } from '@/utils/cn';

export interface HealthDialogProps {
  open: boolean;
  issues: CheckResult[];
  targetLabel: string;
  onClose: () => void;
  onFix: (sectionId: string | null) => void;
  onExportAnyway: () => void;
}

export function firstIssueSection(issues: CheckResult[]): string | null {
  for (const c of issues) {
    if (c.sectionId) return c.sectionId;
    const item = c.items?.find((i) => i.sectionId);
    if (item?.sectionId) return item.sectionId;
  }
  return null;
}

export function HealthDialog({ open, issues, targetLabel, onClose, onFix, onExportAnyway }: HealthDialogProps) {
  const fails = issues.filter((i) => i.status === 'fail').length;
  const title = `${issues.length} issue${issues.length === 1 ? '' : 's'} found`;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={`The pre-export health check found ${fails ? `${fails} problem${fails === 1 ? '' : 's'} that will likely show in your ${targetLabel}` : `things worth a look before exporting your ${targetLabel}`}.`}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onExportAnyway}>
            Export anyway
          </Button>
          <Button variant="primary" autoFocus onClick={() => onFix(firstIssueSection(issues))}>
            Fix issues
          </Button>
        </>
      }
    >
      <ul className="-mx-1 space-y-1.5">
        {issues.map((c) => {
          const Icon = c.status === 'fail' ? XCircle : AlertTriangle;
          return (
            <li key={c.id} className="rounded-lg border border-line bg-elevated/60 px-3 py-2.5">
              <div className="flex items-start gap-2.5">
                <Icon className={cn('mt-0.5 size-4 shrink-0', c.status === 'fail' ? 'text-danger' : 'text-warn')} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">
                    <span className="sr-only">{c.status === 'fail' ? 'Problem: ' : 'Warning: '}</span>
                    {c.label}
                  </p>
                  {c.detail && <p className="mt-0.5 text-[12px] leading-snug text-fg-muted">{c.detail}</p>}
                  {!!c.items?.length && (
                    <ul className="mt-1.5 space-y-0.5">
                      {c.items.slice(0, 5).map((it, i) => (
                        <li key={i} className="flex gap-1.5 text-[12px] text-fg-subtle">
                          <span aria-hidden="true">·</span>
                          <span className="min-w-0">{it.message}</span>
                        </li>
                      ))}
                      {c.items.length > 5 && <li className="text-[12px] text-fg-subtle">+ {c.items.length - 5} more</li>}
                    </ul>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
