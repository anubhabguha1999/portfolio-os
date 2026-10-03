/**
 * Job description ⇄ resume match. Deterministic and explainable:
 *
 *   score = Σ weight(matched keywords) / Σ weight(all keywords) × 100
 *   weight = kind points (hard 3 · tool 2 · soft 1 · other 1)
 *          × where it appears (requirements 1.5 · general 1 · nice-to-have 0.6)
 *          × repetition (+20 % per extra mention, max +60 %)
 *          × 1.3 when the term is in the job title
 *
 * A keyword counts as matched when it appears anywhere the resume prints it (headline, summary,
 * entries, bullets, tags, skills). Synonyms resolve to one canonical name first ("k8s" = Kubernetes).
 */
import type { ResolvedResume } from '@/studio/model/resolve';
import type { Library, Profile } from '@/studio/model/types';
import { corpusHas, corpusOf, extractJobKeywords, KIND_WEIGHT, ZONE_WEIGHT, type Corpus, type JdKeyword } from './keywords';
import type { KeywordKind } from './dictionary';
import { STOPWORDS, tokenize } from './text';

/* ------------------------------ corpora ------------------------------ */

/** Everything a resolved resume prints, as a searchable corpus. */
export function resumeCorpus(r: ResolvedResume): Corpus {
  const texts: string[] = [r.headline];
  const terms: string[] = [];
  for (const s of r.sections) {
    texts.push(s.text);
    for (const it of s.items) {
      texts.push(it.title, it.subtitle, it.description, ...it.bullets);
      terms.push(...it.tags);
    }
    for (const g of s.skills) terms.push(...g.names, g.category);
  }
  return corpusOf(texts.filter(Boolean), terms.filter(Boolean));
}

export interface LibrarySource {
  /** Human label, e.g. "Experience · Frontend Engineer at Acme". */
  label: string;
  kind: 'profile' | 'experience' | 'project' | 'skill' | 'education' | 'certification' | 'achievement';
  corpus: Corpus;
}

/** Profile + library entries as separate searchable sources (to say *where* a keyword lives). */
export function librarySources(library: Library, profile?: Profile): LibrarySource[] {
  const out: LibrarySource[] = [];
  if (profile && (profile.headline.trim() || profile.bio.trim())) out.push({ label: 'Profile headline & bio', kind: 'profile', corpus: corpusOf([profile.headline, profile.bio]) });
  for (const e of library.experience) {
    const name = [e.role, e.company].filter((x) => x.trim()).join(' at ') || 'Untitled role';
    out.push({ label: `Experience · ${name}`, kind: 'experience', corpus: corpusOf([e.role, e.description, ...e.achievements], e.technologies) });
  }
  for (const p of library.projects)
    out.push({ label: `Project · ${p.title || 'Untitled project'}`, kind: 'project', corpus: corpusOf([p.title, p.role, p.description, p.resumeSummary, ...p.resumeBullets, ...p.features], p.technologies) });
  for (const s of library.skills) if (s.name.trim()) out.push({ label: `Skill · ${s.name.trim()}`, kind: 'skill', corpus: corpusOf([], [s.name]) });
  for (const e of library.education) out.push({ label: `Education · ${[e.degree, e.field].filter((x) => x.trim()).join(', ') || e.institution || 'Untitled'}`, kind: 'education', corpus: corpusOf([e.degree, e.field, e.description]) });
  for (const c of library.certifications) out.push({ label: `Certification · ${c.name || 'Untitled'}`, kind: 'certification', corpus: corpusOf([c.name, c.issuer]) });
  for (const a of library.achievements) out.push({ label: `Achievement · ${a.title || 'Untitled'}`, kind: 'achievement', corpus: corpusOf([a.title, a.description]) });
  return out;
}

/* ------------------------------- title -------------------------------- */

export interface Seniority {
  level: number;
  label: string;
}

const SENIORITY: Array<[RegExp, Seniority]> = [
  [/\b(?:intern|internship|trainee|apprentice|working student)\b/i, { level: 0, label: 'Intern' }],
  [/\b(?:head of|director|vp|vice president|chief|cto|cio|cpo)\b/i, { level: 6, label: 'Director / Head' }],
  [/\b(?:principal|distinguished|fellow)\b/i, { level: 5, label: 'Principal' }],
  [/\b(?:staff|lead|tech lead|team lead)\b/i, { level: 4, label: 'Lead / Staff' }],
  [/\b(?:senior|sr\.?|iii)\b/i, { level: 3, label: 'Senior' }],
  [/\b(?:mid[- ]level|mid[- ]senior|intermediate|ii)\b/i, { level: 2, label: 'Mid-level' }],
  [/\b(?:junior|jr\.?|entry[- ]level|graduate|new grad|associate)\b/i, { level: 1, label: 'Junior / Entry' }],
];

export function seniorityOf(title: string): Seniority | null {
  for (const [re, s] of SENIORITY) if (re.test(title)) return s;
  return null;
}

/** Typical seniority for an amount of experience (years). */
export function seniorityForYears(years: number): Seniority {
  if (years < 2) return { level: 1, label: 'Junior / Entry' };
  if (years < 5) return { level: 2, label: 'Mid-level' };
  if (years < 8) return { level: 3, label: 'Senior' };
  return { level: 4, label: 'Lead / Staff' };
}

const TITLE_DROP = new Set(['senior', 'sr', 'junior', 'jr', 'lead', 'staff', 'principal', 'intern', 'internship', 'entry', 'level', 'mid', 'associate', 'graduate', 'ii', 'iii', 'iv', 'i', 'head', 'remote', 'hybrid', 'contract', 'full-time', 'part-time', 'm/f/d', 'f/m/d', 'w/m/d', 'h/f']);
const TITLE_SYNONYMS: Record<string, string> = {
  developer: 'engineer',
  develop: 'engineer',
  programmer: 'engineer',
  programm: 'engineer',
  dev: 'engineer',
  engin: 'engineer',
  engineer: 'engineer',
  swe: 'engineer',
  sde: 'engineer',
  'front-end': 'frontend',
  'back-end': 'backend',
  'full-stack': 'fullstack',
  fullstack: 'fullstack',
  'ui/ux': 'ux',
  'ux/ui': 'ux',
  ml: 'machine-learning',
  mgr: 'manag',
  'software engineer': 'engineer',
};

/** Core role words of a title ("Senior Front-End Developer" → frontend, engineer). */
export function titleCore(title: string): string[] {
  const toks = tokenize(title.replace(/\bfront\s+end\b/gi, 'frontend').replace(/\bback\s+end\b/gi, 'backend').replace(/\bfull\s+stack\b/gi, 'fullstack'));
  const out: string[] = [];
  for (const t of toks) {
    if (STOPWORDS.has(t.text) || TITLE_DROP.has(t.text) || t.text === '&' || t.text === 'and') continue;
    const k = TITLE_SYNONYMS[t.text] ?? TITLE_SYNONYMS[t.stem] ?? t.stem;
    if (!out.includes(k)) out.push(k);
  }
  return out;
}

const ROLE_NOUN = /\b(?:engineer|developer|programmer|manager|designer|analyst|scientist|specialist|consultant|architect|administrator|coordinator|intern|director|officer|writer|marketer|associate|executive|representative|lead|head|strategist|researcher|accountant|recruiter|editor|technician|assistant|advisor|owner|producer|planner|tester|sre|devops)s?\b/i;

/** First short line that reads like a job title, else ''. */
export function guessJobTitle(jd: string): string {
  for (const raw of jd.split(/\r?\n/).slice(0, 6)) {
    const line = raw
      .replace(/^[\s#*_>•·-]+|[\s*_]+$/g, '')
      .replace(/^(?:job\s+)?(?:title|role|position)\s*[:：-]\s*/i, '')
      .trim();
    if (!line || line.split(/\s+/).length > 10) continue;
    if (ROLE_NOUN.test(line)) return line.replace(/\s*[-–|@(].*$/, '').trim() || line;
  }
  return '';
}

export interface TitleAlignment {
  jobTitle: string;
  /** The resume title that matched best. */
  best: { text: string; source: string } | null;
  /** 0–100 share of the job title's core words found in the best resume title. */
  score: number;
  matched: string[];
  missing: string[];
  jobSeniority: Seniority | null;
  resumeSeniority: Seniority | null;
}

export function titleAlignment(jobTitle: string, candidates: Array<{ text: string; source: string }>): TitleAlignment {
  const core = titleCore(jobTitle);
  let best: TitleAlignment['best'] = null;
  let bestMatched: string[] = [];
  for (const c of candidates) {
    if (!c.text.trim()) continue;
    const have = new Set(titleCore(c.text));
    const m = core.filter((w) => have.has(w));
    if (!best || m.length > bestMatched.length) {
      best = c;
      bestMatched = m;
    }
  }
  const first = candidates.find((c) => c.text.trim());
  return {
    jobTitle,
    best: best ?? null,
    score: core.length ? Math.round((bestMatched.length / core.length) * 100) : 0,
    matched: bestMatched,
    missing: core.filter((w) => !bestMatched.includes(w)),
    jobSeniority: seniorityOf(jobTitle),
    resumeSeniority: first ? seniorityOf(first.text) : null,
  };
}

/* ------------------------------- years -------------------------------- */

export interface YearsRequirement {
  min: number;
  max: number | null;
  /** The phrase the number came from, e.g. "5+ years of experience with React". */
  text: string;
}

const NUM_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15 };

export function yearsRequirements(jd: string): YearsRequirement[] {
  const re = /\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen)\s*(?:\+|plus)?\s*(?:(?:-|–|to)\s*(\d{1,2}))?\s*\+?\s*(?:years?|yrs?)\b(?:'s)?([^.\n;]{0,70})/gi;
  const out: YearsRequirement[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(jd))) {
    const tail = m[3] ?? '';
    // Only experience requirements ("5 years of experience", "3+ yrs in React"), not "founded 10 years ago".
    if (/\b(?:ago|old|history|anniversary|warranty|founded)\b/i.test(tail)) continue;
    const before = jd.slice(Math.max(0, m.index - 25), m.index);
    if (!/\b(?:experience|exp\b|in |with |of |working|building|professional|industry|hands-on|background)/i.test(tail) && !/\b(?:least|minimum|min\.?)\s*$/i.test(before)) continue;
    const a = NUM_WORDS[m[1]!.toLowerCase()] ?? Number(m[1]);
    const b = m[2] ? Number(m[2]) : null;
    if (!a || a > 30) continue;
    out.push({ min: a, max: b, text: (m[0] ?? '').replace(/\s+/g, ' ').trim().replace(/[,:]$/, '') });
  }
  return out;
}

function ymOf(v: string): number | null {
  const m = /^(\d{4})(?:-(\d{1,2}))?/.exec(v.trim());
  return m ? Number(m[1]) * 12 + (m[2] ? Number(m[2]) - 1 : 0) : null;
}

/** Months of dated experience in the printed resume (overlaps merged). */
export function experienceMonths(r: ResolvedResume, now = new Date()): { months: number; undated: number } {
  const nowYm = now.getFullYear() * 12 + now.getMonth();
  const ranges: Array<[number, number]> = [];
  let undated = 0;
  for (const s of r.sections)
    if (s.kind === 'experience')
      for (const it of s.items) {
        const a = ymOf(it.start);
        const b = it.current ? nowYm : ymOf(it.end);
        if (a === null || b === null || b < a) {
          undated++;
          continue;
        }
        ranges.push([a, Math.min(b, nowYm) + 1]);
      }
  ranges.sort((x, y) => x[0] - y[0]);
  let months = 0;
  let curA = -1;
  let curB = -1;
  for (const [a, b] of ranges) {
    if (a > curB) {
      if (curB > curA) months += curB - curA;
      curA = a;
      curB = b;
    } else curB = Math.max(curB, b);
  }
  if (curB > curA) months += curB - curA;
  return { months, undated };
}

/* ------------------------------- degree ------------------------------- */

const DEGREES: Array<[RegExp, string]> = [
  [/\b(?:ph\.?\s?d|doctorate|doctoral)\b/i, 'PhD'],
  [/\b(?:master'?s?|m\.?\s?sc?|msc|m\.?\s?tech|mba|m\.?\s?eng)\b/i, "Master's"],
  [/\b(?:bachelor'?s?|b\.?\s?sc?|bsc|b\.?\s?tech|b\.?\s?e\.?|b\.?\s?eng|undergraduate degree|ba\b|bs\b)\b/i, "Bachelor's"],
];

export function degreeMentions(text: string): string[] {
  return DEGREES.filter(([re]) => re.test(text)).map(([, d]) => d);
}

/* ------------------------------- result ------------------------------- */

export interface KeywordResult extends JdKeyword {
  matched: boolean;
  /** Library/profile places this missing keyword already exists. */
  inLibrary: string[];
}

export interface GroupSummary {
  kind: KeywordKind;
  matched: number;
  total: number;
  weightMatched: number;
  weightTotal: number;
}

export interface Suggestion {
  level: 'high' | 'medium' | 'low';
  text: string;
}

export interface JobMatchResult {
  score: number;
  keywords: KeywordResult[];
  groups: GroupSummary[];
  title: TitleAlignment | null;
  years: { required: YearsRequirement | null; all: YearsRequirement[]; resumeMonths: number; undated: number };
  degree: { required: string[]; resume: string[] };
  suggestions: Suggestion[];
  /** Plain-language explanation of the score with this posting's numbers. */
  explanation: string;
}

export interface JobMatchInput {
  jd: string;
  title?: string;
  company?: string;
  resolved: ResolvedResume;
  library?: Library;
  profile?: Profile;
  now?: Date;
}

export const KIND_LABEL: Record<KeywordKind, string> = { hard: 'Hard skills', tool: 'Tools & technologies', soft: 'Soft skills', other: 'Other keywords' };

export function analyzeJobMatch(input: JobMatchInput): JobMatchResult {
  const jobTitle = (input.title ?? '').trim() || guessJobTitle(input.jd);
  const extracted = extractJobKeywords(input.jd, { title: jobTitle, company: input.company });
  const corpus = resumeCorpus(input.resolved);
  const sources = input.library ? librarySources(input.library, input.profile) : [];

  const keywords: KeywordResult[] = extracted.map((k) => {
    const matched = corpusHas(corpus, k);
    return { ...k, matched, inLibrary: matched ? [] : sources.filter((s) => corpusHas(s.corpus, k)).map((s) => s.label) };
  });

  const groups: GroupSummary[] = (['hard', 'tool', 'soft', 'other'] as const).map((kind) => {
    const ks = keywords.filter((k) => k.kind === kind);
    return {
      kind,
      matched: ks.filter((k) => k.matched).length,
      total: ks.length,
      weightMatched: round(ks.filter((k) => k.matched).reduce((s, k) => s + k.weight, 0)),
      weightTotal: round(ks.reduce((s, k) => s + k.weight, 0)),
    };
  });
  const wTotal = groups.reduce((s, g) => s + g.weightTotal, 0);
  const wMatched = groups.reduce((s, g) => s + g.weightMatched, 0);
  const score = wTotal > 0 ? Math.round((wMatched / wTotal) * 100) : 0;

  // Title.
  const r = input.resolved;
  const expTitles = r.sections.filter((s) => s.kind === 'experience').flatMap((s) => s.items.slice(0, 3).map((it) => ({ text: it.title, source: `Experience · ${[it.title, it.subtitle].filter(Boolean).join(' at ')}` })));
  const title = jobTitle ? titleAlignment(jobTitle, [{ text: r.headline, source: 'Headline' }, ...expTitles]) : null;

  // Years & degree.
  const allYears = yearsRequirements(input.jd);
  const required = allYears.length ? allYears.reduce((a, b) => (b.min > a.min ? b : a)) : null;
  const { months, undated } = experienceMonths(r, input.now);
  const eduText = r.sections
    .filter((s) => s.kind === 'education')
    .flatMap((s) => s.items.map((i) => `${i.title} ${i.description}`))
    .join(' ');
  const degree = { required: degreeMentions(input.jd), resume: degreeMentions(eduText) };

  const suggestions = buildSuggestions({ keywords, score, title, required, months, undated, degree, resolved: r });
  const explanation = wTotal
    ? `${keywords.filter((k) => k.matched).length} of ${keywords.length} keywords found, worth ${round(wMatched)} of ${round(wTotal)} weighted points → ${score}%. Hard skills count ${KIND_WEIGHT.hard}×, tools ${KIND_WEIGHT.tool}×, soft skills and other keywords 1×; terms under requirements count ${ZONE_WEIGHT.required}×, nice-to-haves ${ZONE_WEIGHT.preferred}×; repeated terms and words in the job title weigh a little more.`
    : 'No recognisable skills or repeated keywords were found in the posting yet.';

  return { score, keywords, groups, title, years: { required, all: allYears, resumeMonths: months, undated }, degree, suggestions, explanation };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function quoteList(items: string[], max = 4): string {
  const shown = items.slice(0, max).map((s) => `“${s}”`);
  const more = items.length - shown.length;
  return shown.join(', ') + (more > 0 ? ` and ${more} more` : '');
}

function buildSuggestions(x: {
  keywords: KeywordResult[];
  score: number;
  title: TitleAlignment | null;
  required: YearsRequirement | null;
  months: number;
  undated: number;
  degree: { required: string[]; resume: string[] };
  resolved: ResolvedResume;
}): Suggestion[] {
  const out: Suggestion[] = [];
  const missing = x.keywords.filter((k) => !k.matched);
  const fromLib = missing.filter((k) => k.inLibrary.length && k.kind !== 'other');
  for (const k of fromLib.slice(0, 5))
    out.push({ level: k.zone === 'required' ? 'high' : 'medium', text: `“${k.label}” is in your ${k.inLibrary[0]!.split(' · ')[0]!.toLowerCase()} (${k.inLibrary[0]!.split(' · ').slice(1).join(' · ') || k.inLibrary[0]}) but not printed in this resume. Include that entry, bullet or skill if it's relevant.` });

  const reqHard = missing.filter((k) => !k.inLibrary.length && (k.kind === 'hard' || k.kind === 'tool') && k.zone === 'required');
  if (reqHard.length)
    out.push({ level: 'high', text: `The posting requires ${quoteList(reqHard.map((k) => k.label))}, which don't appear anywhere in your profile. If you have real experience with them, add them to your skills and back them up with a bullet. If you don't, leave them out and address the gap in your cover letter.` });

  const otherHard = missing.filter((k) => !k.inLibrary.length && (k.kind === 'hard' || k.kind === 'tool') && k.zone !== 'required');
  if (otherHard.length) out.push({ level: 'medium', text: `Also mentioned: ${quoteList(otherHard.map((k) => k.label))}. Add only the ones you have actually used.` });

  const soft = missing.filter((k) => k.kind === 'soft');
  if (soft.length) out.push({ level: 'low', text: `Show ${quoteList(soft.map((k) => k.label.toLowerCase()), 3)} through outcomes in your bullets (e.g. “Mentored 3 engineers…”). Listing soft skills on their own carries little weight.` });

  const other = missing.filter((k) => k.kind === 'other' && k.count >= 2);
  if (other.length) out.push({ level: 'low', text: `The posting repeats ${quoteList(other.map((k) => k.label), 3)}. Where it's true, use the same wording in your summary or bullets, since ATS filters match exact phrases.` });

  if (x.title && x.title.jobTitle && x.title.score < 60) {
    const where = x.title.best?.text ? `Your closest title is “${x.title.best.text}”` : 'This resume has no headline';
    out.push({ level: 'medium', text: `${where}, and the posting is for “${x.title.jobTitle}”. If it honestly describes you, set this resume's headline to match the posting's wording. Headlines can differ per resume.` });
  }
  if (x.title?.jobSeniority && x.title.resumeSeniority && Math.abs(x.title.jobSeniority.level - x.title.resumeSeniority.level) >= 2)
    out.push({ level: 'low', text: `Seniority differs: the posting reads as ${x.title.jobSeniority.label.toLowerCase()}, your latest title as ${x.title.resumeSeniority.label.toLowerCase()}. Make the scope of your work (team size, ownership, impact) clear in your bullets.` });

  if (x.required) {
    const years = x.months / 12;
    if (x.months === 0 && x.undated) out.push({ level: 'medium', text: `The posting asks for ${x.required.text}. Your experience entries have no dates, so a reader can't tell how long you've worked. Add start and end dates.` });
    else if (years + 0.25 < x.required.min) out.push({ level: 'medium', text: `The posting asks for ${x.required.min}+ years, and your dated experience adds up to about ${years.toFixed(1)}. Check that every relevant role (internships, freelance, open source) is listed with dates.` });
  }
  if (x.degree.required.length && !x.degree.resume.length && !x.resolved.sections.some((s) => s.kind === 'education'))
    out.push({ level: 'low', text: `The posting mentions a ${x.degree.required[x.degree.required.length - 1]} degree, and this resume has no Education section.` });

  const hasSkills = x.resolved.sections.some((s) => s.kind === 'skills' || s.kind === 'technical-skills');
  if (!hasSkills && x.keywords.some((k) => k.kind === 'tool' || k.kind === 'hard'))
    out.push({ level: 'medium', text: "This resume has no Skills section. ATS parsers look for one, and it's the natural place for the tools you match." });

  if (x.score >= 75) out.push({ level: 'low', text: 'Keyword coverage is strong. Next, make the matching bullets concrete with numbers and outcomes (see the bullet helper).' });
  if (!out.length) out.push({ level: 'low', text: 'No obvious gaps. Proofread, then tailor your summary to the role.' });
  const rank = { high: 0, medium: 1, low: 2 } as const;
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}
