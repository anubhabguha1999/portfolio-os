/**
 * A small, dependency-free Claude Messages API client for the browser.
 *
 * The optional AI assistant calls https://api.anthropic.com directly with the user's
 * own API key (CORS is enabled for direct browser access). Nothing goes through a
 * server of ours, and nothing here runs unless the user adds a key and starts a tool.
 */

export const API_URL = 'https://api.anthropic.com/v1/messages';
export const MODELS_URL = 'https://api.anthropic.com/v1/models';
export const API_VERSION = '2023-06-01';
/** Opt-in beta for server-side refusal fallbacks (`fallbacks: "default"`). */
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export interface AiModel {
  id: string;
  label: string;
  description: string;
  /** Sends `output_config.effort` (unsupported on Haiku 4.5). */
  effort?: 'low' | 'medium' | 'high';
  /** Sends `fallbacks: "default"` with the fallback beta header. */
  fallbacks?: boolean;
}

export const AI_MODELS: AiModel[] = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', description: 'Best writing and judgement. Recommended.', effort: 'medium', fallbacks: true },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', description: 'Faster and about half the price.', effort: 'medium', fallbacks: true },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', description: 'Fastest and cheapest. Good for quick drafts.' },
];
export const DEFAULT_MODEL = AI_MODELS[0]!.id;

export function modelInfo(id: string): AiModel {
  return AI_MODELS.find((m) => m.id === id) ?? { id, label: id, description: '' };
}

/* ------------------------------- Errors ------------------------------ */

export type AiErrorKind = 'auth' | 'permission' | 'billing' | 'not_found' | 'too_large' | 'invalid_request' | 'rate_limit' | 'overloaded' | 'server' | 'network' | 'aborted' | 'refusal';

export class AiError extends Error {
  readonly kind: AiErrorKind;
  readonly status: number | null;
  /** Seconds to wait before retrying (from the `retry-after` header), when known. */
  readonly retryAfter: number | null;
  constructor(kind: AiErrorKind, message: string, opts: { status?: number | null; retryAfter?: number | null } = {}) {
    super(message);
    this.name = 'AiError';
    this.kind = kind;
    this.status = opts.status ?? null;
    this.retryAfter = opts.retryAfter ?? null;
  }
  /** Worth offering "Try again" without changing anything. */
  get retryable(): boolean {
    return this.kind === 'rate_limit' || this.kind === 'overloaded' || this.kind === 'server' || this.kind === 'network' || this.kind === 'aborted';
  }
}

const TYPE_TO_KIND: Record<string, AiErrorKind> = {
  authentication_error: 'auth',
  permission_error: 'permission',
  billing_error: 'billing',
  not_found_error: 'not_found',
  request_too_large: 'too_large',
  invalid_request_error: 'invalid_request',
  rate_limit_error: 'rate_limit',
  overloaded_error: 'overloaded',
  api_error: 'server',
  timeout_error: 'server',
};

function kindForStatus(status: number): AiErrorKind {
  if (status === 401) return 'auth';
  if (status === 402) return 'billing';
  if (status === 403) return 'permission';
  if (status === 404) return 'not_found';
  if (status === 413) return 'too_large';
  if (status === 429) return 'rate_limit';
  if (status === 529) return 'overloaded';
  if (status >= 500) return 'server';
  return 'invalid_request';
}

function friendly(kind: AiErrorKind, detail: string, retryAfter: number | null): string {
  switch (kind) {
    case 'auth':
      return 'Anthropic rejected this API key. Check that it was pasted in full and has not been revoked.';
    case 'permission':
      return `This API key is not allowed to do that.${detail ? ` (${detail})` : ''}`;
    case 'billing':
      return `There is a billing problem on your Anthropic account.${detail ? ` (${detail})` : ''}`;
    case 'not_found':
      return `The selected model is not available to this API key. Try another model.${detail ? ` (${detail})` : ''}`;
    case 'too_large':
      return 'The text sent is too long. Shorten the job description or pick fewer sections.';
    case 'rate_limit':
      return retryAfter ? `Rate limit reached on your Anthropic account. Try again in ${retryAfter} s.` : 'Rate limit reached on your Anthropic account. Wait a moment and try again.';
    case 'overloaded':
      return 'Anthropic is overloaded right now. Try again in a little while, or pick a different model.';
    case 'server':
      return `Anthropic returned a server error.${detail ? ` (${detail})` : ''} Try again.`;
    case 'network':
      return 'Could not reach api.anthropic.com. Check your connection (or an ad blocker) and try again.';
    case 'aborted':
      return 'Stopped.';
    case 'refusal':
      return 'The model declined this request. Rephrase the input and try again.';
    default:
      return detail || 'The request was not accepted.';
  }
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  if (Number.isFinite(n) && n >= 0) return Math.ceil(n);
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : Math.max(0, Math.ceil((at - Date.now()) / 1000));
}

/** Maps a non-2xx response to an AiError (reads the JSON error body when present). */
export async function errorFromResponse(res: Response): Promise<AiError> {
  let type = '';
  let detail = '';
  try {
    const body = (await res.json()) as { error?: { type?: string; message?: string } };
    type = body.error?.type ?? '';
    detail = body.error?.message ?? '';
  } catch {
    /* not JSON */
  }
  const kind = (type && TYPE_TO_KIND[type]) || kindForStatus(res.status);
  const retryAfter = parseRetryAfter(res.headers.get('retry-after'));
  return new AiError(kind, friendly(kind, detail, retryAfter), { status: res.status, retryAfter });
}

/** Maps an `event: error` payload received mid-stream. */
export function errorFromEvent(data: unknown): AiError {
  const err = (data as { error?: { type?: string; message?: string } } | null)?.error;
  const kind = (err?.type && TYPE_TO_KIND[err.type]) || 'server';
  return new AiError(kind, friendly(kind, err?.message ?? '', null));
}

function isAbort(err: unknown): boolean {
  return (err instanceof DOMException && err.name === 'AbortError') || (err instanceof Error && err.name === 'AbortError');
}

/* ----------------------------- Requests ------------------------------ */

export interface AiRequest {
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  maxTokens?: number;
}

export interface BuiltRequest {
  url: string;
  init: RequestInit & { headers: Record<string, string>; body: string };
}

export function buildHeaders(apiKey: string, beta?: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-api-key': apiKey.trim(),
    'anthropic-version': API_VERSION,
    'anthropic-dangerous-direct-browser-access': 'true',
    ...(beta ? { 'anthropic-beta': beta } : {}),
  };
}

export function buildRequest(req: AiRequest, signal?: AbortSignal): BuiltRequest {
  const info = modelInfo(req.model);
  const body: Record<string, unknown> = {
    model: req.model,
    max_tokens: req.maxTokens ?? 16000,
    stream: true,
    system: req.system,
    messages: [{ role: 'user', content: req.prompt }],
  };
  if (info.effort) body.output_config = { effort: info.effort };
  if (info.fallbacks) body.fallbacks = 'default';
  return {
    url: API_URL,
    init: { method: 'POST', headers: buildHeaders(req.apiKey, info.fallbacks ? FALLBACK_BETA : undefined), body: JSON.stringify(body), ...(signal ? { signal } : {}) },
  };
}

/* ------------------------------ SSE parser --------------------------- */

export interface SseEvent {
  event: string;
  data: string;
}

/**
 * Incremental Server-Sent Events parser. Feed it decoded text in arbitrary chunks
 * (a chunk may end mid-line or mid-event); it returns each completed event once.
 */
export class SseParser {
  private buffer = '';
  private event = '';
  private data: string[] = [];

  push(chunk: string): SseEvent[] {
    this.buffer += chunk;
    const out: SseEvent[] = [];
    let nl: number;
    while ((nl = this.buffer.search(/\r\n|\r|\n/)) !== -1) {
      // A lone trailing \r might be the first half of \r\n: wait for more input.
      if (this.buffer[nl] === '\r' && nl === this.buffer.length - 1) break;
      const line = this.buffer.slice(0, nl);
      this.buffer = this.buffer.slice(nl + (this.buffer.startsWith('\r\n', nl) ? 2 : 1));
      this.line(line, out);
    }
    return out;
  }

  /** Call at end of stream to emit a final event that had no trailing blank line. */
  flush(): SseEvent[] {
    const out: SseEvent[] = [];
    if (this.buffer) {
      this.line(this.buffer.replace(/\r$/, ''), out);
      this.buffer = '';
    }
    this.line('', out);
    return out;
  }

  private line(line: string, out: SseEvent[]) {
    if (line === '') {
      if (this.data.length) out.push({ event: this.event || 'message', data: this.data.join('\n') });
      this.event = '';
      this.data = [];
      return;
    }
    if (line.startsWith(':')) return;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') this.event = value;
    else if (field === 'data') this.data.push(value);
  }
}

/* ---------------------------- Stream state --------------------------- */

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface StreamState {
  text: string;
  usage: AiUsage;
  stopReason: string | null;
  done: boolean;
  model: string | null;
}

export function initialStreamState(): StreamState {
  return { text: '', usage: { inputTokens: 0, outputTokens: 0 }, stopReason: null, done: false, model: null };
}

interface UsageJson {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

function inputOf(u: UsageJson): number {
  return (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
}

/**
 * Applies one SSE event to the stream state. Returns the text delta (possibly '').
 * Throws AiError for `error` events. Thinking, fallback and other blocks are ignored.
 */
export function applyEvent(state: StreamState, ev: SseEvent): string {
  if (ev.event === 'ping') return '';
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(ev.data) as Record<string, unknown>;
  } catch {
    return '';
  }
  const type = (data.type as string | undefined) ?? ev.event;
  switch (type) {
    case 'error':
      throw errorFromEvent(data);
    case 'message_start': {
      const msg = data.message as { model?: string; usage?: UsageJson } | undefined;
      if (msg?.model) state.model = msg.model;
      if (msg?.usage) state.usage = { inputTokens: inputOf(msg.usage), outputTokens: msg.usage.output_tokens ?? 0 };
      return '';
    }
    case 'content_block_delta': {
      const delta = data.delta as { type?: string; text?: string } | undefined;
      if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
        state.text += delta.text;
        return delta.text;
      }
      return '';
    }
    case 'message_delta': {
      const delta = data.delta as { stop_reason?: string | null } | undefined;
      if (delta?.stop_reason) state.stopReason = delta.stop_reason;
      const u = data.usage as UsageJson | undefined;
      if (u) {
        if (u.output_tokens !== undefined) state.usage.outputTokens = u.output_tokens;
        if (u.input_tokens !== undefined) state.usage.inputTokens = inputOf(u);
      }
      return '';
    }
    case 'message_stop':
      state.done = true;
      return '';
    default:
      return '';
  }
}

/* ------------------------------ Streaming ---------------------------- */

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface StreamOptions {
  signal?: AbortSignal;
  onText?: (delta: string, full: string) => void;
  fetch?: FetchLike;
}

export interface AiResult {
  text: string;
  usage: AiUsage;
  stopReason: string | null;
  model: string | null;
}

const defaultFetch: FetchLike = (input, init) => globalThis.fetch(input, init);

/** Sends one streamed Messages request and resolves with the full text and usage. */
export async function streamMessage(req: AiRequest, opts: StreamOptions = {}): Promise<AiResult> {
  if (!req.apiKey.trim()) throw new AiError('auth', 'Add your Anthropic API key first.');
  const { url, init } = buildRequest(req, opts.signal);
  const doFetch = opts.fetch ?? defaultFetch;
  let res: Response;
  try {
    res = await doFetch(url, init);
  } catch (err) {
    if (isAbort(err) || opts.signal?.aborted) throw new AiError('aborted', friendly('aborted', '', null));
    throw new AiError('network', friendly('network', '', null));
  }
  if (!res.ok) throw await errorFromResponse(res);
  if (!res.body) throw new AiError('network', 'The response had no body.');

  const state = initialStreamState();
  const parser = new SseParser();
  const decoder = new TextDecoder();
  const reader = res.body.getReader();
  const handle = (events: SseEvent[]) => {
    for (const ev of events) {
      const delta = applyEvent(state, ev);
      if (delta) opts.onText?.(delta, state.text);
    }
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      handle(parser.push(decoder.decode(value, { stream: true })));
      if (state.done) break;
    }
    handle(parser.push(decoder.decode()));
    handle(parser.flush());
  } catch (err) {
    void reader.cancel().catch(() => {});
    if (err instanceof AiError) throw err;
    if (isAbort(err) || opts.signal?.aborted) throw new AiError('aborted', friendly('aborted', '', null));
    throw new AiError('network', 'The connection dropped before the answer finished. Try again.');
  }
  if (!state.done && opts.signal?.aborted) throw new AiError('aborted', friendly('aborted', '', null));
  if (!state.done) throw new AiError('network', 'The connection dropped before the answer finished. Try again.');
  if (state.stopReason === 'refusal') throw new AiError('refusal', friendly('refusal', '', null));
  return { text: state.text, usage: state.usage, stopReason: state.stopReason, model: state.model };
}

/** Checks a key without spending tokens (lists one model). Resolves on success. */
export async function verifyKey(apiKey: string, opts: { signal?: AbortSignal; fetch?: FetchLike } = {}): Promise<void> {
  if (!apiKey.trim()) throw new AiError('auth', 'Paste an API key first.');
  const doFetch = opts.fetch ?? defaultFetch;
  let res: Response;
  try {
    res = await doFetch(`${MODELS_URL}?limit=1`, { method: 'GET', headers: buildHeaders(apiKey), ...(opts.signal ? { signal: opts.signal } : {}) });
  } catch (err) {
    if (isAbort(err)) throw new AiError('aborted', friendly('aborted', '', null));
    throw new AiError('network', friendly('network', '', null));
  }
  if (!res.ok) throw await errorFromResponse(res);
}
