/**
 * Application tracker persistence (IndexedDB, this device only).
 * Records are validated and merged onto defaults when read, so older data keeps
 * working after the model gains fields.
 */
import { z } from 'zod';
import { getDb } from '@/lib/storage/db';
import { uid } from '@/utils/id';
import { APPLICATION_STATUSES, type Application, type ApplicationStatus } from './types';

const nowIso = () => new Date().toISOString();

/** Local calendar date as YYYY-MM-DD. */
export function today(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const str = z.string().catch('');
const statusSchema = z.enum(APPLICATION_STATUSES);

const applicationSchema = z.object({
  id: z.string().min(1),
  company: str,
  role: str,
  jobUrl: str,
  location: str,
  workMode: z.enum(['', 'onsite', 'hybrid', 'remote']).catch(''),
  salary: str,
  source: str,
  status: statusSchema.catch('wishlist'),
  order: z.number().finite().catch(0),
  savedAt: str,
  appliedAt: str,
  nextStep: str,
  nextStepDate: str,
  contacts: z
    .array(z.unknown())
    .catch([])
    .transform((list) =>
      list.flatMap((c) => {
        const r = z.object({ id: str, name: str, email: str, role: str }).safeParse(c);
        return r.success ? [{ ...r.data, id: r.data.id || uid('ct') }] : [];
      }),
    ),
  notes: str,
  jobDescription: str,
  resumeId: z.string().nullable().catch(null),
  documentId: z.string().nullable().catch(null),
  history: z
    .array(z.unknown())
    .catch([])
    .transform((list) =>
      list.flatMap((h) => {
        const r = z.object({ status: statusSchema, at: z.string() }).safeParse(h);
        return r.success ? [r.data] : [];
      }),
    ),
  createdAt: str,
  updatedAt: str,
});

export function createApplication(over: Partial<Application> = {}): Application {
  const t = nowIso();
  const status = over.status ?? 'wishlist';
  return {
    id: uid('app'),
    company: '',
    role: '',
    jobUrl: '',
    location: '',
    workMode: '',
    salary: '',
    source: '',
    status,
    order: Date.now(),
    savedAt: today(),
    appliedAt: status !== 'wishlist' ? today() : '',
    nextStep: '',
    nextStepDate: '',
    contacts: [],
    notes: '',
    jobDescription: '',
    resumeId: null,
    documentId: null,
    history: [{ status, at: t }],
    createdAt: t,
    updatedAt: t,
    ...over,
  };
}

/** Validates an unknown record; returns null when it is not an application. */
export function normalizeApplication(raw: unknown): Application | null {
  const r = applicationSchema.safeParse(raw);
  if (!r.success) return null;
  const a = r.data as Application;
  const t = nowIso();
  if (!a.createdAt) a.createdAt = a.updatedAt || t;
  if (!a.updatedAt) a.updatedAt = a.createdAt;
  if (!a.savedAt) a.savedAt = a.createdAt.slice(0, 10);
  return a;
}

/**
 * Moves an application to a new status (pure). Records the change in history,
 * and fills in the applied date the first time it leaves the wishlist.
 */
export function withStatus(app: Application, status: ApplicationStatus, at = nowIso()): Application {
  if (app.status === status) return app;
  const appliedAt = !app.appliedAt && app.status === 'wishlist' && status !== 'withdrawn' ? at.slice(0, 10) : app.appliedAt;
  return { ...app, status, appliedAt, history: [...app.history, { status, at }] };
}

/* ------------------------------- CRUD ------------------------------- */

export async function listApplications(): Promise<Application[]> {
  const all = await (await getDb()).getAll('applications');
  return all
    .map(normalizeApplication)
    .filter((a): a is Application => !!a)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getApplication(id: string): Promise<Application | null> {
  const rec = await (await getDb()).get('applications', id);
  return rec ? normalizeApplication(rec) : null;
}

/**
 * Saves an application. `touch: false` keeps `updatedAt` (used for kanban re-ordering,
 * which should not count as activity for "stale" detection).
 */
export async function saveApplication(app: Application, opts: { touch?: boolean } = {}): Promise<Application> {
  const next = opts.touch === false && app.updatedAt ? { ...app } : { ...app, updatedAt: nowIso() };
  await (await getDb()).put('applications', next);
  return next;
}

export async function deleteApplication(id: string): Promise<void> {
  await (await getDb()).delete('applications', id);
}

export async function duplicateApplication(id: string): Promise<Application> {
  const src = await getApplication(id);
  if (!src) throw new Error('Application not found.');
  const t = nowIso();
  const copy = createApplication({
    ...structuredClone(src),
    id: uid('app'),
    role: src.role ? `${src.role} (copy)` : '(copy)',
    status: 'wishlist',
    appliedAt: '',
    history: [{ status: 'wishlist', at: t }],
    order: Date.now(),
    createdAt: t,
    updatedAt: t,
    savedAt: today(),
  });
  copy.contacts = copy.contacts.map((c) => ({ ...c, id: uid('ct') }));
  return saveApplication(copy);
}

/** Changes status and persists. */
export async function moveApplication(id: string, status: ApplicationStatus, order?: number): Promise<Application | null> {
  const app = await getApplication(id);
  if (!app) return null;
  const next = withStatus(app, status);
  return saveApplication({ ...next, order: order ?? next.order });
}
