import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useWorkspace } from '@/studio/store/workspace';
import type { SocialLink } from '@/studio/model/types';
import { Select, TextArea, TextInput } from '@/components/ui/Field';
import { Button, IconButton } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/misc';
import { uid } from '@/utils/id';

export const PLATFORMS = [
  { value: 'github', label: 'GitHub' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'x', label: 'X / Twitter' },
  { value: 'dribbble', label: 'Dribbble' },
  { value: 'behance', label: 'Behance' },
  { value: 'medium', label: 'Medium' },
  { value: 'stackoverflow', label: 'Stack Overflow' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'mastodon', label: 'Mastodon' },
  { value: 'website', label: 'Website' },
  { value: 'other', label: 'Other' },
];

function looksLikeUrl(v: string): boolean {
  return !v.trim() || /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(v.trim());
}

/** Central identity used by Portfolio, Resume and Document Studio. */
export function IdentityForm() {
  const profile = useWorkspace((s) => s.profile);
  const patch = useWorkspace((s) => s.patchProfile);
  const setLinks = (links: SocialLink[]) => patch({ socialLinks: links });
  const links = profile.socialLinks;
  const emailBad = !!profile.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim());
  const bioWords = profile.bio.trim() ? profile.bio.trim().split(/\s+/).length : 0;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <SectionLabel>Identity</SectionLabel>
        <TextInput label="Full name" autoComplete="name" value={profile.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Alex Morgan" />
        <TextInput label="Headline" value={profile.headline} onChange={(e) => patch({ headline: e.target.value })} placeholder="Senior Full-Stack Engineer" />
        <TextArea label="Bio" rows={5} value={profile.bio} onChange={(e) => patch({ bio: e.target.value })} placeholder="Two or three sentences about what you do and what you care about." help={`${bioWords} words · used as the default resume summary and portfolio about text.`} />
      </section>
      <section className="space-y-3">
        <SectionLabel>Contact</SectionLabel>
        <TextInput label="Email" type="email" autoComplete="email" value={profile.email} onChange={(e) => patch({ email: e.target.value })} error={emailBad ? 'This doesn’t look like an email address.' : undefined} />
        <TextInput label="Phone" type="tel" autoComplete="tel" value={profile.phone ?? ''} onChange={(e) => patch({ phone: e.target.value })} />
        <TextInput label="Location" value={profile.location ?? ''} onChange={(e) => patch({ location: e.target.value })} placeholder="City, Country" />
        <TextInput label="Website" type="url" value={profile.website ?? ''} onChange={(e) => patch({ website: e.target.value })} placeholder="https://" error={looksLikeUrl(profile.website ?? '') ? undefined : 'Enter a web address.'} />
      </section>
      <section className="space-y-3">
        <SectionLabel
          action={
            <Button size="xs" icon={<Plus className="size-3.5" />} onClick={() => setLinks([...links, { id: uid('sl'), platform: 'linkedin', label: '', url: '' }])}>
              Add link
            </Button>
          }
        >
          Social links
        </SectionLabel>
        {!links.length && <p className="text-[12px] text-fg-subtle">No links yet. GitHub and LinkedIn are the most common on resumes.</p>}
        <ul className="space-y-2.5">
          {links.map((l, i) => {
            const set = (p: Partial<SocialLink>) => setLinks(links.map((x) => (x.id === l.id ? { ...x, ...p } : x)));
            const move = (to: number) => {
              const next = [...links];
              const [item] = next.splice(i, 1);
              next.splice(to, 0, item!);
              setLinks(next);
            };
            return (
              <li key={l.id} className="rounded-lg border border-line bg-bg p-2.5">
                <div className="flex items-end gap-2">
                  <Select className="flex-1" label="Platform" value={l.platform} onChange={(e) => set({ platform: e.target.value })} options={PLATFORMS} />
                  <div className="flex pb-0.5">
                    <IconButton label="Move up" size="sm" disabled={i === 0} onClick={() => move(i - 1)}>
                      <ArrowUp className="size-3.5" />
                    </IconButton>
                    <IconButton label="Move down" size="sm" disabled={i === links.length - 1} onClick={() => move(i + 1)}>
                      <ArrowDown className="size-3.5" />
                    </IconButton>
                    <IconButton label="Remove link" size="sm" onClick={() => setLinks(links.filter((x) => x.id !== l.id))}>
                      <Trash2 className="size-3.5" />
                    </IconButton>
                  </div>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <TextInput aria-label="Link URL" placeholder="https://" value={l.url} onChange={(e) => set({ url: e.target.value })} error={looksLikeUrl(l.url) ? undefined : 'Enter a web address.'} />
                  <TextInput aria-label="Display label" placeholder="Label (optional)" value={l.label} onChange={(e) => set({ label: e.target.value })} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
