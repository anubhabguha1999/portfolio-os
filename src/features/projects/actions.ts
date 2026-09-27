import { createPortfolio } from '@/lib/portfolio-factory';
import { createProject, listProjects } from '@/lib/storage/projects';
import type { PortfolioTemplate } from '@/templates/types';

/** Create an empty starter project and return its id. */
export async function createBlankProject(): Promise<string> {
  const rec = await createProject(createPortfolio({ title: 'Untitled portfolio' }), 'Untitled portfolio');
  return rec.id;
}

/** Create a project pre-filled with a template's sample content and return its id. */
export async function createProjectFromTemplate(template: PortfolioTemplate): Promise<string> {
  const portfolio = template.create();
  const rec = await createProject(portfolio, `${template.name} portfolio`);
  return rec.id;
}

/** Where "Create Portfolio" should go: the dashboard if work exists, onboarding otherwise. */
export async function createEntryRoute(): Promise<'/projects' | '/new'> {
  try {
    return (await listProjects()).length > 0 ? '/projects' : '/new';
  } catch {
    return '/new';
  }
}
