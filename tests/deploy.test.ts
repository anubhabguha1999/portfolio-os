import { describe, expect, it } from 'vitest';
import { createPortfolio } from '@/lib/portfolio-factory';
import { deploy, defaultSiteName, siteFiles, siteSlug, DeployError, type DeployFile } from '@/lib/deploy';
import { expectedUrl } from '@/features/deploy/providers';

const enc = new TextEncoder();
const FILES: DeployFile[] = [
  { path: 'index.html', bytes: enc.encode('<!doctype html><title>Hi</title>') },
  { path: 'css/styles.css', bytes: enc.encode('body{margin:0}') },
  { path: '.nojekyll', bytes: new Uint8Array(0) },
];

interface Call {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

type Route = (call: Call) => { status?: number; json?: unknown } | undefined;

/** A fake host: each route answers the first matching request. */
function fakeFetch(routes: Array<[string, Route]>) {
  const calls: Call[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const raw = init?.body;
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const body = typeof raw === 'string' && headers['Content-Type'] === 'application/json' ? JSON.parse(raw) : raw;
    const call = { method, url, headers, body };
    calls.push(call);
    for (const [key, route] of routes) {
      const [m, prefix] = key.split(' ') as [string, string];
      if (m === method && url.startsWith(prefix)) {
        const res = route(call);
        if (res) return new Response(res.json === undefined ? null : JSON.stringify(res.json), { status: res.status ?? 200 });
      }
    }
    return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
  }) as typeof fetch;
  return { fn, calls };
}

describe('siteSlug', () => {
  it('makes host-safe names', () => {
    expect(siteSlug('  Ána’s Portfolio!! 2026 ')).toBe('ana-s-portfolio-2026');
    expect(siteSlug('---')).toBe('portfolio');
    expect(siteSlug('a'.repeat(80), 10)).toBe('aaaaaaaaaa');
  });
});

describe('siteFiles', () => {
  it('publishes the website package without the repo README on hosted sites', async () => {
    const p = createPortfolio({ title: 'Ada Portfolio', sections: ['hero', 'about', 'contact'] });
    const hosted = (await siteFiles(p, 'netlify', { inlineExternal: false })).files.map((f) => f.path);
    expect(hosted).toEqual(expect.arrayContaining(['index.html', 'css/styles.css', 'js/app.js', '404.html', 'robots.txt']));
    expect(hosted).not.toContain('README.md');
    expect(hosted.every((f) => !f.startsWith('portfolio/'))).toBe(true);
    const repo = (await siteFiles(p, 'github', { inlineExternal: false })).files.map((f) => f.path);
    expect(repo).toContain('README.md');
    expect(defaultSiteName(p, 'Ada’s Portfolio')).toBe('ada-s-portfolio');
  });
});

describe('expectedUrl', () => {
  it('previews each host address', () => {
    expect(expectedUrl('netlify', 'jane', undefined)).toBe('https://jane.netlify.app');
    expect(expectedUrl('vercel', 'jane', undefined)).toBe('https://jane.vercel.app');
    expect(expectedUrl('github', 'site', 'Jane')).toBe('https://jane.github.io/site/');
    expect(expectedUrl('github', 'jane.github.io', 'Jane')).toBe('https://jane.github.io/');
  });
});

describe('Netlify', () => {
  it('creates a site, sends file digests and uploads only the required files', async () => {
    let polls = 0;
    const { fn, calls } = fakeFetch([
      [
        'POST https://api.netlify.com/api/v1/sites/site_1/deploys',
        (c) => {
          const files = (c.body as { files: Record<string, string> }).files;
          // Netlify already has the CSS; it asks for the other two.
          return { json: { id: 'd1', state: 'uploading', required: [files['/index.html'], files['/.nojekyll']] } };
        },
      ],
      ['POST https://api.netlify.com/api/v1/sites', () => ({ json: { id: 'site_1', name: 'jane', url: 'http://jane.netlify.app', ssl_url: 'https://jane.netlify.app', admin_url: 'https://app.netlify.com/sites/jane' } })],
      ['PUT https://api.netlify.com/api/v1/deploys/d1/files/', () => ({ json: {} })],
      ['GET https://api.netlify.com/api/v1/deploys/d1', () => ({ json: { id: 'd1', state: ++polls < 2 ? 'processing' : 'ready' } })],
    ]);
    const stages: string[] = [];
    const res = await deploy(FILES, { provider: 'netlify', name: 'jane' }, { token: 't', fetch: fn, pollMs: 0, onStage: (s) => stages.push(s) });
    expect(res).toMatchObject({ target: 'site_1', name: 'jane', url: 'https://jane.netlify.app' });
    expect(res.pending).toBeUndefined();
    expect(calls[0]?.body).toEqual({ name: 'jane' });
    expect(calls[0]?.headers.Authorization).toBe('Bearer t');
    const create = calls[1]!;
    expect(create.headers['Content-Type']).toBe('application/json');
    const digests = (create.body as { files: Record<string, string> }).files;
    expect(Object.keys(digests).sort()).toEqual(['/.nojekyll', '/css/styles.css', '/index.html']);
    expect(Object.values(digests).every((d) => /^[0-9a-f]{40}$/.test(d))).toBe(true);
    const puts = calls.filter((c) => c.method === 'PUT');
    expect(puts.map((c) => c.url.replace('https://api.netlify.com/api/v1/deploys/d1/files', '')).sort()).toEqual(['/.nojekyll', '/index.html']);
    expect(puts[0]?.headers['Content-Type']).toBe('application/octet-stream');
    expect(new TextDecoder().decode(puts.find((c) => c.url.endsWith('/index.html'))!.body as Uint8Array)).toContain('<title>Hi</title>');
    expect(stages.at(-1)).toBe('Live');
  });

  it('encodes file paths segment by segment', async () => {
    const { fn, calls } = fakeFetch([
      ['POST https://api.netlify.com/api/v1/sites/s/deploys', (c) => ({ json: { id: 'd', state: 'uploading', required: Object.values((c.body as { files: Record<string, string> }).files) } })],
      ['GET https://api.netlify.com/api/v1/sites/s', () => ({ json: { id: 's', name: 'x', url: 'https://x.netlify.app' } })],
      ['PUT https://api.netlify.com/api/v1/deploys/d/files/', () => ({ json: {} })],
      ['GET https://api.netlify.com/api/v1/deploys/d', () => ({ json: { id: 'd', state: 'ready' } })],
    ]);
    const files = [{ path: 'assets/images/my photo#1.jpg', bytes: new Uint8Array([1, 2]) }];
    await deploy(files, { provider: 'netlify', name: 'x', previous: { target: 's', name: 'x', url: '', deployedAt: '' } }, { token: 't', fetch: fn, pollMs: 0 });
    expect(calls.find((c) => c.method === 'PUT')?.url).toBe('https://api.netlify.com/api/v1/deploys/d/files/assets/images/my%20photo%231.jpg');
  });

  it('redeploys into the existing site with the same name', async () => {
    const { fn, calls } = fakeFetch([
      ['GET https://api.netlify.com/api/v1/sites/site_1', () => ({ json: { id: 'site_1', name: 'jane', url: 'https://jane.netlify.app' } })],
      ['POST https://api.netlify.com/api/v1/sites/site_1/deploys', () => ({ json: { id: 'd2', state: 'ready' } })],
    ]);
    const previous = { target: 'site_1', name: 'jane', url: 'https://jane.netlify.app', deployedAt: '' };
    await deploy(FILES, { provider: 'netlify', name: 'jane', previous }, { token: 't', fetch: fn, pollMs: 0 });
    expect(calls.map((c) => `${c.method} ${c.url}`)).not.toContain('POST https://api.netlify.com/api/v1/sites');
  });

  it('reuses a site of the same name that already belongs to the account', async () => {
    const { fn, calls } = fakeFetch([
      ['POST https://api.netlify.com/api/v1/sites/own_1/deploys', () => ({ json: { id: 'd', state: 'ready', required: [] } })],
      ['POST https://api.netlify.com/api/v1/sites', () => ({ status: 422, json: { errors: { subdomain: ['must be unique'] } } })],
      ['GET https://api.netlify.com/api/v1/sites/jane.netlify.app', () => ({ json: { id: 'own_1', name: 'jane', url: 'https://jane.netlify.app' } })],
    ]);
    const res = await deploy(FILES, { provider: 'netlify', name: 'jane' }, { token: 't', fetch: fn, pollMs: 0 });
    expect(res.target).toBe('own_1');
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('explains a taken name', async () => {
    const { fn } = fakeFetch([['POST https://api.netlify.com/api/v1/sites', () => ({ status: 422, json: { errors: { subdomain: ['must be unique'] } } })]]);
    await expect(deploy(FILES, { provider: 'netlify', name: 'taken' }, { token: 't', fetch: fn, pollMs: 0 })).rejects.toThrow(/already taken/);
  });

  it('turns 401 into a token message', async () => {
    const { fn } = fakeFetch([['POST https://api.netlify.com/api/v1/sites', () => ({ status: 401, json: { code: 401, message: 'Access Denied' } })]]);
    const err = await deploy(FILES, { provider: 'netlify', name: 'x' }, { token: 'bad', fetch: fn, pollMs: 0 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DeployError);
    expect((err as Error).message).toMatch(/rejected the token/);
  });
});

describe('Vercel', () => {
  it('uploads files by digest and returns the production alias', async () => {
    const { fn, calls } = fakeFetch([
      ['POST https://api.vercel.com/v2/files', () => ({ json: {} })],
      ['POST https://api.vercel.com/v13/deployments', () => ({ json: { id: 'dpl_1', url: 'jane-abc123.vercel.app', readyState: 'BUILDING' } })],
      ['GET https://api.vercel.com/v13/deployments/dpl_1', () => ({ json: { id: 'dpl_1', url: 'jane-abc123.vercel.app', readyState: 'READY', alias: ['jane-git-main-x.vercel.app', 'jane.vercel.app'] } })],
    ]);
    const res = await deploy(FILES, { provider: 'vercel', name: 'jane', teamId: 'team_9' }, { token: 't', fetch: fn, pollMs: 0 });
    expect(res.url).toBe('https://jane.vercel.app');
    const uploads = calls.filter((c) => c.url.includes('/v2/files'));
    expect(uploads).toHaveLength(3);
    expect(uploads[0]?.url).toContain('teamId=team_9');
    // SHA-1 of "body{margin:0}"
    const css = uploads.find((u) => (u.body as Uint8Array).byteLength === 14)!;
    expect(css.headers['x-vercel-digest']).toMatch(/^[0-9a-f]{40}$/);
    const create = calls.find((c) => c.url.includes('/v13/deployments?'))!;
    expect(create.url).toContain('teamId=team_9');
    const body = create.body as { name: string; target: string; files: Array<{ file: string; sha: string; size: number }> };
    expect(body.name).toBe('jane');
    expect(body.target).toBe('production');
    expect(body.files.map((f) => f.file).sort()).toEqual(['.nojekyll', 'css/styles.css', 'index.html']);
    expect(body.files.find((f) => f.file === 'css/styles.css')?.sha).toBe(css.headers['x-vercel-digest']);
  });

  it('rejects invalid project names before uploading', async () => {
    const { fn, calls } = fakeFetch([]);
    await expect(deploy(FILES, { provider: 'vercel', name: 'Bad Name' }, { token: 't', fetch: fn })).rejects.toThrow(/lowercase/);
    expect(calls).toHaveLength(0);
  });

  it('reports a failed build', async () => {
    const { fn } = fakeFetch([
      ['POST https://api.vercel.com/v2/files', () => ({ json: {} })],
      ['POST https://api.vercel.com/v13/deployments', () => ({ json: { id: 'd', url: 'x.vercel.app', readyState: 'ERROR', errorMessage: 'boom' } })],
    ]);
    await expect(deploy(FILES, { provider: 'vercel', name: 'jane' }, { token: 't', fetch: fn, pollMs: 0 })).rejects.toThrow(/boom/);
  });
});

describe('GitHub Pages', () => {
  function github(opts: { repoExists: boolean; branchExists: boolean; pages: 'none' | 'other' | 'ok' }) {
    let pagesState = opts.pages;
    return fakeFetch([
      ['GET https://api.github.com/user', () => ({ json: { login: 'Jane' } })],
      ['GET https://api.github.com/repos/Jane/site/git/ref/heads/gh-pages', () => (opts.branchExists ? { json: { object: { sha: 'old' } } } : { status: 404, json: {} })],
      ['GET https://api.github.com/repos/Jane/site/pages/builds/latest', () => ({ json: { status: 'built', commit: 'c1' } })],
      [
        'GET https://api.github.com/repos/Jane/site/pages',
        () => (pagesState === 'none' ? { status: 404, json: {} } : { json: { html_url: 'https://jane.github.io/site/', source: { branch: pagesState === 'ok' ? 'gh-pages' : 'main', path: '/' } } }),
      ],
      ['GET https://api.github.com/repos/Jane/site', () => (opts.repoExists ? { json: { full_name: 'Jane/site', private: false, html_url: 'https://github.com/Jane/site', owner: { login: 'Jane' } } } : { status: 404, json: {} })],
      ['POST https://api.github.com/user/repos', () => ({ status: 201, json: { full_name: 'Jane/site', private: false, html_url: 'https://github.com/Jane/site', owner: { login: 'Jane' } } })],
      ['POST https://api.github.com/repos/Jane/site/git/blobs', (c) => ({ status: 201, json: { sha: `b-${(c.body as { content: string }).content.length}` } })],
      ['POST https://api.github.com/repos/Jane/site/git/trees', () => ({ status: 201, json: { sha: 'tree1' } })],
      ['POST https://api.github.com/repos/Jane/site/git/commits', () => ({ status: 201, json: { sha: 'c1' } })],
      ['POST https://api.github.com/repos/Jane/site/git/refs', () => ({ status: 201, json: {} })],
      ['PATCH https://api.github.com/repos/Jane/site/git/refs/heads/gh-pages', () => ({ json: {} })],
      [
        'POST https://api.github.com/repos/Jane/site/pages',
        () => {
          pagesState = 'ok';
          return { status: 201, json: { html_url: 'https://jane.github.io/site/' } };
        },
      ],
      [
        'PUT https://api.github.com/repos/Jane/site/pages',
        () => {
          pagesState = 'ok';
          return { status: 204 };
        },
      ],
    ]);
  }

  it('creates the repo, commits to gh-pages and enables Pages', async () => {
    const { fn, calls } = github({ repoExists: false, branchExists: false, pages: 'none' });
    const res = await deploy(FILES, { provider: 'github', name: 'site' }, { token: 't', fetch: fn, pollMs: 0 });
    expect(res).toMatchObject({ target: 'Jane/site', name: 'Jane/site', url: 'https://jane.github.io/site/' });
    expect(res.pending).toBeUndefined();
    const sent = calls.map((c) => `${c.method} ${c.url.replace('https://api.github.com', '')}`);
    expect(sent).toContain('POST /user/repos');
    expect(calls.find((c) => c.url.endsWith('/user/repos'))?.body).toMatchObject({ name: 'site', auto_init: true, private: false });
    const tree = calls.find((c) => c.url.endsWith('/git/trees'))?.body as { tree: Array<{ path: string }>; base_tree?: string };
    expect(tree.base_tree).toBeUndefined();
    expect(tree.tree.map((t) => t.path).sort()).toEqual(['.nojekyll', 'css/styles.css', 'index.html']);
    expect(calls.find((c) => c.url.endsWith('/git/commits'))?.body).toMatchObject({ tree: 'tree1', parents: [] });
    expect(calls.find((c) => c.url.endsWith('/git/refs'))?.body).toEqual({ ref: 'refs/heads/gh-pages', sha: 'c1' });
    expect(calls.find((c) => c.method === 'POST' && c.url.endsWith('/pages'))?.body).toEqual({ source: { branch: 'gh-pages', path: '/' } });
    // Never writes to other branches.
    expect(sent.some((s) => /refs\/heads\/(?!gh-pages)/.test(s))).toBe(false);
    expect(calls[0]?.headers['X-GitHub-Api-Version']).toBe('2022-11-28');
  });

  it('updates an existing branch and repoints Pages', async () => {
    const { fn, calls } = github({ repoExists: true, branchExists: true, pages: 'other' });
    await deploy(FILES, { provider: 'github', name: 'Jane/site' }, { token: 't', fetch: fn, pollMs: 0 });
    const sent = calls.map((c) => `${c.method} ${c.url.replace('https://api.github.com', '')}`);
    expect(sent).not.toContain('GET /user');
    expect(sent).not.toContain('POST /user/repos');
    expect(calls.find((c) => c.url.endsWith('/git/commits'))?.body).toMatchObject({ parents: ['old'] });
    expect(sent).toContain('PATCH /repos/Jane/site/git/refs/heads/gh-pages');
    expect(sent).toContain('PUT /repos/Jane/site/pages');
  });

  it('explains when Pages cannot be enabled', async () => {
    const { fn } = fakeFetch([
      ['GET https://api.github.com/repos/Jane/site/git/ref/heads/gh-pages', () => ({ status: 404, json: {} })],
      ['GET https://api.github.com/repos/Jane/site/pages', () => ({ status: 404, json: {} })],
      ['GET https://api.github.com/repos/Jane/site', () => ({ json: { full_name: 'Jane/site', private: true, html_url: 'https://github.com/Jane/site', owner: { login: 'Jane' } } })],
      ['POST https://api.github.com/repos/Jane/site/git/blobs', () => ({ status: 201, json: { sha: 'b' } })],
      ['POST https://api.github.com/repos/Jane/site/git/trees', () => ({ status: 201, json: { sha: 't' } })],
      ['POST https://api.github.com/repos/Jane/site/git/commits', () => ({ status: 201, json: { sha: 'c' } })],
      ['POST https://api.github.com/repos/Jane/site/git/refs', () => ({ status: 201, json: {} })],
      ['POST https://api.github.com/repos/Jane/site/pages', () => ({ status: 422, json: { message: 'Your current plan does not support GitHub Pages for this repository.' } })],
    ]);
    await expect(deploy(FILES, { provider: 'github', name: 'Jane/site' }, { token: 't', fetch: fn, pollMs: 0 })).rejects.toThrow(/public repositories/);
  });
});
