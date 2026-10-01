import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SectionLabel } from '@/components/ui/misc';
import { TextArea, TextInput } from '@/components/ui/Field';
import type { CoverLetterData, StudioDocument } from '@/studio/model/types';
import { useDocumentEditor } from '@/studio/store/document-editor';
import { useWorkspace } from '@/studio/store/workspace';

export const LETTER_PARTS: Array<{ ref: string; label: string }> = [
  { ref: 'letter:sender', label: 'Sender' },
  { ref: 'letter:date', label: 'Date' },
  { ref: 'letter:recipient', label: 'Recipient' },
  { ref: 'letter:role', label: 'Role' },
  { ref: 'letter:salutation', label: 'Salutation' },
  { ref: 'letter:opening', label: 'Opening' },
  { ref: 'letter:body', label: 'Body' },
  { ref: 'letter:closing', label: 'Closing' },
  { ref: 'letter:signature', label: 'Signature' },
];

function Part({ id, active, title, children }: { id: string; active: boolean; title: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (active) {
      ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      ref.current?.querySelector<HTMLElement>('input,textarea')?.focus({ preventScroll: true });
    }
  }, [active]);
  return (
    <section ref={ref} data-part={id} className={`space-y-3 border-b border-line px-4 py-4 transition-colors ${active ? 'bg-accent-soft/60' : ''}`}>
      <SectionLabel>{title}</SectionLabel>
      {children}
    </section>
  );
}

const WORDS = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/** Structured cover-letter editor. The selected canvas part is highlighted and focused. */
export function LetterForm({ doc }: { doc: StudioDocument }) {
  const update = useDocumentEditor((s) => s.updateLetter);
  const selected = useDocumentEditor((s) => s.selected);
  const profile = useWorkspace((s) => s.profile);
  const l = doc.letter!;
  const f = (k: keyof CoverLetterData) => ({ value: l[k], onChange: (e: { target: { value: string } }) => update({ [k]: e.target.value }, k) });
  const is = (r: string) => selected === r;
  const words = WORDS(l.opening) + WORDS(l.body) + WORDS(l.closing);
  return (
    <div>
      <Part id="letter:sender" active={is('letter:sender')} title="Sender">
        <p className="text-[12px] leading-relaxed text-fg-muted">
          <span className="font-medium text-fg">{profile.name || 'Your name'}</span>
          {profile.headline ? ` · ${profile.headline}` : ''} — from your shared profile.{' '}
          <Link to="/profile" className="font-medium text-accent hover:underline">
            Edit profile
          </Link>
        </p>
      </Part>
      <Part id="letter:date" active={is('letter:date')} title="Date">
        <TextInput aria-label="Date" type="text" placeholder="2026-09-30 or any text" {...f('date')} help="YYYY-MM-DD is formatted automatically." />
      </Part>
      <Part id="letter:recipient" active={is('letter:recipient')} title="Recipient">
        <div className="grid gap-2.5 sm:grid-cols-2">
          <TextInput label="Name" placeholder="Jordan Lee" {...f('recipient')} />
          <TextInput label="Title" placeholder="Hiring Manager" {...f('recipientTitle')} />
        </div>
        <TextInput label="Company" placeholder="Acme Corp" {...f('company')} />
        <TextArea label="Address" rows={2} placeholder={'1 Main Street\nBerlin'} {...f('address')} />
      </Part>
      <Part id="letter:role" active={is('letter:role')} title="Role">
        <TextInput aria-label="Role" placeholder="Senior Engineer" {...f('role')} help="Used for the subject line and the document metadata." />
      </Part>
      <Part id="letter:salutation" active={is('letter:salutation')} title="Salutation">
        <TextInput aria-label="Salutation" {...f('salutation')} />
      </Part>
      <Part id="letter:opening" active={is('letter:opening')} title="Opening">
        <TextArea aria-label="Opening" rows={3} {...f('opening')} />
      </Part>
      <Part id="letter:body" active={is('letter:body')} title="Body">
        <TextArea aria-label="Body" rows={10} {...f('body')} help="Separate paragraphs with a blank line. **bold** and *italic* work." />
      </Part>
      <Part id="letter:closing" active={is('letter:closing')} title="Closing">
        <TextArea aria-label="Closing" rows={3} {...f('closing')} />
      </Part>
      <Part id="letter:signature" active={is('letter:signature')} title="Signature">
        <div className="grid gap-2.5 sm:grid-cols-2">
          <TextInput label="Sign-off" {...f('signOff')} />
          <TextInput label="Signature" placeholder={profile.name} {...f('signature')} help="Typed in a script-like style." />
        </div>
      </Part>
      <p className="px-4 py-3 text-[11.5px] text-fg-subtle">
        {words} words{words > 400 ? ' — most cover letters work best under 400 words.' : ''}
      </p>
    </div>
  );
}
