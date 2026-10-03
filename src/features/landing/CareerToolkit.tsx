import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Briefcase, DatabaseBackup, GitCompare, Globe, Languages, ListChecks, Lock, MessagesSquare, Rocket, Sparkles, Target, UserSquare } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Reveal, Stagger, StaggerItem } from './motion';

/**
 * "Career toolkit": every tool after the resume, each card a link to its page with a small
 * illustration drawn in HTML/CSS (no images, no engine code). Motion is transform/opacity
 * only and switches off with reduced motion (see .tk-* in index.css).
 */
export function CareerToolkit() {
  return (
    <section id="toolkit" aria-labelledby="toolkit-title" className="tk-section mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <Reveal>
        <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-accent">Career toolkit</p>
        <h2 id="toolkit-title" className="mt-3 max-w-3xl text-[clamp(1.8rem,4vw,2.8rem)] font-semibold leading-[1.05] tracking-[-0.03em]">
          Everything between <span className="font-display font-normal italic tracking-[-0.01em]">apply</span> and <span className="font-display font-normal italic tracking-[-0.01em]">offer.</span>
        </h2>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
          Match your resume to a job, sharpen every bullet, track applications, rehearse interviews and publish your site. All of it runs on your device, with the same private data as your resume.
        </p>
      </Reveal>

      <Stagger as="div" className="mt-10 grid gap-4 sm:mt-12 md:grid-cols-12">
        <Tool to="/match" className="md:col-span-7" icon={Target} title="Job match" body="Paste a job description and see the keywords your resume covers, what's missing and a score that explains itself.">
          <MatchArt />
        </Tool>
        <Tool to="/applications" className="md:col-span-5" icon={Briefcase} title="Application tracker" body="Every role from wishlist to offer, with the exact resume and cover letter you sent.">
          <BoardArt />
        </Tool>
        <Tool to="/bullets" className="md:col-span-4" icon={ListChecks} title="Bullet helper" body="Flags weak verbs, missing numbers, long lines and passive voice.">
          <BulletArt />
        </Tool>
        <Tool to="/interview" className="md:col-span-4" icon={MessagesSquare} title="Interview prep" body="Questions built from your own roles and projects, with STAR answers and flashcards.">
          <FlashcardArt />
        </Tool>
        <Tool to="/compare" className="md:col-span-4" icon={GitCompare} title="Compare resumes" body="Two versions side by side, down to the word.">
          <DiffArt />
        </Tool>
        <Tool to="/linkedin" className="md:col-span-5" icon={UserSquare} title="LinkedIn copy" body="Headline, About and experience written from your profile, sized to LinkedIn's limits.">
          <LinkedInArt />
        </Tool>
        <Tool to="/assistant" className="md:col-span-7" icon={Sparkles} title="AI assistant" badge="Optional" body="Bring your own API key to rewrite bullets, draft cover letters and get tailoring tips. It never invents facts.">
          <AssistantArt />
        </Tool>
      </Stagger>

      <Stagger className="mt-4 grid gap-4 sm:grid-cols-3">
        <MiniTool to="/backup" icon={DatabaseBackup} title="Backup & sync" body="Everything in one encrypted file or a synced folder." art={<SyncArt />} />
        <MiniTool to="/projects" icon={Rocket} title="One-click deploy" body="Publish to Netlify, Vercel or GitHub Pages from the browser." art={<DeployArt />} />
        <MiniTool to="/resumes" icon={Languages} title="12 output languages" body="Translated headings and dates, with right-to-left layouts." art={<LanguageArt />} />
      </Stagger>
    </section>
  );
}

/* --------------------------------- Cards --------------------------------- */

function Tool({ to, icon: Icon, title, body, badge, className, children }: { to: string; icon: typeof Target; title: string; body: string; badge?: string; className?: string; children: ReactNode }) {
  return (
    <StaggerItem as="div" className={cn('min-w-0', className)}>
      <Link to={to} className="group/tool relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-panel p-5 transition-[border-color,translate] duration-500 ease-out hover:-translate-y-1 hover:border-line-strong sm:p-6">
        <div className="tk-glow pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-[radial-gradient(closest-side,var(--app-accent-soft),transparent)] opacity-0 transition-opacity duration-500 group-hover/tool:opacity-100" aria-hidden="true" />
        <div className="relative flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg border border-line bg-elevated text-accent transition-transform duration-500 ease-out group-hover/tool:-rotate-6 group-hover/tool:scale-110">
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <h3 className="text-[15.5px] font-semibold tracking-tight">{title}</h3>
          {badge && <span className="rounded-full border border-line px-2 py-0.5 text-[10.5px] font-medium text-fg-muted">{badge}</span>}
          <ArrowUpRight className="ml-auto size-4 text-fg-subtle transition-transform duration-300 group-hover/tool:-translate-y-0.5 group-hover/tool:translate-x-0.5 group-hover/tool:text-fg" aria-hidden="true" />
        </div>
        <p className="relative mt-2.5 max-w-md text-[13.5px] leading-relaxed text-fg-muted">{body}</p>
        <div className="relative mt-5 flex flex-1 items-end" aria-hidden="true">
          {children}
        </div>
      </Link>
    </StaggerItem>
  );
}

function MiniTool({ to, icon: Icon, title, body, art }: { to: string; icon: typeof Target; title: string; body: string; art: ReactNode }) {
  return (
    <StaggerItem className="min-w-0">
      <Link to={to} className="group/tool flex h-full items-start gap-3.5 rounded-2xl border border-line bg-panel p-4 transition-[border-color,translate] duration-500 ease-out hover:-translate-y-1 hover:border-line-strong">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold">{title}</span>
          <span className="mt-0.5 block text-[12.5px] leading-snug text-fg-muted">{body}</span>
          <span className="mt-3 block" aria-hidden="true">
            {art}
          </span>
        </span>
      </Link>
    </StaggerItem>
  );
}

/* ------------------------------ Illustrations ----------------------------- */

const chip = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium';

function MatchArt() {
  // Static SVG ring: a one-off drawing, nothing animates on the main thread.
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex w-full flex-wrap items-center gap-5 rounded-xl border border-line bg-bg/60 p-4">
      <div className="relative grid size-[84px] shrink-0 place-items-center">
        <svg viewBox="0 0 72 72" className="absolute inset-0 -rotate-90">
          <circle cx="36" cy="36" r={r} fill="none" stroke="var(--app-line)" strokeWidth="6" />
          <circle cx="36" cy="36" r={r} fill="none" stroke="url(#tk-ring)" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * 0.14} />
          <defs>
            <linearGradient id="tk-ring" x1="0" x2="1">
              <stop offset="0" stopColor="var(--app-accent)" />
              <stop offset="1" stopColor="#e9a6ff" />
            </linearGradient>
          </defs>
        </svg>
        <span className="text-[20px] font-semibold tabular-nums">
          86<span className="text-[11px] text-fg-muted">%</span>
        </span>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {['TypeScript', 'React', 'AWS', 'Node.js'].map((k) => (
            <span key={k} className={cn(chip, 'border-ok/30 bg-ok/10 text-ok')}>
              ✓ {k}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['Kubernetes', 'CI/CD'].map((k) => (
            <span key={k} className={cn(chip, 'border-danger/30 bg-danger/10 text-danger')}>
              + {k}
            </span>
          ))}
          <span className={cn(chip, 'border-line text-fg-muted')}>in your profile</span>
        </div>
      </div>
    </div>
  );
}

function BoardArt() {
  const cols: Array<[string, string[], string]> = [
    ['Applied', ['Acme', 'Northwind'], 'bg-accent'],
    ['Interview', ['Globex'], 'bg-warn'],
    ['Offer', [], 'bg-ok'],
  ];
  return (
    <div className="grid w-full grid-cols-3 gap-2 rounded-xl border border-line bg-bg/60 p-2.5">
      {cols.map(([name, cards, dot], i) => (
        <div key={name} className="min-w-0 rounded-lg bg-panel/70 p-1.5">
          <p className="flex items-center gap-1.5 px-1 pb-1.5 text-[10.5px] font-medium text-fg-muted">
            <span className={cn('size-1.5 rounded-full', dot)} />
            {name}
          </p>
          <div className="space-y-1.5">
            {cards.map((c) => (
              <div key={c} className="truncate rounded-md border border-line bg-elevated px-2 py-1.5 text-[11px]">
                {c}
              </div>
            ))}
            {/* The card on its way to "Offer". */}
            {i === 2 && <div className="tk-float truncate rounded-md border border-ok/40 bg-ok/10 px-2 py-1.5 text-[11px] text-ok shadow-float">Initech</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function BulletArt() {
  return (
    <div className="w-full space-y-2 rounded-xl border border-line bg-bg/60 p-3.5 text-[12px] leading-snug">
      <p className="text-fg-muted">
        <span className="text-danger line-through decoration-danger/70">Responsible for</span> the checkout service
      </p>
      <p>
        <span className="font-semibold text-ok">Rebuilt</span> the checkout service, cutting errors <span className="rounded bg-accent-soft px-1 font-medium text-accent">38%</span>
      </p>
    </div>
  );
}

function FlashcardArt() {
  return (
    <div className="relative h-[92px] w-full">
      <div className="absolute inset-x-6 top-0 h-[74px] rotate-[-4deg] rounded-xl border border-line bg-elevated/60 transition-transform duration-500 group-hover/tool:rotate-[-7deg]" />
      <div className="absolute inset-x-3 top-1.5 h-[74px] rotate-[3deg] rounded-xl border border-line bg-elevated/80 transition-transform duration-500 group-hover/tool:rotate-[6deg]" />
      <div className="absolute inset-x-0 top-3 flex h-[74px] flex-col justify-center rounded-xl border border-line-strong bg-panel px-3.5">
        <p className="text-[12px] font-medium">Tell me about a time you cut latency.</p>
        <p className="mt-1 font-mono text-[10.5px] text-fg-subtle">S · T · A · R — 1:52 spoken</p>
      </div>
    </div>
  );
}

function DiffArt() {
  return (
    <div className="w-full space-y-1 rounded-xl border border-line bg-bg/60 p-3 font-mono text-[11px] leading-relaxed">
      <p className="truncate rounded bg-danger/10 px-1.5 text-danger">− Led a team of 4 engineers</p>
      <p className="truncate rounded bg-ok/10 px-1.5 text-ok">+ Led a team of 6 engineers</p>
      <p className="truncate px-1.5 text-fg-subtle">&nbsp;&nbsp;Shipped 3 products</p>
    </div>
  );
}

function LinkedInArt() {
  return (
    <div className="w-full rounded-xl border border-line bg-bg/60 p-3.5">
      <p className="text-[12.5px] font-medium leading-snug">Senior Full-Stack Engineer · TypeScript, React, AWS · I ship fast, reliable web platforms</p>
      <div className="mt-3 flex items-center gap-2.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-hover">
          <div className="h-full w-[39%] rounded-full bg-[linear-gradient(90deg,var(--app-accent),#e9a6ff)]" />
        </div>
        <span className="font-mono text-[10.5px] tabular-nums text-fg-muted">86 / 220</span>
      </div>
    </div>
  );
}

function AssistantArt() {
  return (
    <div className="w-full space-y-2 rounded-xl border border-line bg-bg/60 p-3.5 text-[12px] leading-snug">
      <div className="flex justify-end">
        <p className="max-w-[80%] rounded-xl rounded-br-sm bg-accent-soft px-3 py-2">Rewrite this bullet for impact. Don't invent numbers.</p>
      </div>
      <div className="flex">
        <p className="max-w-[88%] rounded-xl rounded-bl-sm border border-line bg-panel px-3 py-2 text-fg-muted">
          Cut checkout errors by <span className="rounded bg-hover px-1 font-mono text-fg">[X%]</span> by rebuilding payment retries
          <span className="tk-caret ml-0.5 inline-block h-3 w-[2px] translate-y-0.5 bg-accent" />
        </p>
      </div>
      <p className="flex items-center gap-1.5 text-[10.5px] text-fg-subtle">
        <Lock className="size-3" /> Your key, sent only to the AI provider
      </p>
    </div>
  );
}

function SyncArt() {
  return (
    <span className="flex items-center gap-2 text-[10.5px] text-fg-muted">
      <span className="rounded-md border border-line px-1.5 py-0.5">Laptop</span>
      <span className="relative h-px flex-1 overflow-hidden bg-line-strong">
        <span className="tk-travel absolute inset-y-0 left-0 w-6 bg-[linear-gradient(90deg,transparent,var(--app-accent),transparent)]" />
      </span>
      <span className="rounded-md border border-line px-1.5 py-0.5">Desktop</span>
    </span>
  );
}

function DeployArt() {
  return (
    <span className="flex flex-wrap gap-1.5">
      {['Netlify', 'Vercel', 'GitHub Pages'].map((h) => (
        <span key={h} className={cn(chip, 'border-line text-fg-muted')}>
          <Globe className="size-3" /> {h}
        </span>
      ))}
    </span>
  );
}

function LanguageArt() {
  return (
    <span className="flex flex-wrap gap-1.5">
      {['EN', 'ES', 'DE', 'FR', 'हिन्दी', 'العربية', '日本語'].map((l) => (
        <span key={l} className={cn(chip, 'border-line text-fg-muted')} lang={l === 'हिन्दी' ? 'hi' : l === 'العربية' ? 'ar' : l === '日本語' ? 'ja' : undefined}>
          {l}
        </span>
      ))}
    </span>
  );
}
