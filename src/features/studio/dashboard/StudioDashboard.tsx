import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Briefcase, DatabaseBackup, FileStack, FileText, GitCompare, Globe, HardDrive, LayoutTemplate, ListChecks, Lock, MessagesSquare, Package, Plus, ScanText, ShieldCheck, Sparkles, Target, UploadCloud, UserRound, UserSquare } from 'lucide-react';
import { Truncate } from 'dead-lock-react-lib';
import { SiteHeader } from '@/components/SiteHeader';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/misc';
import { BRAND } from '@/config/brand';
import { RESUME_TEMPLATE_COUNT } from '@/studio/templates/count';
import { listProjects, type ProjectSummary } from '@/lib/storage/projects';
import { listDocuments, listResumes, type StudioSummary } from '@/studio/storage/repo';
import { listDocs } from '@/knowledge/storage/repo';
import { ensureWorkspace, useWorkspace } from '@/studio/store/workspace';
import { useImageUrls } from '@/studio/images/service';
import { timeAgo } from '@/utils/format';
import type { Profile } from '@/studio/model/types';
import { cn } from '@/utils/cn';

const CAREER_TOOLS: Array<{ to: string; title: string; body: string; icon: ReactNode }> = [
  { to: '/applications', title: 'Applications', body: 'Track every application from wishlist to offer.', icon: <Briefcase className="size-4" /> },
  { to: '/match', title: 'Job match', body: 'Compare a resume with a job description.', icon: <Target className="size-4" /> },
  { to: '/bullets', title: 'Bullet helper', body: 'Find weak verbs, missing metrics and long lines.', icon: <ListChecks className="size-4" /> },
  { to: '/interview', title: 'Interview prep', body: 'Practise questions built from your experience.', icon: <MessagesSquare className="size-4" /> },
  { to: '/compare', title: 'Compare resumes', body: 'See what differs between two versions.', icon: <GitCompare className="size-4" /> },
  { to: '/linkedin', title: 'LinkedIn copy', body: 'Headline, About and experience, sized to fit.', icon: <UserSquare className="size-4" /> },
  { to: '/assistant', title: 'AI assistant', body: 'Optional, with your own API key.', icon: <Sparkles className="size-4" /> },
  { to: '/backup', title: 'Backup & sync', body: 'Everything in one file or a synced folder.', icon: <DatabaseBackup className="size-4" /> },
];

/** The export pipeline behind the pack is large; load it when the dialog opens. */
const ApplicationPackDialog = lazy(() => import('../pack/ApplicationPackDialog').then((m) => ({ default: m.ApplicationPackDialog })));

export function profileCompleteness(p: Profile): { score: number; missing: string[] } {
  const checks: Array<[boolean, string]> = [
    [!!p.name.trim(), 'name'],
    [!!p.headline.trim(), 'headline'],
    [p.bio.trim().split(/\s+/).length >= 12, 'bio'],
    [/@/.test(p.email), 'email'],
    [!!p.phone?.trim(), 'phone'],
    [!!p.location?.trim(), 'location'],
    [!!p.website?.trim() || p.socialLinks.length > 0, 'links'],
    [!!p.profileImage, 'photo'],
  ];
  return { score: Math.round((checks.filter((c) => c[0]).length / checks.length) * 100), missing: checks.filter((c) => !c[0]).map((c) => c[1]) };
}

interface Recent {
  id: string;
  name: string;
  updatedAt: string;
  kind: 'portfolio' | 'resume' | 'document';
  to: string;
  detail: string;
}

function StudioCard({ to, icon, title, tagline, body, accent, stat, actions }: { to: string; icon: ReactNode; title: string; tagline: string; body: string; accent: string; stat: ReactNode; actions: ReactNode }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-panel p-6 transition hover:border-line-strong">
      <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full opacity-20 blur-3xl transition group-hover:opacity-35" style={{ background: accent }} aria-hidden="true" />
      <div className="flex items-start justify-between gap-4">
        <span className="grid size-11 place-items-center rounded-2xl border border-line bg-elevated" style={{ color: accent }}>
          {icon}
        </span>
        <span className="text-right text-[12px] text-fg-subtle">{stat}</span>
      </div>
      <h2 className="mt-5 text-[19px] font-semibold tracking-tight">
        <Link to={to} className="after:absolute after:inset-0 after:content-['']">
          {title}
        </Link>
      </h2>
      <p className="mt-1 text-[13.5px] font-medium text-fg">{tagline}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">{body}</p>
      <div className="relative z-10 mt-6 flex flex-wrap items-center gap-2">{actions}</div>
    </article>
  );
}

export default function StudioDashboard() {
  const navigate = useNavigate();
  const profile = useWorkspace((s) => s.profile);
  const library = useWorkspace((s) => s.library);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [resumes, setResumes] = useState<StudioSummary[]>([]);
  const [docs, setDocs] = useState<StudioSummary[]>([]);
  const [pack, setPack] = useState(false);
  const [knowledge, setKnowledge] = useState(0);
  const avatarKey = profile.profileImage ? `profile:${profile.profileImage.usage.portfolio}:circle` : '';
  const avatar = useImageUrls(avatarKey ? [avatarKey] : []);

  useEffect(() => {
    void ensureWorkspace();
    void listDocs()
      .then((k) => setKnowledge(k.length))
      .catch(() => {});
    void Promise.all([listProjects().catch(() => []), listResumes().catch(() => []), listDocuments().catch(() => [])]).then(([p, r, d]) => {
      setProjects(p);
      setResumes(r);
      setDocs(d);
    });
  }, []);

  const completeness = profileCompleteness(profile);
  const recent = useMemo<Recent[]>(
    () =>
      [
        ...projects.map((p) => ({ id: p.id, name: p.name, updatedAt: p.updatedAt, kind: 'portfolio' as const, to: `/builder/${p.id}`, detail: `Portfolio · ${p.themeName}` })),
        ...resumes.map((r) => ({ id: r.id, name: r.name, updatedAt: r.updatedAt, kind: 'resume' as const, to: `/resume/${r.id}`, detail: r.kind === 'cv' ? 'CV' : 'Resume' })),
        ...docs.map((d) => ({ id: d.id, name: d.name, updatedAt: d.updatedAt, kind: 'document' as const, to: `/document/${d.id}`, detail: d.kind === 'cover-letter' ? 'Cover letter' : 'Document' })),
      ]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 6),
    [projects, resumes, docs],
  );

  return (
    <div className="flex min-h-full flex-col bg-bg text-fg">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-fg-subtle">{BRAND.name}</p>
            <h1 className="mt-2 text-[clamp(2rem,5vw,3rem)] font-semibold leading-[1.05] tracking-[-0.035em]">
              One identity. <span className="font-display font-normal italic">Every format.</span>
            </h1>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-fg-muted">Build your website, resumes and printable documents from the same profile — entirely in your browser.</p>
          </div>
          <Link to="/profile" className="flex min-w-[260px] items-center gap-3 rounded-2xl border border-line bg-panel p-3 pr-4 hover:border-line-strong">
            <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-elevated text-fg-subtle">{avatar(avatarKey) ? <img src={avatar(avatarKey)} alt="" className="size-full object-cover" /> : <UserRound className="size-5" />}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold">{profile.name || 'Set up your profile'}</span>
              <span className="block truncate text-[11.5px] text-fg-subtle">{profile.headline || 'Name, headline, contact, photo'}</span>
              <ProgressBar value={completeness.score} className="mt-1.5 h-1" label="Profile completeness" />
            </span>
            <span className="font-mono text-[11px] text-fg-subtle">{completeness.score}%</span>
          </Link>
        </header>

        <section className="mt-10 grid gap-5 md:grid-cols-2" aria-label="Studios">
          <StudioCard
            to="/projects"
            icon={<Globe className="size-5" />}
            title="Portfolio Studio"
            tagline="Create and publish your website"
            body="Drag-and-drop sections, 12 themes, live preview — export standalone HTML or a deploy-ready ZIP."
            accent="#8b7cff"
            stat={`${projects.length} portfolio${projects.length === 1 ? '' : 's'}`}
            actions={
              <>
                <Button size="sm" variant="primary" iconRight={<ArrowRight className="size-3.5" />} onClick={() => navigate('/projects')}>
                  Open
                </Button>
                <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => navigate('/new')}>
                  New portfolio
                </Button>
              </>
            }
          />
          <StudioCard
            to="/resumes"
            icon={<FileText className="size-5" />}
            title="Resume Studio"
            tagline="Build professional resumes and CVs"
            body={`${RESUME_TEMPLATE_COUNT} templates, real pagination, fit-to-one-page, ATS checks — export vector PDF, editable DOCX, TXT and JSON.`}
            accent="#3ecf8e"
            stat={`${resumes.length} version${resumes.length === 1 ? '' : 's'}`}
            actions={
              <>
                <Button size="sm" variant="primary" iconRight={<ArrowRight className="size-3.5" />} onClick={() => navigate('/resumes')}>
                  Open
                </Button>
                <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => navigate('/resumes/new')}>
                  New resume
                </Button>
              </>
            }
          />
          <StudioCard
            to="/documents"
            icon={<FileStack className="size-5" />}
            title="Document Studio"
            tagline="Create printable documents"
            body="Cover letters, case studies, proposals, reports and presentation PDFs built from blocks on real paper pages."
            accent="#f5b455"
            stat={`${docs.length} document${docs.length === 1 ? '' : 's'}`}
            actions={
              <Button size="sm" variant="primary" iconRight={<ArrowRight className="size-3.5" />} onClick={() => navigate('/documents')}>
                Open
              </Button>
            }
          />
          <StudioCard
            to="/profile"
            icon={<UserRound className="size-5" />}
            title="Profile Studio"
            tagline="Manage your identity and profile image"
            body="Crop, adjust and shape your photo, create variants for each context, and keep contact details in one place."
            accent="#ff8fb1"
            stat={`${completeness.score}% complete`}
            actions={
              <Button size="sm" variant="primary" iconRight={<ArrowRight className="size-3.5" />} onClick={() => navigate('/profile')}>
                Open
              </Button>
            }
          />
          <div className="md:col-span-2">
            <StudioCard
              to="/knowledge"
              icon={<ScanText className="size-5" />}
              title="Extract Your Data"
              tagline="Import PDFs and turn them into reusable structured data"
              body="Extract text, tables, links and metadata locally (OCR for scans), review the detected profile, experience, projects and skills, then reuse them in every portfolio, resume and document. Nothing is uploaded."
              accent="#5ab0ff"
              stat={`${knowledge} document${knowledge === 1 ? '' : 's'}`}
              actions={
                <>
                  <Button size="sm" variant="primary" icon={<UploadCloud className="size-3.5" />} onClick={() => navigate('/knowledge')}>
                    Upload PDF
                  </Button>
                  <Button size="sm" iconRight={<ArrowRight className="size-3.5" />} onClick={() => navigate('/knowledge')}>
                    Open library
                  </Button>
                </>
              }
            />
          </div>
        </section>

        <section className="mt-10" aria-labelledby="career-tools">
          <h2 id="career-tools" className="text-[14px] font-semibold">
            Career tools
          </h2>
          <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {CAREER_TOOLS.map((t) => (
              <li key={t.to}>
                <Link to={t.to} className="group flex h-full items-start gap-3 rounded-2xl border border-line bg-panel p-3.5 hover:border-line-strong hover:bg-hover">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-elevated text-fg-muted group-hover:text-accent">{t.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium">{t.title}</span>
                    <span className="mt-0.5 block text-[11.5px] leading-snug text-fg-subtle">{t.body}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-3xl border border-line bg-panel p-5">
            <h2 className="text-[14px] font-semibold">Recent work</h2>
            {recent.length ? (
              <ul className="mt-3 divide-y divide-line">
                {recent.map((r) => (
                  <li key={`${r.kind}-${r.id}`}>
                    <Link to={r.to} className="flex items-center gap-3 py-2.5 hover:text-fg">
                      <span className={cn('grid size-8 place-items-center rounded-lg border border-line bg-elevated', r.kind === 'portfolio' ? 'text-[#8b7cff]' : r.kind === 'resume' ? 'text-[#3ecf8e]' : 'text-[#f5b455]')}>
                        {r.kind === 'portfolio' ? <LayoutTemplate className="size-4" /> : r.kind === 'resume' ? <FileText className="size-4" /> : <FileStack className="size-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <Truncate disableClickExpand className="text-[13px] font-medium" style={{ display: 'block', maxWidth: '100%' }}>
                          {r.name}
                        </Truncate>
                        <span className="block text-[11.5px] text-fg-subtle">{r.detail}</span>
                      </span>
                      <span className="text-[11.5px] text-fg-subtle">{timeAgo(r.updatedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[13px] text-fg-muted">Nothing yet — open any studio to start.</p>
            )}
          </div>
          <div className="flex flex-col gap-5">
            <div className="rounded-3xl border border-line bg-panel p-5">
              <h2 className="flex items-center gap-2 text-[14px] font-semibold">
                <Package className="size-4 text-accent" /> Application pack
              </h2>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-muted">Resume (PDF + DOCX), cover letter (PDF + DOCX) and your portfolio as standalone HTML — in one ZIP.</p>
              <Button className="mt-4" size="sm" variant="primary" icon={<Package className="size-3.5" />} onClick={() => setPack(true)}>
                Export application pack
              </Button>
            </div>
            <div className="rounded-3xl border border-line bg-panel p-5">
              <h2 className="text-[14px] font-semibold">Shared library</h2>
              <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
                {[
                  ['Roles', library.experience.length],
                  ['Projects', library.projects.length],
                  ['Skills', library.skills.length],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-bg py-2.5">
                    <dt className="text-[11px] text-fg-subtle">{k}</dt>
                    <dd className="text-[18px] font-semibold tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-[11.5px] leading-snug text-fg-subtle">Edit a project once — linked portfolios, every resume and your PDFs update.</p>
            </div>
          </div>
        </section>

        <section className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-line bg-panel px-5 py-4 text-[12.5px] text-fg-muted">
          <span className="inline-flex items-center gap-2 font-medium text-fg">
            <ShieldCheck className="size-4 text-ok" /> Your data stays on this device.
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Lock className="size-3.5" /> No account, no upload endpoint
          </span>
          <span className="inline-flex items-center gap-1.5">
            <HardDrive className="size-3.5" /> Stored in this browser (IndexedDB)
          </span>
          <Link to="/settings" className="ml-auto text-accent hover:underline">
            Storage &amp; backups →
          </Link>
        </section>
      </main>
      {pack && (
        <Suspense fallback={null}>
          <ApplicationPackDialog open onClose={() => setPack(false)} />
        </Suspense>
      )}
    </div>
  );
}
