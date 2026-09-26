import type { Portfolio } from '@/types/portfolio';

export interface PortfolioTemplate {
  id: string;
  name: string;
  description: string;
  /** Who it suits, shown in the gallery. */
  audience: string;
  themeId: string;
  /** Short tags such as "Dark", "Serif", "Animated". */
  tags: string[];
  /** Build a complete portfolio with sample content. */
  create(): Portfolio;
}
