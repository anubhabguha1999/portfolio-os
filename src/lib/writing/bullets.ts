/**
 * Deterministic bullet-point checks for resumes (no AI service).
 *
 * Rules: weak opener · no metric · too long / too short · repeated opening verb ·
 * tense (past roles past, current role consistent) · first-person pronouns · filler words ·
 * passive voice · no action verb.
 *
 * Score per bullet: 100 minus each finding's penalty (floored at 0); overall = mean.
 */
import type { ResolvedResume } from '@/studio/model/resolve';
import { words } from './text';

export type BulletRule = 'weak-opener' | 'no-metric' | 'too-long' | 'too-short' | 'repeated-verb' | 'tense' | 'pronoun' | 'filler' | 'passive' | 'no-verb';

export interface BulletFinding {
  rule: BulletRule;
  level: 'warn' | 'info';
  message: string;
  /** Concrete replacement ideas (e.g. stronger verbs). */
  suggestions?: string[];
}

export interface BulletContext {
  /** True for the current role (present tense allowed), false for a past one, undefined when unknown. */
  current?: boolean;
  /** Groups bullets that belong to one entry (tense consistency, repeated verbs within an entry). */
  groupId?: string;
}

export interface BulletInput extends BulletContext {
  id: string;
  text: string;
}

export interface BulletReport {
  id: string;
  text: string;
  groupId?: string;
  words: number;
  findings: BulletFinding[];
  score: number;
}

export interface BulletSummary {
  bullets: BulletReport[];
  score: number;
  counts: Partial<Record<BulletRule, number>>;
  /** Opening verbs used three or more times across the set. */
  repeatedVerbs: Array<{ verb: string; count: number }>;
}

export const RULE_LABEL: Record<BulletRule, string> = {
  'weak-opener': 'Weak opener',
  'no-metric': 'No number or metric',
  'too-long': 'Too long',
  'too-short': 'Too short',
  'repeated-verb': 'Repeated opening verb',
  tense: 'Tense',
  pronoun: 'First-person pronoun',
  filler: 'Filler words',
  passive: 'Passive voice',
  'no-verb': 'No action verb',
};

export const PENALTY: Record<BulletRule, number> = {
  'weak-opener': 25,
  'no-metric': 15,
  'too-long': 15,
  'too-short': 10,
  'repeated-verb': 10,
  tense: 10,
  pronoun: 10,
  filler: 5,
  passive: 15,
  'no-verb': 10,
};

/** Bullet length limits. ~30 words ≈ two printed lines on a typical A4/Letter resume. */
export const MAX_WORDS = 30;
export const MAX_CHARS = 200;
export const MIN_WORDS = 6;

const WEAK_OPENERS: Array<[RegExp, string[]]> = [
  [/^(?:was |were )?responsible for\b/i, ['Led', 'Owned', 'Managed', 'Directed']],
  [/^(?:i )?worked (?:on|with|in)\b/i, ['Built', 'Developed', 'Delivered', 'Implemented']],
  [/^(?:i )?helped(?: to)?\b|^help(?:ing)?(?: to)?\b/i, ['Enabled', 'Contributed to', 'Drove', 'Supported (then name your part)']],
  [/^(?:i )?assisted(?: with| in)?\b|^assist(?:ing)?\b/i, ['Supported', 'Partnered with', 'Co-led', 'Contributed to']],
  [/^(?:was )?involved in\b/i, ['Contributed to', 'Drove', 'Executed']],
  [/^participated in\b/i, ['Contributed to', 'Collaborated on', 'Presented']],
  [/^(?:was )?tasked with\b/i, ['Delivered', 'Executed', 'Owned']],
  [/^duties included\b/i, ['Managed', 'Ran', 'Handled (then add the result)']],
  [/^(?:was )?in charge of\b/i, ['Led', 'Directed', 'Oversaw']],
  [/^(?:was )?part of\b/i, ['Collaborated with', 'Contributed to']],
  [/^handled\b/i, ['Managed', 'Resolved', 'Processed']],
  [/^did\b/i, ['Completed', 'Executed', 'Performed']],
  [/^(?:utili[sz]ed|used)\b/i, ['Applied', 'Leveraged', 'Built with']],
  [/^(?:tried|attempted) to\b/i, ['Delivered', 'Achieved']],
  [/^(?:had|have) (?:the )?(?:opportunity|chance) to\b/i, ['Led', 'Delivered', 'Built']],
  [/^(?:my|our) (?:role|job|duties|responsibilities)\b/i, ['Led', 'Owned', 'Managed']],
  [/^(?:worked|working) as\b/i, ['Served as', 'Led', 'Built']],
];

const METRIC = /\d|%|[$€£¥₹]|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred|hundreds|thousand|thousands|million|millions|billion|dozen|dozens|double[ds]?|doubling|tripled?|halved|half|twice|thrice)\b|\b\d+x\b|×/i;

const PRONOUN = /\b(?:I|me|my|mine|myself|we|our|ours|us)\b/;
const PRONOUN_CI = /\b(?:me|my|mine|myself|we|our|ours)\b/i;

const FILLERS = ['very', 'really', 'various', 'several', 'successfully', 'effectively', 'efficiently', 'extremely', 'basically', 'actually', 'just', 'quite', 'somewhat', 'totally', 'in order to', 'a number of', 'a lot of', 'lots of', 'etc', 'and so on', 'things', 'stuff', 'different', 'highly', 'utilize', 'utilized', 'utilizing', 'utilise', 'utilised', 'synergy', 'go-getter', 'hard-working', 'hardworking', 'results-driven', 'dynamic', 'detail-oriented'];
const FILLER_RE = new RegExp(`\\b(?:${FILLERS.map((f) => f.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')).join('|')})\\b`, 'gi');

const IRREGULAR_PARTICIPLES = 'built|done|made|led|run|won|written|given|taken|seen|known|shown|grown|driven|chosen|held|kept|sent|spent|set|cut|put|brought|bought|taught|thought|found|sold|told|paid|met|begun|become|drawn|undertaken|overseen|rewritten|broken|spoken|chosen|hidden|frozen|stolen|forgotten|gotten|got';
const PASSIVE = new RegExp(`\\b(?:was|were|is|are|been|being|be|got|gets|get)\\s+(?:\\w+ly\\s+)?(?:\\w{3,}ed|${IRREGULAR_PARTICIPLES})\\b(?!\\s+(?:to|in|on)\\b(?!\\s+by))`, 'i');
const PASSIVE_EXCEPTIONS = /\b(?:was|were|is|are|been)\s+(?:responsible|based|located|interested|involved|excited|focused|dedicated|skilled|experienced|qualified|tasked|promoted|awarded|selected|elected|named|nominated|invited|certified|recognized|recognised|hired|recruited|ranked)\b/i;

/** Irregular past forms commonly used as resume openers. */
const IRREGULAR_PAST = new Set('led built ran grew drove wrote made won began took set cut saw brought taught sold bought spoke held kept found became chose gave got oversaw undertook rewrote rebuilt redrew drew sped spent sent met paid told thought understood withdrew overcame put shut split spun struck stood upheld wove forecast broadcast'.split(' '));

/** Base forms → used to recognise present tense ("Lead", "Leads", "Leading"). */
const ACTION_VERBS = new Set(
  `accelerate achieve administer advise align analyze analyse architect assess audit automate boost build champion coach collaborate
  communicate compile conduct configure consolidate coordinate create cut debug decrease define deliver deploy design develop devise
  direct document drive earn eliminate enable engineer enhance establish evaluate execute expand facilitate forecast foster generate
  grow guide identify implement improve increase initiate innovate install integrate introduce launch lead maintain manage maximize
  mentor migrate minimize model modernize monitor negotiate optimize orchestrate organize overhaul own oversee partner pilot pioneer
  plan prepare present prioritize produce program prototype publish raise rebuild recruit redesign reduce refactor resolve restructure
  revamp run save scale secure ship simplify spearhead standardize streamline strengthen supervise support teach test train transform
  translate troubleshoot unify upgrade validate win write handle use utilize help assist serve contribute research recommend review
  oversee head translate`.split(/\s+/).filter(Boolean),
);

/** Openers that are clearly not verbs. */
const NON_VERB_OPENERS = new Set(['the', 'a', 'an', 'this', 'that', 'these', 'those', 'my', 'our', 'their', 'his', 'her', 'its', 'it', 'there', 'i', 'we', 'they', 'he', 'she', 'you', 'team', 'project', 'company', 'role', 'member', 'responsibilities', 'duties', 'experience', 'successful', 'various', 'several', 'multiple']);

export type Tense = 'past' | 'present' | 'unknown';

/** First word, lower-case, without punctuation. Leading adverbs ("Successfully led") are skipped. */
export function openingVerb(text: string): string {
  const ws = words(text.replace(/^[^A-Za-z0-9]+/, ''));
  let i = 0;
  while (i < ws.length - 1 && /ly$/.test(ws[i]!) && ws[i]!.length > 4) i++;
  return (ws[i] ?? '').replace(/[^a-z-]/g, '');
}

/** Very small morphology: past (-ed / irregular), present (base / -s / -ing), else unknown. */
export function tenseOf(word: string): Tense {
  const w = word.toLowerCase();
  if (!w) return 'unknown';
  if (IRREGULAR_PAST.has(w)) return 'past';
  if (ACTION_VERBS.has(w)) return 'present';
  if (/[^e]ed$|[a-z]{2}ied$|eed$|[^aeiou]ed$/.test(w) && w.length > 3) return 'past';
  if (/ed$/.test(w) && w.length > 4) return 'past';
  if (/ing$/.test(w) && w.length > 5) return 'present';
  if (/s$/.test(w) && !/ss$/.test(w) && (ACTION_VERBS.has(w.slice(0, -1)) || ACTION_VERBS.has(w.replace(/es$/, '')))) return 'present';
  if (/ies$/.test(w) && ACTION_VERBS.has(w.replace(/ies$/, 'y'))) return 'present';
  return 'unknown';
}

/** Base form for counting repeats ("Led", "Leading", "Leads" → "lead"). */
export function verbLemma(word: string): string {
  const w = word.toLowerCase();
  const irregular: Record<string, string> = { led: 'lead', built: 'build', ran: 'run', grew: 'grow', drove: 'drive', wrote: 'write', made: 'make', won: 'win', oversaw: 'oversee', took: 'take', set: 'set', cut: 'cut', taught: 'teach', sold: 'sell', spoke: 'speak', held: 'hold', kept: 'keep', found: 'find', became: 'become', gave: 'give', brought: 'bring', rebuilt: 'rebuild', rewrote: 'rewrite', undertook: 'undertake', spent: 'spend', sent: 'send', drew: 'draw', redrew: 'redraw' };
  if (irregular[w]) return irregular[w]!;
  if (ACTION_VERBS.has(w)) return w;
  const candidates = [
    w.replace(/ied$/, 'y'),
    w.replace(/ies$/, 'y'),
    w.replace(/ed$/, ''),
    w.replace(/ed$/, 'e'),
    w.replace(/d$/, ''),
    w.replace(/ing$/, ''),
    w.replace(/ing$/, 'e'),
    w.replace(/es$/, ''),
    w.replace(/s$/, ''),
    w.replace(/([bdglmnprt])\1ed$/, '$1'),
    w.replace(/([bdglmnprt])\1ing$/, '$1'),
  ];
  return candidates.find((c) => ACTION_VERBS.has(c)) ?? w.replace(/(?:ing|ed|es|s)$/, '');
}

function toPast(lemma: string): string {
  const irregular: Record<string, string> = { lead: 'Led', build: 'Built', run: 'Ran', grow: 'Grew', drive: 'Drove', write: 'Wrote', make: 'Made', win: 'Won', oversee: 'Oversaw', teach: 'Taught', cut: 'Cut', set: 'Set', rebuild: 'Rebuilt', spearhead: 'Spearheaded' };
  if (irregular[lemma]) return irregular[lemma]!;
  const past = lemma.endsWith('e') ? `${lemma}d` : /[^aeiou]y$/.test(lemma) ? `${lemma.slice(0, -1)}ied` : /^(?:ship|plan|scrap|stop)$/.test(lemma) ? `${lemma}${lemma.slice(-1)}ed` : `${lemma}ed`;
  return past[0]!.toUpperCase() + past.slice(1);
}

function toPresent(lemma: string): string {
  return lemma[0]!.toUpperCase() + lemma.slice(1);
}

/** Alternatives offered when an opening verb is overused. */
const VERB_ALTERNATIVES: Record<string, string[]> = {
  lead: ['Directed', 'Headed', 'Spearheaded', 'Guided'],
  build: ['Engineered', 'Developed', 'Implemented', 'Shipped'],
  develop: ['Built', 'Engineered', 'Designed', 'Created'],
  manage: ['Oversaw', 'Ran', 'Directed', 'Coordinated'],
  create: ['Designed', 'Launched', 'Produced', 'Established'],
  improve: ['Optimized', 'Streamlined', 'Strengthened', 'Upgraded'],
  implement: ['Rolled out', 'Deployed', 'Integrated', 'Introduced'],
  design: ['Architected', 'Prototyped', 'Modeled', 'Crafted'],
  work: ['Partnered', 'Collaborated', 'Delivered', 'Built'],
  increase: ['Grew', 'Boosted', 'Raised', 'Expanded'],
  reduce: ['Cut', 'Lowered', 'Decreased', 'Eliminated'],
  help: ['Enabled', 'Supported', 'Contributed to', 'Drove'],
  support: ['Enabled', 'Maintained', 'Assisted', 'Served'],
  use: ['Applied', 'Leveraged', 'Adopted'],
  collaborate: ['Partnered with', 'Worked with', 'Teamed with', 'Aligned with'],
};

export function alternativesFor(lemma: string): string[] {
  return VERB_ALTERNATIVES[lemma] ?? ['Delivered', 'Drove', 'Launched', 'Optimized'].filter((v) => v.toLowerCase() !== toPast(lemma).toLowerCase());
}

/** Rules that only need the bullet itself. */
export function checkBullet(text: string): BulletFinding[] {
  const t = text.trim();
  const out: BulletFinding[] = [];
  if (!t) return out;
  const n = words(t).length;

  for (const [re, verbs] of WEAK_OPENERS) {
    const m = re.exec(t);
    if (m) {
      out.push({ rule: 'weak-opener', level: 'warn', message: `Starts with “${m[0].trim()}”, which describes a duty rather than what you achieved. Open with a strong action verb.`, suggestions: verbs });
      break;
    }
  }

  if (!METRIC.test(t)) out.push({ rule: 'no-metric', level: 'info', message: 'No number or metric. Add scale or impact where you can (%, $, time saved, users, team size).' });

  if (n > MAX_WORDS || t.length > MAX_CHARS) out.push({ rule: 'too-long', level: 'warn', message: `${n} words (${t.length} characters) will likely print on more than two lines. Aim for ${MAX_WORDS} words or fewer, or split it into two bullets.` });
  else if (n < MIN_WORDS) out.push({ rule: 'too-short', level: 'info', message: `Only ${n} word${n === 1 ? '' : 's'}. Add what you did, how you did it and what changed as a result.` });

  if (PRONOUN.test(t) || PRONOUN_CI.test(t)) {
    const m = PRONOUN.exec(t) ?? PRONOUN_CI.exec(t);
    out.push({ rule: 'pronoun', level: 'info', message: `Uses “${m![0]}”. Resume bullets drop first-person pronouns, and “we” hides your own contribution.` });
  }

  const fillers = [...new Set((t.match(FILLER_RE) ?? []).map((f) => f.toLowerCase()))];
  if (fillers.length) out.push({ rule: 'filler', level: 'info', message: `Filler: ${fillers.map((f) => `“${f}”`).join(', ')}. Cut them or replace them with specifics.` });

  if (PASSIVE.test(t) && !PASSIVE_EXCEPTIONS.test(t)) {
    const m = PASSIVE.exec(t)!;
    out.push({ rule: 'passive', level: 'warn', message: `Passive voice (“${m[0]}”). Say who did it, e.g. “Built…” instead of “was built…”.` });
  }

  const first = openingVerb(t);
  if (!out.some((f) => f.rule === 'weak-opener') && NON_VERB_OPENERS.has(first)) out.push({ rule: 'no-verb', level: 'info', message: `Starts with “${first}”. Lead with an action verb so the reader sees what you did first.` });
  return out;
}

function scoreOf(findings: BulletFinding[]): number {
  return Math.max(0, 100 - findings.reduce((s, f) => s + PENALTY[f.rule], 0));
}

/** Check a set of bullets, including rules that need the whole set (repeats, tense). */
export function analyzeBullets(inputs: BulletInput[]): BulletSummary {
  const reports: BulletReport[] = inputs.map((b) => ({ id: b.id, text: b.text, groupId: b.groupId, words: words(b.text).length, findings: checkBullet(b.text), score: 100 }));

  // Repeated opening verbs: 3+ across the set, or 2+ within one entry.
  const lemmas = inputs.map((b) => {
    const v = openingVerb(b.text);
    return tenseOf(v) === 'unknown' ? '' : verbLemma(v);
  });
  const total = new Map<string, number>();
  const perGroup = new Map<string, number>();
  lemmas.forEach((l, i) => {
    if (!l) return;
    total.set(l, (total.get(l) ?? 0) + 1);
    const g = `${inputs[i]!.groupId ?? ''}|${l}`;
    perGroup.set(g, (perGroup.get(g) ?? 0) + 1);
  });
  const seen = new Map<string, number>();
  lemmas.forEach((l, i) => {
    if (!l) return;
    const nAll = total.get(l)!;
    const nGroup = inputs[i]!.groupId !== undefined ? perGroup.get(`${inputs[i]!.groupId}|${l}`)! : 0;
    const order = (seen.get(l) ?? 0) + 1;
    seen.set(l, order);
    // Keep the first use; flag the repeats.
    if (order > 1 && (nAll >= 3 || nGroup >= 2)) {
      const word = openingVerb(inputs[i]!.text);
      reports[i]!.findings.push({ rule: 'repeated-verb', level: 'info', message: `“${word[0]!.toUpperCase()}${word.slice(1)}” opens ${nGroup >= 2 && nAll < 3 ? `${nGroup} bullets in this entry` : `${nAll} bullets`}. Vary your verbs.`, suggestions: alternativesFor(l) });
    }
  });

  // Tense. Past roles → past tense. Current role / unknown → consistent with the majority of its group.
  const groups = new Map<string, number[]>();
  inputs.forEach((b, i) => {
    const key = b.groupId ?? '__all__';
    groups.set(key, [...(groups.get(key) ?? []), i]);
  });
  for (const idxs of groups.values()) {
    const tenses = idxs.map((i) => ({ i, tense: tenseOf(openingVerb(inputs[i]!.text)) })).filter((x) => x.tense !== 'unknown');
    const past = tenses.filter((x) => x.tense === 'past').length;
    const present = tenses.length - past;
    for (const { i, tense } of tenses) {
      const ctx = inputs[i]!.current;
      const lemma = verbLemma(openingVerb(inputs[i]!.text));
      if (ctx === false && tense === 'present') {
        reports[i]!.findings.push({ rule: 'tense', level: 'warn', message: 'This is a past role, so use past tense.', suggestions: [toPast(lemma)] });
      } else if (ctx !== false && past > 0 && present > 0) {
        const minority: Tense = ctx === true ? (present >= past ? 'past' : 'present') : past >= present ? 'present' : 'past';
        if (tense === minority)
          reports[i]!.findings.push({
            rule: 'tense',
            level: 'info',
            message: ctx === true ? `Mixed tenses in your current role (${present} present, ${past} past). Pick one tense and use it throughout.` : `Mixed tenses (${present} present, ${past} past). Use the same tense throughout.`,
            suggestions: [minority === 'past' ? toPresent(lemma) : toPast(lemma)],
          });
      }
    }
  }

  for (const r of reports) r.score = scoreOf(r.findings);
  const counts: BulletSummary['counts'] = {};
  for (const r of reports) for (const f of r.findings) counts[f.rule] = (counts[f.rule] ?? 0) + 1;
  const repeatedVerbs = [...total.entries()].filter(([, c]) => c >= 3).map(([verb, count]) => ({ verb, count })).sort((a, b) => b.count - a.count);
  const score = reports.length ? Math.round(reports.reduce((s, r) => s + r.score, 0) / reports.length) : 0;
  return { bullets: reports, score, counts, repeatedVerbs };
}

/* --------------------------- resume bullets --------------------------- */

export interface ResumeBullet extends BulletInput {
  sectionId: string;
  sectionTitle: string;
  /** Resolved item id (ItemRef / LocalEntry id). */
  itemId: string;
  itemLabel: string;
}

/** Every printed bullet of a resolved resume, with role context for the tense rule. */
export function resumeBullets(resolved: Pick<ResolvedResume, 'sections'>): ResumeBullet[] {
  const out: ResumeBullet[] = [];
  for (const s of resolved.sections)
    for (const it of s.items)
      it.bullets.forEach((b, i) => {
        if (!b.trim()) return;
        const isRole = s.kind === 'experience' || s.kind === 'volunteer';
        out.push({
          id: `${it.id}:${i}`,
          text: b.trim(),
          groupId: it.id,
          ...(isRole ? { current: it.current || /present|current|now/i.test(it.date) } : {}),
          sectionId: s.id,
          sectionTitle: s.title,
          itemId: it.id,
          itemLabel: [it.title, it.subtitle].filter((x) => x.trim()).join(' · ') || 'Untitled entry',
        });
      });
  return out;
}
