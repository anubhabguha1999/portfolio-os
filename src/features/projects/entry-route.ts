import { listProjects } from '@/lib/storage/projects';

/** Where "Create Portfolio" should go: the dashboard if work exists, onboarding otherwise. */
export async function createEntryRoute(): Promise<'/projects' | '/new'> {
  try {
    return (await listProjects()).length > 0 ? '/projects' : '/new';
  } catch {
    return '/new';
  }
}
