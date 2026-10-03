/**
 * Deterministic interview-question generator (no AI). Builds likely questions from a
 * resolved resume (experience bullets, metrics, technologies, projects, skills), a
 * curated skill bank, a general behavioural bank and — when given — the target
 * application's company, role and job description.
 */
import type { ResolvedResume } from '@/studio/model/resolve';

export type QuestionCategory = 'experience' | 'project' | 'skill' | 'general' | 'company';

export const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  experience: 'Experience',
  project: 'Projects',
  skill: 'Technical',
  general: 'General',
  company: 'This role',
};

export interface InterviewQuestion {
  /** Stable across sessions as long as the source content is unchanged. */
  id: string;
  category: QuestionCategory;
  text: string;
  /** What a strong answer should cover. */
  hint: string;
  /** Where the question came from, e.g. "Senior Engineer · Northwind". */
  source: string;
  tags: string[];
}

export interface QuestionContext {
  company?: string;
  role?: string;
  jobDescription?: string;
}

/* ------------------------------ helpers ------------------------------ */

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const stripEnd = (s: string) => clean(s).replace(/[.;:!\s]+$/, '');
const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0]!.toLowerCase() + s.slice(1) : s);

const METRIC_RE = /(?:[$€£₹]\s?\d[\d,.]*\s?[kmb]?\b|\d[\d,.]*\s?(?:%|x\b|×|k\b|m\b|ms\b|s\b|h\b|hours?\b|days?\b|weeks?\b|months?\b|users?\b|customers?\b|clients?\b|engineers?\b|teams?\b|people\b|events?\b|requests?\b)|\b\d{2,}[\d,.]*\+?)/gi;

/** Numbers/percentages/money mentioned in a bullet (deduplicated, in order). */
export function extractMetrics(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(METRIC_RE)) {
    const v = m[0].trim();
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

const IRREGULAR = new Set(
  'built led ran made wrote drove grew cut set won took gave began brought bought kept met sold spent taught thought understood upheld rebuilt rewrote overhauled oversaw undertook mentored shipped owned own'.split(' '),
);

/** True when a bullet starts with a past-tense action verb ("Designed…", "Led…"). */
export function startsWithActionVerb(text: string): boolean {
  const w = clean(text).split(' ')[0]?.toLowerCase().replace(/[^a-z-]/g, '') ?? '';
  return w.length > 2 && (/ed$/.test(w) || IRREGULAR.has(w));
}

function q(category: QuestionCategory, text: string, hint: string, source: string, tags: string[] = []): InterviewQuestion {
  return { id: `${category}:${hash(`${category}|${text}`)}`, category, text, hint, source, tags };
}

const STAR_HINT = 'Set the scene (Situation), your responsibility (Task), the specific steps you took (Action) and the measurable outcome (Result).';

function metricHint(metrics: string[]): string {
  return metrics.length ? `Explain how you measured ${metrics.slice(0, 2).join(' and ')} — baseline, method and why it mattered. ${STAR_HINT}` : STAR_HINT;
}

function bulletQuestion(category: QuestionCategory, bullet: string, where: string, source: string, tags: string[]): InterviewQuestion {
  const b = stripEnd(bullet);
  const metrics = extractMetrics(b);
  const text = startsWithActionVerb(b) ? `Tell me about a time you ${lowerFirst(b)}${where ? ` at ${where}` : ''}.` : `${where ? `At ${where}` : 'On your resume'} you mention: “${b}.” Walk me through it — what was your part?`;
  return q(category, text, metricHint(metrics), source, [...metrics, ...tags.slice(0, 3)]);
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/* ------------------------------ skill bank ------------------------------ */

/** Curated technical questions per skill (lower-case name) — two to three each. */
export const SKILL_BANK: Record<string, string[]> = {
  typescript: ['How do you model data that can be in several states in TypeScript (e.g. loading/success/error)?', 'When would you reach for generics, and when do they hurt readability?', 'What is the difference between `unknown` and `any`, and how do you narrow `unknown` safely?'],
  javascript: ['Explain the event loop — how are microtasks and macrotasks scheduled?', 'How do closures work, and where have they caused a bug for you?', 'What changed for you when moving from callbacks to promises and async/await?'],
  react: ['How do you decide where state should live in a React app?', 'What causes unnecessary re-renders and how do you find and fix them?', 'How do effects differ from event handlers, and when is an effect the wrong tool?'],
  'next.js': ['How do you choose between static generation, server rendering and client rendering in Next.js?', 'How do you handle caching and revalidation of data in a Next.js app?'],
  vue: ['How does Vue’s reactivity system track dependencies?', 'When would you use a composable versus a store?'],
  angular: ['How does Angular change detection work, and when would you use OnPush?', 'How do you structure RxJS streams to avoid leaks?'],
  'node.js': ['How does Node handle concurrency with a single thread, and when would you use worker threads?', 'How do you deal with back-pressure when streaming data in Node?', 'How do you structure error handling in an Express/Node service?'],
  python: ['How do generators help with memory when processing large datasets?', 'How do you manage dependencies and environments for a Python project?', 'What does the GIL mean for concurrency in Python?'],
  go: ['How do you use goroutines and channels without leaking goroutines?', 'How do you design error handling in Go services?', 'When would you use a mutex rather than a channel?'],
  java: ['How does garbage collection affect latency, and how have you tuned it?', 'How do you design thread-safe classes in Java?'],
  'c#': ['How does async/await work in .NET, and what is a common deadlock pitfall?', 'How do you structure dependency injection in a .NET application?'],
  rust: ['Explain ownership and borrowing with an example from your own code.', 'When have you used `Arc<Mutex<T>>`, and what were the alternatives?'],
  sql: ['How do you find and fix a slow query?', 'Explain the difference between the isolation levels and a bug each one prevents.', 'When would you denormalise a schema?'],
  postgresql: ['How do you choose between B-tree, GIN and BRIN indexes in PostgreSQL?', 'How do you run a schema migration on a large table without downtime?'],
  mysql: ['How do you diagnose lock contention in MySQL?', 'How would you set up replication and handle replica lag?'],
  mongodb: ['How do you design a document schema for a one-to-many relationship in MongoDB?', 'When would you use transactions in MongoDB?'],
  redis: ['What would you cache in Redis, and how do you handle invalidation?', 'How would you implement rate limiting with Redis?'],
  graphql: ['How do you avoid the N+1 problem in a GraphQL server?', 'How do you version or evolve a GraphQL schema?'],
  kafka: ['How do partitions and consumer groups affect ordering and throughput in Kafka?', 'How do you get exactly-once (or effectively-once) processing?'],
  aws: ['Walk me through how you would design a highly available service on AWS.', 'How do you control and monitor cloud costs?', 'How do you manage IAM permissions with least privilege?'],
  gcp: ['How would you design a scalable service on Google Cloud?', 'How do you manage service accounts and permissions?'],
  azure: ['How would you design a resilient service on Azure?', 'How do you manage secrets and identities in Azure?'],
  docker: ['How do you keep Docker images small and secure?', 'What is the difference between a container and a VM?'],
  kubernetes: ['How do readiness and liveness probes differ, and what happens if you get them wrong?', 'How do you roll out a change safely on Kubernetes?'],
  terraform: ['How do you structure Terraform modules and state for several environments?', 'How do you handle drift between Terraform state and reality?'],
  'ci/cd': ['What does a good CI/CD pipeline look like to you?', 'How do you make deployments safe to roll back?'],
  git: ['How do you keep a long-running branch in sync, and when do you rebase versus merge?', 'Describe your ideal code-review process.'],
  accessibility: ['How do you make a custom component (e.g. a dropdown) accessible?', 'How do you test accessibility beyond automated tools?'],
  css: ['How do you organise CSS in a large codebase to avoid conflicts?', 'When do you use grid versus flexbox?'],
  'html': ['Why does semantic HTML matter, and where have you seen it make a difference?'],
  testing: ['How do you decide what to unit test versus integration test?', 'How do you deal with flaky tests?'],
  'machine learning': ['How do you detect and handle overfitting?', 'How do you choose an evaluation metric for an imbalanced dataset?'],
  'data analysis': ['Walk me through how you would investigate a sudden drop in a key metric.', 'How do you communicate uncertainty in your findings?'],
  figma: ['How do you hand off designs so engineers can build them accurately?', 'How do you structure components and variants in a design system?'],
  'product management': ['How do you prioritise a backlog with competing stakeholder requests?', 'How do you decide whether a feature was successful?'],
  agile: ['What makes a sprint retrospective useful rather than ritual?', 'How do you handle scope changes mid-sprint?'],
};

/** Questions by skill category when a skill is not in the bank. */
const CATEGORY_BANK: Array<{ match: RegExp; questions: Array<(skill: string) => string> }> = [
  { match: /lang/i, questions: [(s) => `What do you like and dislike about ${s} compared with other languages you use?`, (s) => `How do you keep ${s} code readable and well-tested in a growing codebase?`] },
  { match: /front|ui|web/i, questions: [(s) => `How have you used ${s} to improve performance or user experience?`, (s) => `How do you test UI built with ${s}?`] },
  { match: /back|server|api/i, questions: [(s) => `How do you design and version APIs built with ${s}?`, (s) => `How have you scaled or debugged a service that uses ${s}?`] },
  { match: /cloud|devops|infra|ops/i, questions: [(s) => `How have you used ${s} to make deployments safer or faster?`, (s) => `What would you monitor in a system that depends on ${s}?`] },
  { match: /data|ml|ai|analytics/i, questions: [(s) => `Walk me through a project where you used ${s} end to end.`, (s) => `How do you validate results produced with ${s}?`] },
  { match: /design/i, questions: [(s) => `How does ${s} fit into your design process?`, (s) => `Show me a decision you made with ${s} that changed the outcome for users.`] },
  { match: /lead|manage|soft|people/i, questions: [(s) => `Give me an example of ${s.toLowerCase()} making a measurable difference.`] },
];

const GENERIC_SKILL = [(s: string) => `How have you used ${s} in a real project, and what limitation did you run into?`, (s: string) => `How would you explain ${s} to a new teammate, and what pitfalls would you warn them about?`];

export function skillQuestions(name: string, category: string, max = 2): string[] {
  const key = name.trim().toLowerCase();
  const bank = SKILL_BANK[key] ?? SKILL_BANK[key.replace(/\.js$/, '')] ?? SKILL_BANK[`${key}.js`];
  if (bank) return bank.slice(0, max);
  const cat = CATEGORY_BANK.find((c) => c.match.test(category));
  return (cat?.questions ?? GENERIC_SKILL).slice(0, max).map((f) => f(name.trim()));
}

/* ------------------------------ general bank ------------------------------ */

export const GENERAL_BANK: Array<{ text: string; hint: string; tag: string }> = [
  { tag: 'intro', text: 'Tell me about yourself.', hint: 'Two minutes: present (current role and strongest result), past (how you got here), future (why this kind of role next).' },
  { tag: 'motivation', text: 'What motivates you in your work?', hint: 'Be specific and back it with an example where that motivation showed up.' },
  { tag: 'motivation', text: 'Why are you looking for a new role right now?', hint: 'Stay positive and forward-looking — what you are moving towards, not away from.' },
  { tag: 'weakness', text: 'What is your greatest weakness?', hint: 'A real, non-critical weakness, the concrete steps you are taking, and evidence it is improving.' },
  { tag: 'strength', text: 'What is your greatest strength, and how has it helped a team?', hint: 'Pick one strength and prove it with a result.' },
  { tag: 'conflict', text: 'Tell me about a time you disagreed with a colleague or manager. How did you resolve it?', hint: STAR_HINT + ' Show you listened, used data and kept the relationship intact.' },
  { tag: 'leadership', text: 'Tell me about a time you led a team or initiative without formal authority.', hint: STAR_HINT + ' Focus on how you got buy-in.' },
  { tag: 'failure', text: 'Tell me about a time you failed. What did you learn?', hint: STAR_HINT + ' Own it, and spend most of the time on what changed afterwards.' },
  { tag: 'feedback', text: 'Describe a time you received difficult feedback. What did you do with it?', hint: STAR_HINT },
  { tag: 'pressure', text: 'Tell me about a time you had to deliver under a tight deadline.', hint: STAR_HINT + ' Mention trade-offs and how you communicated them.' },
  { tag: 'prioritisation', text: 'How do you prioritise when everything seems urgent?', hint: 'Describe your framework, then give a real example.' },
  { tag: 'ambiguity', text: 'Tell me about a time you had to work with unclear requirements.', hint: STAR_HINT },
  { tag: 'goals', text: 'Where do you see yourself in three to five years?', hint: 'Connect your growth to what this role offers.' },
  { tag: 'questions', text: 'Do you have any questions for us?', hint: 'Prepare three: about the team’s challenges, how success is measured, and what the first 90 days look like.' },
];

/* ------------------------------ generator ------------------------------ */

/** Words from `text` that match any of `terms` (case-insensitive, whole words). */
export function mentionedTerms(text: string, terms: string[]): string[] {
  const hay = ` ${text.toLowerCase()} `;
  const out: string[] = [];
  for (const t of terms) {
    const term = t.trim();
    if (!term) continue;
    const esc = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, 'i').test(hay) && !out.some((o) => o.toLowerCase() === term.toLowerCase())) out.push(term);
  }
  return out;
}

export interface GenerateOptions {
  /** Max bullet-based questions per experience/project entry. */
  bulletsPerItem?: number;
  /** Max questions per skill. */
  perSkill?: number;
  /** Max skills to cover. */
  maxSkills?: number;
}

export function generateQuestions(resume: ResolvedResume, ctx: QuestionContext = {}, opts: GenerateOptions = {}): InterviewQuestion[] {
  const bulletsPerItem = opts.bulletsPerItem ?? 3;
  const perSkill = opts.perSkill ?? 2;
  const maxSkills = opts.maxSkills ?? 12;
  const out: InterviewQuestion[] = [];
  const seen = new Set<string>();
  const push = (x: InterviewQuestion) => {
    if (seen.has(x.id)) return;
    seen.add(x.id);
    out.push(x);
  };

  const company = ctx.company?.trim() ?? '';
  const role = ctx.role?.trim() ?? '';
  const jd = ctx.jobDescription?.trim() ?? '';

  // Role/company first: most relevant when preparing for a specific application.
  if (company || role) {
    const target = company || 'this company';
    push(q('company', `Why do you want to work at ${target}?`, 'Show you researched them: product, customers, recent news, values — and connect it to your own goals.', company || 'Application', ['why us']));
    if (role) push(q('company', `Why are you a good fit for the ${role} role?`, 'Pick the three requirements that matter most and match each to evidence from your experience.', company || role, ['fit']));
    push(q('company', `What do you know about ${target} and its competitors?`, 'Product, market, business model, and one thoughtful observation or question.', company || role, ['research']));
    if (role) push(q('company', `What would you aim to achieve in your first 90 days as ${role}?`, 'Learn (people, systems), quick wins, then one bigger contribution — tied to what the job description emphasises.', company || role, ['90 days']));
  }

  const skillNames = resume.sections.flatMap((s) => s.skills.flatMap((g) => g.names));
  const allTags = [...new Set([...skillNames, ...resume.sections.flatMap((s) => s.items.flatMap((i) => i.tags))])];
  if (jd) {
    const yours = mentionedTerms(jd, allTags);
    for (const term of yours.slice(0, 6)) push(q('company', `This role calls for ${term}. Tell me about the most complex thing you have built or done with it.`, `${STAR_HINT} Pick an example that matches the scale of this role.`, 'Job description', [term]));
    const bankOnly = mentionedTerms(
      jd,
      Object.keys(SKILL_BANK).filter((k) => !allTags.some((t) => t.toLowerCase() === k)),
    );
    for (const term of bankOnly.slice(0, 3))
      push(q('company', `The job description mentions ${term}, which isn’t on your resume. How would you get up to speed?`, 'Be honest about your level, name adjacent experience, and give a concrete learning plan.', 'Job description', [term]));
  }

  for (const section of resume.sections) {
    if (section.kind === 'experience') {
      for (const item of section.items) {
        const org = item.subtitle.trim();
        const title = item.title.trim();
        const src = [title, org].filter(Boolean).join(' · ') || 'Experience';
                for (const b of item.bullets.filter((x) => x.trim()).slice(0, bulletsPerItem)) push(bulletQuestion('experience', b, org, src, item.tags));
        if (!item.bullets.length && item.description.trim()) push(bulletQuestion('experience', item.description, org, src, item.tags));
        if (title || org) push(q('experience', `What was the hardest decision you made${title ? ` as ${title}` : ''}${org ? ` at ${org}` : ''}, and how did it play out?`, STAR_HINT, src));
        const tech = item.tags.filter((t) => t.trim()).slice(0, 3);
        if (tech.length >= 2) push(q('experience', `Why did ${org || 'your team'} use ${listJoin(tech)}, and what trade-offs did you see?`, 'Explain the context, the alternatives you considered and what you would choose today.', src, tech));
        if (item.current && org) push(q('experience', `Why are you looking to leave ${org}?`, 'Positive and forward-looking: what you have achieved there and what you want next.', src, ['motivation']));
      }
    }
    if (section.kind === 'projects') {
      for (const item of section.items) {
        const title = item.title.trim() || 'this project';
        const src = item.title.trim() || 'Project';
        push(q('project', `Walk me through ${title}. What problem does it solve${item.subtitle.trim() ? `, and what was your role as ${item.subtitle.trim()}` : ', and what did you build yourself'}?`, 'Problem → users → your architecture → the hardest part → result or what you learned.', src, item.tags.slice(0, 3)));
        for (const b of item.bullets.filter((x) => x.trim()).slice(0, Math.max(1, bulletsPerItem - 1))) {
          const s = stripEnd(b);
          const metrics = extractMetrics(s);
          push(q('project', `In ${title}: “${s}.” How did you achieve that, and what would you do differently now?`, metricHint(metrics), src, metrics));
        }
        const tech = item.tags.filter((t) => t.trim()).slice(0, 3);
        if (tech.length) push(q('project', `Why did you choose ${listJoin(tech)} for ${title}?`, 'Constraints, alternatives considered, and a trade-off you accepted.', src, tech));
      }
    }
    if (section.kind === 'achievements' || section.kind === 'awards') {
      for (const item of section.items.slice(0, 2)) if (item.title.trim()) push(q('experience', `Tell me about “${stripEnd(item.title)}”. What did it take to get there?`, STAR_HINT, item.title.trim()));
    }
  }

  // Skills (from the resume's skills sections; one group per category).
  const skillEntries: Array<{ name: string; category: string }> = [];
  for (const s of resume.sections) for (const g of s.skills) for (const n of g.names) if (!skillEntries.some((e) => e.name.toLowerCase() === n.toLowerCase())) skillEntries.push({ name: n, category: g.category });
  for (const sk of skillEntries.slice(0, maxSkills)) for (const text of skillQuestions(sk.name, sk.category, perSkill)) push(q('skill', text, 'Answer with a concrete example from your own work, then generalise.', sk.category ? `${sk.name} · ${sk.category}` : sk.name, [sk.name]));

  for (const g of GENERAL_BANK) push(q('general', g.text, g.hint, 'General', [g.tag]));
  return out;
}

/* ------------------------------ answers ------------------------------ */

export interface StarAnswer {
  situation: string;
  task: string;
  action: string;
  result: string;
  /** 0 = not rated, 1 = shaky, 2 = okay, 3 = confident. */
  confidence: 0 | 1 | 2 | 3;
  updatedAt: string;
}

export type AnswerMap = Record<string, StarAnswer>;

export const emptyAnswer = (): StarAnswer => ({ situation: '', task: '', action: '', result: '', confidence: 0, updatedAt: '' });

/** Average speaking pace used for the time estimate. */
export const WORDS_PER_MINUTE = 150;
/** A good spoken answer runs about two minutes. */
export const TARGET_SECONDS = 120;

export function countWords(text: string): number {
  const m = text.trim().match(/\S+/g);
  return m ? m.length : 0;
}

export function answerWords(a: StarAnswer): number {
  return countWords(a.situation) + countWords(a.task) + countWords(a.action) + countWords(a.result);
}

export function speakingSeconds(words: number): number {
  return Math.round((words / WORDS_PER_MINUTE) * 60);
}

export function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function hasAnswer(a: StarAnswer | undefined): boolean {
  return !!a && answerWords(a) > 0;
}

/** Deterministic shuffle (mulberry32) so a seed reproduces a deck order. */
export function shuffle<T>(items: T[], seed: number): T[] {
  const out = items.slice();
  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
