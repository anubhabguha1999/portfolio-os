import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Download, ExternalLink, KeyRound, Rocket, ShieldCheck, TriangleAlert, Unplug } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { Button, Spinner } from '@/components/ui/Button';
import { Badge, EmptyState, ProgressBar, SectionLabel } from '@/components/ui/misc';
import { Switch, TextInput } from '@/components/ui/Field';
import { useProject } from '@/hooks/useProject';
import { useAutosave } from '@/hooks/useAutosave';
import { useEditor } from '@/stores/editor';
import { toast } from '@/stores/ui';
import { BRAND } from '@/config/brand';
import { exportZip } from '@/lib/export';
import { defaultOptions } from '@/features/export/model';
import {
  deploy,
  defaultSiteName,
  loadRecords,
  loadTokens,
  saveRecord,
  saveToken,
  siteFiles,
  siteSlug,
  verifyToken,
  DeployError,
  type DeployProvider,
  type DeployRecords,
  type DeployResult,
} from '@/lib/deploy';
import { copyText, downloadBlob } from '@/utils/download';
import { formatBytes, timeAgo } from '@/utils/format';
import { cn } from '@/utils/cn';
import { expectedUrl, isDeployTab, MANUAL_INFO, PROVIDER_INFO, TABS, type DeployTab } from './providers';

export default function DeployPage() {
  const { projectId } = useParams();
  const state = useProject(projectId);
  if (state.status === 'loading')
    return (
      <div className="grid min-h-dvh place-items-center bg-bg text-fg-subtle" role="status" aria-label="Loading project">
        <Spinner className="size-5" />
      </div>
    );
  if (state.status !== 'ready')
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-4">
        <EmptyState
          icon={<TriangleAlert className="size-5" />}
          title="Project not found"
          description="It may have been deleted, or it was created in another browser."
          action={
            <Link to="/projects" className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-[13px] font-semibold text-accent-fg hover:bg-accent-strong">
              <ArrowLeft className="size-4" /> Back to projects
            </Link>
          }
        />
      </div>
    );
  return <Deploy key={projectId} projectId={projectId!} />;
}

type Job = { status: 'running'; stage: string; progress: number } | { status: 'done'; result: DeployResult; warnings: string[] } | { status: 'error'; message: string };

function Deploy({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const portfolio = useEditor((s) => s.portfolio)!;
  const projectName = useEditor((s) => s.projectName);
  const updateMetadata = useEditor((s) => s.updateMetadata);
  useAutosave();

  const [params, setParams] = useSearchParams();
  const initialTab = params.get('to');
  const [tab, setTabState] = useState<DeployTab>(isDeployTab(initialTab) ? initialTab : 'netlify');
  const setTab = (t: DeployTab) => {
    setTabState(t);
    setParams((p) => {
      p.set('to', t);
      return p;
    }, { replace: true });
  };

  const [tokens, setTokens] = useState<Partial<Record<DeployProvider, string>>>({});
  const [remember, setRemember] = useState<Partial<Record<DeployProvider, boolean>>>({});
  const [accounts, setAccounts] = useState<Partial<Record<DeployProvider, string>>>({});
  const [records, setRecords] = useState<DeployRecords>({});
  const [names, setNames] = useState<Partial<Record<DeployProvider, string>>>({});
  const [teamId, setTeamId] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    document.title = `Deploy${projectName ? ` · ${projectName}` : ''} — ${BRAND.name}`;
  }, [projectName]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadTokens(), loadRecords(projectId)]).then(([saved, recs]) => {
      if (cancelled) return;
      setTokens(saved);
      setRemember(Object.fromEntries(Object.keys(saved).map((k) => [k, true])));
      setRecords(recs);
      const fallback = defaultSiteName(portfolio, projectName);
      setNames({ netlify: recs.netlify?.name ?? fallback, vercel: recs.vercel?.name ?? fallback, github: recs.github?.name ?? fallback });
    });
    return () => {
      cancelled = true;
      abort.current?.abort();
    };
    // Defaults are taken once, when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const running = job?.status === 'running';

  const switchTab = (t: DeployTab) => {
    if (running) return;
    setJob(null);
    setTab(t);
  };

  async function connect(provider: DeployProvider): Promise<string | null> {
    const token = tokens[provider]?.trim();
    if (!token) {
      setJob({ status: 'error', message: `Paste your ${PROVIDER_INFO[provider].label} token first.` });
      return null;
    }
    setVerifying(true);
    try {
      const account = await verifyToken(provider, { token });
      setAccounts((a) => ({ ...a, [provider]: account }));
      await saveToken(provider, remember[provider] ? token : null);
      return account;
    } catch (err) {
      setJob({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      return null;
    } finally {
      setVerifying(false);
    }
  }

  async function forget(provider: DeployProvider) {
    await saveToken(provider, null);
    setTokens((t) => ({ ...t, [provider]: '' }));
    setAccounts((a) => ({ ...a, [provider]: undefined }));
    setRemember((r) => ({ ...r, [provider]: false }));
    toast({ title: `${PROVIDER_INFO[provider].label} token removed from this device` });
  }

  async function run(provider: DeployProvider) {
    setJob(null);
    const account = accounts[provider] ?? (await connect(provider));
    if (!account) return;
    const token = tokens[provider]!.trim();
    const raw = (names[provider] ?? '').trim();
    const name = provider === 'github' ? raw : raw ? siteSlug(raw) : '';
    if (provider !== 'netlify' && !name) {
      setJob({ status: 'error', message: `Enter a ${PROVIDER_INFO[provider].nameLabel.toLowerCase()}.` });
      return;
    }
    if (name !== raw) setNames((n) => ({ ...n, [provider]: name }));

    const ctrl = new AbortController();
    abort.current = ctrl;
    setJob({ status: 'running', stage: 'Building website…', progress: 0.02 });
    try {
      const { files, warnings } = await siteFiles(portfolio, provider);
      const previous = records[provider];
      const result = await deploy(files, { provider, name, ...(teamId.trim() ? { teamId: teamId.trim() } : {}), ...(previous ? { previous } : {}) }, {
        token,
        signal: ctrl.signal,
        onStage: (stage, progress) => setJob({ status: 'running', stage, progress }),
      });
      const { pending: _pending, ...record } = result;
      setRecords(await saveRecord(projectId, provider, record));
      setJob({ status: 'done', result, warnings });
      toast({ tone: 'success', title: result.pending ? 'Uploaded — going live shortly' : 'Your site is live', description: result.url });
    } catch (err) {
      setJob({ status: 'error', message: err instanceof DeployError || err instanceof Error ? err.message : String(err) });
    } finally {
      if (abort.current === ctrl) abort.current = null;
    }
  }

  const [zipping, setZipping] = useState(false);
  async function downloadZip() {
    setZipping(true);
    try {
      const res = await exportZip(portfolio, { ...defaultOptions(portfolio).zip, includeProjectJson: false });
      downloadBlob(res.blob, res.filename);
      toast({ tone: 'success', title: 'Website ZIP downloaded', description: `${res.filename} · ${formatBytes(res.blob.size)}` });
    } catch (err) {
      toast({ tone: 'error', title: 'The ZIP could not be built', description: err instanceof Error ? err.message : String(err) });
    } finally {
      setZipping(false);
    }
  }

  const siteUrl = portfolio.metadata.siteUrl.trim().replace(/\/+$/, '');

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-panel px-2 sm:px-3">
        <Link to="/projects" className="rounded-md p-1 hover:bg-hover" aria-label="All projects">
          <LogoMark className="size-6" />
        </Link>
        <span className="text-fg-subtle" aria-hidden="true">
          /
        </span>
        <p className="min-w-0 truncate text-[13px] font-medium" title={projectName}>
          {projectName}
        </p>
        <Badge tone="accent" className="max-sm:hidden!">
          Deploy
        </Badge>
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" icon={<Download className="size-4" />} onClick={() => navigate(`/export/${projectId}?format=zip`)} aria-label="Export Studio">
            <span className="hidden sm:inline">Export Studio</span>
          </Button>
          <Button size="sm" variant="secondary" icon={<ArrowLeft className="size-4" />} onClick={() => navigate(`/builder/${projectId}`)} aria-label="Back to builder">
            <span className="hidden sm:inline">Back to builder</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-10">
        <h1 className="text-[22px] font-semibold tracking-tight">Put your portfolio online</h1>
        <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-fg-muted">
          Publish the static website straight from your browser to a free host. You use your own access token, and it is sent only to that host. {BRAND.name} has no server in between.
        </p>

        <nav aria-label="Hosts" className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TABS.map((t) => {
            const info = t === 'manual' ? MANUAL_INFO : PROVIDER_INFO[t];
            const Icon = info.icon;
            const active = t === tab;
            const live = t !== 'manual' ? records[t] : undefined;
            return (
              <button
                key={t}
                type="button"
                aria-current={active ? 'page' : undefined}
                disabled={running && !active}
                onClick={() => switchTab(t)}
                className={cn('group flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-50', active ? 'border-line-strong bg-elevated' : 'border-line bg-panel hover:bg-hover')}
              >
                <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg border', active ? 'border-accent/30 bg-accent-soft text-accent' : 'border-line bg-bg text-fg-muted group-hover:text-fg')}>
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-[13px] font-medium">
                    {info.label}
                    {live && <span className="size-1.5 rounded-full bg-ok" title="Deployed" />}
                  </span>
                  <span className="block truncate text-[11.5px] text-fg-subtle">{info.description}</span>
                </span>
              </button>
            );
          })}
        </nav>

        {tab === 'manual' ? (
          <ManualPanel zipping={zipping} onDownload={() => void downloadZip()} />
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section className="space-y-6 rounded-[var(--radius-panel)] border border-line bg-panel p-5" aria-label={`${PROVIDER_INFO[tab].label} settings`}>
              <div className="space-y-3">
                <SectionLabel
                  action={
                    accounts[tab] ? (
                      <Badge tone="ok">
                        <Check className="size-3" aria-hidden="true" /> {accounts[tab]}
                      </Badge>
                    ) : null
                  }
                >
                  1 · Access token
                </SectionLabel>
                <div className="flex items-end gap-2">
                  <TextInput
                    className="min-w-0 flex-1"
                    label={`${PROVIDER_INFO[tab].label} token`}
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Paste your personal access token"
                    value={tokens[tab] ?? ''}
                    disabled={running}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTokens((t) => ({ ...t, [tab]: v }));
                      setAccounts((a) => ({ ...a, [tab]: undefined }));
                    }}
                  />
                  <Button variant="secondary" icon={<KeyRound className="size-4" />} loading={verifying} disabled={running || !tokens[tab]?.trim()} onClick={() => void connect(tab)}>
                    Connect
                  </Button>
                </div>
                <Switch
                  checked={!!remember[tab]}
                  disabled={running}
                  onChange={(v) => {
                    setRemember((r) => ({ ...r, [tab]: v }));
                    const token = tokens[tab]?.trim();
                    if (!v) void saveToken(tab, null);
                    else if (token && accounts[tab]) void saveToken(tab, token);
                  }}
                  label="Remember on this device"
                  help="Stored in this browser only. Leave it off on a shared computer. You'll paste the token again next time."
                />
                {(tokens[tab] || accounts[tab]) && remember[tab] && (
                  <Button size="xs" variant="ghost" icon={<Unplug className="size-3.5" />} disabled={running} onClick={() => void forget(tab)}>
                    Forget saved token
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                <SectionLabel>2 · Where to publish</SectionLabel>
                <TextInput
                  label={PROVIDER_INFO[tab].nameLabel}
                  help={PROVIDER_INFO[tab].nameHelp}
                  spellCheck={false}
                  value={names[tab] ?? ''}
                  disabled={running}
                  onChange={(e) => {
                    const v = e.target.value;
                    setNames((n) => ({ ...n, [tab]: v }));
                  }}
                />
                {tab === 'vercel' && (
                  <TextInput label="Team ID (optional)" help="Only needed to deploy into a Vercel team instead of your personal account." spellCheck={false} placeholder="team_…" value={teamId} disabled={running} onChange={(e) => setTeamId(e.target.value)} />
                )}
                <p className="text-[12px] text-fg-muted">
                  Address: <span className="font-mono text-fg">{expectedUrl(tab, tab === 'github' || !(names[tab] ?? '').trim() ? (names[tab] ?? '').trim() : siteSlug(names[tab] ?? ''), accounts[tab])}</span>
                </p>
              </div>

              <div className="space-y-3">
                <SectionLabel>3 · Publish</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" size="lg" icon={<Rocket className="size-4" />} loading={running} onClick={() => void run(tab)}>
                    {records[tab] ? 'Redeploy' : `Deploy to ${PROVIDER_INFO[tab].label}`}
                  </Button>
                  {running && (
                    <Button variant="ghost" size="lg" onClick={() => abort.current?.abort()}>
                      Cancel
                    </Button>
                  )}
                </div>
                <JobStatus
                  job={job}
                  siteUrl={siteUrl}
                  onUseSiteUrl={(url) => {
                    updateMetadata('siteUrl', url);
                    toast({ tone: 'success', title: 'Site URL saved', description: 'Redeploy to add the sitemap and full social-share links.' });
                  }}
                />
                {records[tab] && job?.status !== 'done' && (
                  <p className="text-[12px] text-fg-muted">
                    Last deployed {timeAgo(records[tab]!.deployedAt)} to{' '}
                    <a className="font-medium text-accent hover:underline" href={records[tab]!.url} target="_blank" rel="noopener noreferrer">
                      {records[tab]!.url.replace(/^https?:\/\//, '')}
                    </a>
                    . Redeploying replaces it with the current version.
                  </p>
                )}
              </div>
            </section>

            <aside className="space-y-4">
              <div className="rounded-[var(--radius-panel)] border border-line bg-panel p-4">
                <p className="text-[13px] font-semibold">Get a {PROVIDER_INFO[tab].label} token</p>
                <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-[12.5px] leading-relaxed text-fg-muted">
                  {PROVIDER_INFO[tab].tokenSteps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                <a href={PROVIDER_INFO[tab].tokenUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-accent hover:underline">
                  Create a token <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              </div>
              <div className="flex gap-2.5 rounded-[var(--radius-panel)] border border-line bg-panel p-4 text-[12px] leading-relaxed text-fg-muted">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden="true" />
                <p>Your browser talks to {PROVIDER_INFO[tab].label} directly. Revoke the token from your {PROVIDER_INFO[tab].label} settings any time. Deployed sites keep working.</p>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

function JobStatus({ job, siteUrl, onUseSiteUrl }: { job: Job | null; siteUrl: string; onUseSiteUrl: (url: string) => void }) {
  const [copied, setCopied] = useState(false);
  if (!job) return null;
  if (job.status === 'running')
    return (
      <div className="space-y-1.5 rounded-lg border border-line bg-bg/60 p-3" aria-live="polite">
        <div className="flex items-center justify-between gap-2 text-[12px]">
          <span className="truncate text-fg-muted">{job.stage}</span>
          <span className="shrink-0 font-mono tabular-nums text-fg-subtle">{Math.round(job.progress * 100)}%</span>
        </div>
        <ProgressBar value={job.progress * 100} label="Deploying" />
      </div>
    );
  if (job.status === 'error')
    return (
      <p role="alert" className="flex gap-2 rounded-lg border border-danger/25 bg-danger/10 p-3 text-[12.5px] text-fg">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
        <span>{job.message}</span>
      </p>
    );
  const { result, warnings } = job;
  const normalized = result.url.replace(/\/+$/, '');
  return (
    <div className="space-y-3 rounded-lg border border-ok/25 bg-ok/10 p-3.5" aria-live="polite">
      <p className="flex items-center gap-1.5 text-[13px] font-semibold">
        <Check className="size-4 text-ok" aria-hidden="true" /> {result.pending ? 'Uploaded. It can take a minute or two to go live.' : 'Your site is live'}
      </p>
      <a href={result.url} target="_blank" rel="noopener noreferrer" className="block break-all font-mono text-[13px] text-accent hover:underline">
        {result.url}
      </a>
      <div className="flex flex-wrap gap-1.5">
        <a href={result.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-7 items-center gap-1.5 rounded-md bg-accent px-2 text-[12px] font-medium text-accent-fg hover:bg-accent-strong">
          <ExternalLink className="size-3.5" aria-hidden="true" /> Open site
        </a>
        <Button
          size="xs"
          variant="secondary"
          icon={copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          onClick={() => {
            void copyText(result.url).then((ok) => {
              setCopied(ok);
              if (ok) window.setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? 'Copied' : 'Copy link'}
        </Button>
        {result.adminUrl && (
          <a href={result.adminUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-elevated px-2 text-[12px] font-medium hover:bg-hover">
            Dashboard <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        )}
      </div>
      {siteUrl !== normalized && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ok/20 pt-3 text-[12px] text-fg-muted">
          <span>Set this as the portfolio’s site URL to get a sitemap and full social-share links.</span>
          <Button size="xs" variant="secondary" onClick={() => onUseSiteUrl(`${normalized}/`)}>
            Use as site URL
          </Button>
        </div>
      )}
      {warnings.length > 0 && (
        <ul className="list-disc space-y-1 border-t border-ok/20 pt-3 pl-4 text-[12px] text-fg-muted">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ManualPanel({ zipping, onDownload }: { zipping: boolean; onDownload: () => void }) {
  const hosts = [
    { name: 'Netlify Drop', url: 'https://app.netlify.com/drop', steps: ['Unzip the download.', 'Drag the "portfolio" folder onto the Netlify Drop page.', 'Sign in to keep the site. Otherwise it expires after an hour.'] },
    { name: 'Cloudflare Pages', url: 'https://dash.cloudflare.com/?to=/:account/pages/new/upload', steps: ['Unzip the download.', 'Workers & Pages → Create → Pages → "Upload assets".', 'Upload the "portfolio" folder. No build command is needed.'] },
    { name: 'Any static host', url: '', steps: ['Upload everything inside the "portfolio" folder to your web root.', 'index.html is the entry point and 404.html the not-found page.', 'Works on S3, Firebase Hosting, Render, Surge, nginx and Apache.'] },
  ];
  return (
    <section className="mt-6 space-y-5 rounded-[var(--radius-panel)] border border-line bg-panel p-5" aria-label="Manual upload">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[13px] leading-relaxed text-fg-muted">No token needed. Download the deploy-ready website and drop it on any static host.</p>
        <Button variant="primary" icon={<Download className="size-4" />} loading={zipping} onClick={onDownload}>
          Download website ZIP
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {hosts.map((h) => (
          <div key={h.name} className="rounded-xl border border-line bg-bg/50 p-4">
            <p className="text-[13px] font-semibold">{h.name}</p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-[12.5px] leading-relaxed text-fg-muted">
              {h.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            {h.url && (
              <a href={h.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-accent hover:underline">
                Open {h.name} <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
