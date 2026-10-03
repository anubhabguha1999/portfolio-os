import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Copy, ExternalLink, MessagesSquare, Plus, Trash2, TriangleAlert, UserRound, X } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { Button, IconButton, Spinner } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Card, EmptyState, SectionLabel } from '@/components/ui/misc';
import { Select, TextArea, TextInput } from '@/components/ui/Field';
import { toast } from '@/stores/ui';
import { BRAND } from '@/config/brand';
import { uid } from '@/utils/id';
import { timeAgo } from '@/utils/format';
import {
  APPLICATION_STATUSES,
  STATUS_LABELS,
  WORK_MODE_LABELS,
  deleteApplication,
  duplicateApplication,
  getApplication,
  saveApplication,
  withStatus,
  type Application,
  type ApplicationContact,
  type ApplicationStatus,
  type WorkMode,
} from '@/lib/applications';
import { StatusBadge, formatDay, relativeDay, useStudioDocs } from './shared';

const NEXT_STAGE: Partial<Record<ApplicationStatus, ApplicationStatus>> = { wishlist: 'applied', applied: 'screening', screening: 'interview', interview: 'offer', offer: 'accepted' };

const SOURCES = ['LinkedIn', 'Company website', 'Referral', 'Recruiter', 'Job board', 'Networking', 'Other'];

const safeUrl = (u: string) => (/^https?:\/\//i.test(u.trim()) ? u.trim() : u.trim() ? `https://${u.trim()}` : '');

export default function ApplicationPage() {
  const { id } = useParams();
  const [state, setState] = useState<{ status: 'loading' } | { status: 'missing' } | { status: 'ready'; app: Application }>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    void getApplication(id ?? '')
      .then((app) => alive && setState(app ? { status: 'ready', app } : { status: 'missing' }))
      .catch(() => alive && setState({ status: 'missing' }));
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <div className="flex min-h-full flex-col bg-bg text-fg">
      <SiteHeader />
      {state.status === 'loading' ? (
        <div className="grid flex-1 place-items-center py-24 text-fg-subtle" role="status" aria-label="Loading application">
          <Spinner className="size-5" />
        </div>
      ) : state.status === 'missing' ? (
        <EmptyState
          className="flex-1 py-24"
          icon={<TriangleAlert className="size-5" />}
          title="Application not found"
          description="It may have been deleted, or it was created in another browser."
          action={
            <Link to="/applications" className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-[13px] font-semibold text-accent-fg hover:bg-accent-strong">
              <ArrowLeft className="size-4" /> Back to applications
            </Link>
          }
        />
      ) : (
        <Editor key={state.app.id} initial={state.app} />
      )}
    </div>
  );
}

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

function Editor({ initial }: { initial: Application }) {
  const navigate = useNavigate();
  const [app, setApp] = useState(initial);
  const [save, setSave] = useState<SaveState>('saved');
  const [deleting, setDeleting] = useState(false);
  const docs = useStudioDocs();
  const latest = useRef(app);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    document.title = `${app.company || 'Application'}${app.role ? ` · ${app.role}` : ''} — ${BRAND.name}`;
  }, [app.company, app.role]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current) return;
    dirty.current = false;
    setSave('saving');
    try {
      const saved = await saveApplication(latest.current);
      latest.current = { ...latest.current, updatedAt: saved.updatedAt };
      setApp((a) => ({ ...a, updatedAt: saved.updatedAt }));
      setSave(dirty.current ? 'dirty' : 'saved');
    } catch (err) {
      dirty.current = true;
      setSave('error');
      toast({ tone: 'error', title: 'Could not save', description: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  // Save on leave.
  useEffect(() => {
    const onHide = () => void flush();
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      void flush();
    };
  }, [flush]);

  const update = (patch: Partial<Application> | ((a: Application) => Application)) => {
    const next = typeof patch === 'function' ? patch(latest.current) : { ...latest.current, ...patch };
    latest.current = next;
    setApp(next);
    dirty.current = true;
    setSave('dirty');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 600);
  };

  const setStatus = (s: ApplicationStatus) => update((a) => withStatus(a, s));
  const next = NEXT_STAGE[app.status];

  const setContact = (cid: string, patch: Partial<ApplicationContact>) => update((a) => ({ ...a, contacts: a.contacts.map((c) => (c.id === cid ? { ...c, ...patch } : c)) }));

  const resume = docs.resumes.find((r) => r.id === app.resumeId);
  const document_ = docs.documents.find((d) => d.id === app.documentId);
  const url = safeUrl(app.jobUrl);

  return (
    <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
      <Link to="/applications" className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-muted hover:text-fg">
        <ArrowLeft className="size-3.5" /> All applications
      </Link>

      <header className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={app.status} />
            <span className="text-[12px] text-fg-subtle" aria-live="polite">
              {save === 'saving' ? 'Saving…' : save === 'dirty' ? 'Unsaved changes' : save === 'error' ? 'Save failed' : `Saved · ${timeAgo(app.updatedAt)}`}
            </span>
          </div>
          <h1 className="mt-1.5 truncate text-[clamp(1.6rem,4vw,2.2rem)] font-semibold tracking-[-0.03em]">{app.company || 'New application'}</h1>
          <p className="truncate text-[14px] text-fg-muted">{app.role || 'Add the role below'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/interview?application=${app.id}`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-elevated px-3.5 text-[13px] font-medium hover:border-line-strong">
            <MessagesSquare className="size-4" /> Prep interview
          </Link>
          <Button
            icon={<Copy className="size-4" />}
            onClick={async () => {
              await flush();
              const copy = await duplicateApplication(app.id);
              toast({ tone: 'success', title: 'Application duplicated' });
              navigate(`/applications/${copy.id}`);
            }}
          >
            Duplicate
          </Button>
          <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setDeleting(true)}>
            Delete
          </Button>
        </div>
      </header>

      {/* Status */}
      <Card as="section" className="mt-6 p-4 sm:p-5">
        <SectionLabel>Status</SectionLabel>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Select className="w-[200px]" label="Current stage" value={app.status} onChange={(e) => setStatus(e.target.value as ApplicationStatus)} options={APPLICATION_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))} />
          {next && (
            <Button variant="primary" iconRight={<ArrowRight className="size-4" />} onClick={() => setStatus(next)}>
              Move to {STATUS_LABELS[next]}
            </Button>
          )}
          {app.status !== 'rejected' && app.status !== 'accepted' && app.status !== 'withdrawn' && (
            <>
              <Button variant="ghost" onClick={() => setStatus('rejected')}>
                Mark rejected
              </Button>
              <Button variant="ghost" onClick={() => setStatus('withdrawn')}>
                Withdraw
              </Button>
            </>
          )}
        </div>
        <ol className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-fg-muted" aria-label="Status history">
          {app.history.map((h, i) => (
            <li key={`${h.at}-${i}`} className="inline-flex items-center gap-1.5">
              <Check className="size-3 text-accent" aria-hidden="true" />
              <span className="font-medium text-fg">{STATUS_LABELS[h.status]}</span>
              <span className="text-fg-subtle">{new Date(h.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </li>
          ))}
        </ol>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Job */}
        <Card as="section" className="p-4 sm:p-5">
          <SectionLabel>Job</SectionLabel>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <TextInput label="Company" value={app.company} onChange={(e) => update({ company: e.target.value })} placeholder="Acme Inc." autoFocus={!initial.company} />
            <TextInput label="Role" value={app.role} onChange={(e) => update({ role: e.target.value })} placeholder="Senior Frontend Engineer" />
            <div className="sm:col-span-2">
              <TextInput
                label="Job URL"
                type="url"
                inputMode="url"
                value={app.jobUrl}
                onChange={(e) => update({ jobUrl: e.target.value })}
                placeholder="https://…"
                help={
                  url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                      Open posting <ExternalLink className="size-3" />
                    </a>
                  ) : undefined
                }
              />
            </div>
            <TextInput label="Location" value={app.location} onChange={(e) => update({ location: e.target.value })} placeholder="Berlin, Germany" />
            <Select label="Work mode" value={app.workMode} onChange={(e) => update({ workMode: e.target.value as WorkMode })} options={(Object.keys(WORK_MODE_LABELS) as WorkMode[]).map((k) => ({ value: k, label: WORK_MODE_LABELS[k] }))} />
            <TextInput label="Salary range" value={app.salary} onChange={(e) => update({ salary: e.target.value })} placeholder="€70–85k + equity" />
            <div>
              <TextInput label="Source" list="application-sources" value={app.source} onChange={(e) => update({ source: e.target.value })} placeholder="LinkedIn, referral…" />
              <datalist id="application-sources">
                {SOURCES.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
          </div>
        </Card>

        {/* Dates */}
        <Card as="section" className="p-4 sm:p-5">
          <SectionLabel>Dates &amp; next step</SectionLabel>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <TextInput label="Saved" type="date" value={app.savedAt} onChange={(e) => update({ savedAt: e.target.value })} />
            <TextInput label="Applied" type="date" value={app.appliedAt} onChange={(e) => update({ appliedAt: e.target.value })} />
            <TextInput label="Next step" value={app.nextStep} onChange={(e) => update({ nextStep: e.target.value })} placeholder="Technical interview, follow up…" />
            <TextInput
              label="Next step date"
              type="date"
              value={app.nextStepDate}
              onChange={(e) => update({ nextStepDate: e.target.value })}
              help={app.nextStepDate ? `${formatDay(app.nextStepDate)} · ${relativeDay(app.nextStepDate)}` : undefined}
            />
          </div>
        </Card>

        {/* Materials */}
        <Card as="section" className="p-4 sm:p-5">
          <SectionLabel>What you sent</SectionLabel>
          <div className="mt-3 grid gap-3">
            <PickerRow
              label="Resume version"
              value={app.resumeId ?? ''}
              onChange={(v) => update({ resumeId: v || null })}
              options={docs.resumes.map((r) => ({ value: r.id, label: r.name }))}
              missing={!!app.resumeId && docs.loaded && !resume}
              openTo={resume ? `/resume/${resume.id}` : null}
              empty={docs.loaded && !docs.resumes.length ? <Link to="/resumes" className="text-accent hover:underline">Create a resume →</Link> : null}
            />
            <PickerRow
              label="Cover letter / document"
              value={app.documentId ?? ''}
              onChange={(v) => update({ documentId: v || null })}
              options={docs.documents.map((d) => ({ value: d.id, label: d.kind === 'cover-letter' ? `${d.name} (cover letter)` : d.name }))}
              missing={!!app.documentId && docs.loaded && !document_}
              openTo={document_ ? `/document/${document_.id}` : null}
              empty={docs.loaded && !docs.documents.length ? <Link to="/documents" className="text-accent hover:underline">Create a cover letter →</Link> : null}
            />
          </div>
        </Card>

        {/* Contacts */}
        <Card as="section" className="p-4 sm:p-5">
          <SectionLabel
            action={
              <Button size="xs" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => update((a) => ({ ...a, contacts: [...a.contacts, { id: uid('ct'), name: '', email: '', role: '' }] }))}>
                Add contact
              </Button>
            }
          >
            Contacts
          </SectionLabel>
          {app.contacts.length ? (
            <ul className="mt-3 space-y-3">
              {app.contacts.map((c, i) => (
                <li key={c.id} className="rounded-xl border border-line bg-bg p-3">
                  <div className="flex items-center gap-2">
                    <UserRound className="size-3.5 text-fg-subtle" aria-hidden="true" />
                    <span className="flex-1 text-[12px] font-medium text-fg-muted">Contact {i + 1}</span>
                    {c.email.trim() && (
                      <a href={`mailto:${c.email.trim()}`} className="text-[12px] text-accent hover:underline">
                        Email
                      </a>
                    )}
                    <IconButton size="xs" label={`Remove contact ${c.name || i + 1}`} onClick={() => update((a) => ({ ...a, contacts: a.contacts.filter((x) => x.id !== c.id) }))}>
                      <X className="size-3.5" />
                    </IconButton>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <TextInput label="Name" value={c.name} onChange={(e) => setContact(c.id, { name: e.target.value })} />
                    <TextInput label="Email" type="email" value={c.email} onChange={(e) => setContact(c.id, { email: e.target.value })} />
                    <TextInput label="Role" value={c.role} onChange={(e) => setContact(c.id, { role: e.target.value })} placeholder="Recruiter" />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[12.5px] text-fg-subtle">Recruiters, hiring managers and referrers for this role.</p>
          )}
        </Card>
      </div>

      <Card as="section" className="mt-4 p-4 sm:p-5">
        <SectionLabel>Notes</SectionLabel>
        <TextArea className="mt-3" rows={5} value={app.notes} onChange={(e) => update({ notes: e.target.value })} placeholder="Interview feedback, questions to ask, follow-ups…" aria-label="Notes" />
      </Card>

      <Card as="section" className="mt-4 p-4 sm:p-5">
        <SectionLabel>Job description</SectionLabel>
        <TextArea
          className="mt-3"
          rows={10}
          value={app.jobDescription}
          onChange={(e) => update({ jobDescription: e.target.value })}
          placeholder="Paste the job description — postings disappear, and Interview prep uses it to suggest questions."
          aria-label="Job description"
          help={app.jobDescription.trim() ? `${app.jobDescription.trim().split(/\s+/).length} words` : undefined}
        />
      </Card>

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={async () => {
          if (timer.current) clearTimeout(timer.current);
          dirty.current = false;
          await deleteApplication(app.id);
          toast({ title: `Deleted ${app.company || 'application'}` });
          navigate('/applications');
        }}
        title={`Delete ${app.company ? `“${app.company}”` : 'this application'}?`}
        description="The linked resume and documents are not affected."
        confirmLabel="Delete application"
      />
    </main>
  );
}

function PickerRow({ label, value, onChange, options, openTo, missing, empty }: { label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }>; openTo: string | null; missing: boolean; empty: ReactNode }) {
  return (
    <div className="flex items-end gap-2">
      <Select
        className="min-w-0 flex-1"
        label={label}
        value={missing ? '' : value}
        onChange={(e) => onChange(e.target.value)}
        options={[{ value: '', label: missing ? 'Deleted — pick another' : 'None' }, ...options]}
        help={empty ?? undefined}
      />
      {openTo && (
        <Link to={openTo} className="mb-[1px] inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-elevated px-3 text-[12.5px] font-medium hover:border-line-strong">
          Open <ExternalLink className="size-3.5" />
        </Link>
      )}
    </div>
  );
}
