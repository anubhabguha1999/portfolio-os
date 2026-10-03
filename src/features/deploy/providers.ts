import { Cloud, GitBranch, Package, Triangle } from 'lucide-react';
import type { DeployProvider } from '@/lib/deploy';

export type DeployTab = DeployProvider | 'manual';

export const TABS: readonly DeployTab[] = ['netlify', 'vercel', 'github', 'manual'];

export function isDeployTab(v: string | null): v is DeployTab {
  return !!v && (TABS as readonly string[]).includes(v);
}

export interface ProviderInfo {
  label: string;
  description: string;
  icon: typeof Cloud;
  /** Where the user creates a token. */
  tokenUrl: string;
  tokenSteps: string[];
  nameLabel: string;
  nameHelp: string;
}

export const PROVIDER_INFO: Record<DeployProvider, ProviderInfo> = {
  netlify: {
    label: 'Netlify',
    description: 'Free · yourname.netlify.app',
    icon: Cloud,
    tokenUrl: 'https://app.netlify.com/user/applications#personal-access-tokens',
    tokenSteps: ['Open Netlify → User settings → Applications.', 'Under "Personal access tokens", choose "New access token".', 'Give it a description, pick an expiry and copy the token.'],
    nameLabel: 'Site name',
    nameHelp: 'Becomes the subdomain. Leave it empty and Netlify picks a random one.',
  },
  vercel: {
    label: 'Vercel',
    description: 'Free · yourname.vercel.app',
    icon: Triangle,
    tokenUrl: 'https://vercel.com/account/settings/tokens',
    tokenSteps: ['Open Vercel → Account settings → Tokens.', 'Create a token scoped to your personal account (or the team you deploy to).', 'Copy the token. Vercel only shows it once.'],
    nameLabel: 'Project name',
    nameHelp: 'Used for the project and its .vercel.app address (Vercel adds a suffix if the name is taken).',
  },
  github: {
    label: 'GitHub Pages',
    description: 'Free · username.github.io',
    icon: GitBranch,
    tokenUrl: 'https://github.com/settings/tokens/new?scopes=repo&description=Portfolio%20OS%20deploy',
    tokenSteps: [
      'The link opens a classic token with the "repo" scope already ticked. Set an expiry and generate it.',
      'Prefer fine-grained tokens? Give it Administration, Contents and Pages (read & write) on the repository.',
      'The site is committed to a gh-pages branch. Your other branches are never touched.',
    ],
    nameLabel: 'Repository',
    nameHelp: 'Created as a public repository if it doesn’t exist. Name it username.github.io to publish at the root.',
  },
};

export const MANUAL_INFO = { label: 'Manual upload', description: 'Download the ZIP · drag & drop', icon: Package };

/** The address the site will most likely get, shown before deploying. */
export function expectedUrl(provider: DeployProvider, name: string, account: string | undefined): string {
  if (provider === 'netlify') return name ? `https://${name}.netlify.app` : 'https://<random-name>.netlify.app';
  if (provider === 'vercel') return `https://${name || '<project>'}.vercel.app`;
  const [owner, repo] = name.includes('/') ? name.split('/', 2) : [account, name];
  const user = (owner || '<username>').toLowerCase();
  if (repo && repo.toLowerCase() === `${user}.github.io`) return `https://${user}.github.io/`;
  return `https://${user}.github.io/${repo || '<repository>'}/`;
}
