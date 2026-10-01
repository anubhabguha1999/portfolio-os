import { lazy, Suspense, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Accessibility,
  ArrowRight,
  ArrowUpRight,
  CloudOff,
  Command,
  Database,
  Download,
  FileArchive,
  FileCode2,
  FileText,
  FileType2,
  GripVertical,
  History,
  LayoutTemplate,
  Lock,
  Palette,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { Shortcut } from '@/components/ui/misc';
import { BRAND } from '@/config/brand';
import { THEMES } from '@/lib/theme/themes';
import { TEMPLATES } from '@/templates';
import { TemplateThumb } from '@/features/templates/TemplateThumb';
import { createEntryRoute } from '@/features/projects/actions';
import { ExportDemo } from './ExportDemo';
import { MarketingFooter } from './MarketingFooter';
import { Skeleton } from 'dead-lock-skeleton';
import { RESUME_TEMPLATE_COUNT } from '@/studio/templates/count';
import { cn } from '@/utils/cn';
import { Reveal, ScrollProgress, Stagger, StaggerItem } from './motion';

/** "Create Portfolio" goes to the dashboard when projects exist, onboarding otherwise. */
// The showcase lays out real resumes with the PDF engine, so it loads after the page.
const ResumeShowcase = lazy(() => import('./ResumeShowcase'));

function useCreatePortfolio(): () => void {
  const navigate = useNavigate();
  const [route, setRoute] = useState<'/projects' | '/new' | null>(null);
  useEffect(() => {
    let alive = true;
    void createEntryRoute().then((r) => {
      if (alive) setRoute(r);
    });
    return () => {
      alive = false;
    };
  }, []);
  return () => {
    if (route) navigate(route);
    else void createEntryRoute().then((r) => navigate(r));
  };
}

const SHORTCUTS: Array<[string, string]> = [
  ['mod+k', 'Command palette'],
  ['mod+s', 'Save version'],
  ['mod+z', 'Undo'],
  ['mod+shift+z', 'Redo'],
  ['mod+p', 'Preview'],
  ['mod+e', 'Export'],
];

export default function LandingPage() {
  const goCreate = useCreatePortfolio();
  // Delay (seconds) for the one-shot `.hero-rise` CSS entrance.
  const rise = (delay: number) => ({ '--d': `${delay}s` }) as CSSProperties;

  useEffect(() => {
    document.title = `${BRAND.name} — ${BRAND.tagline}`;
  }, []);

  return (
    <div className="relative min-h-full overflow-x-clip bg-bg text-fg">
      <ScrollProgress />
      <Backdrop />
      <SiteHeader transparent />
      <main id="main" className="relative">
        {/* -------------------------------- Hero -------------------------------- */}
        <section aria-labelledby="hero-title" className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-24">
          <div className="scene-hero-exit origin-top">
          <p style={rise(0)} className="hero-rise mx-auto flex w-fit max-w-full items-center gap-2 rounded-full border border-line bg-panel/60 px-3 py-1 text-center text-[12px] text-fg-muted backdrop-blur">
            <span className="size-1.5 shrink-0 rounded-full bg-ok shadow-[0_0_10px_var(--app-ok)]" aria-hidden="true" />
            Runs 100% in your browser · No account · Works offline
          </p>
          <h1 id="hero-title" style={rise(0.06)} className="hero-rise mx-auto mt-7 max-w-4xl text-center text-[clamp(2.6rem,8.4vw,6.2rem)] font-semibold leading-[0.95] tracking-[-0.045em]">
            Build once.
            <br />
            <span className="text-fg-muted">Export </span>
            <span className="bg-[linear-gradient(100deg,var(--app-fg)_10%,var(--app-accent)_55%,#e9a6ff_92%)] bg-clip-text pr-[0.06em] font-display font-normal italic tracking-[-0.02em] text-transparent">everywhere.</span>
          </h1>
          <p style={rise(0.14)} className="hero-rise mx-auto mt-6 max-w-2xl text-center text-[clamp(1rem,2.2vw,1.2rem)] leading-relaxed text-fg-muted">
            {BRAND.description}
          </p>
          <div style={rise(0.22)} className="hero-rise mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={goCreate}
              className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 text-[15px] font-semibold text-accent-fg shadow-[0_1px_0_rgba(255,255,255,.3)_inset,0_14px_40px_-12px_var(--app-accent)] transition-[background,transform] hover:bg-accent-strong active:translate-y-px sm:w-auto"
            >
              Create Portfolio
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </button>
            <Link
              to="/templates"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-line-strong bg-panel/50 px-6 text-[15px] font-medium text-fg backdrop-blur transition-colors hover:bg-hover sm:w-auto"
            >
              Explore Templates
            </Link>
          </div>
          <p style={rise(0.3)} className="hero-rise mt-5 text-center text-[12px] text-fg-subtle">
            Free to use · Open file formats · Nothing to install
          </p>
          </div>

          <div style={rise(0.35)} className="hero-rise relative mt-16 [perspective:1400px] sm:mt-20">
            <div className="absolute -inset-x-6 -inset-y-10 rounded-[40px] bg-[radial-gradient(60%_60%_at_50%_40%,var(--app-accent-soft),transparent_70%)]" aria-hidden="true" />
            {/* Tilts up from the floor and settles flat as it scrolls into the middle of the screen. */}
            <div className="scene-tilt relative origin-[50%_0%] rounded-[26px] border border-line/80 bg-canvas/90 p-3 shadow-float sm:p-6">
              <ExportDemo />
            </div>
          </div>
        </section>

        {/* ---------------------------- How it works ---------------------------- */}
        <Section
          id="how"
          eyebrow="How it works"
          title={
            <>
              Three steps. <Serif>No detours.</Serif>
            </>
          }
        >
          <StepsTrack />
          <Stagger as="ol" className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3">
            {[
              { n: '01', t: 'Start from a template', d: `Pick one of ${TEMPLATES.length} designed starting points — or a blank page. Every template is editable sample content, not a locked layout.` },
              { n: '02', t: 'Shape it visually', d: 'Edit content in forms, reorder sections by dragging, switch themes, and watch the live preview update on desktop, tablet and phone.' },
              { n: '03', t: 'Export anything', d: 'Download a single HTML file, a print-quality PDF, an editable Word document, or a ZIP you can drop onto any static host.' },
            ].map((s) => (
              <StaggerItem key={s.n} className="group bg-panel p-6 transition-colors duration-500 hover:bg-elevated sm:p-8">
                <span className="inline-block font-display text-[44px] italic leading-none text-accent transition-transform duration-500 ease-out group-hover:-translate-y-1 group-hover:scale-110">{s.n}</span>
                <h3 className="mt-5 text-[17px] font-semibold tracking-tight">{s.t}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-fg-muted">{s.d}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </Section>

        {/* ------------------------------- Formats ------------------------------ */}
        <Section
          id="formats"
          eyebrow="Export formats"
          title={
            <>
              One portfolio. <Serif>Four finished files.</Serif>
            </>
          }
          intro="The same data model drives every output, so your PDF never drifts out of date with your website."
        >
          <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: FileCode2, ext: 'html', color: '#f97316', t: 'Standalone web page', d: 'One self-contained file with styles, script and images inlined. Opens anywhere, even offline.' },
              { icon: FileText, ext: 'pdf', color: '#ef4444', t: 'Print-ready PDF', d: 'A clean, paginated document for applications and email attachments.' },
              { icon: FileType2, ext: 'docx', color: '#3b82f6', t: 'Editable Word file', d: 'Real headings, lists and links — ready for anyone who asks for “a Word version”.' },
              { icon: FileArchive, ext: 'zip', color: '#a78bfa', t: 'Deploy-ready website', d: 'Separate HTML, CSS, JS and assets. Upload the folder to any static host.' },
            ].map((f) => (
              <StaggerItem key={f.ext} className="group relative overflow-hidden rounded-2xl border border-line bg-panel p-5 transition-[border-color,translate,box-shadow] duration-500 ease-out hover:-translate-y-1.5 hover:border-line-strong hover:shadow-float">
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-xl transition-transform duration-500 ease-out group-hover:-rotate-6 group-hover:scale-110" style={{ background: `${f.color}1f`, color: f.color }}>
                    <f.icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="font-mono text-[11px] font-semibold tracking-wider" style={{ color: f.color }}>
                    .{f.ext}
                  </span>
                </div>
                <h3 className="mt-6 text-[15px] font-semibold">{f.t}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">{f.d}</p>
                <div className="pointer-events-none absolute -bottom-12 -right-12 size-32 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-30" style={{ background: f.color }} aria-hidden="true" />
              </StaggerItem>
            ))}
          </Stagger>
        </Section>

        {/* ------------------------------- Privacy ------------------------------ */}
        <ZoomScene labelledBy="privacy-title" className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28" innerClassName="grid items-center gap-10 overflow-hidden rounded-[28px] border border-line bg-panel p-6 sm:p-10 lg:grid-cols-[1.1fr_1fr] lg:p-14">
            <div>
              <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-ok">Private by architecture</p>
              <h2 id="privacy-title" className="mt-4 text-[clamp(2rem,5vw,3.4rem)] font-semibold leading-[1.02] tracking-[-0.035em]">
                Your data <Serif>never</Serif> leaves your device.
              </h2>
              <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-fg-muted">
                There is no {BRAND.name} server to send it to. Projects, images and version history live in your browser’s own database, and every export is generated right here on your machine.
              </p>
              <Stagger className="mt-8 grid gap-3 sm:grid-cols-2">
                {[
                  { icon: Lock, t: 'No accounts or sign-in' },
                  { icon: CloudOff, t: 'No servers, no uploads' },
                  { icon: ShieldCheck, t: 'No analytics or tracking' },
                  { icon: WifiOff, t: 'Installable, works offline' },
                ].map((i) => (
                  <StaggerItem key={i.t} className="flex items-center gap-3 text-[14px]">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-elevated text-fg-muted">
                      <i.icon className="size-4" aria-hidden="true" />
                    </span>
                    {i.t}
                  </StaggerItem>
                ))}
              </Stagger>
            </div>
            <DeviceDiagram />
        </ZoomScene>

        {/* ------------------------------- Features ----------------------------- */}
        <Section
          id="features"
          eyebrow="Features"
          title={
            <>
              Serious tools, <Serif>quietly</Serif> arranged.
            </>
          }
        >
          <Stagger as="div" className="grid gap-4 md:grid-cols-6">
            <Feature className="md:col-span-4" icon={Palette} title={`${THEMES.length} themes, fully tunable`} body="Palettes for light and dark, type pairings, spacing, radius, motion and effects — tune every token or start from a preset.">
              <div className="mt-6 flex flex-wrap gap-2" aria-hidden="true">
                {THEMES.map((t) => {
                  const p = t.palettes[t.defaultScheme];
                  return (
                    <span key={t.id} className="flex h-8 overflow-hidden rounded-lg border border-line" title={t.name}>
                      <span className="w-4 sm:w-5" style={{ background: p.background }} />
                      <span className="w-4 sm:w-5" style={{ background: p.primary }} />
                      <span className="w-4 sm:w-5" style={{ background: p.accent }} />
                    </span>
                  );
                })}
              </div>
            </Feature>
            <Feature className="md:col-span-2" icon={LayoutTemplate} title={`${TEMPLATES.length} templates`} body="Each with its own layout, section order, motion and a realistic sample persona to rewrite." />
            <Feature className="md:col-span-2" icon={GripVertical} title="Drag & drop sections" body="Seventeen section types. Reorder, duplicate, rename or hide them per device." />
            <Feature className="md:col-span-2" icon={History} title="Version history" body="Automatic snapshots plus named versions. Restore any point without losing the current one." />
            <Feature className="md:col-span-2" icon={Accessibility} title="Accessibility audit" body="Checks alt text, contrast, heading order and link labels before you publish." />
            <Feature className="md:col-span-6" icon={Command} title="Command palette & shortcuts" body="Everything is a keystroke away: jump to a section, switch theme, preview, export, undo.">
              <ul className="mt-5 grid gap-x-6 gap-y-3 text-[13px] text-fg-muted sm:flex sm:flex-wrap">
                {SHORTCUTS.map(([k, l]) => (
                  <li key={k} className="flex items-center gap-2">
                    <Shortcut keys={k} />
                    {l}
                  </li>
                ))}
              </ul>
            </Feature>
          </Stagger>
        </Section>

        {/* ------------------------------- Templates ---------------------------- */}
        <section aria-labelledby="tpl-title" className="py-20 sm:py-28">
          <Reveal className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-4 sm:px-6">
            <div>
              <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-accent">Templates</p>
              <h2 id="tpl-title" className="mt-3 text-[clamp(1.8rem,4vw,2.8rem)] font-semibold tracking-[-0.03em]">
                Start somewhere <Serif>beautiful.</Serif>
              </h2>
            </div>
            <Link to="/templates" className="inline-flex items-center gap-1.5 text-[14px] font-medium text-fg-muted hover:text-fg">
              Browse all templates
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </Reveal>
          <TemplateReel>
            {TEMPLATES.map((t) => (
              <StaggerItem key={t.id} className="w-[min(78vw,340px)] shrink-0 snap-start">
                <Link to={`/templates?t=${t.id}`} className="group block rounded-2xl border border-line bg-panel p-2 transition-[border-color,translate] duration-500 ease-out hover:-translate-y-1.5 hover:border-line-strong">
                  <div className="overflow-hidden rounded-xl">
                    <TemplateThumb template={t} className="transition-transform duration-700 group-hover:scale-[1.03]" />
                  </div>
                  <div className="flex items-center justify-between gap-3 px-2 pb-1 pt-3">
                    <span className="text-[14px] font-medium">{t.name}</span>
                    <span className="truncate text-[12px] text-fg-subtle">{t.audience}</span>
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </TemplateReel>
        </section>

        {/* --------------------------- Resume highlights -------------------------- */}
        <section id="resumes" aria-labelledby="resumes-title" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="grid items-center gap-14 lg:grid-cols-[1fr_1.05fr]">
            <Reveal>
              <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-accent">Resume Studio</p>
              <h2 id="resumes-title" className="mt-3 max-w-xl text-[clamp(1.8rem,4vw,2.8rem)] font-semibold leading-[1.05] tracking-[-0.03em]">
                Resumes that look <Serif>designed,</Serif> not typed.
              </h2>
              <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-fg-muted">
                Pick from {RESUME_TEMPLATE_COUNT} print-grade templates, each with a realistic example already filled in. Rewrite it with your own details and tailor a version for every role, all from the one profile your portfolio uses.
              </p>
              <ul className="mt-7 grid gap-x-6 gap-y-3.5 text-[14px] sm:grid-cols-2">
                {[
                  { icon: LayoutTemplate, t: `${RESUME_TEMPLATE_COUNT} templates`, d: 'Sidebars, banners, serif and ATS-safe layouts' },
                  { icon: ShieldCheck, t: 'ATS & content checks', d: 'Standard headings, dates, length and keywords' },
                  { icon: FileText, t: 'Real pagination', d: 'Fit to one page, keep entries together' },
                  { icon: FileArchive, t: 'PDF, DOCX, TXT, JSON', d: 'Plus a zipped application pack' },
                ].map((f) => (
                  <li key={f.t} className="flex gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-elevated text-accent">
                      <f.icon className="size-4" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block font-medium">{f.t}</span>
                      <span className="block text-[12.5px] text-fg-subtle">{f.d}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link to="/resumes" className="group inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-[14px] font-semibold text-accent-fg transition-colors hover:bg-accent-strong">
                  Build a resume
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
                <Link to="/documents" className="inline-flex h-11 items-center justify-center rounded-xl border border-line-strong px-5 text-[14px] font-medium text-fg-muted hover:bg-hover hover:text-fg">
                  Write a cover letter
                </Link>
              </div>
            </Reveal>
            <Suspense
              fallback={
                <div className="mx-auto grid h-[min(118vw,470px)] w-full max-w-[560px] place-items-center" role="status" aria-label="Loading example resumes">
                  <Skeleton width={232} height={328} borderRadius={4} />
                </div>
              }
            >
              <ResumeShowcase />
            </Suspense>
          </div>
        </section>

        {/* -------------------------------- CTA --------------------------------- */}
        <ZoomScene labelledBy="cta-title" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6" innerClassName="relative overflow-hidden rounded-[28px] border border-line bg-panel px-6 py-16 text-center sm:px-12">
            <div className="absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_0%,var(--app-accent-soft),transparent)]" aria-hidden="true" />
            <h2 id="cta-title" className="relative text-[clamp(2rem,5vw,3.2rem)] font-semibold leading-[1.05] tracking-[-0.035em]">
              Your next portfolio is <Serif>one file</Serif> away.
            </h2>
            <p className="relative mx-auto mt-4 max-w-lg text-[15px] text-fg-muted">No sign-up. Close the tab and everything is still here when you come back.</p>
            <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button type="button" onClick={goCreate} className="group inline-flex h-12 items-center gap-2 rounded-xl bg-fg px-6 text-[15px] font-semibold text-bg transition-[opacity,scale] hover:scale-[1.03] hover:opacity-90 active:scale-100">
                Create Portfolio
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
              <Link to="/about" className="inline-flex h-12 items-center rounded-xl px-5 text-[14px] text-fg-muted hover:text-fg">
                How it works under the hood
              </Link>
            </div>
        </ZoomScene>
      </main>
      <MarketingFooter />
    </div>
  );
}

/* ------------------------------ Local pieces ------------------------------ */

function Serif({ children }: { children: ReactNode }) {
  return <span className="font-display font-normal italic tracking-[-0.01em]">{children}</span>;
}

function Section({ id, eyebrow, title, intro, children }: { id: string; eyebrow: string; title: ReactNode; intro?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <Reveal>
        <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-accent">{eyebrow}</p>
        <h2 id={`${id}-title`} className="mt-3 max-w-3xl text-[clamp(1.8rem,4vw,2.8rem)] font-semibold leading-[1.05] tracking-[-0.03em]">
          {title}
        </h2>
        {intro && <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-fg-muted">{intro}</p>}
      </Reveal>
      <div className="mt-10 sm:mt-12">{children}</div>
    </section>
  );
}

function Feature({ icon: Icon, title, body, className, children }: { icon: typeof Palette; title: string; body: string; className?: string; children?: ReactNode }) {
  return (
    <StaggerItem as="div" className={cn('group rounded-2xl border border-line bg-panel p-6 transition-[border-color,translate] duration-500 ease-out hover:-translate-y-1 hover:border-line-strong', className)}>
      <Icon className="size-5 text-accent transition-transform duration-500 ease-out group-hover:scale-125" aria-hidden="true" />
      <h3 className="mt-5 text-[16px] font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-fg-muted">{body}</p>
      {children}
    </StaggerItem>
  );
}

function DeviceDiagram() {
  const rows = [
    { icon: Database, t: 'IndexedDB', d: 'Projects, images & versions' },
    { icon: LayoutTemplate, t: 'Portfolio Engine', d: 'Renders preview and exports' },
    { icon: Download, t: 'Your downloads folder', d: 'HTML · PDF · DOCX · ZIP' },
  ];
  return (
    <figure>
      <div className="rounded-2xl border border-line-strong bg-bg/60 p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="truncate font-mono text-[11px] text-fg-subtle">inside your browser</span>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ok/10 px-2 py-0.5 text-[11px] font-medium text-ok">
            <span className="size-1.5 rounded-full bg-ok" aria-hidden="true" /> On this device
          </span>
        </div>
        <Stagger as="ol" className="relative grid gap-2.5">
          <span className="absolute bottom-6 left-[25px] top-6 w-px overflow-hidden bg-line-strong" aria-hidden="true">
            <span className="landing-pulse absolute inset-x-0 top-0 h-10 bg-[linear-gradient(transparent,var(--app-accent),transparent)]" />
          </span>
          {rows.map((r) => (
            <StaggerItem key={r.t} className="relative flex items-center gap-3 rounded-xl border border-line bg-panel p-2.5">
              <span className="grid size-[30px] shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                <r.icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium">{r.t}</span>
                <span className="block text-[12px] text-fg-subtle">{r.d}</span>
              </span>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
      <figcaption className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-line px-3 py-2.5 text-[12px] text-fg-subtle">
        <CloudOff className="size-4 shrink-0" aria-hidden="true" />
        <span>
          <span className="line-through decoration-danger/70">Cloud sync · Uploads · Server rendering</span> — not part of the architecture.
        </span>
      </figcaption>
    </figure>
  );
}

/** Restrained atmosphere: a soft top glow, a faint grid, and grain. */
function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[1100px] overflow-hidden">
      <div className="absolute left-1/2 top-[-380px] h-[760px] w-[1200px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(139,124,255,.2),transparent)]" />
      <div className="absolute right-[-200px] top-[140px] h-[420px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(62,207,142,.07),transparent)]" />
      <div className="absolute inset-0 [background-image:linear-gradient(var(--app-line)_1px,transparent_1px),linear-gradient(90deg,var(--app-line)_1px,transparent_1px)] [background-size:64px_64px] opacity-[.35] [mask-image:radial-gradient(70%_55%_at_50%_0%,#000,transparent)]" />
      <div className="noise-bg absolute inset-0 opacity-[.035] mix-blend-overlay" />
    </div>
  );
}

/** A panel that pushes in from slightly further away and settles as it scrolls into view. */
function ZoomScene({ labelledBy, className, innerClassName, children }: { labelledBy: string; className?: string; innerClassName?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={labelledBy} className={className}>
      <div className={cn('scene-zoom', innerClassName)}>{children}</div>
    </section>
  );
}

/** Accent line drawn across the three steps as the section scrolls through. */
function StepsTrack() {
  return (
    <div aria-hidden="true" className="mb-4 h-px overflow-hidden rounded-full bg-line">
      <div className="scene-draw h-full origin-left bg-[linear-gradient(90deg,var(--app-accent),#e9a6ff)]" />
    </div>
  );
}

/** Horizontal template strip: glides in sideways as it scrolls into view. */
function TemplateReel({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden">
      <ul className="scene-glide mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:px-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))]">{children}</ul>
    </div>
  );
}
