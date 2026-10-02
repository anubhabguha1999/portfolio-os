import { createPortfolio } from '@/lib/portfolio-factory';
import { createProject } from '@/lib/storage/projects';
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

export { createEntryRoute } from './entry-route';
