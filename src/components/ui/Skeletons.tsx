import { DeadLockSkeleton } from 'dead-lock-skeleton';
import { cn } from '@/utils/cn';

/**
 * Placeholder card grid shown while a list loads from IndexedDB. The markup mirrors the
 * real cards so the page does not jump when content arrives.
 */
export function CardGridSkeleton({ count = 6, label, className, thumb = 'aspect-[210/297]' }: { count?: number; label: string; className?: string; thumb?: string }) {
  return (
    <DeadLockSkeleton loading as="ul" role="status" aria-busy="true" aria-label={label} className={cn('grid gap-6', className)}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} aria-hidden="true" className="rounded-2xl border border-line bg-panel p-3">
          <div className={cn('skeleton-item w-full rounded-xl', thumb)} />
          <p className="mt-3 w-3/4 text-[13.5px] font-semibold">Loading name</p>
          <p className="mt-1 w-1/2 text-[11.5px]">Loading details</p>
        </li>
      ))}
    </DeadLockSkeleton>
  );
}
