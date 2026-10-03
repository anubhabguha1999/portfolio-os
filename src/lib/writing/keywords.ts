/**
 * Keyword extraction from job descriptions and keyword lookup in resume/library text.
 *
 *   text → tokens (boundaries at punctuation/newlines) → 1–4-gram dictionary lookup
 *        (stemmed, synonyms → canonical)  → hard skills / tools / soft skills
 *   leftover tokens → stopword-free 1–3-grams → repeated or emphasised phrases → "other"
 *
 * Deterministic, no AI service.
 */
import { lookupTerm, MAX_ALIAS_TOKENS, canonicalTerm, type KeywordKind } from './dictionary';
import { STOPWORDS, tokenize, type Token } from './text';

export type Zone = 'required' | 'preferred' | 'general' | 'skip';

export interface JdKeyword {
  /** Identity: canonical name for dictionary terms, stem key for "other" phrases. */
  key: string;
  /** Display label. */
  label: string;
  kind: KeywordKind;
  count: number;
  /** Most important zone the term appeared in. */
  zone: Exclude<Zone, 'skip'>;
  /** Stem keys of every surface form seen (used to find the term in other text). */
  forms: string[];
  /** Final weight used by the score. */
  weight: number;
  inTitle: boolean;
}

/** Points per keyword kind — the base of the weighted score. */
export const KIND_WEIGHT: Record<KeywordKind, number> = { hard: 3, tool: 2, soft: 1, other: 1 };
/** Multiplier by where the keyword appears in the posting. */
export const ZONE_WEIGHT: Record<Exclude<Zone, 'skip'>, number> = { required: 1.5, general: 1, preferred: 0.6 };
const ZONE_RANK: Record<Exclude<Zone, 'skip'>, number> = { preferred: 0, general: 1, required: 2 };

const H_GENERAL = /^(?:responsibilities|key responsibilities|what you(?:'| wi)ll do|what you will be doing|the role|about the role|about this role|your role|role overview|duties|day[- ]to[- ]day|in this role|the job|job description|overview|summary|your impact|what you'll work on)\b/i;
const H_REQUIRED = /^(?:requirements?|qualifications?|minimum qualifications|basic qualifications|required qualifications|required skills|what you(?:'| wi)ll (?:need|bring)|what we(?:'re| are) looking for|must[- ]haves?|must have|you have|you bring|you should have|you might be a fit|skills(?: (?:&|and) (?:experience|qualifications))?|who you are|about you|your profile|your background|key skills|technical skills|experience|essential(?: skills| criteria)?|what it takes)\b/i;
const H_PREFERRED = /^(?:preferred(?: qualifications| skills)?|nice[- ]to[- ]haves?|nice to have|bonus(?: points)?|desired(?: skills| qualifications)?|desirable|pluses|good to have|it(?:'s| is| would be) (?:a )?(?:plus|great|nice)|extra credit|additional qualifications|even better|ideally)\b/i;
const H_SKIP = /^(?:about (?:us|the company|the team|our company)|who we are|benefits|perks|what we offer|we offer|why (?:join|work)|compensation|salary|pay|equal (?:opportunity|employment)|eeo|our (?:values|mission|culture|story)|how to apply|location|diversity|life at|working here|the company)\b/i;

const INLINE_PREFERRED = /\b(?:nice[- ]to[- ]have|preferred|preferably|bonus|a plus|is a plus|are a plus|ideally|desirable|advantageous|good to have)\b/i;
const INLINE_REQUIRED = /\b(?:required|must|minimum|at least|essential|mandatory|need to have|strong (?:experience|knowledge|proficiency)|proficien(?:t|cy) (?:in|with))\b/i;

function headingZone(line: string): Zone | null {
  const clean = line.replace(/^[\s#*_>•·-]+|[\s*_:：-]+$/g, '').trim();
  // List items are content, not headings.
  if (/^\s*(?:[-•·▪●]|\*\s|\d{1,2}[.)]\s)/.test(line)) return null;
  if (!clean || clean.split(/\s+/).length > 8) return null;
  const colon = /[:：]\s*$/.test(line) || /^[^:：]{1,60}[:：]/.test(line);
  const head = clean.split(/[:：]/)[0]!.trim();
  // A heading is (nearly) the whole line, or the part before a colon — not "Experience with X".
  const fits = (re: RegExp) => {
    const m = re.exec(head);
    if (!m || (head !== clean && !colon)) return false;
    const rest = head.slice(m[0].length).trim();
    return colon || rest.length <= 3 || (/^(?:&|and|\/)\s/i.test(rest) && rest.length <= 30);
  };
  if (fits(H_GENERAL)) return 'general';
  if (fits(H_PREFERRED)) return 'preferred';
  if (fits(H_REQUIRED)) return 'required';
  if (fits(H_SKIP)) return 'skip';
  return null;
}

/** Each line of the posting with the zone it belongs to. Headings switch the zone. */
export function zoneLines(jd: string): Array<{ line: string; zone: Zone }> {
  const out: Array<{ line: string; zone: Zone }> = [];
  let zone: Zone = 'general';
  for (const raw of jd.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const h = headingZone(line);
    if (h) {
      zone = h;
      // Heading lines that carry content after a colon ("Requirements: React, Node") still count.
      const rest = line.split(/[:：]/).slice(1).join(':').trim();
      if (rest) out.push({ line: rest, zone: h });
      continue;
    }
    let z = zone;
    if (z !== 'skip') {
      if (INLINE_PREFERRED.test(line)) z = 'preferred';
      else if (INLINE_REQUIRED.test(line)) z = 'required';
    }
    out.push({ line, zone: z });
  }
  return out;
}

export interface DictMatch {
  canonical: string;
  kind: Exclude<KeywordKind, 'other'>;
  start: number;
  end: number;
  stemKey: string;
}

/** Dictionary terms in a token stream (longest match first, never across a boundary). */
export function matchDictionary(tokens: Token[]): DictMatch[] {
  const out: DictMatch[] = [];
  let i = 0;
  while (i < tokens.length) {
    let matched = false;
    for (let n = Math.min(MAX_ALIAS_TOKENS, tokens.length - i); n >= 1; n--) {
      if (tokens.slice(i + 1, i + n).some((t) => t.boundary)) continue;
      const span = tokens.slice(i, i + n);
      const key = span.map((t) => t.stem).join(' ');
      const hit = lookupTerm(
        key,
        span.map((t) => t.raw).join(' '),
        span.map((t) => t.text).join(' '),
      );
      if (hit) {
        out.push({ ...hit, start: i, end: i + n, stemKey: key });
        i += n;
        matched = true;
        break;
      }
    }
    if (!matched) i++;
  }
  return out;
}

/** Words that appear in almost every posting and say nothing about the candidate. */
const JD_NOISE = new Set(
  `build building built design designing develop developing create creating drive driving deliver delivering ensure ensuring support supporting
  manage managing own owning grow growing make making work help helping join provide providing maintain maintaining improve improving
  write writing lead leading partner partnering contribute contributing define defining shape shaping play take bring want love enjoy
  thrive passion passionate excited exciting motivated mission world people person culture environment fast paced ideal great best new
  high quality impact impactful value values growth time full part remote hybrid office onsite on-site location salary benefit based
  level senior junior mid lead principal staff intern engineer engineering developer development manager role position team teams company
  business product products customer customers client clients user users member members colleague colleagues opportunity day week month year
  hour including include etc across within like also well every each good strong excellent solid proven deep broad wide range variety
  ability able familiar familiarity experience experienced knowledge understanding skill skills tool tools technology technologies
  stack platform platforms system systems solution solutions service services feature features project projects application applications
  way ways thing things part parts area areas field fields industry global international local equal employer
  candidate candidates applicant applicants background must required preferred plus bonus nice minimum years months degree bachelor
  master related relevant equivalent similar other others first second one two three four five six seven eight nine ten`.split(/\s+/).filter(Boolean),
);

function isContentToken(t: Token): boolean {
  if (STOPWORDS.has(t.text) || JD_NOISE.has(t.text) || JD_NOISE.has(t.stem)) return false;
  if (/^\d/.test(t.text)) return false;
  if (t.text.length < 3 && !/[+#]/.test(t.text)) return false;
  return /[a-z]/.test(t.text);
}

interface PhraseAcc {
  key: string;
  forms: Map<string, number>;
  count: number;
  zone: Exclude<Zone, 'skip'>;
  n: number;
  capitalised: boolean;
}

function bumpZone(a: Exclude<Zone, 'skip'>, b: Exclude<Zone, 'skip'>): Exclude<Zone, 'skip'> {
  return ZONE_RANK[b] > ZONE_RANK[a] ? b : a;
}

export interface ExtractOptions {
  /** Job title — its words are not treated as keywords, and title keywords weigh more. */
  title?: string;
  /** Company name — never a keyword. */
  company?: string;
  /** Max "other" phrases kept (default 12). */
  maxOther?: number;
}

/** Keywords of a job description, heaviest first. */
export function extractJobKeywords(jd: string, opts: ExtractOptions = {}): JdKeyword[] {
  const lines = zoneLines(jd).filter((l) => l.zone !== 'skip');
  const titleTokens = tokenize(opts.title ?? '');
  const titleDict = new Set(matchDictionary(titleTokens).map((m) => m.canonical));
  const exclude = new Set([...titleTokens, ...tokenize(opts.company ?? '')].map((t) => t.stem));

  const dict = new Map<string, { label: string; kind: Exclude<KeywordKind, 'other'>; count: number; zone: Exclude<Zone, 'skip'>; forms: Set<string> }>();
  const phrases = new Map<string, PhraseAcc>();

  for (const { line, zone: z } of lines) {
    const zone = z as Exclude<Zone, 'skip'>;
    const tokens = tokenize(line);
    const hits = matchDictionary(tokens);
    const consumed = new Set<number>();
    for (const h of hits) {
      for (let k = h.start; k < h.end; k++) consumed.add(k);
      const cur = dict.get(h.canonical) ?? { label: h.canonical, kind: h.kind, count: 0, zone, forms: new Set<string>() };
      cur.count++;
      cur.zone = bumpZone(cur.zone, zone);
      cur.forms.add(h.stemKey);
      dict.set(h.canonical, cur);
    }
    // Runs of content tokens between dictionary hits / boundaries.
    let run: Token[] = [];
    const flush = () => {
      for (let n = 1; n <= 3; n++)
        for (let s = 0; s + n <= run.length; s++) {
          const span = run.slice(s, s + n);
          if (span.some((t) => exclude.has(t.stem))) continue;
          const key = span.map((t) => t.stem).join(' ');
          const form = span.map((t) => t.text).join(' ');
          const acc = phrases.get(key) ?? { key, forms: new Map(), count: 0, zone, n, capitalised: false };
          acc.count++;
          acc.zone = bumpZone(acc.zone, zone);
          acc.forms.set(form, (acc.forms.get(form) ?? 0) + 1);
          // A capitalised word mid-sentence is often a product name ("Retool", "Snowplow").
          if (n === 1 && !span[0]!.boundary && /^[A-Z][a-z]+[A-Z]?[a-z]*$|^[A-Z]{2,6}s?$/.test(span[0]!.raw)) acc.capitalised = true;
          phrases.set(key, acc);
        }
      run = [];
    };
    tokens.forEach((t, idx) => {
      if (t.boundary) flush();
      if (consumed.has(idx) || !isContentToken(t)) flush();
      else run.push(t);
    });
    flush();
  }

  const out: JdKeyword[] = [];
  for (const [canonical, d] of dict) {
    const inTitle = titleDict.has(canonical);
    out.push({ key: canonical, label: d.label, kind: d.kind, count: d.count, zone: d.zone, forms: [...d.forms], inTitle, weight: weightOf(d.kind, d.zone, d.count, inTitle) });
  }

  // "Other" phrases: repeated multi-word phrases, frequent words, or product-like names.
  const candidates = [...phrases.values()].filter((p) => (p.n >= 2 ? p.count >= 2 : p.count >= 3 || (p.capitalised && p.zone !== 'general') || (p.capitalised && p.count >= 2)));
  candidates.sort((a, b) => b.count * b.n - a.count * a.n || ZONE_RANK[b.zone] - ZONE_RANK[a.zone]);
  const kept: PhraseAcc[] = [];
  for (const c of candidates) {
    // Skip phrases contained in (or containing) a kept phrase with similar frequency.
    const overlaps = kept.some((k) => (` ${k.key} `.includes(` ${c.key} `) && k.count >= c.count - 1) || (` ${c.key} `.includes(` ${k.key} `) && c.count >= k.count));
    if (overlaps) continue;
    kept.push(c);
    if (kept.length >= (opts.maxOther ?? 12)) break;
  }
  for (const p of kept) {
    const label = [...p.forms.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    out.push({ key: p.key, label, kind: 'other', count: p.count, zone: p.zone, forms: [p.key], inTitle: false, weight: weightOf('other', p.zone, p.count, false) });
  }
  return out.sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label));
}

export function weightOf(kind: KeywordKind, zone: Exclude<Zone, 'skip'>, count: number, inTitle: boolean): number {
  const freq = 1 + 0.2 * Math.min(Math.max(count - 1, 0), 3);
  return Math.round(KIND_WEIGHT[kind] * ZONE_WEIGHT[zone] * freq * (inTitle ? 1.3 : 1) * 100) / 100;
}

/* ------------------------------ corpus ------------------------------ */

/** Searchable view of some text: canonical dictionary terms + every stemmed 1–4-gram. */
export interface Corpus {
  canonicals: Set<string>;
  grams: Set<string>;
}

export function emptyCorpus(): Corpus {
  return { canonicals: new Set(), grams: new Set() };
}

/** Add prose (bullets, descriptions) to a corpus. */
export function addText(c: Corpus, text: string): Corpus {
  if (!text.trim()) return c;
  const tokens = tokenize(text);
  for (const m of matchDictionary(tokens)) c.canonicals.add(m.canonical);
  for (let i = 0; i < tokens.length; i++)
    for (let n = 1; n <= MAX_ALIAS_TOKENS && i + n <= tokens.length; n++) {
      if (n > 1 && tokens[i + n - 1]!.boundary) break;
      c.grams.add(
        tokens
          .slice(i, i + n)
          .map((t) => t.stem)
          .join(' '),
      );
    }
  return c;
}

/** Add a short label typed as a skill/tag ("node", "k8s") — case rules are relaxed. */
export function addTerm(c: Corpus, term: string): Corpus {
  const hit = canonicalTerm(term);
  if (hit) c.canonicals.add(hit.canonical);
  return addText(c, term);
}

export function corpusOf(texts: string[], terms: string[] = []): Corpus {
  const c = emptyCorpus();
  for (const t of texts) addText(c, t);
  for (const t of terms) addTerm(c, t);
  return c;
}

export function corpusHas(c: Corpus, k: Pick<JdKeyword, 'key' | 'kind' | 'forms'>): boolean {
  // Dictionary terms match by canonical name only (so "go to market" never counts as Go).
  if (k.kind !== 'other') return c.canonicals.has(k.key);
  return k.forms.some((f) => c.grams.has(f));
}
