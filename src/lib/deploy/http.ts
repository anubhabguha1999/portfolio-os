import { DeployError, type DeployContext } from './types';

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  /** Objects are sent as JSON. */
  body?: unknown;
}

function isRaw(body: unknown): body is BodyInit {
  // isView rather than instanceof: typed arrays can come from another realm (workers, test DOMs).
  return typeof body === 'string' || ArrayBuffer.isView(body) || body instanceof ArrayBuffer || (typeof Blob !== 'undefined' && body instanceof Blob);
}

/** Pulls the host's own error text out of a JSON error body. */
function errorText(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const d = data as Record<string, unknown>;
  const err = d.error;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && typeof (err as Record<string, unknown>).message === 'string') return (err as { message: string }).message;
  if (typeof d.message === 'string') {
    const details = Array.isArray(d.errors) ? d.errors.map((e) => (e && typeof e === 'object' ? (e as { message?: string }).message : '')).filter(Boolean) : [];
    return details.length ? `${d.message}: ${details.join('; ')}` : d.message;
  }
  return '';
}

/** JSON request with a bearer token. Returns `null` on 404 when `allow404` is set. */
export async function request<T>(ctx: DeployContext, url: string, opts: RequestOptions & { allow404: true }): Promise<T | null>;
export async function request<T>(ctx: DeployContext, url: string, opts?: RequestOptions & { allow404?: false }): Promise<T>;
export async function request<T>(ctx: DeployContext, url: string, opts: RequestOptions & { allow404?: boolean } = {}): Promise<T | null> {
  const doFetch = ctx.fetch ?? fetch;
  const headers: Record<string, string> = { Authorization: `Bearer ${ctx.token}`, ...opts.headers };
  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    if (isRaw(opts.body)) body = opts.body;
    else {
      body = JSON.stringify(opts.body);
      headers['Content-Type'] ??= 'application/json';
    }
  }
  let res: Response;
  try {
    res = await doFetch(url, { method: opts.method ?? 'GET', headers, ...(body !== undefined ? { body } : {}), ...(ctx.signal ? { signal: ctx.signal } : {}) });
  } catch (err) {
    if (ctx.signal?.aborted) throw new DeployError('Deploy cancelled.');
    // The browser hides the reason (offline, blocked by an extension, or a response without CORS headers).
    const u = new URL(url);
    throw new DeployError(
      `The browser could not complete ${opts.method ?? 'GET'} ${u.host}${u.pathname}${err instanceof Error && err.message ? ` (${err.message})` : ''}. Check your connection, and turn off ad or privacy blockers for this page.`,
    );
  }
  if (res.status === 404 && opts.allow404) return null;
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const host = new URL(url).host;
    if (res.status === 401) throw new DeployError(`${host} rejected the token. It may be wrong, expired or revoked.`, 401);
    const detail = errorText(data) || text.slice(0, 200) || res.statusText;
    throw new DeployError(`${host} returned ${res.status}${detail ? `: ${detail}` : ''}`, res.status);
  }
  return data as T;
}

export function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DeployError('Deploy cancelled.'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new DeployError('Deploy cancelled.'));
      },
      { once: true },
    );
  });
}

/** Runs `fn` over `items` with at most `limit` in flight, preserving order. */
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i] as T, i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export async function sha1Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', bytes.slice().buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Lowercase letters, digits and single hyphens — valid for Netlify, Vercel and GitHub. */
export function siteSlug(input: string, max = 63): string {
  const s = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
  return s || 'portfolio';
}
