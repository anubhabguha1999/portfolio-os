/**
 * One-click deploy of the static website (the same files as the website ZIP) straight from
 * the browser. Tokens are the user's own personal access tokens; they only ever go to the host
 * they belong to, and are kept on this device only when the user asks for that.
 */
import type { Portfolio } from '@/types/portfolio';
import { buildSitePackage, type HtmlEnv } from '@/lib/html/build';
import { getMeta, setMeta } from '@/lib/storage/db';
import { deployNetlify, netlifyAccount } from './netlify';
import { deployVercel, vercelAccount } from './vercel';
import { deployGithub, githubAccount } from './github';
import { siteSlug } from './http';
import type { DeployContext, DeployFile, DeployProvider, DeployRecord, DeployResult } from './types';

export * from './types';
export { siteSlug } from './http';

/** Files a host serves; the repo keeps README.md, hosted sites don't need to publish it. */
export async function siteFiles(p: Portfolio, provider: DeployProvider, env: HtmlEnv = {}): Promise<{ files: DeployFile[]; warnings: string[] }> {
  const site = await buildSitePackage(p, { fontDelivery: p.settings.fontDelivery, embedData: false }, env);
  const files = provider === 'github' ? site.files : site.files.filter((f) => f.path !== 'README.md');
  return { files, warnings: site.warnings };
}

export interface DeployRequest {
  provider: DeployProvider;
  /** Netlify site name / Vercel project / GitHub repository ("repo" or "owner/repo"). */
  name: string;
  /** Vercel only. */
  teamId?: string;
  /** From an earlier deploy of this project to the same host. */
  previous?: DeployRecord;
}

export function deploy(files: DeployFile[], req: DeployRequest, ctx: DeployContext): Promise<DeployResult> {
  switch (req.provider) {
    case 'netlify': {
      // Re-deploy into the same site unless the user renamed it.
      const reuse = req.previous && (!req.name || req.previous.name === req.name);
      return deployNetlify(files, { ...(reuse ? { siteId: req.previous?.target } : {}), ...(req.name ? { name: req.name } : {}) }, ctx);
    }
    case 'vercel':
      return deployVercel(files, { project: req.name, ...(req.teamId ? { teamId: req.teamId } : {}) }, ctx);
    case 'github': {
      const [owner, repo] = req.name.includes('/') ? req.name.split('/', 2) : [undefined, req.name];
      return deployGithub(files, { repo: repo ?? '', ...(owner ? { owner } : {}) }, ctx);
    }
  }
}

/** Confirms the token works and returns the account name to show. */
export function verifyToken(provider: DeployProvider, ctx: DeployContext): Promise<string> {
  if (provider === 'netlify') return netlifyAccount(ctx);
  if (provider === 'vercel') return vercelAccount(ctx);
  return githubAccount(ctx);
}

export function defaultSiteName(p: Portfolio, projectName: string): string {
  return siteSlug(projectName || p.metadata.title || p.metadata.author || 'portfolio', 50);
}

/* ------------------------------------------------------------------ */
/* Local storage (IndexedDB meta)                                      */
/* ------------------------------------------------------------------ */

const TOKENS_KEY = 'deploy:tokens';
const recordsKey = (projectId: string) => `deploy:sites:${projectId}`;

export type SavedTokens = Partial<Record<DeployProvider, string>>;
export type DeployRecords = Partial<Record<DeployProvider, DeployRecord>>;

export async function loadTokens(): Promise<SavedTokens> {
  return (await getMeta<SavedTokens>(TOKENS_KEY)) ?? {};
}

export async function saveToken(provider: DeployProvider, token: string | null): Promise<void> {
  const all = await loadTokens();
  if (token) all[provider] = token;
  else delete all[provider];
  await setMeta(TOKENS_KEY, all);
}

export async function loadRecords(projectId: string): Promise<DeployRecords> {
  return (await getMeta<DeployRecords>(recordsKey(projectId))) ?? {};
}

export async function saveRecord(projectId: string, provider: DeployProvider, record: DeployRecord | null): Promise<DeployRecords> {
  const all = await loadRecords(projectId);
  if (record) all[provider] = record;
  else delete all[provider];
  await setMeta(recordsKey(projectId), all);
  return all;
}
