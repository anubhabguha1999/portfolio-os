import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Toaster } from '@/components/ui/Toaster';
import { Spinner } from '@/components/ui/Button';
import { PwaPrompt } from '@/features/settings/PwaPrompt';
import { ScrollToTop } from './ScrollToTop';
import { VercelAnalytics } from './VercelAnalytics';
import { RouteSeo } from './RouteSeo';

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
const StudioDashboard = lazy(() => import('@/features/studio/dashboard/StudioDashboard'));
const ProfileStudioPage = lazy(() => import('@/features/studio/profile/ProfileStudioPage'));
const ResumesPage = lazy(() => import('@/features/studio/resume/ResumesPage'));
const ResumeStudioPage = lazy(() => import('@/features/studio/resume/ResumeStudioPage'));
const DocumentsPage = lazy(() => import('@/features/studio/documents/DocumentsPage'));
const DocumentStudioPage = lazy(() => import('@/features/studio/documents/DocumentStudioPage'));
const KnowledgePage = lazy(() => import('@/features/knowledge/KnowledgePage'));
const KnowledgeDocPage = lazy(() => import('@/features/knowledge/KnowledgeDocPage'));

function PageFallback() {
  return (
    <div className="grid h-full min-h-[60vh] place-items-center text-fg-subtle" role="status" aria-label="Loading">
      <Spinner className="size-5" />
    </div>
  );
}

/**
 * Clean paths (/resumes, /templates…) so every public page is its own crawlable URL.
 * Share payloads still travel in the fragment (/view#p=…), which is never sent to a server.
 * Legacy /#/route links are rewritten in main.tsx before the router starts.
 */
export function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <RouteSeo />
      <VercelAnalytics />
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
            <Route path="/studio" element={<StudioDashboard />} />
            <Route path="/profile" element={<ProfileStudioPage />} />
            <Route path="/resumes" element={<ResumesPage />} />
            <Route path="/resume/:resumeId" element={<ResumeStudioPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/document/:id" element={<DocumentStudioPage />} />
            <Route path="/knowledge" element={<KnowledgePage />} />
            <Route path="/knowledge/:id" element={<KnowledgeDocPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      <Toaster />
      <PwaPrompt />
    </BrowserRouter>
  );
}
