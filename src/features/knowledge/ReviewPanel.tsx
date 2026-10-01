import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, FileText, Globe, Pencil, Plus, UserRound, X } from 'lucide-react';
import { Menu } from '@/components/ui/Menu';
import { listProjects, type ProjectSummary } from '@/lib/storage/projects';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { toast } from '@/stores/ui';
import { useWorkspace } from '@/studio/store/workspace';
import { RESUME_TEMPLATES } from '@/studio/templates/resume';
import { formatRange } from '@/utils/format';
import { cn } from '@/utils/cn';
import { ALL_SCOPE, buildReview, type Decision, type DuplicateMode, type Review, type ReviewItem } from '@/knowledge/import/review';
import { addToExistingPortfolio, commitReview, createPortfolioFromLibrary, createResumeFromImport } from '@/knowledge/import/targets';
import { patchDoc } from '@/knowledge/storage/repo';
import type { Provenance, SemanticResume } from '@/knowledge/types';
import { ConfidenceBadge } from './shared';

const KIND_LABEL: Record<ReviewItem['kind'], string> = { experience: 'Experience', projects: 'Projects', education: 'Education', skills: 'Skills', certifications: 'Certifications', achievements: 'Achievements' };

function DecisionButtons({ value, onChange, onEdit, editing }: { value: Decision; onChange: (d: Decision) => void; onEdit?: () => void; editing?: boolean }) {
  const btn = (active: boolean, tone: string) => cn('inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11.5px] font-medium transition-colors', active ? tone : 'border-line text-fg-muted hover:border-line-strong hover:text-fg');
  return (
    <div className="flex shrink-0 gap-1" role="group" aria-label="Decision">
      <button type="button" aria-pressed={value === 'accept'} onClick={() => onChange('accept')} className={btn(value === 'accept', 'border-ok bg-ok text-white shadow-sm')}>
        <Check className="size-3" /> {value === 'accept' ? 'Accepted' : 'Accept'}
      </button>
      {onEdit && (
        <button type="button" aria-pressed={!!editing} onClick={onEdit} className={btn(!!editing, 'border-accent/50 bg-accent-soft text-fg')}>
          <Pencil className="size-3" /> Edit
        </button>
      )}
      <button type="button" aria-pressed={value === 'ignore'} onClick={() => onChange('ignore')} className={btn(value === 'ignore', 'border-danger/60 bg-danger/15 text-danger')}>
        <X className="size-3" /> {value === 'ignore' ? 'Ignored' : 'Ignore'}
      </button>
    </div>
  );
}

function SourceLink({ source, onShow }: { source: Provenance | null; onShow: (s: Provenance) => void }) {
  if (!source) return null;
  return (
    <button type="button" onClick={() => onShow(source)} className="text-[11px] text-fg-subtle underline-offset-2 hover:text-accent hover:underline">
      Source: {source.docName} — Page {source.page}
    </button>
  );
}

const input = 'h-8 w-full rounded-md border border-line bg-bg px-2 text-[12.5px] outline-none focus:border-accent';

export function ReviewPanel({ semantic, docId, docName, onShowSource }: { semantic: SemanticResume; docId: string; docName: string; onShowSource: (s: Provenance) => void }) {
  const navigate = useNavigate();
  const profile = useWorkspace((s) => s.profile);
  const library = useWorkspace((s) => s.library);
  // Built once per mount: the parent keys this panel by extraction and waits for the workspace,
  // so duplicate checks see the current library.
  const [review, setReview] = useState<Review>(() => buildReview(semantic, docId, docName, profile, library));
  const [editing, setEditing] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [resumeDialog, setResumeDialog] = useState(false);
  const [template, setTemplate] = useState(RESUME_TEMPLATES[0]?.id ?? 'ats-minimal');
  const [portfolios, setPortfolios] = useState<ProjectSummary[]>([]);
  useEffect(() => {
    void listProjects()
      .then(setPortfolios)
      .catch(() => {});
  }, []);

  const toggleEdit = (id: string) =>
    setEditing((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const setProfileField = (key: string, patch: Partial<Review['profile'][number]>) => setReview((r) => ({ ...r, profile: r.profile.map((f) => (f.key === key ? { ...f, ...patch } : f)) }));
  const setItem = (uid: string, patch: Partial<ReviewItem> | ((it: ReviewItem) => ReviewItem)) =>
    setReview((r) => ({ ...r, items: r.items.map((it) => (it.uid === uid ? (typeof patch === 'function' ? patch(it) : ({ ...it, ...patch } as ReviewItem)) : it)) }));
  const setValue = (uid: string, patch: Record<string, unknown>) => setItem(uid, (it) => ({ ...it, value: { ...it.value, ...patch } }) as ReviewItem);

  const accepted = review.profile.filter((f) => f.decision === 'accept').length + review.social.filter((s) => s.decision === 'accept' && !s.exists).length + review.items.filter((i) => i.decision === 'accept' && !(i.duplicateOf && i.duplicateMode === 'ignore')).length + review.languages.filter((l) => l.decision === 'accept').length;
  const groups = (Object.keys(KIND_LABEL) as ReviewItem['kind'][]).map((k) => [k, review.items.filter((i) => i.kind === k)] as const).filter(([, list]) => list.length);

  const commit = async (target: 'library' | 'profile' | 'resume' | 'portfolio' | { portfolio: ProjectSummary }) => {
    setBusy(true);
    try {
      const res = await commitReview(review, target === 'profile' ? { profile: true, kinds: [] } : ALL_SCOPE);
      await patchDoc(docId, { status: 'completed' });
      const summary = `${res.counts.profileFields} profile field${res.counts.profileFields === 1 ? '' : 's'}, ${res.counts.added} new item${res.counts.added === 1 ? '' : 's'}, ${res.counts.merged} merged`;
      if (target === 'resume') {
        const r = await createResumeFromImport(semantic.profile.name.value ? `${semantic.profile.name.value} — Resume` : 'Imported resume', template, res.library, res.entries, res.touched);
        toast({ tone: 'success', title: 'Resume created from PDF', description: summary });
        navigate(`/resume/${r.id}`);
        return;
      }
      if (typeof target === 'object') {
        const r = await addToExistingPortfolio(target.portfolio.id, res.touched);
        toast({
          tone: r.locked.length ? 'warning' : 'success',
          title: `Added to “${target.portfolio.name}”`,
          description: `${summary}. ${r.added} item${r.added === 1 ? '' : 's'} placed in its sections${r.locked.length ? `; locked sections skipped: ${r.locked.join(', ')}` : ''}.`,
        });
        navigate(`/builder/${target.portfolio.id}`);
        return;
      }
      if (target === 'portfolio') {
        const id = await createPortfolioFromLibrary(res.touched);
        toast({ tone: 'success', title: 'Portfolio created from PDF', description: `${summary}. Linked to your shared library.` });
        navigate(`/builder/${id}`);
        return;
      }
      setDone(summary);
      toast({ tone: 'success', title: 'Imported into your shared profile', description: summary });
    } catch (err) {
      toast({ tone: 'error', title: 'Import failed', description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 pb-28">
      <div className="rounded-xl border border-line bg-bg px-3.5 py-3 text-[12.5px] text-fg-muted">
        <p className="font-semibold text-fg">Import review</p>
        <p className="mt-0.5">Detected by local rules — check each field. Nothing changes until you import, and existing values are never overwritten silently.</p>
      </div>

      {review.profile.length > 0 && (
        <Group title="Profile">
          {review.profile.map((f) => {
            const id = `p:${f.key}`;
            const differs = f.existing && f.existing.toLowerCase() !== f.value.toLowerCase();
            return (
              <Row key={f.key} label={f.label} decision={f.decision} onDecision={(d) => setProfileField(f.key, { decision: d })} editing={editing.has(id)} onEdit={() => toggleEdit(id)} footer={<><ConfidenceBadge value={f.confidence} /> <SourceLink source={f.source} onShow={onShowSource} /></>}>
                {editing.has(id) ? (
                  f.key === 'bio' ? (
                    <textarea className={cn(input, 'h-24 py-1.5')} value={f.value} onChange={(e) => setProfileField(f.key, { value: e.target.value, decision: 'accept' })} aria-label={f.label} />
                  ) : (
                    <input className={input} value={f.value} onChange={(e) => setProfileField(f.key, { value: e.target.value, decision: 'accept' })} aria-label={f.label} />
                  )
                ) : (
                  <p className={cn('text-[13px] text-fg', f.key === 'bio' && 'line-clamp-3')}>{f.value}</p>
                )}
                {f.value !== f.original && <p className="mt-0.5 text-[11px] text-fg-subtle">Detected: {f.original} · Modified locally</p>}
                {differs && (
                  <p className="mt-1 text-[11.5px] text-warn">
                    Current profile: <span className="text-fg">{f.existing}</span> — accept to replace it.
                  </p>
                )}
                {!differs && f.existing && <p className="mt-1 text-[11.5px] text-fg-subtle">Already in your profile.</p>}
              </Row>
            );
          })}
          {review.social.map((s) => (
            <Row key={s.uid} label={s.platform} decision={s.decision} onDecision={(d) => setReview((r) => ({ ...r, social: r.social.map((x) => (x.uid === s.uid ? { ...x, decision: d } : x)) }))} footer={<SourceLink source={s.source} onShow={onShowSource} />}>
              <p className="break-all text-[12.5px] text-fg">{s.url}</p>
              {s.exists && <p className="mt-0.5 text-[11.5px] text-fg-subtle">Already in your profile.</p>}
            </Row>
          ))}
        </Group>
      )}

      {groups.map(([kind, list]) => (
        <Group key={kind} title={`${KIND_LABEL[kind]} × ${list.length}`}>
          {kind === 'skills' ? (
            <div className="flex flex-wrap gap-1.5 p-3">
              {list.map((it) => {
                const v = it.value as { name: string; original?: string };
                const on = it.decision === 'accept' && !(it.duplicateOf && it.duplicateMode === 'ignore');
                return (
                  <button
                    key={it.uid}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setItem(it.uid, { decision: on ? 'ignore' : 'accept', ...(it.duplicateOf ? { duplicateMode: on ? 'ignore' : 'merge' } : {}) } as Partial<ReviewItem>)}
                    title={`${Math.round(it.confidence * 100)}% confidence${v.original && v.original !== v.name ? ` · from “${v.original}”` : ''}${it.duplicateOf ? ` · possible duplicate of “${it.duplicateLabel}” (merged, not duplicated)` : ''}`}
                    className={cn('inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[12px]', on ? 'border-accent/50 bg-accent-soft text-fg' : 'border-line text-fg-subtle line-through', it.confidence < 0.75 && on && 'border-warn/50')}
                  >
                    {on ? <Check className="size-3" /> : <X className="size-3" />}
                    {v.name}
                    {v.original && v.original !== v.name && <span className="text-[10.5px] text-fg-subtle">({v.original})</span>}
                    {it.duplicateOf && <span className="text-[10.5px] text-warn">dup</span>}
                  </button>
                );
              })}
              <p className="w-full pt-1 text-[11px] text-fg-subtle">Tap to accept or ignore. Amber = lower confidence. “dup” = already in your library under another spelling; it is merged, never duplicated.</p>
            </div>
          ) : (
            list.map((it) => <ItemRow key={it.uid} it={it} editing={editing.has(it.uid)} onEdit={() => toggleEdit(it.uid)} onDecision={(d) => setItem(it.uid, { decision: d })} onDup={(m) => setItem(it.uid, { duplicateMode: m })} onValue={(p) => setValue(it.uid, p)} onShowSource={onShowSource} />)
          )}
        </Group>
      ))}

      {review.languages.length > 0 && (
        <Group title={`Languages × ${review.languages.length}`}>
          {review.languages.map((l) => (
            <Row key={l.uid} label={l.language} decision={l.decision} onDecision={(d) => setReview((r) => ({ ...r, languages: r.languages.map((x) => (x.uid === l.uid ? { ...x, decision: d } : x)) }))}>
              <p className="text-[12.5px] text-fg-muted">{l.fluency || 'Fluency not stated'}</p>
            </Row>
          ))}
        </Group>
      )}

      {!review.profile.length && !groups.length && <p className="text-[13px] text-fg-muted">Nothing resume-like was detected in this document.</p>}

      <div className="sticky bottom-0 -mx-4 border-t border-line bg-panel/95 px-4 py-3 backdrop-blur">
        {done && <p className="mb-2 text-[12px] text-ok">✓ Imported: {done}. It is now available in every studio.</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" loading={busy} disabled={!accepted} icon={<Check className="size-3.5" />} onClick={() => void commit('library')}>
            Import selected data ({accepted})
          </Button>
          <Button size="sm" disabled={busy || !review.profile.some((f) => f.decision === 'accept')} icon={<UserRound className="size-3.5" />} onClick={() => void commit('profile')}>
            Profile only
          </Button>
          <Button size="sm" disabled={busy || !accepted} icon={<FileText className="size-3.5" />} onClick={() => setResumeDialog(true)}>
            New resume
          </Button>
          {portfolios.length ? (
            <Menu
              label="Use in a portfolio"
              align="start"
              header={<p className="px-2.5 pb-1 pt-1.5 text-[11px] text-fg-subtle">Import, then place the items in portfolio sections</p>}
              trigger={(p) => (
                <Button {...p} size="sm" disabled={busy || !accepted} icon={<Globe className="size-3.5" />} iconRight={<ChevronDown className="size-3" />}>
                  Portfolio
                </Button>
              )}
              items={[
                { label: 'New portfolio', icon: <Plus />, onSelect: () => void commit('portfolio') },
                'separator',
                ...portfolios.map((pf) => ({ label: `Add to “${pf.name}”`, icon: <Globe />, onSelect: () => void commit({ portfolio: pf }) })),
              ]}
            />
          ) : (
            <Button size="sm" disabled={busy || !accepted} icon={<Globe className="size-3.5" />} onClick={() => void commit('portfolio')}>
              New portfolio
            </Button>
          )}
        </div>
      </div>

      <Dialog
        open={resumeDialog}
        onClose={() => setResumeDialog(false)}
        size="md"
        title="Create a resume from this PDF"
        description="Accepted data goes into your shared profile and library, then a new resume opens in Resume Studio. You can switch templates at any time."
        footer={
          <>
            <Button variant="ghost" onClick={() => setResumeDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={busy}
              iconRight={<ArrowRight className="size-3.5" />}
              onClick={() => {
                setResumeDialog(false);
                void commit('resume');
              }}
            >
              Import &amp; open Resume Studio
            </Button>
          </>
        }
      >
        <div className="grid gap-1.5 sm:grid-cols-2">
          {RESUME_TEMPLATES.map((t) => (
            <label key={t.id} className={cn('flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[13px]', template === t.id ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong')}>
              <input type="radio" name="tpl" checked={template === t.id} onChange={() => setTemplate(t.id)} />
              {t.name}
            </label>
          ))}
        </div>
      </Dialog>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">{title}</h3>
      <div className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">{children}</div>
    </section>
  );
}

function Row({ label, decision, onDecision, editing, onEdit, footer, children }: { label: string; decision: Decision; onDecision: (d: Decision) => void; editing?: boolean; onEdit?: () => void; footer?: ReactNode; children: ReactNode }) {
  return (
    <div className={cn('grid gap-1.5 px-3 py-2.5 transition-colors', decision === 'ignore' ? 'bg-hover/40' : 'border-l-2 border-ok/60')}>
      <div className="flex items-start justify-between gap-3">
        <span className="flex items-center gap-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-subtle">
          {label}
          {decision === 'ignore' && <span className="rounded bg-fg-subtle/15 px-1.5 py-px text-[10px] tracking-normal text-fg-subtle">Not imported</span>}
        </span>
        <DecisionButtons value={decision} onChange={onDecision} {...(onEdit ? { onEdit } : {})} editing={!!editing} />
      </div>
      <div className={cn('min-w-0 transition-opacity', decision === 'ignore' && 'opacity-45 [&_p]:line-through')}>{children}</div>
      {footer && <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', decision === 'ignore' && 'opacity-45')}>{footer}</div>}
    </div>
  );
}

function ItemRow({ it, editing, onEdit, onDecision, onDup, onValue, onShowSource }: { it: ReviewItem; editing: boolean; onEdit: () => void; onDecision: (d: Decision) => void; onDup: (m: DuplicateMode) => void; onValue: (p: Record<string, unknown>) => void; onShowSource: (s: Provenance) => void }) {
  const v = it.value as unknown as Record<string, unknown>;
  const s = (k: string) => String(v[k] ?? '');
  const list = (k: string) => (Array.isArray(v[k]) ? (v[k] as string[]) : []);
  let title = '';
  let detail = '';
  let fields: Array<[string, string]> = [];
  switch (it.kind) {
    case 'experience':
      title = [s('role'), s('company')].filter(Boolean).join(' — ') || 'Untitled role';
      detail = [formatRange(s('start'), s('end'), !!v.current) || 'Dates not found', s('location')].filter(Boolean).join(' · ');
      fields = [['role', 'Role'], ['company', 'Company'], ['location', 'Location'], ['start', 'Start (YYYY-MM)'], ['end', 'End (YYYY-MM)']];
      break;
    case 'projects':
      title = s('title');
      detail = s('description');
      fields = [['title', 'Title'], ['description', 'Description'], ['live', 'Live URL'], ['github', 'Repository']];
      break;
    case 'education':
      title = [s('degree'), s('field')].filter(Boolean).join(', ') || s('institution');
      detail = [s('institution'), formatRange(s('start'), s('end'))].filter(Boolean).join(' · ');
      fields = [['institution', 'Institution'], ['degree', 'Degree'], ['field', 'Field'], ['start', 'Start'], ['end', 'End'], ['grade', 'Grade']];
      break;
    case 'certifications':
      title = s('name');
      detail = [s('issuer'), s('date')].filter(Boolean).join(' · ');
      fields = [['name', 'Name'], ['issuer', 'Issuer'], ['date', 'Date'], ['url', 'URL']];
      break;
    case 'achievements':
      title = s('title');
      detail = s('description');
      fields = [['title', 'Title'], ['description', 'Description'], ['date', 'Date']];
      break;
    default:
      break;
  }
  const bullets = it.kind === 'experience' ? list('achievements') : it.kind === 'projects' ? list('features') : [];
  const tech = it.kind === 'experience' || it.kind === 'projects' ? list('technologies') : [];
  return (
    <Row label={KIND_LABEL[it.kind].replace(/s$/, '')} decision={it.decision} onDecision={onDecision} editing={editing} onEdit={onEdit} footer={<><ConfidenceBadge value={it.confidence} /> <SourceLink source={it.source} onShow={onShowSource} /></>}>
      {editing ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {fields.map(([k, label]) => (
            <label key={k} className={cn('grid gap-0.5 text-[11px] text-fg-subtle', k === 'description' && 'sm:col-span-2')}>
              {label}
              {k === 'description' ? <textarea className={cn(input, 'h-20 py-1.5')} value={s(k)} onChange={(e) => onValue({ [k]: e.target.value })} /> : <input className={input} value={s(k)} onChange={(e) => onValue({ [k]: e.target.value })} />}
            </label>
          ))}
          {it.kind === 'experience' && (
            <label className="flex items-center gap-2 text-[12px]">
              <input type="checkbox" checked={!!v.current} onChange={(e) => onValue({ current: e.target.checked, ...(e.target.checked ? { end: '' } : {}) })} /> Current role
            </label>
          )}
          {tech.length > 0 && (
            <label className="grid gap-0.5 text-[11px] text-fg-subtle sm:col-span-2">
              Technologies (comma separated)
              <input className={input} value={tech.join(', ')} onChange={(e) => onValue({ technologies: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} />
            </label>
          )}
        </div>
      ) : (
        <>
          <p className="text-[13px] font-medium text-fg">{title}</p>
          {detail && <p className="mt-0.5 line-clamp-2 text-[12px] text-fg-muted">{detail}</p>}
          {bullets.length > 0 && (
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[12px] text-fg-muted">
              {bullets.slice(0, 3).map((b, i) => (
                <li key={i}>{b}</li>
              ))}
              {bullets.length > 3 && <li className="list-none text-fg-subtle">+{bullets.length - 3} more</li>}
            </ul>
          )}
          {tech.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {tech.map((t) => (
                <span key={t} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-fg-muted">
                  {t}
                </span>
              ))}
            </div>
          )}
          {it.kind === 'experience' && !s('start') && <p className="mt-1 text-[11.5px] text-warn">⚠ No dates were found. They are left empty rather than guessed.</p>}
        </>
      )}
      {it.duplicateOf && (
        <div className="mt-2 rounded-lg border border-warn/40 bg-warn/5 px-2.5 py-2 text-[12px]">
          <p className="font-medium text-warn">Possible duplicate</p>
          <p className="mt-0.5 text-fg-muted">
            Existing: <span className="text-fg">{it.duplicateLabel}</span> · Imported: <span className="text-fg">{title}</span>
          </p>
          <div className="mt-1.5 flex gap-1" role="radiogroup" aria-label="Duplicate handling">
            {(
              [
                ['merge', 'Merge', 'Fill empty fields of the existing item and add new bullets/technologies.'],
                ['keep-both', 'Keep both', 'Add as a separate item.'],
                ['ignore', 'Ignore', 'Do not import this item.'],
              ] as const
            ).map(([m, label, help]) => (
              <button key={m} type="button" role="radio" aria-checked={it.duplicateMode === m} title={help} onClick={() => onDup(m)} className={cn('h-7 rounded-md border px-2 text-[11.5px]', it.duplicateMode === m ? 'border-accent bg-accent-soft text-fg' : 'border-line text-fg-muted')}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </Row>
  );
}
