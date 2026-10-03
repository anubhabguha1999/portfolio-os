import { Suspense, useEffect, useState, type ReactNode } from 'react';

/** Mounts its children once the browser is idle, for UI that has nothing to show at startup. */
export function WhenIdle({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const ric = window.requestIdleCallback as ((cb: () => void, o?: { timeout: number }) => number) | undefined;
    if (ric) {
      const id = ric(() => setReady(true), { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(() => setReady(true), 1500);
    return () => window.clearTimeout(id);
  }, []);
  return ready ? <Suspense fallback={null}>{children}</Suspense> : null;
}
