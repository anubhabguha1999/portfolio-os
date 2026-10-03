/**
 * GitHub Pages: commit the site to a `gh-pages` branch through the Git Data API and point
 * Pages at it. Other branches are never touched, so an existing repository is safe.
 * https://docs.github.com/en/rest/git · https://docs.github.com/en/rest/pages
 */
import { bytesToBase64 } from '@/lib/export/assets';
import { mapLimit, request, wait } from './http';
import { DeployError, type DeployContext, type DeployFile, type DeployResult } from './types';

const API = 'https://api.github.com';
export const PAGES_BRANCH = 'gh-pages';

const HEADERS = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };

function gh<T>(ctx: DeployContext, path: string, opts: { method?: string; body?: unknown } = {}) {
  return request<T>(ctx, `${API}${path}`, { ...opts, headers: HEADERS });
}

function gh404<T>(ctx: DeployContext, path: string) {
  return request<T>(ctx, `${API}${path}`, { headers: HEADERS, allow404: true });
}

export async function githubAccount(ctx: DeployContext): Promise<string> {
  return (await gh<{ login: string }>(ctx, '/user')).login;
}

export interface GithubTarget {
  /** Repository name; created (public) under the token's user when it doesn't exist. */
  repo: string;
  /** Defaults to the token's user. */
  owner?: string;
  description?: string;
}

interface Repo {
  full_name: string;
  private: boolean;
  html_url: string;
  owner: { login: string };
}

interface Pages {
  html_url?: string;
  source?: { branch: string; path: string };
}

async function ensureRepo(ctx: DeployContext, owner: string, name: string, description: string): Promise<{ repo: Repo; created: boolean }> {
  const existing = await gh404<Repo>(ctx, `/repos/${owner}/${name}`);
  if (existing) return { repo: existing, created: false };
  // auto_init gives the repository a first commit; the Git Data API refuses empty repositories.
  const repo = await gh<Repo>(ctx, '/user/repos', { method: 'POST', body: { name, description, auto_init: true, private: false, has_wiki: false, has_projects: false } });
  return { repo, created: true };
}

async function ensurePages(ctx: DeployContext, full: string): Promise<string> {
  const source = { branch: PAGES_BRANCH, path: '/' };
  const pages = await gh404<Pages>(ctx, `/repos/${full}/pages`);
  if (!pages) {
    try {
      const made = await gh<Pages>(ctx, `/repos/${full}/pages`, { method: 'POST', body: { source } });
      if (made.html_url) return made.html_url;
    } catch (err) {
      if (err instanceof DeployError && err.status === 422) {
        throw new DeployError('GitHub Pages could not be enabled. Free accounts can only publish public repositories, and the token needs the "Pages" permission (or the classic "repo" scope).', 422);
      }
      throw err;
    }
  } else if (pages.source?.branch !== source.branch || pages.source.path !== source.path) {
    await gh(ctx, `/repos/${full}/pages`, { method: 'PUT', body: { source } });
  }
  const after = await gh<Pages>(ctx, `/repos/${full}/pages`);
  return after.html_url || `https://${full.split('/')[0]?.toLowerCase()}.github.io/${full.split('/')[1]}/`;
}

export async function deployGithub(files: DeployFile[], t: GithubTarget, ctx: DeployContext): Promise<DeployResult> {
  const stage = ctx.onStage ?? (() => {});
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(t.repo)) throw new DeployError('Repository names use letters, digits, ".", "_" and "-".');

  stage('Checking repository…', 0.05);
  const owner = t.owner || (await githubAccount(ctx));
  const { repo, created } = await ensureRepo(ctx, owner, t.repo, t.description ?? 'Portfolio website');
  const full = repo.full_name;
  // A brand-new repository can take a moment before its first commit is readable.
  if (created) await wait(ctx.pollMs ?? 1500, ctx.signal);

  let done = 0;
  stage(`Uploading files… 0/${files.length}`, 0.1);
  const tree = await mapLimit(files, 4, async (f) => {
    const blob = await gh<{ sha: string }>(ctx, `/repos/${full}/git/blobs`, { method: 'POST', body: { content: bytesToBase64(f.bytes), encoding: 'base64' } });
    done++;
    stage(`Uploading files… ${done}/${files.length}`, 0.1 + (0.55 * done) / files.length);
    return { path: f.path, mode: '100644', type: 'blob', sha: blob.sha };
  });

  stage('Committing…', 0.7);
  // No base_tree: the branch holds exactly this site, so removed files disappear too.
  const newTree = await gh<{ sha: string }>(ctx, `/repos/${full}/git/trees`, { method: 'POST', body: { tree } });
  const ref = await gh404<{ object: { sha: string } }>(ctx, `/repos/${full}/git/ref/heads/${PAGES_BRANCH}`);
  const commit = await gh<{ sha: string }>(ctx, `/repos/${full}/git/commits`, {
    method: 'POST',
    body: { message: `Deploy portfolio (${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC)`, tree: newTree.sha, parents: ref ? [ref.object.sha] : [] },
  });
  if (ref) await gh(ctx, `/repos/${full}/git/refs/heads/${PAGES_BRANCH}`, { method: 'PATCH', body: { sha: commit.sha } });
  else await gh(ctx, `/repos/${full}/git/refs`, { method: 'POST', body: { ref: `refs/heads/${PAGES_BRANCH}`, sha: commit.sha } });

  stage('Enabling GitHub Pages…', 0.8);
  const url = await ensurePages(ctx, full);
  const base = { target: full, name: full, url, deployedAt: new Date().toISOString(), adminUrl: `${repo.html_url}/settings/pages` };

  // Pages builds asynchronously; wait a little, but a slow build isn't a failure.
  for (let i = 0; i < 30; i++) {
    const build = await gh404<{ status: string; commit?: string; error?: { message?: string | null } }>(ctx, `/repos/${full}/pages/builds/latest`);
    if (build?.commit === commit.sha && build.status === 'built') {
      stage('Live', 1);
      return base;
    }
    if (build?.commit === commit.sha && build.status === 'errored') throw new DeployError(`GitHub Pages could not build the site${build.error?.message ? `: ${build.error.message}` : '.'}`);
    stage(`Publishing… (${build?.commit === commit.sha ? build.status : 'queued'})`, Math.min(0.97, 0.82 + i * 0.005));
    await wait(ctx.pollMs ?? 3000, ctx.signal);
  }
  stage('Published', 1);
  return { ...base, pending: true };
}
