import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * Every page, by area. Each one is its own lazily loaded chunk.
 * SEO for these paths lives in src/config/seo-routes.json.
 */
export interface AppRoute {
  path: string;
  page: LazyExoticComponent<ComponentType>;
}

export const ROUTES: AppRoute[] = [
  // Marketing
  { path: '/', page: lazy(() => import('@/features/landing/LandingPage')) },
  { path: '/about', page: lazy(() => import('@/features/landing/AboutPage')) },
  { path: '/templates', page: lazy(() => import('@/features/templates/TemplatesPage')) },

  // Portfolio Studio
  { path: '/projects', page: lazy(() => import('@/features/projects/ProjectsPage')) },
  { path: '/new', page: lazy(() => import('@/features/projects/NewProjectPage')) },
  { path: '/builder/:projectId', page: lazy(() => import('@/features/builder/BuilderPage')) },
  { path: '/preview/:projectId', page: lazy(() => import('@/features/preview/PreviewPage')) },
  { path: '/export/:projectId', page: lazy(() => import('@/features/export/ExportStudioPage')) },
  { path: '/deploy/:projectId', page: lazy(() => import('@/features/deploy/DeployPage')) },
  { path: '/view', page: lazy(() => import('@/features/share/ViewPage')) },

  // Studios
  { path: '/studio', page: lazy(() => import('@/features/studio/dashboard/StudioDashboard')) },
  { path: '/profile', page: lazy(() => import('@/features/studio/profile/ProfileStudioPage')) },
  { path: '/resumes', page: lazy(() => import('@/features/studio/resume/ResumesPage')) },
  { path: '/resumes/new', page: lazy(() => import('@/features/studio/resume/NewResumePage')) },
  { path: '/resume/:resumeId', page: lazy(() => import('@/features/studio/resume/ResumeStudioPage')) },
  { path: '/documents', page: lazy(() => import('@/features/studio/documents/DocumentsPage')) },
  { path: '/document/:id', page: lazy(() => import('@/features/studio/documents/DocumentStudioPage')) },

  // Extract Your Data
  { path: '/knowledge', page: lazy(() => import('@/features/knowledge/KnowledgePage')) },
  { path: '/knowledge/:id', page: lazy(() => import('@/features/knowledge/KnowledgeDocPage')) },

  { path: '/settings', page: lazy(() => import('@/features/settings/SettingsPage')) },

  // Local build & test runner: only under `npm run dev` (its endpoint is a dev-server plugin), never in a build.
  ...(import.meta.env.DEV ? [{ path: '/runner', page: lazy(() => import('@/features/runner/RunnerPage')) }] : []),
];
