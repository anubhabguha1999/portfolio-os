export type DeployProvider = 'netlify' | 'vercel' | 'github';

export const PROVIDERS: readonly DeployProvider[] = ['netlify', 'vercel', 'github'];

export interface DeployFile {
  /** Relative to the site root, e.g. "css/styles.css". */
  path: string;
  bytes: Uint8Array;
}

/** What we remember about a deploy so the next one updates the same site. */
export interface DeployRecord {
  /** Netlify site id, Vercel project name, or GitHub "owner/repo". */
  target: string;
  /** The name the user typed (site name, project or repository). */
  name: string;
  url: string;
  deployedAt: string;
  /** Provider dashboard for this site. */
  adminUrl?: string;
}

export interface DeployResult extends DeployRecord {
  /** The host accepted the files but the site may take a moment to go live. */
  pending?: boolean;
}

export type DeployStage = (stage: string, progress: number) => void;

export interface DeployContext {
  token: string;
  onStage?: DeployStage;
  /** Injected in tests. */
  fetch?: typeof fetch;
  /** Poll interval in ms (tests use 0). */
  pollMs?: number;
  signal?: AbortSignal;
}

/** Error with a message that is safe and useful to show the user. */
export class DeployError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'DeployError';
  }
}
