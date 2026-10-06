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

  // Career tools
  { path: '/bullets', page: lazy(() => import('@/features/bullets/BulletHelperPage')) },
  { path: '/match', page: lazy(() => import('@/features/match/JobMatchPage')) },
  { path: '/linkedin', page: lazy(() => import('@/features/linkedin/LinkedInPage')) },
  { path: '/compare', page: lazy(() => import('@/features/compare/ComparePage')) },
  { path: '/interview', page: lazy(() => import('@/features/interview/InterviewPrepPage')) },
  { path: '/applications/:id', page: lazy(() => import('@/features/applications/ApplicationPage')) },
  { path: '/applications', page: lazy(() => import('@/features/applications/ApplicationsPage')) },
  { path: '/backup', page: lazy(() => import('@/features/backup/BackupPage')) },
  { path: '/assistant', page: lazy(() => import('@/features/assistant/AssistantPage')) },

  { path: '/search', page: lazy(() => import('@/features/search/SearchPage')) },
  { path: '/settings', page: lazy(() => import('@/features/settings/SettingsPage')) },

  // Local build & test runner: only under `npm run dev` (its endpoint is a dev-server plugin), never in a build.
  ...(import.meta.env.DEV ? [{ path: '/runner', page: lazy(() => import('@/features/runner/RunnerPage')) }] : []),
];
