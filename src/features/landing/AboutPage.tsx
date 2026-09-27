import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Braces, CloudOff, Cpu, Eye, FileArchive, FileCode2, FileText, FileType2, Lock, ShieldCheck } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { BRAND, SCHEMA_VERSION } from '@/config/brand';
import { SECTION_TYPES } from '@/sections/registry';
import { THEMES } from '@/lib/theme/themes';
import { MarketingFooter } from './MarketingFooter';

const LIBRARIES: Array<{ name: string; role: string; license: string }> = [
  { name: 'React', role: 'User interface', license: 'MIT' },
  { name: 'TypeScript', role: 'Type-safe source', license: 'Apache-2.0' },
  { name: 'Vite', role: 'Build tooling', license: 'MIT' },
  { name: 'Tailwind CSS', role: 'App styling', license: 'MIT' },
  { name: 'Zustand', role: 'Editor state', license: 'MIT' },
  { name: 'React Router', role: 'Navigation', license: 'MIT' },
  { name: 'Framer Motion', role: 'Interface motion', license: 'MIT' },
  { name: 'Lucide', role: 'Icons', license: 'ISC' },
  { name: 'dnd kit', role: 'Drag and drop', license: 'MIT' },
  { name: 'idb', role: 'IndexedDB storage', license: 'ISC' },
  { name: 'Zod', role: 'Schema validation', license: 'MIT' },
  { name: 'Marked', role: 'Markdown', license: 'MIT' },
  { name: 'DOMPurify', role: 'HTML sanitising', license: 'Apache-2.0 / MPL-2.0' },
  { name: 'jsPDF', role: 'PDF export', license: 'MIT' },
  { name: 'docx', role: 'Word export', license: 'MIT' },
  { name: 'JSZip', role: 'Website ZIP export', license: 'MIT / GPL-3.0' },
  { name: 'fflate', role: 'Compression for share links', license: 'MIT' },
  { name: 'QRCode', role: 'QR codes', license: 'MIT' },
  { name: 'vite-plugin-pwa & Workbox', role: 'Offline support', license: 'MIT' },
];

export default function AboutPage() {
  useEffect(() => {
    document.title = `About — ${BRAND.name}`;
  }, []);

  return (
    <div className="min-h-full bg-bg text-fg">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-4xl px-4 pb-24 pt-12 sm:px-6 sm:pt-20">
        <header>
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-accent">About {BRAND.name}</p>
          <h1 className="mt-4 text-[clamp(2.2rem,6vw,4rem)] font-semibold leading-[1] tracking-[-0.04em]">
            Software that <span className="font-display font-normal italic">belongs to you.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-fg-muted">
            {BRAND.name} is a portfolio studio with no back end. It is a set of static files: once loaded, the whole product — editor, renderer and every exporter — runs on your computer.
          </p>
        </header>

        <Block title="Philosophy">
          <div className="grid gap-6 sm:grid-cols-3">
            <Principle title="Own your work">A portfolio is a career document. It should be a file you keep, not a row in someone else’s database.</Principle>
            <Principle title="Write once">You describe your work a single time. Web page, PDF, Word document and website are views of the same data.</Principle>
            <Principle title="Quality by default">Semantic HTML, accessible colour, sensible motion and fast pages are the starting point — not a paid tier.</Principle>
          </div>
        </Block>

        <Block title="Privacy model">
          <ul className="grid gap-3 sm:grid-cols-2">
            <Fact icon={Lock} title="No accounts">There is nothing to sign up for and no identity to link your work to.</Fact>
            <Fact icon={CloudOff} title="No servers">Projects and images are stored in IndexedDB in this browser. Exports are generated locally and downloaded directly.</Fact>
            <Fact icon={ShieldCheck} title="No tracking">No analytics, cookies, fingerprinting or third-party scripts in the app.</Fact>
            <Fact icon={Braces} title="Open formats">Backups are plain JSON; exports are standard HTML, PDF and DOCX files that open anywhere.</Fact>
          </ul>
          <p className="mt-5 text-[13px] leading-relaxed text-fg-subtle">
            Two things touch the network only when you ask them to: exported pages may load web fonts if you choose “CDN fonts”, and links you add point wherever you point them. Share links carry the portfolio inside the URL fragment, which browsers never send to servers.
          </p>
        </Block>

        <Block title="How the Portfolio Engine works">
          <p className="max-w-2xl text-[14px] leading-relaxed text-fg-muted">
            A portfolio is one validated JSON document: metadata, a theme, and an ordered list of typed sections. The engine walks the {SECTION_TYPES.length} section definitions in its registry, applies the theme’s design tokens ({THEMES.length} built-in themes), sanitises every piece of user content, and produces each output from the same source.
          </p>
          <EngineDiagram />
        </Block>

        <Block title="Open-source credits">
          <p className="mb-5 text-[14px] text-fg-muted">{BRAND.name} stands on the work of these projects and their maintainers.</p>
          <ul className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
            {LIBRARIES.map((l) => (
              <li key={l.name} className="flex items-baseline justify-between gap-4 bg-panel px-4 py-3">
                <span className="text-[13.5px] font-medium">{l.name}</span>
                <span className="truncate text-right text-[12px] text-fg-subtle">
                  {l.role} · {l.license}
                </span>
              </li>
            ))}
          </ul>
        </Block>

        <Block title="Version">
          <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-8 gap-y-2 text-[13.5px]">
            <dt className="text-fg-subtle">Product</dt>
            <dd>{BRAND.name}</dd>
            <dt className="text-fg-subtle">Portfolio schema</dt>
            <dd className="font-mono">v{SCHEMA_VERSION}</dd>
            <dt className="text-fg-subtle">Backup format</dt>
            <dd className="font-mono">{BRAND.fileExtension}</dd>
          </dl>
        </Block>

        <div className="mt-16 flex flex-wrap items-center gap-3">
          <Link to="/new" className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-[14px] font-semibold text-accent-fg hover:bg-accent-strong">
            Create a portfolio
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link to="/templates" className="inline-flex h-11 items-center rounded-xl border border-line-strong px-5 text-[14px] hover:bg-hover">
            Browse templates
          </Link>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  const id = `about-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  return (
    <section aria-labelledby={id} className="mt-16 border-t border-line pt-10 sm:mt-20">
      <h2 id={id} className="mb-6 text-[22px] font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Principle({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="font-display text-[20px] italic">{title}</h3>
      <p className="mt-2 text-[13.5px] leading-relaxed text-fg-muted">{children}</p>
    </div>
  );
}

function Fact({ icon: Icon, title, children }: { icon: typeof Lock; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3 rounded-2xl border border-line bg-panel p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-elevated text-fg-muted">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span>
        <span className="block text-[14px] font-medium">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-relaxed text-fg-muted">{children}</span>
      </span>
    </li>
  );
}

const OUTPUTS = [
  { icon: Eye, label: 'Live preview', note: 'sandboxed iframe', color: 'var(--app-ok)' },
  { icon: FileCode2, label: 'HTML', note: 'single standalone file', color: '#f97316' },
  { icon: FileText, label: 'PDF', note: 'portfolio or résumé', color: '#ef4444' },
  { icon: FileType2, label: 'DOCX', note: 'editable Word document', color: '#3b82f6' },
  { icon: FileArchive, label: 'ZIP', note: 'deployable static site', color: '#a78bfa' },
];

function EngineDiagram() {
  return (
    <figure className="mt-8">
      <div className="grid items-center gap-3 md:grid-cols-[1fr_28px_1fr_28px_1.1fr]">
        <div className="rounded-2xl border border-line bg-panel p-4">
          <p className="flex items-center gap-2 text-[13px] font-semibold">
            <Braces className="size-4 text-accent" aria-hidden="true" /> Portfolio data
          </p>
          <pre className="mt-3 overflow-hidden rounded-lg bg-bg p-3 font-mono text-[11px] leading-relaxed text-fg-muted" aria-hidden="true">
            {`{
  "version": "${SCHEMA_VERSION}",
  "metadata": { … },
  "theme": { … },
  "sections": [
    { "type": "hero", … },
    { "type": "projects", … }
  ]
}`}
          </pre>
        </div>
        <Arrow />
        <div className="rounded-2xl border border-accent/40 bg-accent-soft p-4">
          <p className="flex items-center gap-2 text-[13px] font-semibold">
            <Cpu className="size-4 text-accent" aria-hidden="true" /> Portfolio Engine
          </p>
          <ol className="mt-3 space-y-1.5 text-[12.5px] text-fg-muted">
            <li>1 · Validate & migrate schema</li>
            <li>2 · Resolve theme tokens</li>
            <li>3 · Render each section</li>
            <li>4 · Sanitise & escape content</li>
            <li>5 · Bundle images & fonts</li>
          </ol>
        </div>
        <Arrow />
        <ul className="grid gap-2">
          {OUTPUTS.map((o) => (
            <li key={o.label} className="flex items-center gap-3 rounded-xl border border-line bg-panel px-3 py-2">
              <o.icon className="size-4 shrink-0" style={{ color: o.color }} aria-hidden="true" />
              <span className="text-[13px] font-medium">{o.label}</span>
              <span className="ml-auto truncate text-[11.5px] text-fg-subtle">{o.note}</span>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="mt-4 text-[12.5px] text-fg-subtle">One data model flows through one engine into five outputs — so they can never disagree with each other.</figcaption>
    </figure>
  );
}

function Arrow() {
  return (
    <div aria-hidden="true" className="flex justify-center text-fg-subtle">
      <ArrowRight className="size-4 rotate-90 md:rotate-0" />
    </div>
  );
}
