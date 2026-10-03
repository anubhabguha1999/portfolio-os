/**
 * Small, dependency-free text utilities shared by the job-match and bullet helpers.
 * Everything is deterministic and runs offline.
 */

/** Lower-case, unify dashes/quotes and collapse whitespace. */
export function normalizeText(s: string): string {
  return s
    .replace(/[‐-―−]/g, '-')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export interface Token {
  /** Lower-cased token text (keeps + # . / inside tech words such as c++, node.js, ci/cd). */
  text: string;
  /** Token as written (for case-sensitive checks such as "Go" or "REST"). */
  raw: string;
  /** Lite stem of `text`. */
  stem: string;
  /** True when a sentence/line/clause boundary precedes this token (n-grams never cross it). */
  boundary: boolean;
}

/**
 * Tokenise free text. Punctuation that ends a clause (. , ; : ! ? ( ) newline, bullets)
 * becomes a boundary so phrases do not join across sentences.
 */
export function tokenize(input: string): Token[] {
  const s = input.replace(/[‐-―−]/g, '-').replace(/[‘’ʼ]/g, "'");
  const out: Token[] = [];
  // A word: letters/digits plus inner . + # / - & ' (c++, c#, node.js, ci/cd, front-end, r&d, don't).
  const re = /[A-Za-z0-9][A-Za-z0-9+#]*(?:[./&'-][A-Za-z0-9+#]+)*[+#]*|\.[A-Za-z][A-Za-z0-9]*|[\n.,;:!?()[\]{}•·|"]/g;
  let boundary = true;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const raw = m[0];
    if (/^[\n.,;:!?()[\]{}•·|"]$/.test(raw)) {
      boundary = true;
      continue;
    }
    // Strip possessive 's.
    const clean = raw.replace(/'s$/i, '');
    const text = clean.toLowerCase();
    out.push({ text, raw: clean, stem: stem(text), boundary });
    boundary = false;
  }
  return out;
}

/** Plain word list (lower-case) — used for counts. */
export function words(s: string): string[] {
  return s.match(/[A-Za-z0-9][A-Za-z0-9+#'’.-]*/g)?.map((w) => w.replace(/[.]+$/, '').toLowerCase()) ?? [];
}

export function wordCount(s: string): number {
  return words(s).length;
}

const STEM_EXCEPTIONS = new Set(['js', 'ts', 'css', 'aws', 'gcp', 'ios', 'kubernetes', 'jenkins', 'pandas', 'analytics', 'devops', 'sales', 'news', 'business', 'process', 'access', 'success', 'class', 'status', 'canvas', 'redis', 'postgres', 'express', 'series', 'less', 'ops', 'apis', 'llms', 'saas', 'paas', 'iaas', 'xss', 'sass', 'mlops', 'nodejs', 'nextjs', 'vuejs', 'reactjs', 'k8s', 'cross', 'bus', 'gas', 'atlas', 'focus', 'campus', 'bonus', 'plus', 'this', 'is', 'was', 'has', 'its', 'us', 'thus', 'across']);

/**
 * Stemming-lite: removes the common English inflections that matter for keyword matching
 * (plurals, -ing, -ed, -ies) without the aggressiveness of a full Porter stemmer.
 * "developers" → "develop", "testing" → "test", "libraries" → "library", "managed" → "manag".
 */
export function stem(word: string): string {
  let w = word.toLowerCase();
  if (w.length <= 3 || STEM_EXCEPTIONS.has(w) || /[^a-z]/.test(w)) return w;
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('sses')) return w.slice(0, -2);
  if (w.endsWith('ers') && w.length > 5) w = w.slice(0, -1);
  else if (w.endsWith('es') && /(ches|shes|xes|zes)$/.test(w)) w = w.slice(0, -2);
  else if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) w = w.slice(0, -1);
  if (w.endsWith('ing') && w.length > 5) w = w.slice(0, -3);
  else if (w.endsWith('ed') && w.length > 4) w = w.slice(0, -2);
  else if (w.endsWith('er') && w.length > 5) w = w.slice(0, -2);
  // "manag" / "manage" / "management" families converge enough for matching.
  if (w.endsWith('ment') && w.length > 7) w = w.slice(0, -4);
  if (w.endsWith('e') && w.length > 4) w = w.slice(0, -1);
  // Doubled final consonant after -ing/-ed removal: "running" → "runn" → "run".
  if (/([bdfgmnprt])\1$/.test(w) && w.length > 3) w = w.slice(0, -1);
  return w;
}

export const STOPWORDS = new Set(
  `a about above across after again against all almost also although always am among an and another any anyone anything are around as at
  be because been before being below between both but by can cannot could did do does doing done down during each either else
  etc even ever every few for from further get gets getting given go goes going had has have having he her here hers him his how however
  i if in into is it its itself just least less like likely make makes many may me might more most much must my myself near need needs
  neither no nor not now of off often on once one only onto or other others our ours out over own per perhaps please plus rather
  really same see seem seems several shall she should since so some something such than that the their theirs them themselves then
  there these they this those though through throughout thus to together too toward towards under unless until up upon us use used
  using very via was we well were what whatever when where whether which while who whom whose why will with within without would yet
  you your yours yourself yourselves able ability abilities strong excellent good great new including include includes includ
  across based related relevant work working works worked role roles position job jobs team teams company candidate candidates
  ideal looking seeking opportunity opportunities experience experienced year years plus day days responsibilities responsibility
  requirement requirements qualification qualifications preferred required bonus nice desired skill skills knowledge understanding
  familiarity familiar proficiency proficient hands-on hand solid deep proven demonstrated track record minimum least degree equivalent
  apply applicants join help ensure across within various multiple key major high highly level levels other etc e.g i.e
  we're you'll you're we'll they're it's don't won't can't who'll what's`.split(/\s+/).filter(Boolean),
);

/** Sentences of a block of text (also splits on newlines and bullet characters). */
export function sentences(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9])|\s*[•·▪●]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Split pasted bullet text into one item per line, removing list markers. */
export function splitBullets(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•·▪●◦‣–—>]|\d{1,2}[.)])\s*/, '').trim())
    .filter((l) => l.length > 0);
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
