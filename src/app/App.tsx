import { lazy, Suspense } from 'react';
import { HashRouter, Route, Routes, Navigate } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Toaster } from '@/components/ui/Toaster';
import { Spinner } from '@/components/ui/Button';
import { PwaPrompt } from '@/features/settings/PwaPrompt';

const LandingPage = lazy(() => import('@/features/landing/LandingPage'));
const ProjectsPage = lazy(() => import('@/features/projects/ProjectsPage'));
const NewProjectPage = lazy(() => import('@/features/projects/NewProjectPage'));
const TemplatesPage = lazy(() => import('@/features/templates/TemplatesPage'));
const BuilderPage = lazy(() => import('@/features/builder/BuilderPage'));
const PreviewPage = lazy(() => import('@/features/preview/PreviewPage'));
const ExportStudioPage = lazy(() => import('@/features/export/ExportStudioPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const AboutPage = lazy(() => import('@/features/landing/AboutPage'));
const ViewPage = lazy(() => import('@/features/share/ViewPage'));

function PageFallback() {
  return (
    <div className="grid h-full min-h-[60vh] place-items-center text-fg-subtle" role="status" aria-label="Loading">
      <Spinner className="size-5" />
    </div>
  );
}

/**
 * HashRouter keeps every route (and share payloads) in the URL fragment, so the app
 * works from any static host or file path without server rewrites.
 */
export function App() {
  return (
    <HashRouter>
      <ErrorBoundary area="Application">
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/new" element={<NewProjectPage />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/builder/:projectId" element={<BuilderPage />} />
            <Route path="/preview/:projectId" element={<PreviewPage />} />
            <Route path="/export/:projectId" element={<ExportStudioPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/view" element={<ViewPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      <Toaster />
      <PwaPrompt />
    </HashRouter>
  );
}
