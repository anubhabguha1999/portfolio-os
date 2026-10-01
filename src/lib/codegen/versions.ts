/**
 * Supported dependency versions for generated projects.
 *
 * This is the single place the export engine's toolchain is defined; generators read
 * it instead of hard-coding versions. Update it when a new stable release is verified
 * (the export test suite builds generated projects against these ranges).
 * Verified: September 2026.
 */
export const TOOLCHAIN = {
  next: '16.3.8',
  react: '19.3.0',
  'react-dom': '19.3.0',
  typescript: '^7.0.2',
  '@types/react': '^19.3.0',
  '@types/react-dom': '^19.3.0',
  '@types/node': '^26.6.3',
  tailwindcss: '^4.3.3',
  '@tailwindcss/postcss': '^4.3.3',
  '@tailwindcss/vite': '^4.3.3',
  vite: '^8.3.1',
  '@vitejs/plugin-react': '^6.1.1',
  'react-router-dom': '^7.18.4',
  motion: '^13.4.6',
  eslint: '^10.11.0',
  'eslint-config-next': '16.3.8',
} as const;

export type ToolchainPackage = keyof typeof TOOLCHAIN;

/** Caret range for runtime deps (exact pins stay exact for Next/React). */
export function versionOf(pkg: ToolchainPackage): string {
  const v = TOOLCHAIN[pkg];
  return /^[\d]/.test(v) ? `^${v}` : v;
}

export function pick(pkgs: ToolchainPackage[]): Record<string, string> {
  return Object.fromEntries(pkgs.sort().map((p) => [p, versionOf(p)]));
}

/** Minimum Node.js the toolchain requires. */
export const NODE_ENGINE = '>=20.19';
