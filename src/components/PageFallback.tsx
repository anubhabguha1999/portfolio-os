import { Spinner } from '@/components/ui/Button';

/** Shown while a lazily loaded page downloads. */
export function PageFallback() {
  return (
    <div className="grid h-full min-h-[60vh] place-items-center text-fg-subtle" role="status" aria-label="Loading">
      <Spinner className="size-5" />
    </div>
  );
}
