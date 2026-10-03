/**
 * Vercel: upload each file by SHA-1, then create a production deployment that references them.
 * https://vercel.com/docs/rest-api/reference/endpoints/deployments/create-a-new-deployment
 */
import { mapLimit, request, sha1Hex, wait } from './http';
import { DeployError, type DeployContext, type DeployFile, type DeployResult } from './types';

const API = 'https://api.vercel.com';

interface VercelDeployment {
  id: string;
  url: string;
  readyState?: string;
  alias?: string[];
  errorMessage?: string;
}

export async function vercelAccount(ctx: DeployContext): Promise<string> {
  const res = await request<{ user?: { username?: string; email?: string; name?: string } }>(ctx, `${API}/v2/user`);
  return res.user?.name || res.user?.username || res.user?.email || 'Vercel account';
}

export interface VercelTarget {
  /** Project name; also the `<name>.vercel.app` subdomain when it is free. */
  project: string;
  /** Deploy into a team instead of the personal account. */
  teamId?: string;
}

function withTeam(path: string, teamId?: string): string {
  if (!teamId) return `${API}${path}`;
  return `${API}${path}${path.includes('?') ? '&' : '?'}teamId=${encodeURIComponent(teamId)}`;
}

/** The production alias is public even when deployment protection guards the unique URL. */
function publicUrl(d: VercelDeployment): string {
  const alias = [...(d.alias ?? [])].sort((a, b) => a.length - b.length)[0];
  return `https://${alias || d.url}`;
}

export async function deployVercel(files: DeployFile[], t: VercelTarget, ctx: DeployContext): Promise<DeployResult> {
  const stage = ctx.onStage ?? (() => {});
  if (!/^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/.test(t.project) || t.project.includes('---') || t.project.length > 100) {
    throw new DeployError('Vercel project names use lowercase letters, digits, ".", "_" and "-" (up to 100 characters).');
  }

  let done = 0;
  stage(`Uploading files… 0/${files.length}`, 0.05);
  const refs = await mapLimit(files, 4, async (f) => {
    const sha = await sha1Hex(f.bytes);
    await request(ctx, withTeam('/v2/files', t.teamId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'x-vercel-digest': sha },
      body: f.bytes,
    });
    done++;
    stage(`Uploading files… ${done}/${files.length}`, 0.05 + (0.5 * done) / files.length);
    return { file: f.path, sha, size: f.bytes.byteLength };
  });

  stage('Creating deployment…', 0.6);
  let d = await request<VercelDeployment>(ctx, withTeam('/v13/deployments?skipAutoDetectionConfirmation=1', t.teamId), {
    method: 'POST',
    body: {
      name: t.project,
      files: refs,
      target: 'production',
      projectSettings: { framework: null, buildCommand: null, installCommand: null, devCommand: null, outputDirectory: null },
    },
  });

  for (let i = 0; i < 90 && d.readyState !== 'READY'; i++) {
    if (d.readyState === 'ERROR' || d.readyState === 'CANCELED') throw new DeployError(`Vercel could not publish the site${d.errorMessage ? `: ${d.errorMessage}` : '.'}`);
    stage(`Publishing… (${(d.readyState ?? 'queued').toLowerCase()})`, Math.min(0.95, 0.65 + i * 0.01));
    await wait(ctx.pollMs ?? 2000, ctx.signal);
    d = await request<VercelDeployment>(ctx, withTeam(`/v13/deployments/${d.id}`, t.teamId));
  }
  stage('Live', 1);
  const result: DeployResult = {
    target: t.project,
    name: t.project,
    url: publicUrl(d),
    deployedAt: new Date().toISOString(),
    adminUrl: 'https://vercel.com/dashboard',
  };
  return d.readyState === 'READY' ? result : { ...result, pending: true };
}
