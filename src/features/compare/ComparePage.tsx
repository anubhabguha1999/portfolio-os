import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, FileText, GitCompare, Palette, TriangleAlert } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { IconButton, Spinner } from '@/components/ui/Button';
import { Select, Segmented, Switch } from '@/components/ui/Field';
import { Badge, Card, EmptyState, SectionLabel } from '@/components/ui/misc';
import { cn } from '@/utils/cn';
import type { ResumeDoc } from '@/studio/model/types';
import { getResume, listResumes, type StudioSummary } from '@/studio/storage/repo';
import { ensureWorkspace, useWorkspace } from '@/studio/store/workspace';
import type { DiffOp } from '@/lib/diff';
import { compareResumes, type FieldDiff, type ItemDiff, type LineDiff, type Presence, type ResumeComparison, type SectionDiff } from '@/lib/diff/resume';

type View = 'side' | 'unified';
type Side = 'a' | 'b' | 'unified';

/** Template id → name, loaded lazily with the template registry. */
function useTemplateNames(): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    void import('@/studio/templates/resume').then((m) => alive && setNames(Object.fromEntries(m.RESUME_TEMPLATES.map((t) => [t.id, t.name]))))
      .catch(() => undefined); // names fall back to template ids
    return () => {
      alive = false;
    };
  }, []);
  return names;
}

export default function ComparePage() {
  const [params, setParams] = useSearchParams();
  const profile = useWorkspace((s) => s.profile);
  const library = useWorkspace((s) => s.library);
  const [list, setList] = useState<StudioSummary[] | null>(null);
  const [docs, setDocs] = useState<{ a: ResumeDoc | null; b: ResumeDoc | null } | null>(null);
  const [view, setView] = useState<View>(() => (typeof window !== 'undefined' && window.innerWidth < 640 ? 'unified' : 'side'));
  const [onlyChanges, setOnlyChanges] = useState(true);
  const templateNames = useTemplateNames();

  const idA = params.get('a') ?? '';
  const idB = params.get('b') ?? '';


  useEffect(() => {
    let alive = true;
    void (async () => {
      await ensureWorkspace();
      const l = await listResumes();
      if (alive) setList(l);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Fill in missing picks with the most recently edited resumes.
  useEffect(() => {
    if (!list || list.length < 2) return;
    const known = (id: string) => list.some((r) => r.id === id);
    let a = known(idA) ? idA : '';
    let b = known(idB) ? idB : '';
    if (!a) a = list.find((r) => r.id !== b)!.id;
    if (!b) b = list.find((r) => r.id !== a)!.id;
    if (a !== idA || b !== idB)
      setParams(
        (p) => {
          p.set('a', a);
          p.set('b', b);
          return p;
        },
        { replace: true },
      );
  }, [list, idA, idB, setParams]);

  useEffect(() => {
    if (!idA || !idB) return;
    let alive = true;
    void Promise.all([getResume(idA), getResume(idB)]).then(([a, b]) => alive && setDocs({ a, b }));
    return () => {
      alive = false;
    };
  }, [idA, idB]);

  const comparison = useMemo<ResumeComparison | null>(() => {
    if (!docs?.a || !docs.b) return null;
    return compareResumes({ a: docs.a, b: docs.b, library, profile, templateName: (id) => templateNames[id] ?? id });
  }, [docs, library, profile, templateNames]);

  const pick = (key: 'a' | 'b', id: string) =>
    setParams(
      (p) => {
        p.set(key, id);
        return p;
      },
      { replace: true },
    );
  const swap = () =>
    setParams(
      (p) => {
        p.set('a', idB);
        p.set('b', idA);
        return p;
      },
      { replace: true },
    );

  const options = (list ?? []).map((r) => ({ value: r.id, label: r.name }));
  const nameA = list?.find((r) => r.id === idA)?.name ?? 'A';
  const nameB = list?.find((r) => r.id === idB)?.name ?? 'B';

  return (
    <div className="flex min-h-full flex-col bg-bg text-fg">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <header>
          <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-accent">Resume Studio</p>
          <h1 className="mt-1 text-[clamp(1.9rem,4.4vw,2.6rem)] font-semibold tracking-[-0.03em]">
            Compare <span className="font-display font-normal italic">resumes</span>
          </h1>
          <p className="mt-1.5 max-w-xl text-[13px] text-fg-muted">See exactly what differs between two versions as printed — sections, entries, wording, skills and design. Read-only: nothing is changed.</p>
        </header>

        {list === null ? (
          <div className="mt-16 grid place-items-center text-fg-subtle" role="status" aria-label="Loading resumes">
            <Spinner className="size-5" />
          </div>
        ) : list.length < 2 ? (
          <EmptyState
            className="mt-10 rounded-3xl border border-dashed border-line py-16"
            icon={<GitCompare className="size-5" />}
            title="You need two resumes to compare"
            description="Duplicate a resume and tailor it for a role, then come back to see what changed."
            action={
              <Link to="/resumes" className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-[13px] font-semibold text-accent-fg hover:bg-accent-strong">
                <FileText className="size-4" /> Go to resumes
              </Link>
            }
          />
        ) : (
          <>
            <div className="mt-6 grid gap-3 rounded-2xl border border-line bg-panel p-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
              <Select label={<SideTag side="a">Resume A</SideTag>} value={idA} onChange={(e) => pick('a', e.target.value)} options={options} />
              <IconButton label="Swap A and B" variant="secondary" size="md" onClick={swap} className="justify-self-center">
                <ArrowLeftRight className="size-4" />
              </IconButton>
              <Select label={<SideTag side="b">Resume B</SideTag>} value={idB} onChange={(e) => pick('b', e.target.value)} options={options} />
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 sm:col-span-3">
                <Segmented<View>
                  className="w-full max-w-[260px]"
                  value={view}
                  onChange={setView}
                  options={[
                    { value: 'side', label: 'Side by side' },
                    { value: 'unified', label: 'Unified' },
                  ]}
                />
                <div className="w-44">
                  <Switch checked={onlyChanges} onChange={setOnlyChanges} label="Only changes" />
                </div>
              </div>
            </div>

            {idA && idA === idB && <p className="mt-4 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-[12.5px] text-warn">Both sides are the same resume — pick a different one for A or B.</p>}

            {docs && (!docs.a || !docs.b) ? (
              <EmptyState className="mt-10" icon={<TriangleAlert className="size-5" />} title="Resume not found" description="It may have been deleted. Pick another resume above." />
            ) : !comparison ? (
              <div className="mt-16 grid place-items-center text-fg-subtle" role="status" aria-label="Comparing">
                <Spinner className="size-5" />
              </div>
            ) : (
              <Comparison c={comparison} view={view} onlyChanges={onlyChanges} nameA={nameA} nameB={nameB} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function SideTag({ side, children }: { side: 'a' | 'b'; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('grid size-4 place-items-center rounded text-[10px] font-bold', side === 'a' ? 'bg-danger/15 text-danger' : 'bg-ok/15 text-ok')}>{side.toUpperCase()}</span>
      {children}
    </span>
  );
}

/* ------------------------------ summary ----------------------------- */

function Stat({ label, parts }: { label: string; parts: Array<[string, number, string]> }) {
  const shown = parts.filter(([, n]) => n > 0);
  return (
    <div className="rounded-xl border border-line bg-panel px-3 py-2.5">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">{label}</p>
      <p className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[13px] tabular-nums">
        {shown.length ? (
          shown.map(([sym, n, tone]) => (
            <span key={sym} className={tone}>
              {sym}
              {n}
            </span>
          ))
        ) : (
          <span className="text-fg-subtle">No change</span>
        )}
      </p>
    </div>
  );
}

function Summary({ c }: { c: ResumeComparison }) {
  const s = c.summary;
  const total = s.totalContent + s.designChanges;
  return (
    <section aria-label="Summary of differences" className="mt-6">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-[15px] font-semibold">{total ? `${total} difference${total === 1 ? '' : 's'}` : 'No differences'}</h2>
        <p className="text-[12px] text-fg-subtle">
          {s.sectionsHidden ? `${s.sectionsHidden} section${s.sectionsHidden === 1 ? '' : 's'} hidden · ` : ''}
          Counted on the printed content after shared/detached fields are resolved.
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Stat
          label="Sections"
          parts={[
            ['+', s.sectionsAdded, 'text-ok'],
            ['−', s.sectionsRemoved, 'text-danger'],
            ['~', s.sectionsChanged, 'text-warn'],
            ['↕', s.sectionsMoved, 'text-accent'],
          ]}
        />
        <Stat
          label="Entries"
          parts={[
            ['+', s.entriesAdded, 'text-ok'],
            ['−', s.entriesRemoved, 'text-danger'],
            ['~', s.entriesChanged, 'text-warn'],
            ['↕', s.entriesMoved, 'text-accent'],
          ]}
        />
        <Stat
          label="Words"
          parts={[
            ['+', s.wordsAdded, 'text-ok'],
            ['−', s.wordsRemoved, 'text-danger'],
          ]}
        />
        <Stat
          label="Skills"
          parts={[
            ['+', s.skillsAdded, 'text-ok'],
            ['−', s.skillsRemoved, 'text-danger'],
          ]}
        />
        <Stat label="Design" parts={[['~', s.designChanges, 'text-warn']]} />
      </div>
    </section>
  );
}

/* ------------------------------ inline diff ------------------------- */

function Ops({ ops, side }: { ops: DiffOp<string>[]; side: Side }) {
  return (
    <>
      {ops.map((o, i) => {
        if (o.type === 'equal') return <span key={i}>{o.value}</span>;
        if (o.type === 'delete')
          return side === 'b' ? null : (
            <del key={i} className="rounded-sm bg-danger/15 text-danger decoration-danger/60">
              {o.value}
            </del>
          );
        return side === 'a' ? null : (
          <ins key={i} className="rounded-sm bg-ok/15 text-ok no-underline">
            {o.value}
          </ins>
        );
      })}
    </>
  );
}

function Missing({ children }: { children: ReactNode }) {
  return <p className="text-[12px] italic text-fg-subtle">{children}</p>;
}

/** Two cells (side by side) or one (unified). */
function Row({ view, a, b, unified }: { view: View; a: ReactNode; b: ReactNode; unified: ReactNode }) {
  if (view === 'unified') return <div className="min-w-0">{unified}</div>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-6">
      <div className="min-w-0">{a}</div>
      <div className="min-w-0">{b}</div>
    </div>
  );
}

function FieldText({ f, side, className }: { f: FieldDiff; side: Side; className?: string }) {
  const empty = side === 'a' ? !f.a : side === 'b' ? !f.b : false;
  if (empty) return null;
  return (
    <p className={cn('whitespace-pre-line break-words', className)}>
      <Ops ops={f.ops} side={side} />
    </p>
  );
}

/* ------------------------------ status ------------------------------ */

const PRESENCE: Record<Presence, string> = { shown: '', hidden: 'hidden', empty: 'empty', absent: 'not present' };

function SectionBadges({ s }: { s: SectionDiff }) {
  return (
    <>
      {s.status === 'added' && <Badge tone="ok">{s.presence.a === 'absent' ? 'Added in B' : `Shown in B · ${PRESENCE[s.presence.a]} in A`}</Badge>}
      {s.status === 'removed' && <Badge tone="danger">{s.presence.b === 'absent' ? 'Removed in B' : `${PRESENCE[s.presence.b][0]!.toUpperCase()}${PRESENCE[s.presence.b].slice(1)} in B`}</Badge>}
      {s.status === 'changed' && <Badge tone="warn">Changed</Badge>}
      {s.moved && <Badge tone="accent">Moved</Badge>}
    </>
  );
}

function ItemBadges({ it }: { it: ItemDiff }) {
  return (
    <>
      {it.status === 'added' && <Badge tone="ok">Added</Badge>}
      {it.status === 'removed' && <Badge tone="danger">Removed</Badge>}
      {it.status === 'changed' && <Badge tone="warn">Changed</Badge>}
      {it.moved && <Badge tone="accent">Moved</Badge>}
    </>
  );
}

/* ------------------------------ comparison -------------------------- */

function Comparison({ c, view, onlyChanges, nameA, nameB }: { c: ResumeComparison; view: View; onlyChanges: boolean; nameA: string; nameB: string }) {
  const sections = onlyChanges ? c.sections.filter((s) => s.status !== 'same' || s.moved) : c.sections;
  const design = onlyChanges ? c.design.filter((d) => d.changed) : c.design;
  const showHeader = !onlyChanges || c.header.status !== 'same';
  const nothing = onlyChanges && !sections.length && !design.length && !showHeader;

  return (
    <>
      <Summary c={c} />

      {view === 'side' && (
        <div className="sticky top-14 z-10 mt-6 grid grid-cols-2 gap-3 rounded-xl border border-line bg-elevated/95 px-4 py-2 text-[12px] font-medium backdrop-blur sm:gap-6">
          <span className="truncate">
            <SideTag side="a">{nameA}</SideTag>
          </span>
          <span className="truncate">
            <SideTag side="b">{nameB}</SideTag>
          </span>
        </div>
      )}

      {nothing && <EmptyState className="mt-8 rounded-2xl border border-line" icon={<GitCompare className="size-5" />} title="These resumes print the same" description="Turn off “Only changes” to browse the full content." />}

      <div className="mt-4 space-y-4">
        {showHeader && (
          <Card as="section" className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[14px] font-semibold">Header</h2>
              {c.header.status === 'changed' && <Badge tone="warn">Changed</Badge>}
            </div>
            <div className="mt-3 space-y-2 text-[13px]">
              {c.header.fields
                .filter((f) => !onlyChanges || f.status !== 'same')
                .map((f) => (
                  <LabeledField key={f.field} f={f} view={view} />
                ))}
              {(!onlyChanges || c.header.contact.added.length > 0 || c.header.contact.removed.length > 0) && (
                <div>
                  <SectionLabel>Contact</SectionLabel>
                  <Chips added={c.header.contact.added} removed={c.header.contact.removed} common={onlyChanges ? [] : c.header.contact.common} view={view} />
                </div>
              )}
            </div>
          </Card>
        )}

        {sections.map((s) => (
          <SectionCard key={s.key} s={s} view={view} onlyChanges={onlyChanges} />
        ))}

        {design.length > 0 && (
          <Card as="section" className="p-4">
            <div className="flex items-center gap-2">
              <Palette className="size-4 text-fg-subtle" aria-hidden="true" />
              <h2 className="text-[14px] font-semibold">Design</h2>
              {c.summary.designChanges > 0 && <Badge tone="warn">{c.summary.designChanges} changed</Badge>}
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead className="text-[10.5px] uppercase tracking-[0.12em] text-fg-subtle">
                  <tr>
                    <th className="py-1.5 pr-3 font-semibold">Setting</th>
                    <th className="py-1.5 pr-3 font-semibold">A</th>
                    <th className="py-1.5 font-semibold">B</th>
                  </tr>
                </thead>
                <tbody>
                  {design.map((d) => (
                    <tr key={d.key} className="border-t border-line">
                      <td className="py-1.5 pr-3 text-fg-muted">{d.label}</td>
                      <td className={cn('py-1.5 pr-3', d.changed && 'text-danger')}>
                        <DesignValue k={d.key} v={d.a} />
                      </td>
                      <td className={cn('py-1.5', d.changed && 'font-medium text-ok')}>
                        <DesignValue k={d.key} v={d.b} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

function DesignValue({ k, v }: { k: string; v: string }) {
  if (k === 'accent' && /^#[0-9a-f]{3,8}$/i.test(v))
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded-sm border border-line" style={{ background: v }} aria-hidden="true" />
        <span className="font-mono">{v}</span>
      </span>
    );
  return <>{v}</>;
}

function LabeledField({ f, view }: { f: FieldDiff; view: View }) {
  return (
    <div>
      <SectionLabel>{f.label}</SectionLabel>
      <Row view={view} a={f.a ? <FieldText f={f} side="a" /> : <Missing>—</Missing>} b={f.b ? <FieldText f={f} side="b" /> : <Missing>—</Missing>} unified={<FieldText f={f} side="unified" />} />
    </div>
  );
}

function Chips({ added, removed, common, view }: { added: string[]; removed: string[]; common: string[]; view: View }) {
  const chip = (s: string, tone: 'ok' | 'danger' | 'neutral') => (
    <li key={`${tone}:${s}`}>
      <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[11.5px]', tone === 'ok' ? 'border-ok/30 bg-ok/10 text-ok' : tone === 'danger' ? 'border-danger/30 bg-danger/10 text-danger line-through' : 'border-line bg-hover text-fg-muted')}>
        {tone === 'ok' ? '+ ' : tone === 'danger' ? '− ' : ''}
        {s}
      </span>
    </li>
  );
  const list = (items: ReactNode[]) => (items.length ? <ul className="mt-1.5 flex flex-wrap gap-1.5">{items}</ul> : <Missing>—</Missing>);
  if (view === 'unified') return list([...removed.map((s) => chip(s, 'danger')), ...added.map((s) => chip(s, 'ok')), ...common.map((s) => chip(s, 'neutral'))]);
  return <Row view={view} a={list([...removed.map((s) => chip(s, 'danger')), ...common.map((s) => chip(s, 'neutral'))])} b={list([...added.map((s) => chip(s, 'ok')), ...common.map((s) => chip(s, 'neutral'))])} unified={null} />;
}

function SectionCard({ s, view, onlyChanges }: { s: SectionDiff; view: View; onlyChanges: boolean }) {
  const items = onlyChanges && s.status === 'changed' ? s.items.filter((i) => i.status !== 'same' || i.moved) : s.items;
  const hiddenSame = s.items.length - items.length;
  const whole = s.status === 'added' || s.status === 'removed';
  return (
    <Card as="section" className={cn('p-4', s.status === 'added' && 'border-ok/30', s.status === 'removed' && 'border-danger/30')}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[14px] font-semibold">{s.title}</h2>
        <SectionBadges s={s} />
      </div>
      <div className="mt-3 space-y-3 text-[13px]">
        {s.heading && s.heading.status !== 'same' && <LabeledField f={s.heading} view={view} />}
        {s.text && (!onlyChanges || whole || s.text.status !== 'same') && (
          <Row
            view={view}
            a={s.text.a ? <FieldText f={s.text} side="a" className="leading-relaxed" /> : <Missing>Not in A</Missing>}
            b={s.text.b ? <FieldText f={s.text} side="b" className="leading-relaxed" /> : <Missing>Not in B</Missing>}
            unified={<FieldText f={s.text} side="unified" className="leading-relaxed" />}
          />
        )}
        {s.skills && (!onlyChanges || whole || s.skills.added.length > 0 || s.skills.removed.length > 0) && <Chips added={s.skills.added} removed={s.skills.removed} common={onlyChanges && !whole ? [] : s.skills.common} view={view} />}
        {s.skills && onlyChanges && !whole && s.skills.common.length > 0 && <p className="text-[11.5px] text-fg-subtle">{s.skills.common.length} skills in both</p>}
        {s.skills && (s.skills.categories.added.length > 0 || s.skills.categories.removed.length > 0) && (
          <div>
            <SectionLabel>Skill groups</SectionLabel>
            <Chips added={s.skills.categories.added} removed={s.skills.categories.removed} common={[]} view={view} />
          </div>
        )}
        {items.map((it) => (
          <ItemBlock key={it.key} it={it} view={view} onlyChanges={onlyChanges && !whole} />
        ))}
        {hiddenSame > 0 && <p className="text-[11.5px] text-fg-subtle">{hiddenSame} unchanged {hiddenSame === 1 ? 'entry' : 'entries'} hidden</p>}
      </div>
    </Card>
  );
}

function ItemBlock({ it, view, onlyChanges }: { it: ItemDiff; view: View; onlyChanges: boolean }) {
  const title = it.fields.find((f) => f.field === 'title');
  const meta = it.fields.filter((f) => f.field !== 'title' && f.field !== 'description');
  const desc = it.fields.find((f) => f.field === 'description');
  const bullets = onlyChanges ? it.bullets.filter((l) => l.status !== 'same') : it.bullets;
  const sameBullets = it.bullets.length - bullets.length;
  const hasTags = it.tags.added.length + it.tags.removed.length + it.tags.common.length > 0;
  const tagsChanged = it.tags.added.length + it.tags.removed.length > 0;

  const header = (side: Side) => {
    if ((side === 'a' && !it.a) || (side === 'b' && !it.b)) return <Missing>{side === 'a' ? 'Not in A' : 'Not in B'}</Missing>;
    return (
      <div>
        {title && <FieldText f={title} side={side} className="font-semibold" />}
        <div className="mt-0.5 flex flex-wrap gap-x-2 text-[12px] text-fg-muted">
          {meta
            .filter((f) => !onlyChanges || f.status !== 'same' || f.field === 'subtitle' || f.field === 'date')
            .map((f) => (
              <FieldText key={f.field} f={f} side={side} className="after:ml-2 after:text-fg-subtle after:content-['·'] last:after:content-none" />
            ))}
        </div>
      </div>
    );
  };

  return (
    <div className={cn('rounded-xl border p-3', it.status === 'added' ? 'border-ok/25 bg-ok/[0.04]' : it.status === 'removed' ? 'border-danger/25 bg-danger/[0.04]' : 'border-line bg-bg')}>
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <ItemBadges it={it} />
      </div>
      <Row view={view} a={header('a')} b={header('b')} unified={header('unified')} />
      {desc && (!onlyChanges || desc.status !== 'same') && (
        <div className="mt-2">
          <Row view={view} a={<FieldText f={desc} side="a" className="text-fg-muted" />} b={<FieldText f={desc} side="b" className="text-fg-muted" />} unified={<FieldText f={desc} side="unified" className="text-fg-muted" />} />
        </div>
      )}
      {bullets.length > 0 && (
        <ul className="mt-2 space-y-1">
          {bullets.map((l, i) => (
            <li key={i}>
              <BulletRow l={l} view={view} />
            </li>
          ))}
        </ul>
      )}
      {sameBullets > 0 && <p className="mt-1.5 text-[11.5px] text-fg-subtle">{sameBullets} unchanged bullet{sameBullets === 1 ? '' : 's'}</p>}
      {hasTags && (!onlyChanges || tagsChanged) && (
        <div className="mt-2">
          <Chips added={it.tags.added} removed={it.tags.removed} common={onlyChanges ? [] : it.tags.common} view={view} />
        </div>
      )}
    </div>
  );
}

function BulletRow({ l, view }: { l: LineDiff; view: View }) {
  const cell = (side: Side) => {
    if ((side === 'a' && l.status === 'added') || (side === 'b' && l.status === 'removed')) return null;
    return (
      <p className="flex gap-2 break-words">
        <span aria-hidden="true" className={cn('select-none', l.status === 'added' ? 'text-ok' : l.status === 'removed' ? 'text-danger' : l.status === 'changed' ? 'text-warn' : 'text-fg-subtle')}>
          {l.status === 'added' ? '+' : l.status === 'removed' ? '−' : l.status === 'changed' ? '~' : '•'}
        </span>
        <span className="min-w-0">
          <Ops ops={l.ops} side={side} />
        </span>
      </p>
    );
  };
  return <Row view={view} a={cell('a')} b={cell('b')} unified={cell('unified')} />;
}
