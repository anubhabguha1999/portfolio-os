import { describe, expect, it } from 'vitest';
import { destructiveReason, detectPackageManager, detectTestFramework, parseTestSummary, quoteArg, scriptCommand, stripAnsi, testFilterCommand } from '@/features/runner/commands';

describe('local runner: package manager', () => {
  it('picks the manager from its lockfile', () => {
    expect(detectPackageManager(['package.json', 'pnpm-lock.yaml'])).toEqual({ packageManager: 'pnpm', lockfile: 'pnpm-lock.yaml' });
    expect(detectPackageManager(['yarn.lock'])).toEqual({ packageManager: 'yarn', lockfile: 'yarn.lock' });
    expect(detectPackageManager(['bun.lockb']).packageManager).toBe('bun');
    expect(detectPackageManager(['bun.lock']).packageManager).toBe('bun');
    expect(detectPackageManager(['package-lock.json']).packageManager).toBe('npm');
  });

  it('prefers another manager over a stray package-lock.json', () => {
    expect(detectPackageManager(['package-lock.json', 'pnpm-lock.yaml']).packageManager).toBe('pnpm');
  });

  it('lets the packageManager field break a tie between lockfiles', () => {
    expect(detectPackageManager(['package-lock.json', 'yarn.lock'], 'npm@10.2.0').packageManager).toBe('npm');
  });

  it('falls back to npm without a lockfile and says so', () => {
    expect(detectPackageManager(['package.json'])).toEqual({ packageManager: 'npm', lockfile: null });
  });

  it('detects the test framework from dependencies or the test script', () => {
    expect(detectTestFramework({ vitest: '^3' })).toBe('vitest');
    expect(detectTestFramework({ jest: '^29' })).toBe('jest');
    expect(detectTestFramework({}, 'jest --ci')).toBe('jest');
    expect(detectTestFramework({}, 'node --test')).toBeNull();
  });
});

describe('local runner: commands', () => {
  it('builds script commands per package manager', () => {
    expect(scriptCommand('npm', 'build')).toBe('npm run build');
    expect(scriptCommand('pnpm', 'test')).toBe('pnpm run test');
    expect(scriptCommand('npm', 'test', ['Button'])).toBe('npm run test -- Button');
    expect(scriptCommand('yarn', 'test', ['Button'])).toBe('yarn run test Button');
    expect(scriptCommand('bun', 'test', ['Button'])).toBe('bun run test Button');
  });

  it('quotes arguments for the shell', () => {
    expect(quoteArg('src/a.test.ts')).toBe('src/a.test.ts');
    expect(quoteArg('two words')).toBe("'two words'");
    expect(quoteArg("it's")).toBe(`'it'\\''s'`);
    expect(quoteArg('two words', 'win32')).toBe('"two words"');
    expect(scriptCommand('npm', 'test', ['; rm -rf /'])).toBe("npm run test -- '; rm -rf /'");
  });

  it('builds a filtered test command only when there is a test script', () => {
    expect(testFilterCommand({ packageManager: 'npm', scripts: { test: 'vitest run' } }, ' Button ')).toBe('npm run test -- Button');
    expect(testFilterCommand({ packageManager: 'npm', scripts: { test: 'vitest run' } }, '')).toBe('npm run test');
    expect(testFilterCommand({ packageManager: 'npm', scripts: {} }, 'x')).toBeNull();
  });
});

describe('local runner: safety', () => {
  it('flags destructive commands and script bodies', () => {
    expect(destructiveReason('rm -rf dist')).toMatch(/deletes files/);
    expect(destructiveReason('npm run clean', 'rimraf dist && rm -r build')).toMatch(/deletes files/);
    expect(destructiveReason('sudo npm i -g x')).toMatch(/administrator/);
    expect(destructiveReason('git reset --hard HEAD~1')).toMatch(/discards/);
    expect(destructiveReason('shutdown -h now')).toMatch(/shuts down/);
  });

  it('leaves ordinary commands alone', () => {
    for (const c of ['npm run build', 'vitest run', 'tsc -b && vite build', 'npm run format', 'node scripts/prerender.mjs', 'git status']) expect(destructiveReason(c)).toBeNull();
  });
});

describe('local runner: output', () => {
  it('strips ANSI colour codes', () => {
    expect(stripAnsi('\x1b[32m✓\x1b[39m ok \x1b[2K')).toBe('✓ ok ');
  });

  it('reads the Vitest summary line, not the Test Files line', () => {
    const out = ' Test Files  1 failed | 47 passed (48)\n      Tests  2 failed | 370 passed | 4 skipped (376)\n';
    expect(parseTestSummary(out)).toEqual({ passed: 370, failed: 2, skipped: 4 });
  });

  it('reads coloured Vitest output', () => {
    expect(parseTestSummary('\x1b[2m      Tests \x1b[22m \x1b[1m\x1b[32m24 passed\x1b[39m\x1b[22m\x1b[90m (24)\x1b[39m')).toEqual({ passed: 24, failed: 0, skipped: 0 });
  });

  it('reads the Jest summary line', () => {
    expect(parseTestSummary('Tests:       2 failed, 1 skipped, 24 passed, 27 total\nTime: 3s')).toEqual({ passed: 24, failed: 2, skipped: 1 });
  });

  it('returns null when there is no summary', () => {
    expect(parseTestSummary('vite v8 building for production...\n✓ built in 3.2s')).toBeNull();
  });
});
