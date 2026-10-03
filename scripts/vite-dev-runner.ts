/**
 * Dev-server endpoint behind the /runner page: runs this project's package.json scripts
 * (or a command typed on the page) on this machine and streams the output back.
 *
 * Only exists under `vite` (apply: 'serve'), never in a build. Requests must come from this
 * machine: the Host must be a loopback name (blocks DNS rebinding) and writes need the
 * `x-local-runner` header, which a page on another origin cannot send without a CORS
 * preflight this server never approves.
 *
 *   GET  /__runner/project   name, package manager, scripts
 *   GET  /__runner/events    Server-Sent Events: the current run, then live events
 *   POST /__runner/run       { script } or { command }, plus kind and confirmed
 *   POST /__runner/stop
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import {
  destructiveReason,
  detectPackageManager,
  detectTestFramework,
  parseTestSummary,
  scriptCommand,
  type RunEvent,
  type RunKind,
  type RunnerProject,
  type RunRequest,
  type RunResponse,
} from '../src/features/runner/commands';

const KINDS: RunKind[] = ['build', 'test', 'lint', 'script', 'custom'];
const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
const STOP_GRACE_MS = 3000;
/** Output kept for parsing the test summary and for replaying to a reloaded page. */
const MAX_KEPT = 2_000_000;

function readProject(root: string): RunnerProject {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as Record<string, unknown>;
  const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
  const scripts = Object.fromEntries(Object.entries(obj(pkg.scripts)).filter((e): e is [string, string] => typeof e[1] === 'string'));
  return {
    name: typeof pkg.name === 'string' && pkg.name ? pkg.name : basename(root),
    root,
    ...detectPackageManager(readdirSync(root), pkg.packageManager),
    scripts,
    testFramework: detectTestFramework({ ...obj(pkg.dependencies), ...obj(pkg.devDependencies) }, scripts.test),
  };
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 64_000) throw new Error('Request too large');
  }
  return JSON.parse(raw || '{}');
}

function parseRequest(body: unknown): RunRequest | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const kind = KINDS.includes(b.kind as RunKind) ? (b.kind as RunKind) : null;
  if (!kind) return null;
  const confirmed = b.confirmed === true;
  if (typeof b.script === 'string') return { kind, script: b.script, confirmed };
  if (typeof b.command === 'string') return { kind, command: b.command, confirmed };
  return null;
}

/** Ends the whole process tree: SIGTERM, then SIGKILL after a grace period (taskkill on Windows). */
function killTree(child: ChildProcess): void {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  const signal = (s: NodeJS.Signals) => {
    try {
      process.kill(-child.pid!, s);
    } catch {
      /* already gone */
    }
  };
  signal('SIGTERM');
  setTimeout(() => child.exitCode === null && child.signalCode === null && signal('SIGKILL'), STOP_GRACE_MS).unref();
}

export function localRunner(rootDir: string): Plugin {
  const root = resolve(rootDir);
  const clients = new Set<ServerResponse>();
  let current: { id: string; child: ChildProcess; events: RunEvent[]; output: string; stopped: boolean } | null = null;
  let lastEvents: RunEvent[] = [];
  let seq = 0;

  const emit = (event: RunEvent) => {
    const run = current;
    if (run && run.events.length < 20_000) run.events.push(event);
    const line = `data: ${JSON.stringify(event)}\n\n`;
    for (const c of clients) c.write(line);
  };

  const start = (command: string, kind: RunKind): string => {
    const id = `run_${Date.now().toString(36)}_${++seq}`;
    const startedAt = Date.now();
    // A shell, so a typed command works as it would in a terminal. The environment is the dev server's own,
    // minus the NODE_ENV=development Vite put there: a build started here must build for production.
    const env = { ...process.env };
    delete env.NODE_ENV;
    const child = spawn(command, { cwd: root, env, shell: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const run = { id, child, events: [] as RunEvent[], output: '', stopped: false };
    current = run;
    emit({ type: 'start', id, command, kind, startedAt });
    const onData = (stream: 'stdout' | 'stderr') => (buf: Buffer) => {
      const text = buf.toString('utf8');
      if (run.output.length < MAX_KEPT) run.output += text;
      emit({ type: 'output', id, stream, text });
    };
    child.stdout?.on('data', onData('stdout'));
    child.stderr?.on('data', onData('stderr'));
    let spawnError: string | null = null;
    child.on('error', (e) => (spawnError = e.message));
    child.on('close', (code, signal) => {
      emit({ type: 'exit', id, code, signal, stopped: run.stopped, durationMs: Date.now() - startedAt, tests: kind === 'test' || kind === 'script' || kind === 'custom' ? parseTestSummary(run.output) : null, error: spawnError });
      lastEvents = run.events;
      if (current === run) current = null;
    });
    return id;
  };

  return {
    name: 'local-runner',
    apply: 'serve',
    // Commands run from the page write build output and TypeScript's incremental state; watching
    // those would make Vite reload the page mid-run.
    config: () => ({ server: { watch: { ignored: ['**/*.tsbuildinfo', '**/dist/**', '**/dev-dist/**', '**/coverage/**'] } } }),
    configureServer(server) {
      server.httpServer?.on('close', () => current && killTree(current.child));
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url ?? '').split('?')[0]!;
        if (!path.startsWith('/__runner/')) return next();
        if (!LOOPBACK.test(req.headers.host ?? '')) return send(res, 403, { error: 'Local requests only.' });
        if (req.method === 'POST' && req.headers['x-local-runner'] !== '1') return send(res, 403, { error: 'Missing x-local-runner header.' });

        try {
          if (req.method === 'GET' && path === '/__runner/project') return send(res, 200, { project: readProject(root), running: current?.id ?? null });

          if (req.method === 'GET' && path === '/__runner/events') {
            res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
            // Replay the current (or last) run so a reloaded page shows its output.
            for (const e of current?.events ?? lastEvents) res.write(`data: ${JSON.stringify(e)}\n\n`);
            clients.add(res);
            const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
            req.on('close', () => {
              clearInterval(ping);
              clients.delete(res);
            });
            return;
          }

          if (req.method === 'POST' && path === '/__runner/run') {
            const body = parseRequest(await readJson(req));
            if (!body) return send(res, 400, { error: 'Expected { kind, script } or { kind, command }.' });
            if (current) return send(res, 409, { ok: false, reason: 'busy' } satisfies RunResponse);
            const project = readProject(root);
            let command: string;
            let scriptBody = '';
            if ('script' in body) {
              if (!(body.script in project.scripts)) return send(res, 404, { ok: false, reason: 'unknown-script' } satisfies RunResponse);
              command = scriptCommand(project.packageManager, body.script, [], process.platform === 'win32' ? 'win32' : 'posix');
              scriptBody = project.scripts[body.script]!;
            } else {
              command = body.command.trim();
              // A typed "npm run x" still deserves a look at what script x does.
              const named = /^(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?([\w:.-]+)/.exec(command)?.[1];
              if (named && project.scripts[named]) scriptBody = project.scripts[named]!;
            }
            if (!command) return send(res, 400, { ok: false, reason: 'empty' } satisfies RunResponse);
            const warning = destructiveReason(command, scriptBody);
            if (warning && !body.confirmed) return send(res, 200, { ok: false, reason: 'confirm', command, warning } satisfies RunResponse);
            return send(res, 200, { ok: true, id: start(command, body.kind), command } satisfies RunResponse);
          }

          if (req.method === 'POST' && path === '/__runner/stop') {
            if (current) {
              current.stopped = true;
              killTree(current.child);
            }
            return send(res, 200, { ok: true });
          }

          return send(res, 404, { error: 'Not found' });
        } catch (e) {
          return send(res, 500, { error: (e as Error).message });
        }
      });
    },
  };
}
