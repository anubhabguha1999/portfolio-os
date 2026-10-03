import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageFallback } from '@/components/PageFallback';
import { WhenIdle } from '@/components/WhenIdle';
import { Toaster } from '@/components/ui/Toaster';
import { GlobalSearch } from '@/features/search/GlobalSearch';
import { ROUTER_BASENAME } from '@/utils/base';
import { ROUTES } from './routes';
import { RouteSeo } from './RouteSeo';
import { ScrollToTop } from './ScrollToTop';
import { VercelInsights } from './VercelAnalytics';

// Update / offline notices have nothing to show at startup, so they (and their animation library) load when idle.
const PwaPrompt = lazy(() => import('@/features/settings/PwaPrompt').then((m) => ({ default: m.PwaPrompt })));

/**
 * Clean paths (/resumes, /templates…) so every public page is its own crawlable URL.
 * Share payloads still travel in the fragment (/view#p=…), which is never sent to a server.
 * Legacy /#/route links are rewritten in main.tsx before the router starts.
 */
export function App() {
  return (
    <BrowserRouter basename={ROUTER_BASENAME}>
      <ScrollToTop />
      <RouteSeo />
      <VercelInsights />
      <ErrorBoundary area="Application">
        <Suspense fallback={<PageFallback />}>
          <Routes>
            {ROUTES.map(({ path, page: Page }) => (
              <Route key={path} path={path} element={<Page />} />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      <GlobalSearch />
      <Toaster />
      <WhenIdle>
        <PwaPrompt />
      </WhenIdle>
    </BrowserRouter>
  );
}
