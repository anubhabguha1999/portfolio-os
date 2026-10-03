import { lazy, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileText, Globe, Mail, ScanText, UserRound } from 'lucide-react';
import { PORTFOLIO_TEMPLATE_COUNT } from '@/templates/count';
import { RESUME_TEMPLATE_COUNT } from '@/studio/templates/count';
import { cn } from '@/utils/cn';
import { Reveal, Stagger, StaggerItem } from './motion';
import { WhenNear } from './WhenNear';

// The real template miniatures need the portfolio renderer; it loads when the card is near.
const TemplateThumbAt = lazy(() => import('./TemplateArt').then((m) => ({ default: m.TemplateThumbAt })));

/**
 * Right after the hero: the two things people come here to make — a portfolio website and a
 * resume — each with a preview, what it does and a way in. Everything else follows below.
 */
export function WhatYouMake({ onCreatePortfolio }: { onCreatePortfolio: () => void }) {
  return (
    <section id="make" aria-labelledby="make-title" className="mx-auto max-w-6xl px-4 pb-6 pt-16 sm:px-6 sm:pt-24">
      <Reveal className="text-center">
        <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-accent">What you can make</p>
        <h2 id="make-title" className="mx-auto mt-3 max-w-3xl text-[clamp(1.8rem,4vw,2.8rem)] font-semibold leading-[1.05] tracking-[-0.03em]">
          A portfolio website <span className="font-display font-normal italic tracking-[-0.01em] text-fg-muted">and</span> a resume, from one profile.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
          Write your experience, projects and skills once. Show them as a site you own and as a recruiter-ready resume, and keep both in sync.
        </p>
      </Reveal>

      <Stagger className="mt-9 grid gap-4 sm:mt-12 sm:gap-5 lg:grid-cols-2">
        <ProductCard
          icon={<Globe className="size-4" />}
          eyebrow="Portfolio website"
          title="A personal site that is actually yours"
          body="Pick a template, edit every section visually and publish it on your own domain."
          tags={[`${PORTFOLIO_TEMPLATE_COUNT} templates`, 'Live preview', 'HTML · ZIP · Next.js']}
          visual={<PortfolioVisual />}
          primary={
            <button type="button" onClick={onCreatePortfolio} className={primaryBtn}>
              Create portfolio <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </button>
          }
          secondary={
            <Link to="/templates" className={secondaryBtn}>
              Browse templates
            </Link>
          }
        />
        <ProductCard
          icon={<FileText className="size-4" />}
          eyebrow="Resume & CV"
          title="Resumes that pass the ATS and still look designed"
          body="Start from your old resume or a template, tailor a version per role and export it."
          tags={[`${RESUME_TEMPLATE_COUNT} templates`, 'ATS checks', 'PDF · DOCX']}
          visual={<ResumeVisual />}
          primary={
            <Link to="/resumes" className={primaryBtn}>
              Build resume <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          }
          secondary={
            <a href="#resumes" className={secondaryBtn}>
              Resume features
            </a>
          }
        />
      </Stagger>

      <Reveal>
        <ul className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
          {[
            { icon: Mail, t: 'Cover letters & documents', d: 'Matching letters, case studies and one-pagers', to: '/documents' },
            { icon: ScanText, t: 'Extract your data', d: 'Turn an old PDF resume into editable content', to: '/knowledge' },
            { icon: UserRound, t: 'One shared profile', d: 'Edit once; portfolio and resumes update', to: '/profile' },
          ].map((x) => (
            <li key={x.t} className="bg-panel">
              <Link to={x.to} className="group flex h-full items-center gap-3 px-4 py-3 transition-colors hover:bg-elevated">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                  <x.icon className="size-3.5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium">{x.t}</span>
                  <span className="block text-[12px] text-fg-subtle">{x.d}</span>
                </span>
                <ArrowRight className="size-3.5 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-fg" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}

const primaryBtn = 'group inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-4 text-[13.5px] font-semibold text-accent-fg transition-colors hover:bg-accent-strong';
const secondaryBtn = 'inline-flex h-10 items-center px-2 text-[13.5px] font-medium text-fg-muted underline-offset-4 transition-colors hover:text-fg hover:underline';

function ProductCard({ icon, eyebrow, title, body, tags, visual, primary, secondary }: { icon: ReactNode; eyebrow: string; title: string; body: string; tags: string[]; visual: ReactNode; primary: ReactNode; secondary: ReactNode }) {
  return (
    <StaggerItem className="group/card flex flex-col overflow-hidden rounded-[22px] border border-line bg-panel transition-[border-color,translate] duration-500 ease-out hover:-translate-y-0.5 hover:border-line-strong">
      <div className="relative h-[180px] overflow-hidden bg-canvas sm:h-[240px]" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(70%_80%_at_50%_100%,var(--app-accent-soft),transparent)]" />
        {visual}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-panel to-transparent" />
      </div>
      <div className="flex flex-1 flex-col px-5 pb-5 pt-1 sm:px-7 sm:pb-7">
        <p className="inline-flex items-center gap-1.5 text-[11.5px] font-medium uppercase tracking-[0.14em] text-accent [&_svg]:size-3.5">
          {icon}
          {eyebrow}
        </p>
        <h3 className="mt-2.5 text-[clamp(1.15rem,2.2vw,1.45rem)] font-semibold leading-snug tracking-[-0.02em]">{title}</h3>
        <p className="mt-2 text-[14px] leading-relaxed text-fg-muted">{body}</p>
        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Highlights">
          {tags.map((t) => (
            <li key={t} className="rounded-full border border-line bg-bg/60 px-2.5 py-1 text-[11.5px] text-fg-muted">
              {t}
            </li>
          ))}
        </ul>
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-6">
          {primary}
          {secondary}
        </div>
      </div>
    </StaggerItem>
  );
}

/** Two real template miniatures in browser frames, fanned out. */
function PortfolioVisual() {
  // Same 16:10 box as the thumbnail, so swapping it in never shifts the layout.
  const placeholder = <div className="aspect-[16/10] w-full bg-canvas" />;
  const frame = (cls: string, index: number) => (
    <div className={cn('absolute w-[68%] overflow-hidden rounded-xl border border-line-strong bg-bg shadow-float transition-transform duration-700 ease-out', cls)}>
      <div className="flex items-center gap-1 border-b border-line px-2.5 py-1.5">
        <span className="size-1.5 rounded-full bg-line-strong" />
        <span className="size-1.5 rounded-full bg-line-strong" />
        <span className="size-1.5 rounded-full bg-line-strong" />
      </div>
      <WhenNear fallback={placeholder} margin="400px">
        <TemplateThumbAt index={index} />
      </WhenNear>
    </div>
  );
  return (
    <>
      {frame('left-[6%] top-[16%] -rotate-3 group-hover/card:-translate-y-1 group-hover/card:-rotate-[4deg]', 1)}
      {frame('right-[6%] top-[9%] rotate-2 group-hover/card:-translate-y-2 group-hover/card:rotate-[3deg]', 0)}
    </>
  );
}

/** Two resume sheets drawn in HTML (no layout engine on the home page's first screens). */
function ResumeVisual() {
  const sheet = (cls: string, sidebar: boolean) => (
    <div className={cn('absolute aspect-[210/297] w-[38%] overflow-hidden rounded-[3px] bg-white p-[5%] shadow-float transition-transform duration-700 ease-out', cls)}>
      {sidebar && <div className="absolute inset-y-0 left-0 w-[34%] bg-[#1e3a5f]" />}
      <div className={cn('relative', sidebar && 'ml-[38%]')}>
        <div className="h-[7px] w-[70%] rounded-sm bg-[#1d1b24]" />
        <div className="mt-1.5 h-[4px] w-[45%] rounded-sm bg-[#6a58f5]" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="mt-3">
            <div className="h-[4px] w-[35%] rounded-sm bg-[#1d1b24]/80" />
            <div className="mt-1 h-px w-full bg-[#e4e1d8]" />
            {[92, 84, 88, 70].map((w, j) => (
              <div key={j} className="mt-1 h-[3px] rounded-sm bg-[#1d1b24]/20" style={{ width: `${w - i * 4}%` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <>
      {sheet('left-[14%] top-[12%] -rotate-[5deg] group-hover/card:-translate-y-1 group-hover/card:-rotate-[6deg]', true)}
      {sheet('right-[14%] top-[8%] rotate-[4deg] group-hover/card:-translate-y-2 group-hover/card:rotate-[5deg]', false)}
    </>
  );
}
