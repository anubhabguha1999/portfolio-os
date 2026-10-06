import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Briefcase,
  DatabaseBackup,
  FileStack,
  FileText,
  FolderSearch,
  GitCompare,
  Globe,
  Info,
  LayoutDashboard,
  LayoutTemplate,
  ListChecks,
  MessagesSquare,
  Plus,
  ScanText,
  ScrollText,
  Search,
  Settings,
  Sparkles,
  Target,
  UserRound,
  UserSquare,
} from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { Kbd } from '@/components/ui/misc';
import { modKey } from '@/utils/download';

interface Feature {
  to: string;
  title: string;
  body: string;
  keywords: string;
  icon: ReactNode;
}

/** Every feature, grouped the way it is shown before anything is typed. */
const SECTIONS: Array<{ title: string; blurb: string; accent: string; features: Feature[] }> = [
  {
    title: 'Studios',
    blurb: 'Build your website, resumes and documents from one profile.',
    accent: '#8b7cff',
    features: [
      { to: '/projects', title: 'Portfolio Studio', body: 'Drag-and-drop sections, themes and live preview. Export HTML or a deploy-ready site.', keywords: 'portfolios projects sites websites builder', icon: <Globe /> },
      { to: '/new', title: 'New portfolio', body: 'Start blank, from a template or from an import.', keywords: 'create start blank template import', icon: <Plus /> },
      { to: '/resumes', title: 'Resume Studio', body: 'Print-grade templates, real pagination and ATS checks. Export PDF, DOCX, TXT and JSON.', keywords: 'resumes cv ats', icon: <ScrollText /> },
      { to: '/resumes/new', title: 'New resume', body: 'Pick a template and start from your profile, a file or example content.', keywords: 'create cv template', icon: <Plus /> },
      { to: '/documents', title: 'Document Studio', body: 'Cover letters, case studies, proposals and reports on real paper pages.', keywords: 'cover letter letters proposal report pdf', icon: <FileStack /> },
      { to: '/profile', title: 'Profile Studio', body: 'Your identity, photo variants and contact details in one place.', keywords: 'identity photo me contact', icon: <UserRound /> },
      { to: '/templates', title: 'Templates', body: 'Portfolio designs for developers, designers, writers and more.', keywords: 'themes gallery designs', icon: <LayoutTemplate /> },
    ],
  },
  {
    title: 'Your data',
    blurb: 'Bring in what you already have, and keep it safe.',
    accent: '#3ecf8e',
    features: [
      { to: '/knowledge', title: 'Extract Your Data', body: 'Pull text and details out of PDFs, images and files, with OCR.', keywords: 'knowledge pdf import files upload ocr extract', icon: <ScanText /> },
      { to: '/backup', title: 'Backup & sync', body: 'Everything in one file or a synced folder.', keywords: 'export restore sync folder', icon: <DatabaseBackup /> },
    ],
  },
  {
    title: 'Career tools',
    blurb: 'Tailor, check and track every application.',
    accent: '#f5b455',
    features: [
      { to: '/applications', title: 'Applications', body: 'Track every application from wishlist to offer.', keywords: 'jobs tracker kanban pipeline', icon: <Briefcase /> },
      { to: '/match', title: 'Job match', body: 'Compare a resume with a job description.', keywords: 'job description keywords score', icon: <Target /> },
      { to: '/bullets', title: 'Bullet helper', body: 'Find weak verbs, missing metrics and long lines.', keywords: 'bullets verbs metrics writing', icon: <ListChecks /> },
      { to: '/interview', title: 'Interview prep', body: 'Practise questions built from your experience.', keywords: 'questions practice star', icon: <MessagesSquare /> },
      { to: '/compare', title: 'Compare resumes', body: 'See what differs between two versions.', keywords: 'diff versions', icon: <GitCompare /> },
      { to: '/linkedin', title: 'LinkedIn copy', body: 'Headline, About and experience, sized to fit.', keywords: 'linkedin headline about', icon: <UserSquare /> },
      { to: '/assistant', title: 'AI assistant', body: 'Optional, with your own API key.', keywords: 'ai chat llm write', icon: <Sparkles /> },
    ],
  },
  {
    title: 'App',
    blurb: 'Your workspace and how it behaves.',
    accent: '#ff8fb1',
    features: [
      { to: '/studio', title: 'Dashboard', body: 'Your portfolios, resumes and documents in one place.', keywords: 'home studio overview recent', icon: <LayoutDashboard /> },
      { to: '/settings', title: 'Settings', body: 'Theme, storage and app preferences.', keywords: 'preferences theme storage data', icon: <Settings /> },
      { to: '/about', title: 'About', body: 'How Portfolio OS works and keeps your data private.', keywords: 'info privacy', icon: <Info /> },
    ],
  },
];

interface Item {
  id: string;
  label: string;
  group: string;
  keywords: string;
  to: string;
}

const ITEM_ICONS: Record<string, ReactNode> = {
  Portfolios: <Globe />,
  Resumes: <ScrollText />,
  Documents: <FileText />,
  'Extracted files': <FolderSearch />,
  Templates: <LayoutTemplate />,
};

/** Everything stored on this device. */
async function loadItems(): Promise<Item[]> {
  const [{ listProjects }, studio, { listDocs }, { TEMPLATES }] = await Promise.all([
    import('@/lib/storage/projects'),
    import('@/studio/storage/repo'),
    import('@/knowledge/storage/repo'),
    import('@/templates'),
  ]);
  const settle = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]);
  const [projects, resumes, documents, kdocs] = await Promise.all([settle(listProjects()), settle(studio.listResumes()), settle(studio.listDocuments()), settle(listDocs())]);
  return [
    ...projects.map((p) => ({ id: `p-${p.id}`, label: p.name, group: 'Portfolios', keywords: `${p.headline} ${p.themeName}`, to: `/builder/${p.id}` })),
    ...resumes.map((r) => ({ id: `r-${r.id}`, label: r.name, group: 'Resumes', keywords: `${r.kind} ${r.templateId}`, to: `/resume/${r.id}` })),
    ...documents.map((d) => ({ id: `d-${d.id}`, label: d.name, group: 'Documents', keywords: `${d.kind} ${d.templateId}`, to: `/document/${d.id}` })),
    ...kdocs.map((k) => ({ id: `k-${k.id}`, label: k.name, group: 'Extracted files', keywords: `${k.docType} ${k.folder} ${k.tags.join(' ')}`, to: `/knowledge/${k.id}` })),
    ...TEMPLATES.map((t) => ({ id: `t-${t.id}`, label: t.name, group: 'Templates', keywords: `${t.description} ${t.audience} ${t.tags.join(' ')}`, to: `/templates?t=${t.id}` })),
  ];
}

/** Every word of the query must appear somewhere in the text. */
function matches(text: string, terms: string[]): boolean {
  const hay = text.toLowerCase();
  return terms.every((t) => hay.includes(t));
}

function FeatureCard({ feature, accent }: { feature: Feature; accent: string }) {
  return (
    <Link to={feature.to} className="group flex items-start gap-3 rounded-2xl border border-line bg-panel p-4 transition hover:border-line-strong hover:bg-hover">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-elevated [&>svg]:size-4" style={{ color: accent }}>
        {feature.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[14px] font-semibold">
          {feature.title}
          <ArrowRight className="size-3.5 -translate-x-1 text-fg-subtle opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" aria-hidden="true" />
        </span>
        <span className="mt-0.5 block text-[12.5px] leading-relaxed text-fg-muted">{feature.body}</span>
      </span>
    </Link>
  );
}

/** Search page: shows every feature up front, then narrows to features and saved work as you type. */
export default function SearchPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const [items, setItems] = useState<Item[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    void loadItems().then((next) => alive && setItems(next));
    return () => {
      alive = false;
    };
  }, []);

  const setQuery = (q: string) => setParams(q ? { q } : {}, { replace: true });
  const terms = useMemo(() => query.toLowerCase().split(/\s+/).filter(Boolean), [query]);

  const sections = useMemo(
    () =>
      SECTIONS.map((s) => ({ ...s, features: terms.length ? s.features.filter((f) => matches(`${f.title} ${f.body} ${f.keywords} ${s.title}`, terms)) : s.features })).filter(
        (s) => s.features.length,
      ),
    [terms],
  );

  const groups = useMemo(() => {
    if (!terms.length) return [];
    const byGroup = new Map<string, Item[]>();
    for (const it of items) {
      if (!matches(`${it.label} ${it.keywords} ${it.group}`, terms)) continue;
      byGroup.set(it.group, [...(byGroup.get(it.group) ?? []), it]);
    }
    return [...byGroup];
  }, [items, terms]);

  const saved = items.filter((it) => it.group !== 'Templates').length;
  const first = sections[0]?.features[0]?.to ?? groups[0]?.[1][0]?.to;
  const empty = terms.length > 0 && !sections.length && !groups.length;

  return (
    <div className="flex min-h-full flex-col bg-bg text-fg">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <header>
          <h1 className="text-[clamp(2rem,5vw,3rem)] font-semibold leading-[1.05] tracking-[-0.035em]">
            Everything, <span className="font-display font-normal italic">in one place.</span>
          </h1>
          <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-fg-muted">Browse every tool in Portfolio OS, or type to find a feature, portfolio, resume, document, extracted file or template.</p>
          <form
            role="search"
            className="mt-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (first) void navigate(first);
            }}
          >
            <label className="flex h-14 items-center gap-3 rounded-2xl border border-line bg-panel px-4 shadow-sm focus-within:border-accent">
              <Search className="size-5 shrink-0 text-fg-subtle" aria-hidden="true" />
              <input
                ref={inputRef}
                id="site-search"
                type="search"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && query) {
                    e.preventDefault();
                    setQuery('');
                  }
                }}
                placeholder="Search features, portfolios, resumes, documents…"
                aria-label="Search"
                className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-fg-subtle"
              />
              <Kbd className="hidden sm:inline-flex">{modKey}K</Kbd>
            </label>
          </form>
          {!terms.length && saved > 0 && (
            <p className="mt-2 text-[12px] text-fg-subtle">
              Also searches your {saved} saved item{saved === 1 ? '' : 's'}.
            </p>
          )}
        </header>

        {groups.length > 0 && (
          <section className="mt-10" aria-label="Your work">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-fg-subtle">Your work & templates</h2>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              {groups.map(([group, list]) => (
                <div key={group}>
                  <h3 className="text-[13px] font-semibold">
                    {group} <span className="font-normal text-fg-subtle">{list.length}</span>
                  </h3>
                  <ul className="mt-2 grid gap-1">
                    {list.slice(0, 8).map((it) => (
                      <li key={it.id}>
                        <Link to={it.to} className="flex h-10 items-center gap-3 rounded-lg px-3 text-[13.5px] text-fg-muted hover:bg-hover hover:text-fg [&>svg]:size-4 [&>svg]:shrink-0">
                          {ITEM_ICONS[group]}
                          <span className="truncate">{it.label || 'Untitled'}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {sections.map((s) => (
          <section key={s.title} className="mt-10" aria-label={s.title}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-fg-subtle">{s.title}</h2>
              {!terms.length && <p className="text-[12.5px] text-fg-subtle">{s.blurb}</p>}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {s.features.map((f) => (
                <FeatureCard key={f.to} feature={f} accent={s.accent} />
              ))}
            </div>
          </section>
        ))}

        {empty && (
          <div className="mt-16 text-center">
            <p className="text-[15px] font-medium">Nothing matches “{query}”</p>
            <button type="button" onClick={() => (setQuery(''), inputRef.current?.focus())} className="mt-2 text-[13px] text-accent hover:underline">
              Show everything
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
