import type { PortfolioTemplate } from './types';
import { createPortfolio } from '@/lib/portfolio-factory';

export const TEMPLATES: PortfolioTemplate[] = [
  { id: 'minimal', name: 'Minimal', description: 'Placeholder', audience: 'Everyone', themeId: 'minimal-developer', tags: [], create: () => createPortfolio() },
];

export function getTemplate(id: string): PortfolioTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
