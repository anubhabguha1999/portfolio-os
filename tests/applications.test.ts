import { describe, it, expect } from 'vitest';
import {
  applicationsToCsv,
  computeStats,
  createApplication,
  csvCell,
  deleteApplication,
  duplicateApplication,
  getApplication,
  isStale,
  listApplications,
  moveApplication,
  normalizeApplication,
  saveApplication,
  withStatus,
} from '@/lib/applications';
import { DB_VERSION, getDb } from '@/lib/storage/db';

const DAY = 86_400_000;

describe('applications repository', () => {
  it('uses DB version 4 with an applications store indexed by updatedAt', async () => {
    expect(DB_VERSION).toBe(4);
    const db = await getDb();
    expect(db.objectStoreNames.contains('applications')).toBe(true);
    const tx = db.transaction('applications');
    expect(tx.store.indexNames.contains('byUpdated')).toBe(true);
    await tx.done;
  });

  it('creates, lists, updates, duplicates and deletes', async () => {
    const a = await saveApplication(createApplication({ company: 'Acme', role: 'Engineer', contacts: [{ id: 'c1', name: 'Jo', email: 'jo@acme.test', role: 'Recruiter' }] }));
    expect(a.updatedAt).toBeTruthy();
    expect((await listApplications()).map((x) => x.id)).toContain(a.id);

    await saveApplication({ ...a, notes: 'Referral from Sam' });
    expect((await getApplication(a.id))!.notes).toBe('Referral from Sam');

    const dup = await duplicateApplication(a.id);
    expect(dup.id).not.toBe(a.id);
    expect(dup.status).toBe('wishlist');
    expect(dup.contacts[0]!.id).not.toBe('c1');

    await deleteApplication(a.id);
    await deleteApplication(dup.id);
    expect(await getApplication(a.id)).toBeNull();
  });

  it('keeps updatedAt when saving with touch: false', async () => {
    const old = new Date(Date.now() - 20 * DAY).toISOString();
    const a = await saveApplication({ ...createApplication({ company: 'Old' }), updatedAt: old }, { touch: false });
    expect(a.updatedAt).toBe(old);
    expect((await getApplication(a.id))!.updatedAt).toBe(old);
    await deleteApplication(a.id);
  });

  it('moves between statuses and records history', async () => {
    const a = await saveApplication(createApplication({ company: 'Move Co' }));
    expect(a.appliedAt).toBe('');
    const moved = await moveApplication(a.id, 'applied');
    expect(moved!.status).toBe('applied');
    expect(moved!.appliedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(moved!.history.map((h) => h.status)).toEqual(['wishlist', 'applied']);
    await deleteApplication(a.id);
  });

  it('normalises partial or invalid records', () => {
    expect(normalizeApplication(null)).toBeNull();
    expect(normalizeApplication({ company: 'No id' })).toBeNull();
    const n = normalizeApplication({ id: 'x', company: 'Legacy', status: 'bogus', contacts: [{ name: 'A' }, 5], history: [{ status: 'nope', at: '' }], updatedAt: '2024-01-01T00:00:00.000Z' })!;
    expect(n.status).toBe('wishlist');
    expect(n.role).toBe('');
    expect(n.contacts).toHaveLength(1);
    expect(n.contacts[0]!.id).toBeTruthy();
    expect(n.history).toEqual([]);
    expect(n.createdAt).toBe('2024-01-01T00:00:00.000Z');
    expect(n.savedAt).toBe('2024-01-01');
  });
});

describe('status transitions', () => {
  it('sets the applied date only when first leaving the wishlist', () => {
    const at = '2026-03-02T10:00:00.000Z';
    const a = withStatus(createApplication(), 'screening', at);
    expect(a.appliedAt).toBe('2026-03-02');
    const b = withStatus(a, 'interview', '2026-04-01T10:00:00.000Z');
    expect(b.appliedAt).toBe('2026-03-02');
    expect(b.history.map((h) => h.status)).toEqual(['wishlist', 'screening', 'interview']);
  });

  it('withdrawing from the wishlist does not mark it applied; same status is a no-op', () => {
    const w = createApplication();
    const x = withStatus(w, 'withdrawn');
    expect(x.appliedAt).toBe('');
    expect(withStatus(x, 'withdrawn')).toBe(x);
  });
});

describe('stats', () => {
  const now = Date.parse('2026-06-30T12:00:00.000Z');
  const recent = new Date(now - 2 * DAY).toISOString();
  const old = new Date(now - 15 * DAY).toISOString();
  const mk = (over: Parameters<typeof createApplication>[0]) => createApplication({ updatedAt: recent, ...over });

  const apps = [
    mk({ status: 'wishlist', updatedAt: old }),
    mk({ status: 'applied', updatedAt: old, nextStepDate: '2026-07-05', nextStep: 'Follow up' }),
    mk({ status: 'interview', nextStepDate: '2026-07-01' }),
    mk({ status: 'rejected', updatedAt: old }),
    mk({ status: 'offer' }),
    mk({ status: 'withdrawn', appliedAt: '' }),
  ];

  it('counts per stage, response rate, upcoming and stale', () => {
    const s = computeStats(apps, now);
    expect(s.total).toBe(6);
    expect(s.counts.wishlist).toBe(1);
    expect(s.counts.interview).toBe(1);
    // Sent: applied, interview, rejected, offer (withdrawn from wishlist and wishlist are not).
    expect(s.applied).toBe(4);
    expect(s.responded).toBe(3);
    expect(s.responseRate).toBeCloseTo(0.75);
    expect(s.upcoming.map((a) => a.nextStepDate)).toEqual(['2026-07-01', '2026-07-05']);
    // Rejected is closed so not stale.
    expect(s.stale.map((a) => a.status)).toEqual(['wishlist', 'applied']);
    expect(isStale(apps[3]!, now)).toBe(false);
  });

  it('response rate is null with nothing sent', () => {
    expect(computeStats([createApplication()], now).responseRate).toBeNull();
  });

  it('a rejection reached via history still counts as a response', () => {
    const a = withStatus(withStatus(createApplication(), 'screening'), 'withdrawn');
    const s = computeStats([a], now);
    expect(s.applied).toBe(1);
    expect(s.responded).toBe(1);
  });
});

describe('CSV export', () => {
  it('escapes quotes, commas and newlines and neutralises formulas', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell(null)).toBe('');
    expect(csvCell(42)).toBe('42');
  });

  it('writes a header and one row per application with resolved names', () => {
    const a = createApplication({ company: 'Acme, Inc.', role: 'Dev', status: 'applied', resumeId: 'r1', notes: 'multi\nline', contacts: [{ id: 'c', name: 'Jo', email: 'jo@x.test', role: 'HR' }] });
    const csv = applicationsToCsv([a], { resumes: { r1: 'Backend resume' } });
    const lines = csv.split('\r\n');
    expect(lines[0]!.startsWith('Company,Role,Status')).toBe(true);
    expect(csv).toContain('"Acme, Inc.",Dev,Applied');
    expect(csv).toContain('Backend resume');
    expect(csv).toContain('Jo (HR) <jo@x.test>');
    expect(csv).toContain('"multi\nline"');
  });
});
