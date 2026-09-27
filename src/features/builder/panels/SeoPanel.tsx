import { useEditor } from '@/stores/editor';
import { TextArea, TextInput } from '@/components/ui/Field';
import { ImageField } from '../fields/ImageField';
import { TagsInput } from '../fields/TagsInput';
import { Group } from './Group';
import { FieldShell } from '@/components/ui/Field';
import { checkUrl, hostnameOf } from '@/utils/url';
import { useResolvedSrc } from '../fields/ImageField';
import type { ImageRef } from '@/types/portfolio';

export function SeoPanel() {
  const m = useEditor((s) => s.portfolio!.metadata);
  const update = useEditor((s) => s.updateMetadata);
  const descLen = m.description.trim().length;
  const urlOk = !m.siteUrl || checkUrl(m.siteUrl).ok;
  const og = useResolvedSrc(m.ogImage.src);
  return (
    <div>
      <Group title="Search & social preview">
        <div className="overflow-hidden rounded-xl border border-line bg-bg">
          {og && <img src={og} alt="" className="aspect-[1.91/1] w-full object-cover" />}
          <div className="px-3 py-2.5">
            <p className="truncate text-[11px] text-fg-subtle">{m.siteUrl ? hostnameOf(m.siteUrl) : 'your-site.com'}</p>
            <p className="truncate text-[13px] font-semibold text-accent">{m.title || 'Untitled'}</p>
            <p className="line-clamp-2 text-[12px] text-fg-muted">{m.description || 'Add a description so search engines and social cards show a summary.'}</p>
          </div>
        </div>
        <TextInput label="Page title" value={m.title} onChange={(e) => update('title', e.target.value)} help={`${m.title.length} characters · aim for under 60`} />
        <TextArea
          label="Description"
          rows={3}
          value={m.description}
          onChange={(e) => update('description', e.target.value)}
          help={`${descLen} characters · ${descLen < 50 ? 'too short — aim for 50–160' : descLen > 160 ? 'too long — may be truncated' : 'good length'}`}
        />
        <FieldShell label="Keywords" help="Press Enter to add">
          <TagsInput value={m.keywords} onChange={(v) => update('keywords', v)} />
        </FieldShell>
        <TextInput label="Author" value={m.author} onChange={(e) => update('author', e.target.value)} />
      </Group>
      <Group title="Links & identity">
        <TextInput label="Canonical site URL" placeholder="https://yourname.dev" value={m.siteUrl} error={urlOk ? undefined : 'Enter a valid https:// URL'} onChange={(e) => update('siteUrl', e.target.value)} help="Where the exported site will live. Enables canonical, Open Graph URL and sitemap." />
        <TextInput label="Twitter / X handle" placeholder="@handle" value={m.twitterHandle} onChange={(e) => update('twitterHandle', e.target.value)} />
        <TextInput label="Language" value={m.language} onChange={(e) => update('language', e.target.value)} help="BCP 47 code, e.g. en, en-GB, de, fr." />
        <TextInput label="Favicon" value={m.favicon} onChange={(e) => update('favicon', e.target.value)} help="An emoji or short text (e.g. ✦ or JD)." />
        <ImageField label="Social share image (Open Graph)" help="Recommended 1200×630." value={m.ogImage} onChange={(v: ImageRef) => update('ogImage', v)} />
      </Group>
      <Group title="Structured data" defaultOpen={false}>
        <p className="text-[12px] leading-relaxed text-fg-muted">
          Exports include JSON-LD for <b className="text-fg">ProfilePage</b>, <b className="text-fg">Person</b> (name, job title, skills, social profiles) and a <b className="text-fg">CreativeWork</b> for each project — generated from your content automatically.
        </p>
      </Group>
    </div>
  );
}
