import type { PortfolioTemplate } from './types';
import { minimalTemplate } from './minimal';
import { editorialTemplate } from './editorial';
import { terminalTemplate } from './terminal';
import { creativeTemplate } from './creative';
import { executiveTemplate } from './executive';
import { cyberTemplate } from './cyber';
import { brutalistTemplate } from './brutalist';
import { luxuryTemplate } from './luxury';
import { glassTemplate } from './glass';
import { cupertinoTemplate } from './cupertino';
import { auroraTemplate } from './aurora';
import { monographTemplate } from './monograph';
import { signalTemplate } from './signal';
import { atelierTemplate } from './atelier';

export type { PortfolioTemplate } from './types';

/** Every built-in template, in gallery order. */
export const TEMPLATES: PortfolioTemplate[] = [
  auroraTemplate,
  monographTemplate,
  signalTemplate,
  atelierTemplate,
  minimalTemplate,
  editorialTemplate,
  terminalTemplate,
  creativeTemplate,
  executiveTemplate,
  cyberTemplate,
  brutalistTemplate,
  luxuryTemplate,
  glassTemplate,
  cupertinoTemplate,
];

export function getTemplate(id: string): PortfolioTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/** All distinct tags, for gallery filters. */
export function templateTags(): string[] {
  return [...new Set(TEMPLATES.flatMap((t) => t.tags))].sort((a, b) => a.localeCompare(b));
}
