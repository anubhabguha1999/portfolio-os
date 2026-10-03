import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Copy, ExternalLink, RotateCcw, UserRound } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { Button, Spinner } from '@/components/ui/Button';
import { Select, TextArea } from '@/components/ui/Field';
import { Badge, Card, EmptyState, SectionLabel } from '@/components/ui/misc';
import { getMeta, setMeta } from '@/lib/storage/db';
import { toast } from '@/stores/ui';
import { copyText } from '@/utils/download';
import { cn } from '@/utils/cn';
import { resolveResume } from '@/studio/model/resolve';
import { getResume, listResumes, type StudioSummary } from '@/studio/storage/repo';
import { ensureWorkspace, useWorkspace } from '@/studio/store/workspace';
import { experienceText, generateLinkedIn, LINKEDIN_LIMITS, sourceFromProfile, sourceFromResume, type LinkedInSource } from '@/lib/linkedin';

/** Page-local edits, persisted per source so they survive reloads. Never written back to the profile. */
interface SavedState {
  edits: Record<string, string>;
  headline?: string;
  about?: string;
}

const metaKey = (source: string) => `linkedin-edits:${source}`;

export default function LinkedInPage() {
  const [params, setParams] = useSearchParams();
  const resumeId = params.get('resume') ?? '';
  const loaded = useWorkspace((s) => s.loaded);
  const profile = useWorkspace((s) => s.profile);
  const library = useWorkspace((s) => s.library);
  const [resumes, setResumes] = useState<StudioSummary[]>([]);
  const [src, setSrc] = useState<LinkedInSource | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    void ensureWorkspace().then(() => listResumes().then(setResumes));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    let alive = true;
    setMissing(false);
    if (!resumeId) {
      setSrc(sourceFromProfile(profile, library));
      return;
    }
    void getResume(resumeId).then((r) => {
      if (!alive) return;
      if (!r) {
        setMissing(true);
        setSrc(sourceFromProfile(profile, library));
      } else setSrc(sourceFromResume(resolveResume(r, library, profile), profile));
    });
    return () => {
      alive = false;
    };
  }, [loaded, resumeId, profile, library]);

  const sourceKey = resumeId && !missing ? `resume:${resumeId}` : 'profile';

  return (
    <div className="flex min-h-full flex-col bg-bg text-fg">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-accent">Profile</p>
            <h1 className="mt-1 text-[clamp(1.9rem,4.4vw,2.6rem)] font-semibold tracking-[-0.03em]">
              LinkedIn <span className="font-display font-normal italic">copy</span>
            </h1>
            <p className="mt-1.5 max-w-xl text-[13px] text-fg-muted">Headline, About, experience and skills written from your data, sized to LinkedIn’s limits. Edit here and copy each block — nothing is sent to LinkedIn and your profile is not changed.</p>
          </div>
        </header>

        <div className="mt-6 grid gap-3 rounded-2xl border border-line bg-panel p-4 sm:grid-cols-[minmax(0,320px)_1fr] sm:items-end">
          <Select
            label="Source"
            value={resumeId && !missing ? resumeId : ''}
            onChange={(e) =>
              setParams(
                (p) => {
                  if (e.target.value) p.set('resume', e.target.value);
                  else p.delete('resume');
                  return p;
                },
                { replace: true },
              )
            }
            options={[{ value: '', label: 'Shared profile & library' }, ...resumes.map((r) => ({ value: r.id, label: `Resume: ${r.name}` }))]}
          />
          <p className="text-[12px] text-fg-subtle">
            {resumeId && !missing ? 'Uses what this resume prints — its headline, summary, chosen entries and resume-only wording.' : 'Uses everything in your shared profile and library.'}{' '}
            <Link to="/profile" className="text-accent hover:underline">
              Edit profile →
            </Link>
          </p>
        </div>
        {missing && <p className="mt-3 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-[12.5px] text-warn">That resume was not found — showing your shared profile instead.</p>}

        {!src ? (
          <div className="mt-16 grid place-items-center text-fg-subtle" role="status" aria-label="Loading profile">
            <Spinner className="size-5" />
          </div>
        ) : !src.name && !src.headline && !src.summary && !src.roles.length && !src.skills.length ? (
          <EmptyState
            className="mt-10 rounded-3xl border border-dashed border-line py-16"
            icon={<UserRound className="size-5" />}
            title="Add your profile first"
            description="LinkedIn copy is generated from your headline, bio, experience and skills."
            action={
              <Link to="/profile" className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-[13px] font-semibold text-accent-fg hover:bg-accent-strong">
                Open profile
              </Link>
            }
          />
        ) : (
          <Editor key={sourceKey} src={src} sourceKey={sourceKey} />
        )}
      </main>
    </div>
  );
}

/* ------------------------------ editor ------------------------------ */

function Editor({ src, sourceKey }: { src: LinkedInSource; sourceKey: string }) {
  const bundle = useMemo(() => generateLinkedIn(src), [src]);
  const [state, setState] = useState<SavedState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    void getMeta<SavedState>(metaKey(sourceKey))
      .catch(() => undefined)
      .then((s) => alive && setState({ edits: {}, ...(s && typeof s === 'object' ? s : {}) }));
    return () => {
      alive = false;
    };
  }, [sourceKey]);

  const update = (fn: (s: SavedState) => SavedState) =>
    setState((prev) => {
      const next = fn(prev ?? { edits: {} });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void setMeta(metaKey(sourceKey), next).catch(() => undefined), 400);
      return next;
    });
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (!state)
    return (
      <div className="mt-16 grid place-items-center text-fg-subtle" role="status" aria-label="Loading">
        <Spinner className="size-5" />
      </div>
    );

  const value = (key: string, generated: string) => state.edits[key] ?? generated;
  const edited = (key: string) => key in state.edits;
  const setEdit = (key: string, v: string) => update((s) => ({ ...s, edits: { ...s.edits, [key]: v } }));
  const reset = (key: string) =>
    update((s) => {
      const edits = { ...s.edits };
      delete edits[key];
      return { ...s, edits };
    });
  const anyEdits = Object.keys(state.edits).length > 0;

  const headline = bundle.headlines.find((h) => h.id === state.headline) ?? bundle.headlines[0];
  const about = bundle.about.find((a) => a.id === state.about) ?? bundle.about[0]!;
  const skillsText = bundle.skills.join('\n');
  const skillLines = value('skills', skillsText)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="mt-6 space-y-5">
      {anyEdits && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-panel px-3 py-2 text-[12.5px] text-fg-muted">
          Your edits are saved on this device for this source.
          <Button size="xs" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => update((s) => ({ ...s, edits: {} }))}>
            Regenerate all
          </Button>
        </div>
      )}

      {headline && (
        <Block title="Headline" help="Shown under your name everywhere on LinkedIn.">
          <Variants options={bundle.headlines} value={headline.id} onChange={(id) => update((s) => ({ ...s, headline: id }))} />
          <EditableText id={`headline:${headline.id}`} value={value(`headline:${headline.id}`, headline.text)} limit={LINKEDIN_LIMITS.headline} rows={3} edited={edited(`headline:${headline.id}`)} onChange={setEdit} onReset={reset} label="Headline" />
        </Block>
      )}

      <Block title="About" help="The summary section of your profile. Line breaks are kept; LinkedIn has no bold or bullets, so “•” is used.">
        <Variants options={bundle.about} value={about.id} onChange={(id) => update((s) => ({ ...s, about: id }))} />
        <EditableText id={`about:${about.id}`} value={value(`about:${about.id}`, about.text)} limit={LINKEDIN_LIMITS.about} rows={14} edited={edited(`about:${about.id}`)} onChange={setEdit} onReset={reset} label="About" />
      </Block>

      {bundle.experience.length > 0 && (
        <Block title="Experience" help="One entry per role. Paste the description into each position on LinkedIn.">
          <div className="space-y-4">
            {bundle.experience.map((e) => {
              const key = `exp:${e.id}`;
              const desc = value(key, e.description);
              return (
                <div key={e.id} className="rounded-xl border border-line bg-bg p-3">
                  <div className="grid gap-x-4 gap-y-1.5 text-[12.5px] sm:grid-cols-2">
                    <CopyField label="Title" text={e.title} />
                    <CopyField label="Company" text={e.company} />
                    <CopyField label="Dates" text={e.dates} />
                    <CopyField label="Location" text={e.location} />
                  </div>
                  <div className="mt-3">
                    <EditableText id={key} value={desc} limit={LINKEDIN_LIMITS.experienceDescription} rows={7} edited={edited(key)} onChange={setEdit} onReset={reset} label="Description" extraCopy={{ label: 'Copy all', text: experienceText({ ...e, description: desc }) }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Block>
      )}

      <Block title="Skills" help="LinkedIn allows up to 50 skills, added one at a time. One per line; duplicates are already removed and your strongest skills come first.">
        <EditableText
          id="skills"
          value={value('skills', skillsText)}
          limit={LINKEDIN_LIMITS.skills}
          count={skillLines.length}
          unit="skills"
          rows={8}
          edited={edited('skills')}
          onChange={setEdit}
          onReset={reset}
          label="Skills"
        />
        {skillLines.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Skills preview">
            {skillLines.map((s, i) => (
              <li key={`${s}-${i}`}>
                <button
                  type="button"
                  onClick={() => void copy(s)}
                  title="Copy skill"
                  className={cn('rounded-full border px-2 py-0.5 text-[11.5px] transition hover:border-line-strong', i < LINKEDIN_LIMITS.skills ? 'border-line bg-hover text-fg-muted' : 'border-danger/30 bg-danger/10 text-danger line-through')}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Block>

      {bundle.projects.length > 0 && (
        <Block title="Projects" help="For the Projects section (Add profile section → Recommended → Projects).">
          <div className="space-y-4">
            {bundle.projects.map((p) => {
              const key = `proj:${p.id}`;
              return (
                <div key={p.id} className="rounded-xl border border-line bg-bg p-3">
                  <div className="grid gap-x-4 gap-y-1.5 text-[12.5px] sm:grid-cols-2">
                    <CopyField label="Project name" text={p.title} />
                    <CopyField label="Link" text={p.url} />
                  </div>
                  <div className="mt-3">
                    <EditableText id={key} value={value(key, p.description)} limit={LINKEDIN_LIMITS.projectDescription} rows={5} edited={edited(key)} onChange={setEdit} onReset={reset} label="Description" />
                  </div>
                </div>
              );
            })}
          </div>
        </Block>
      )}

      {bundle.featured.length > 0 && (
        <Block title="Featured suggestions" help="Links worth pinning to the Featured section (Add profile section → Recommended → Add featured → Add a link).">
          <ul className="divide-y divide-line">
            {bundle.featured.map((f) => (
              <li key={`${f.kind}:${f.id}`} className="flex items-start gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium">
                    {f.title}
                    <Badge>{f.kind}</Badge>
                  </p>
                  {f.description && <p className="mt-0.5 text-[12px] text-fg-muted">{f.description}</p>}
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-[12px] text-accent hover:underline">
                    <span className="truncate">{f.url}</span> <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
                  </a>
                </div>
                <CopyButton text={f.url} label="Copy link" />
              </li>
            ))}
          </ul>
        </Block>
      )}
    </div>
  );
}

/* ------------------------------ pieces ------------------------------ */

async function copy(text: string): Promise<boolean> {
  const ok = await copyText(text);
  toast(ok ? { tone: 'success', title: 'Copied to clipboard' } : { tone: 'error', title: 'Could not copy', description: 'Select the text and copy it manually.' });
  return ok;
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="xs"
      variant="secondary"
      disabled={!text.trim()}
      icon={done ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
      onClick={async () => {
        if (await copy(text)) {
          setDone(true);
          window.setTimeout(() => setDone(false), 1500);
        }
      }}
    >
      {label}
    </Button>
  );
}

function Block({ title, help, children }: { title: string; help?: string; children: ReactNode }) {
  return (
    <Card as="section" className="p-4 sm:p-5">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {help && <p className="mt-0.5 text-[12px] text-fg-subtle">{help}</p>}
      <div className="mt-3">{children}</div>
    </Card>
  );
}

function Variants({ options, value, onChange }: { options: Array<{ id: string; label: string }>; value: string; onChange: (id: string) => void }) {
  if (options.length < 2) return null;
  return (
    <div role="radiogroup" aria-label="Variant" className="mb-3 flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={o.id === value}
          onClick={() => onChange(o.id)}
          className={cn('h-7 rounded-full border px-3 text-[12px] font-medium transition', o.id === value ? 'border-accent/40 bg-accent-soft text-accent' : 'border-line bg-elevated text-fg-muted hover:border-line-strong hover:text-fg')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Counter({ n, limit, unit = 'characters' }: { n: number; limit: number; unit?: string }) {
  const over = n > limit;
  const near = !over && n > limit * 0.9;
  return (
    <span className={cn('font-mono text-[11px] tabular-nums', over ? 'font-semibold text-danger' : near ? 'text-warn' : 'text-fg-subtle')} aria-live="polite">
      {n.toLocaleString()} / {limit.toLocaleString()} {unit}
      {over && ' — over the limit'}
    </span>
  );
}

function EditableText({
  id,
  label,
  value,
  limit,
  count,
  unit,
  rows,
  edited,
  onChange,
  onReset,
  extraCopy,
}: {
  id: string;
  label: string;
  value: string;
  limit: number;
  count?: number;
  unit?: string;
  rows: number;
  edited: boolean;
  onChange: (id: string, v: string) => void;
  onReset: (id: string) => void;
  extraCopy?: { label: string; text: string };
}) {
  return (
    <div>
      <TextArea
        label={
          <span className="inline-flex items-center gap-2">
            {label}
            {edited && <Badge tone="accent">Edited</Badge>}
          </span>
        }
        value={value}
        rows={rows}
        onChange={(e) => onChange(id, e.target.value)}
        spellCheck
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Counter n={count ?? value.length} limit={limit} unit={unit} />
        <span className="flex-1" />
        {edited && (
          <Button size="xs" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => onReset(id)}>
            Regenerate
          </Button>
        )}
        {extraCopy && <CopyButton text={extraCopy.text} label={extraCopy.label} />}
        <CopyButton text={value} />
      </div>
    </div>
  );
}

function CopyField({ label, text }: { label: string; text: string }) {
  if (!text) return null;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="min-w-0 flex-1">
        <SectionLabel>{label}</SectionLabel>
        <p className="truncate text-[13px]">{text}</p>
      </div>
      <button type="button" onClick={() => void copy(text)} className="grid size-7 shrink-0 place-items-center rounded-md text-fg-subtle hover:bg-hover hover:text-fg" aria-label={`Copy ${label.toLowerCase()}`}>
        <Copy className="size-3.5" />
      </button>
    </div>
  );
}
