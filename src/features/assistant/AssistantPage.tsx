import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, ExternalLink, FileSearch, KeyRound, ListChecks, Mail, ShieldCheck, TextQuote, Unplug } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { Button } from '@/components/ui/Button';
import { Badge, SectionLabel } from '@/components/ui/misc';
import { Select, Switch, TextInput } from '@/components/ui/Field';
import { toast } from '@/stores/ui';
import { BRAND } from '@/config/brand';
import { cn } from '@/utils/cn';
import { AI_MODELS, AiError, DEFAULT_MODEL, modelInfo, verifyKey } from '@/lib/ai/client';
import { loadApiKey, loadModel, saveApiKey, saveModel } from '@/lib/ai/settings';
import { CoverLetter, RewriteBullets, SummaryVariants, TailorTips, type ToolProps } from './tools';

const TOOLS = [
  { id: 'bullets', label: 'Rewrite bullets', icon: ListChecks, Component: RewriteBullets },
  { id: 'letter', label: 'Cover letter', icon: Mail, Component: CoverLetter },
  { id: 'summary', label: 'Summary', icon: TextQuote, Component: SummaryVariants },
  { id: 'tailor', label: 'Tailor for a job', icon: FileSearch, Component: TailorTips },
] as const;
type ToolId = (typeof TOOLS)[number]['id'];
const isTool = (v: string | null): v is ToolId => TOOLS.some((t) => t.id === v);

type KeyStatus = { state: 'unknown' } | { state: 'checking' } | { state: 'ok' } | { state: 'error'; message: string };

export default function AssistantPage() {
  const [params, setParams] = useSearchParams();
  const initial = params.get('tool');
  const [tool, setToolState] = useState<ToolId>(isTool(initial) ? initial : 'bullets');
  const setTool = (t: ToolId) => {
    setToolState(t);
    setParams(
      (p) => {
        p.set('tool', t);
        return p;
      },
      { replace: true },
    );
  };

  const [apiKey, setApiKey] = useState('');
  const [remember, setRemember] = useState(false);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [status, setStatus] = useState<KeyStatus>({ state: 'unknown' });
  const checking = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([loadApiKey(), loadModel()])
      .then(([key, m]) => {
        if (!alive) return;
        if (key) {
          setApiKey(key);
          setRemember(true);
        }
        setModel(m);
      })
      .catch(() => {});
    return () => {
      alive = false;
      checking.current?.abort();
    };
  }, []);

  async function testKey() {
    checking.current?.abort();
    const ctrl = new AbortController();
    checking.current = ctrl;
    setStatus({ state: 'checking' });
    try {
      await verifyKey(apiKey, { signal: ctrl.signal });
      setStatus({ state: 'ok' });
      if (remember) await saveApiKey(apiKey);
    } catch (err) {
      if (err instanceof AiError && err.kind === 'aborted') return;
      setStatus({ state: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      if (checking.current === ctrl) checking.current = null;
    }
  }

  async function forget() {
    await saveApiKey(null);
    setApiKey('');
    setRemember(false);
    setStatus({ state: 'unknown' });
    toast({ title: 'API key removed from this device' });
  }

  const hasKey = !!apiKey.trim();
  const props: ToolProps = { apiKey, model };
  const Active = TOOLS.find((t) => t.id === tool)!.Component;

  return (
    <div className="flex min-h-full flex-col bg-bg text-fg">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <header>
          <p className="text-[12px] font-medium text-fg-subtle">
            <Link to="/studio" className="hover:text-fg">
              Dashboard
            </Link>{' '}
            / AI assistant
          </p>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 text-[clamp(1.9rem,4.4vw,2.6rem)] font-semibold tracking-[-0.03em]">
            <span>
              AI <span className="font-display font-normal italic">assistant</span>
            </span>
            <Badge tone="accent">Optional</Badge>
          </h1>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-fg-muted">
            Writing help for bullets, cover letters, summaries and job tailoring, powered by Claude with your own Anthropic API key. It only works with facts you already have and marks anything missing with [placeholders] for you to fill in.
          </p>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="space-y-4 rounded-[var(--radius-panel)] border border-line bg-panel p-4 sm:p-5" aria-label="Assistant settings">
            <SectionLabel
              action={
                status.state === 'ok' ? (
                  <Badge tone="ok">
                    <Check className="size-3" aria-hidden="true" /> Key works
                  </Badge>
                ) : null
              }
            >
              Anthropic API key
            </SectionLabel>
            <div className="flex flex-wrap items-end gap-2">
              <TextInput
                className="min-w-0 flex-1 basis-60"
                label="API key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="sk-ant-…"
                value={apiKey}
                error={status.state === 'error' ? status.message : undefined}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setStatus({ state: 'unknown' });
                }}
                onBlur={() => {
                  if (remember && hasKey) void saveApiKey(apiKey);
                }}
              />
              <Button variant="secondary" icon={<KeyRound className="size-4" />} loading={status.state === 'checking'} disabled={!hasKey} onClick={() => void testKey()}>
                Test key
              </Button>
            </div>
            <Switch
              checked={remember}
              onChange={(v) => {
                setRemember(v);
                if (!v) void saveApiKey(null);
                else if (hasKey) void saveApiKey(apiKey);
              }}
              label="Remember on this device"
              help="Stored in this browser only. Leave it off on a shared computer; you'll paste the key again next time."
            />
            {remember && hasKey && (
              <Button size="xs" variant="ghost" icon={<Unplug className="size-3.5" />} onClick={() => void forget()}>
                Forget saved key
              </Button>
            )}
            <Select
              label="Model"
              help={modelInfo(model).description}
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                void saveModel(e.target.value);
              }}
              options={AI_MODELS.map((m) => ({ value: m.id, label: m.label }))}
            />
          </section>

          <aside className="space-y-4">
            <div className="flex gap-2.5 rounded-[var(--radius-panel)] border border-line bg-panel p-4 text-[12px] leading-relaxed text-fg-muted">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden="true" />
              <div className="space-y-2">
                <p className="font-semibold text-fg">What gets sent, and where</p>
                <p>When you run one of these tools, the text it needs (the bullets, job description, profile or resume you choose) goes from your browser straight to Anthropic, under your own account. {BRAND.name} has no server in between.</p>
                <p>Nothing else in the app changes. Without a key the whole app works exactly as before, and nothing is ever sent.</p>
                <p>Suggestions are never written into your resume automatically; you copy what you want.</p>
              </div>
            </div>
            <div className="rounded-[var(--radius-panel)] border border-line bg-panel p-4">
              <p className="text-[13px] font-semibold">Get an API key</p>
              <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-[12.5px] leading-relaxed text-fg-muted">
                <li>Sign in to the Claude Console.</li>
                <li>Open API keys and create a key.</li>
                <li>Paste it here. Usage is billed to your Anthropic account.</li>
              </ol>
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-accent hover:underline">
                Create a key <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            </div>
          </aside>
        </div>

        <nav aria-label="Assistant tools" className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            const active = t.id === tool;
            return (
              <button
                key={t.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => setTool(t.id)}
                className={cn('group flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors', active ? 'border-line-strong bg-elevated' : 'border-line bg-panel hover:bg-hover')}
              >
                <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg border', active ? 'border-accent/30 bg-accent-soft text-accent' : 'border-line bg-bg text-fg-muted group-hover:text-fg')}>
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="truncate text-[13px] font-medium">{t.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-4">
          {/* Each tool keeps its own inputs and result while mounted; switching tools starts fresh. */}
          <Active key={tool} {...props} />
        </div>
      </main>
    </div>
  );
}
