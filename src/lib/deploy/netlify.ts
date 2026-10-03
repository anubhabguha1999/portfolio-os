/**
 * Netlify: create the site once, then deploy with the file-digest method — send every file's
 * SHA-1, upload only the ones Netlify doesn't already have. (The ZIP endpoint's success
 * response isn't readable cross-origin, so browsers report it as a network failure.)
 * https://docs.netlify.com/api/get-started/#file-digest-method
 */
import { mapLimit, request, sha1Hex, wait } from './http';
import { DeployError, type DeployContext, type DeployFile, type DeployResult } from './types';

const API = 'https://api.netlify.com/api/v1';

interface NetlifySite {
  id: string;
  name: string;
  url: string;
  ssl_url?: string;
  admin_url?: string;
}

interface NetlifyDeploy {
  id: string;
  state: string;
  required?: string[];
  error_message?: string | null;
}

/** Each path segment encoded, slashes kept: "/assets/images/my photo.jpg". */
function filePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

export async function netlifyAccount(ctx: DeployContext): Promise<string> {
  const user = await request<{ email?: string; full_name?: string; slug?: string }>(ctx, `${API}/user`);
  return user.full_name || user.email || user.slug || 'Netlify account';
}

export interface NetlifyTarget {
  /** Existing site id from an earlier deploy. */
  siteId?: string;
  /** Subdomain for a new site (`<name>.netlify.app`). Netlify picks one when empty. */
  name?: string;
}

async function ensureSite(ctx: DeployContext, t: NetlifyTarget): Promise<NetlifySite> {
  if (t.siteId) {
    const site = await request<NetlifySite>(ctx, `${API}/sites/${encodeURIComponent(t.siteId)}`, { allow404: true });
    if (site) return site;
  }
  try {
    return await request<NetlifySite>(ctx, `${API}/sites`, { method: 'POST', body: t.name ? { name: t.name } : {} });
  } catch (err) {
    if (err instanceof DeployError && err.status === 422 && t.name) {
      // Taken by one of the user's own sites (e.g. an earlier deploy that didn't finish)? Reuse it.
      const own = await request<NetlifySite>(ctx, `${API}/sites/${encodeURIComponent(`${t.name}.netlify.app`)}`, { allow404: true }).catch(() => null);
      if (own?.name === t.name) return own;
    }
    if (err instanceof DeployError && err.status === 422 && t.name) throw new DeployError(`The name "${t.name}" is already taken on Netlify. Pick another site name.`, 422);
    throw err;
  }
}

export async function deployNetlify(files: DeployFile[], t: NetlifyTarget, ctx: DeployContext): Promise<DeployResult> {
  const stage = ctx.onStage ?? (() => {});
  stage('Preparing site…', 0.1);
  const site = await ensureSite(ctx, t);

  stage('Checking files…', 0.2);
  const digests = await Promise.all(files.map(async (f) => ({ file: f, sha: await sha1Hex(f.bytes) })));
  let deploy = await request<NetlifyDeploy>(ctx, `${API}/sites/${site.id}/deploys`, {
    method: 'POST',
    body: { files: Object.fromEntries(digests.map((d) => [`/${d.file.path}`, d.sha])) },
  });

  // Files with identical content share a digest; upload each needed digest once.
  const required = new Set(deploy.required ?? []);
  const uploads = digests.filter((d) => required.delete(d.sha));
  let done = 0;
  stage(`Uploading files… 0/${uploads.length}`, 0.3);
  await mapLimit(uploads, 4, async (d) => {
    await request(ctx, `${API}/deploys/${deploy.id}/files/${filePath(d.file.path)}`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: d.file.bytes });
    done++;
    stage(`Uploading files… ${done}/${uploads.length}`, 0.3 + (0.3 * done) / Math.max(1, uploads.length));
  });

  const url = site.ssl_url || site.url;
  const base = { target: site.id, name: site.name, url, deployedAt: new Date().toISOString(), ...(site.admin_url ? { adminUrl: site.admin_url } : {}) };
  for (let i = 0; i < 60 && deploy.state !== 'ready'; i++) {
    if (deploy.state === 'error') throw new DeployError(`Netlify could not publish the site${deploy.error_message ? `: ${deploy.error_message}` : '.'}`);
    stage(`Publishing… (${deploy.state})`, Math.min(0.95, 0.6 + i * 0.01));
    await wait(ctx.pollMs ?? 2000, ctx.signal);
    deploy = await request<NetlifyDeploy>(ctx, `${API}/deploys/${deploy.id}`);
  }
  stage('Live', 1);
  return deploy.state === 'ready' ? base : { ...base, pending: true };
}
