/**
 * Local build & test runner: pure helpers shared by the dev-server endpoint
 * (scripts/vite-dev-runner.ts) and the /runner page. No Node or DOM APIs here.
 */

export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';
export type TestFramework = 'vitest' | 'jest';
export type RunKind = 'build' | 'test' | 'lint' | 'script' | 'custom';

export interface RunnerProject {
  name: string;
  root: string;
  packageManager: PackageManager;
  /** The lockfile that decided the package manager; null when there is none and npm is assumed. */
  lockfile: string | null;
  scripts: Record<string, string>;
  testFramework: TestFramework | null;
}

export interface TestSummary {
  passed: number;
  failed: number;
  skipped: number;
}

export type RunEvent =
  | { type: 'start'; id: string; command: string; kind: RunKind; startedAt: number }
  | { type: 'output'; id: string; stream: 'stdout' | 'stderr'; text: string }
  | { type: 'exit'; id: string; code: number | null; signal: string | null; stopped: boolean; durationMs: number; tests: TestSummary | null; error: string | null };

/** Body of POST /__runner/run: a package.json script, or a command typed by the user. */
export type RunRequest = { kind: RunKind; script: string; confirmed?: boolean } | { kind: RunKind; command: string; confirmed?: boolean };

export type RunResponse = { ok: true; id: string; command: string } | { ok: false; reason: 'busy' | 'empty' | 'unknown-script' } | { ok: false; reason: 'confirm'; command: string; warning: string };

/* ------------------------- package manager ------------------------- */

/** Checked in order; npm's lockfile is last because a stray one often sits beside another manager's. */
const LOCKFILES: Array<[string, PackageManager]> = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['package-lock.json', 'npm'],
];

/** The lockfile decides; package.json's "packageManager" field breaks a tie between several. No lockfile: npm. */
export function detectPackageManager(files: readonly string[], packageManagerField?: unknown): { packageManager: PackageManager; lockfile: string | null } {
  const found = LOCKFILES.filter(([f]) => files.includes(f));
  const declared = typeof packageManagerField === 'string' ? packageManagerField.split('@')[0] : null;
  const pick = found.find(([, pm]) => pm === declared) ?? found[0];
  return pick ? { packageManager: pick[1], lockfile: pick[0] } : { packageManager: 'npm', lockfile: null };
}

export function detectTestFramework(deps: Record<string, unknown>, testScript = ''): TestFramework | null {
  if ('vitest' in deps || /\bvitest\b/.test(testScript)) return 'vitest';
  if ('jest' in deps || /\bjest\b/.test(testScript)) return 'jest';
  return null;
}

/* ----------------------------- commands ----------------------------- */

export type Shell = 'posix' | 'win32';

export function quoteArg(arg: string, shell: Shell = 'posix'): string {
  if (/^[\w@%+=:,./-]+$/.test(arg)) return arg;
  if (shell === 'win32') return `"${arg.replace(/"/g, '""')}"`;
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

/** `npm run build`, `pnpm run test Button`… npm needs "--" to pass arguments to the script; the others pass them through. */
export function scriptCommand(pm: PackageManager, script: string, args: string[] = [], shell: Shell = 'posix'): string {
  const name = quoteArg(script, shell);
  const rest = args.map((a) => quoteArg(a, shell)).join(' ');
  if (!rest) return `${pm} run ${name}`;
  return pm === 'npm' ? `npm run ${name} -- ${rest}` : `${pm} run ${name} ${rest}`;
}

/** The test script narrowed by a filter. Vitest and Jest both read a positional argument as a test-file filter. */
export function testFilterCommand(project: Pick<RunnerProject, 'packageManager' | 'scripts'>, filter: string, shell: Shell = 'posix'): string | null {
  if (!project.scripts.test) return null;
  const f = filter.trim();
  return scriptCommand(project.packageManager, 'test', f ? [f] : [], shell);
}

/* ------------------------------ safety ------------------------------ */

const DESTRUCTIVE: Array<[RegExp, string]> = [
  [/(^|[\s;&|(])(rm|rmdir|del|erase|rd)\s/i, 'deletes files'],
  [/(^|[\s;&|(])(sudo|doas)\s/i, 'runs with administrator rights'],
  [/(^|[\s;&|(])(mkfs\S*|format|diskutil|fdisk|dd)\s/i, 'touches disks or partitions'],
  [/(^|[\s;&|(])(shutdown|reboot|halt|poweroff)\b/i, 'shuts down or restarts the computer'],
  [/\bgit\s+(clean|reset\s+--hard|checkout\s+--\s|restore\s)/i, 'discards local changes'],
  [/\b(chmod|chown)\s+-R\b/i, 'changes permissions recursively'],
  [/(^|[^>])>\s*\/dev\/(sd|disk|nvme)/i, 'writes to a raw disk'],
];

/** Why a command (or the script body it runs) looks destructive, or null. */
export function destructiveReason(command: string, scriptBody = ''): string | null {
  for (const text of [command, scriptBody]) {
    for (const [re, why] of DESTRUCTIVE) if (re.test(text)) return `This command ${why}.`;
  }
  return null;
}

/* ------------------------------ output ------------------------------ */

const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*(\x07|\x1b\\)/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI, '');
}

/**
 * The last "Tests" summary line in Vitest or Jest output:
 *   Vitest:  Tests  24 passed | 2 failed | 1 skipped (27)
 *   Jest:    Tests:       2 failed, 1 skipped, 24 passed, 27 total
 */
export function parseTestSummary(output: string): TestSummary | null {
  const lines = stripAnsi(output).split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = /^\s*Tests:?\s+(.*)$/.exec(lines[i]!);
    if (!m || !/\d+\s+(passed|failed|skipped|todo|pending)/.test(m[1]!)) continue;
    const n = (word: string) => Number(new RegExp(`(\\d+)\\s+${word}`).exec(m[1]!)?.[1] ?? 0);
    return { passed: n('passed'), failed: n('failed'), skipped: n('skipped') + n('todo') + n('pending') };
  }
  return null;
}
