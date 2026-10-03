import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, BriefcaseBusiness, CalendarClock, Clock, Download, GripVertical, Kanban, List, MessagesSquare, Plus, Search } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { Button } from '@/components/ui/Button';
import { CardGridSkeleton } from '@/components/ui/Skeletons';
import { Card, EmptyState, SectionLabel } from '@/components/ui/misc';
import { Segmented, Select } from '@/components/ui/Field';
import { toast } from '@/stores/ui';
import { cn } from '@/utils/cn';
import { timeAgo } from '@/utils/format';
import { downloadBlob } from '@/utils/download';
import {
  APPLICATION_STATUSES,
  STATUS_LABELS,
  WORK_MODE_LABELS,
  applicationsToCsv,
  computeStats,
  createApplication,
  daysSince,
  isStale,
  listApplications,
  saveApplication,
  today,
  withStatus,
  type Application,
  type ApplicationStatus,
} from '@/lib/applications';
import { StatusBadge, formatDay, relativeDay, daysUntil, useStudioDocs } from './shared';

type View = 'board' | 'list';
type SortKey = 'company' | 'role' | 'status' | 'appliedAt' | 'nextStepDate' | 'updatedAt';
type StatusFilter = 'all' | 'open' | ApplicationStatus;

const STATUS_OPTIONS = APPLICATION_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }));

function matches(a: Application, q: string): boolean {
  if (!q) return true;
  const hay = [a.company, a.role, a.location, a.source, a.notes, a.salary, ...a.contacts.map((c) => `${c.name} ${c.email}`)].join(' ').toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

const byOrder = (a: Application, b: Application) => a.order - b.order || b.updatedAt.localeCompare(a.updatedAt);

export default function ApplicationsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view: View = params.get('view') === 'list' ? 'list' : 'board';
  const setView = (v: View) =>
    setParams(
      (p) => {
        p.set('view', v);
        return p;
      },
      { replace: true },
    );
  const [apps, setApps] = useState<Application[] | null>(null);
  const [query, setQuery] = useState('');
  const docs = useStudioDocs();


  const refresh = useCallback(async () => {
    try {
      setApps(await listApplications());
    } catch (err) {
      setApps([]);
      toast({ tone: 'error', title: 'Could not load applications', description: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const stats = useMemo(() => computeStats(apps ?? []), [apps]);
  const visible = useMemo(() => (apps ?? []).filter((a) => matches(a, query.trim())), [apps, query]);

  const create = async (status: ApplicationStatus = 'wishlist') => {
    const a = await saveApplication(createApplication({ status }));
    navigate(`/applications/${a.id}`);
  };

  /** Persists a batch of changed records and updates local state optimistically. */
  const persist = useCallback(async (changed: Array<{ app: Application; touch: boolean }>) => {
    if (!changed.length) return;
    setApps((prev) => {
      if (!prev) return prev;
      const map = new Map(changed.map((c) => [c.app.id, c.app]));
      return prev.map((a) => map.get(a.id) ?? a);
    });
    try {
      const saved = await Promise.all(changed.map((c) => saveApplication(c.app, { touch: c.touch })));
      const map = new Map(saved.map((a) => [a.id, a]));
      setApps((prev) => prev && prev.map((a) => map.get(a.id) ?? a));
    } catch (err) {
      toast({ tone: 'error', title: 'Could not save', description: err instanceof Error ? err.message : String(err) });
      void refresh();
    }
  }, [refresh]);

  const changeStatus = useCallback(
    (app: Application, status: ApplicationStatus) => {
      if (app.status === status) return;
      const order = Math.max(0, ...(apps ?? []).filter((a) => a.status === status).map((a) => a.order)) + 1000;
      void persist([{ app: { ...withStatus(app, status), order }, touch: true }]);
      toast({ title: `${app.company || 'Application'} → ${STATUS_LABELS[status]}` });
    },
    [apps, persist],
  );

  const exportCsv = () => {
    if (!apps?.length) return;
    const csv = applicationsToCsv(
      [...visible].sort((a, b) => APPLICATION_STATUSES.indexOf(a.status) - APPLICATION_STATUSES.indexOf(b.status) || byOrder(a, b)),
      { resumes: Object.fromEntries(docs.resumes.map((r) => [r.id, r.name])), documents: Object.fromEntries(docs.documents.map((d) => [d.id, d.name])) },
    );
    downloadBlob(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }), `applications-${today()}.csv`);
    toast({ tone: 'success', title: `Exported ${visible.length} application${visible.length === 1 ? '' : 's'}` });
  };

  return (
    <div className="flex min-h-full flex-col bg-bg text-fg">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-accent">Job search</p>
            <h1 className="mt-1 text-[clamp(1.9rem,4.4vw,2.6rem)] font-semibold tracking-[-0.03em]">
              Application <span className="font-display font-normal italic">tracker</span>
            </h1>
            <p className="mt-1.5 max-w-xl text-[13px] text-fg-muted">Track every role from wishlist to offer, with the exact resume and cover letter you sent. Stored only in this browser.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/interview" className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-elevated px-3.5 text-[13px] font-medium hover:border-line-strong">
              <MessagesSquare className="size-4" /> Interview prep
            </Link>
            <Button icon={<Download className="size-4" />} onClick={exportCsv} disabled={!apps?.length}>
              Export CSV
            </Button>
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => void create()}>
              New application
            </Button>
          </div>
        </header>

        {apps === null ? (
          <CardGridSkeleton label="Loading applications" count={4} className="mt-8 grid-cols-[repeat(auto-fill,minmax(230px,1fr))]" />
        ) : apps.length === 0 ? (
          <EmptyState
            className="mt-10 rounded-3xl border border-dashed border-line py-16"
            icon={<BriefcaseBusiness className="size-5" />}
            title="Track your first application"
            description="Save roles you're interested in, move them through each stage, and link the resume version and cover letter you sent."
            action={
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => void create()}>
                New application
              </Button>
            }
          />
        ) : (
          <>
            <Stats apps={apps} stats={stats} />

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Segmented
                className="w-[200px]"
                value={view}
                onChange={setView}
                options={[
                  { value: 'board', label: <><Kanban className="size-3.5" /> Board</> },
                  { value: 'list', label: <><List className="size-3.5" /> List</> },
                ]}
              />
              <label className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <span className="sr-only">Search applications</span>
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
                <input className="app-input pl-8" type="search" placeholder="Search company, role, notes…" value={query} onChange={(e) => setQuery(e.target.value)} />
              </label>
              {query && (
                <span className="text-[12px] text-fg-subtle">
                  {visible.length} of {apps.length}
                </span>
              )}
            </div>

            {view === 'board' ? (
              <Board apps={visible} onPersist={persist} onStatus={changeStatus} onCreate={(s) => void create(s)} />
            ) : (
              <Table apps={visible} onStatus={changeStatus} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

/* -------------------------------- stats -------------------------------- */

function Stats({ apps, stats }: { apps: Application[]; stats: ReturnType<typeof computeStats> }) {
  const interviews = stats.counts.interview;
  const offers = stats.counts.offer + stats.counts.accepted;
  const tiles = [
    { label: 'Active', value: String(stats.active), sub: `${apps.length} total` },
    { label: 'Applied', value: String(stats.applied), sub: `${stats.counts.wishlist} on wishlist` },
    { label: 'Response rate', value: stats.responseRate === null ? '—' : `${Math.round(stats.responseRate * 100)}%`, sub: `${stats.responded} of ${stats.applied} replied` },
    { label: 'Interviewing', value: String(interviews), sub: `${stats.counts.screening} in screening` },
    { label: 'Offers', value: String(offers), sub: `${stats.counts.rejected} rejected` },
  ];
  const upcoming = stats.upcoming.slice(0, 5);
  const stale = stats.stale.slice(0, 5);
  return (
    <section aria-label="Summary" className="mt-8 space-y-4">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <li key={t.label} className="rounded-2xl border border-line bg-panel px-4 py-3">
            <p className="text-[11.5px] font-medium text-fg-muted">{t.label}</p>
            <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight">{t.value}</p>
            <p className="mt-0.5 truncate text-[11.5px] text-fg-subtle">{t.sub}</p>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-1.5" aria-label="Count per stage">
        {APPLICATION_STATUSES.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-2.5 py-1 text-[11.5px] text-fg-muted">
            {STATUS_LABELS[s]} <strong className="tabular-nums text-fg">{stats.counts[s]}</strong>
          </span>
        ))}
      </div>

      {(upcoming.length > 0 || stale.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-4">
            <SectionLabel>
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-3.5" /> Upcoming next steps
              </span>
            </SectionLabel>
            {upcoming.length ? (
              <ul className="mt-2 divide-y divide-line">
                {upcoming.map((a) => {
                  const overdue = daysUntil(a.nextStepDate) < 0;
                  return (
                    <li key={a.id}>
                      <Link to={`/applications/${a.id}`} className="flex items-center gap-3 py-2 text-[13px] hover:text-accent">
                        <span className="min-w-0 flex-1 truncate">
                          <strong className="font-semibold">{a.company || 'Untitled'}</strong>
                          <span className="text-fg-muted"> · {a.nextStep || 'Next step'}</span>
                        </span>
                        <span className={cn('shrink-0 text-[12px] tabular-nums', overdue ? 'text-danger' : 'text-fg-subtle')}>
                          {formatDay(a.nextStepDate)} · {relativeDay(a.nextStepDate)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-[12.5px] text-fg-subtle">No dated next steps. Add one on an application to see it here.</p>
            )}
          </Card>
          <Card className="p-4">
            <SectionLabel>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5" /> Needs a follow-up
              </span>
            </SectionLabel>
            {stale.length ? (
              <ul className="mt-2 divide-y divide-line">
                {stale.map((a) => (
                  <li key={a.id}>
                    <Link to={`/applications/${a.id}`} className="flex items-center gap-3 py-2 text-[13px] hover:text-accent">
                      <span className="min-w-0 flex-1 truncate">
                        <strong className="font-semibold">{a.company || 'Untitled'}</strong>
                        <span className="text-fg-muted"> · {a.role || STATUS_LABELS[a.status]}</span>
                      </span>
                      <span className="shrink-0 text-[12px] text-warn">{daysSince(a.updatedAt)} days quiet</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[12.5px] text-fg-subtle">Nothing stale — every open application was updated in the last 14 days.</p>
            )}
          </Card>
        </div>
      )}
    </section>
  );
}

/* -------------------------------- board -------------------------------- */

const colId = (s: ApplicationStatus) => `col:${s}`;

function Board({ apps, onPersist, onStatus, onCreate }: { apps: Application[]; onPersist: (c: Array<{ app: Application; touch: boolean }>) => Promise<void>; onStatus: (a: Application, s: ApplicationStatus) => void; onCreate: (s: ApplicationStatus) => void }) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const columns = useMemo(() => {
    const out = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, [] as Application[]])) as Record<ApplicationStatus, Application[]>;
    for (const a of apps) out[a.status].push(a);
    for (const s of APPLICATION_STATUSES) out[s].sort(byOrder);
    return out;
  }, [apps]);
  const active = activeId ? apps.find((a) => a.id === activeId) ?? null : null;

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active: a, over } = e;
    if (!over) return;
    const app = apps.find((x) => x.id === a.id);
    if (!app) return;
    const overId = String(over.id);
    const target: ApplicationStatus | undefined = overId.startsWith('col:') ? (overId.slice(4) as ApplicationStatus) : apps.find((x) => x.id === overId)?.status;
    if (!target) return;
    const list = columns[target].filter((x) => x.id !== app.id);
    let index = overId.startsWith('col:') ? list.length : list.findIndex((x) => x.id === overId);
    if (index < 0) index = list.length;
    // Dropping below the hovered card when moving down within the same column.
    if (target === app.status && !overId.startsWith('col:')) {
      const from = columns[target].findIndex((x) => x.id === app.id);
      const to = columns[target].findIndex((x) => x.id === overId);
      if (from === to) return;
      if (from < to) index = to;
    }
    const moved = target === app.status ? app : withStatus(app, target);
    list.splice(index, 0, moved);
    const changed: Array<{ app: Application; touch: boolean }> = [];
    list.forEach((x, i) => {
      const order = (i + 1) * 1000;
      if (x.id === app.id) changed.push({ app: { ...moved, order }, touch: target !== app.status });
      else if (x.order !== order) changed.push({ app: { ...x, order }, touch: false });
    });
    void onPersist(changed);
    if (target !== app.status) toast({ title: `${app.company || 'Application'} → ${STATUS_LABELS[target]}` });
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="-mx-4 mt-5 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6" role="region" aria-label="Application board" tabIndex={0}>
        <div className="flex min-w-max gap-3">
          {APPLICATION_STATUSES.map((s) => (
            <Column key={s} status={s} apps={columns[s]} onStatus={onStatus} onCreate={onCreate} />
          ))}
        </div>
      </div>
      <DragOverlay>{active ? <CardBody app={active} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}

function Column({ status, apps, onStatus, onCreate }: { status: ApplicationStatus; apps: Application[]; onStatus: (a: Application, s: ApplicationStatus) => void; onCreate: (s: ApplicationStatus) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: colId(status) });
  return (
    <section aria-label={`${STATUS_LABELS[status]} (${apps.length})`} className={cn('flex w-[264px] shrink-0 flex-col rounded-2xl border bg-panel transition-colors', isOver ? 'border-accent/60 bg-accent-soft/40' : 'border-line')}>
      <header className="flex items-center gap-2 px-3 pb-1 pt-3">
        <StatusBadge status={status} />
        <span className="text-[12px] tabular-nums text-fg-subtle">{apps.length}</span>
        <button type="button" onClick={() => onCreate(status)} className="ml-auto grid size-6 place-items-center rounded-md text-fg-subtle hover:bg-hover hover:text-fg" aria-label={`Add application to ${STATUS_LABELS[status]}`} title="Add here">
          <Plus className="size-3.5" />
        </button>
      </header>
      <SortableContext items={apps.map((a) => a.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-[96px] flex-1 flex-col gap-2 p-2">
          {apps.map((a) => (
            <SortableCard key={a.id} app={a} onStatus={onStatus} />
          ))}
          {!apps.length && <li className="grid flex-1 place-items-center rounded-xl border border-dashed border-line px-3 py-6 text-center text-[11.5px] text-fg-subtle">Drop here</li>}
        </ul>
      </SortableContext>
    </section>
  );
}

function SortableCard({ app, onStatus }: { app: Application; onStatus: (a: Application, s: ApplicationStatus) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: app.id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn(isDragging && 'opacity-40')}>
      <CardBody
        app={app}
        handle={
          <button type="button" className="grid size-6 shrink-0 cursor-grab touch-none place-items-center rounded text-fg-subtle hover:bg-hover hover:text-fg active:cursor-grabbing" aria-label={`Drag ${app.company || 'application'}`} {...attributes} {...listeners}>
            <GripVertical className="size-3.5" />
          </button>
        }
        onStatus={onStatus}
      />
    </li>
  );
}

function CardBody({ app, handle, onStatus, overlay }: { app: Application; handle?: ReactNode; onStatus?: (a: Application, s: ApplicationStatus) => void; overlay?: boolean }) {
  const stale = isStale(app);
  const overdue = app.nextStepDate && daysUntil(app.nextStepDate) < 0;
  return (
    <div className={cn('rounded-xl border border-line bg-elevated p-2.5 text-[12.5px]', overlay && 'rotate-1 shadow-float')}>
      <div className="flex items-start gap-1">
        {handle ?? <span className="grid size-6 shrink-0 place-items-center text-fg-subtle"><GripVertical className="size-3.5" /></span>}
        <div className="min-w-0 flex-1">
          <Link to={`/applications/${app.id}`} className="block truncate text-[13px] font-semibold hover:underline">
            {app.company || 'Untitled company'}
          </Link>
          <p className="truncate text-fg-muted">{app.role || 'Role not set'}</p>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 pl-7 text-[11.5px] text-fg-subtle">
        {(app.location || app.workMode) && <span className="truncate">{[app.location, app.workMode && WORK_MODE_LABELS[app.workMode]].filter(Boolean).join(' · ')}</span>}
        {app.nextStepDate && (
          <span className={cn(overdue && 'text-danger')}>
            {app.nextStep || 'Next'}: {formatDay(app.nextStepDate)}
          </span>
        )}
        {stale && <span className="text-warn">{daysSince(app.updatedAt)}d quiet</span>}
      </div>
      {onStatus && (
        <label className="mt-2 block pl-7">
          <span className="sr-only">Move {app.company || 'application'} to</span>
          <select className="app-input h-7 py-0 text-[11.5px]" value={app.status} onChange={(e) => onStatus(app, e.target.value as ApplicationStatus)}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

/* -------------------------------- table -------------------------------- */

function Table({ apps, onStatus }: { apps: Application[]; onStatus: (a: Application, s: ApplicationStatus) => void }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'updatedAt', dir: -1 });
  const [filter, setFilter] = useState<StatusFilter>('all');
  const rows = useMemo(() => {
    const list = apps.filter((a) => (filter === 'all' ? true : filter === 'open' ? !['accepted', 'rejected', 'withdrawn'].includes(a.status) : a.status === filter));
    const val = (a: Application): string | number => (sort.key === 'status' ? APPLICATION_STATUSES.indexOf(a.status) : a[sort.key].toLowerCase());
    return list.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      // Empty values always sort last.
      if (x === '' && y !== '') return 1;
      if (y === '' && x !== '') return -1;
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [apps, filter, sort]);

  const th = (key: SortKey, label: string, className?: string) => {
    const on = sort.key === key;
    return (
      <th scope="col" className={cn('px-3 py-2 text-left font-medium', className)} aria-sort={on ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
        <button type="button" className={cn('inline-flex items-center gap-1 hover:text-fg', on && 'text-fg')} onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : key === 'updatedAt' ? -1 : 1 }))}>
          {label}
          {on && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
        </button>
      </th>
    );
  };

  return (
    <div className="mt-5">
      <Select
        className="w-[200px]"
        label="Status"
        value={filter}
        onChange={(e) => setFilter(e.target.value as StatusFilter)}
        options={[{ value: 'all', label: 'All statuses' }, { value: 'open', label: 'Open (in progress)' }, ...STATUS_OPTIONS]}
      />
      <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-panel">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead className="border-b border-line text-[11.5px] text-fg-muted">
            <tr>
              {th('company', 'Company')}
              {th('role', 'Role')}
              {th('status', 'Status')}
              {th('appliedAt', 'Applied')}
              {th('nextStepDate', 'Next step')}
              {th('updatedAt', 'Updated')}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((a) => (
              <tr key={a.id} className="hover:bg-hover/50">
                <td className="max-w-[220px] px-3 py-2">
                  <Link to={`/applications/${a.id}`} className="block truncate font-semibold hover:underline">
                    {a.company || 'Untitled company'}
                  </Link>
                  {a.location && <span className="block truncate text-[11.5px] text-fg-subtle">{a.location}</span>}
                </td>
                <td className="max-w-[220px] truncate px-3 py-2 text-fg-muted">{a.role}</td>
                <td className="px-3 py-2">
                  <label>
                    <span className="sr-only">Status of {a.company || 'application'}</span>
                    <select className="app-input h-7 w-[130px] py-0 text-[12px]" value={a.status} onChange={(e) => onStatus(a, e.target.value as ApplicationStatus)}>
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-fg-muted">{a.appliedAt ? formatDay(a.appliedAt) : '—'}</td>
                <td className="px-3 py-2 text-fg-muted">
                  {a.nextStepDate ? (
                    <span className={cn('whitespace-nowrap', daysUntil(a.nextStepDate) < 0 && 'text-danger')}>
                      {a.nextStep ? `${a.nextStep} · ` : ''}
                      {formatDay(a.nextStepDate)}
                    </span>
                  ) : (
                    a.nextStep || '—'
                  )}
                </td>
                <td className={cn('whitespace-nowrap px-3 py-2', isStale(a) ? 'text-warn' : 'text-fg-subtle')}>{timeAgo(a.updatedAt)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-fg-subtle">
                  No applications match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
