/**
 * StudioDocument + shared Profile/Library → FlowDoc. Cover letters use the letter
 * templates; every other kind uses the block-based document templates.
 */
import type { FlowDoc } from '@/studio/engine/flow';
import type { Library, Profile, StudioDocument } from './types';
import { photoKey } from './resolve';
import { getDocTemplate } from '@/studio/templates/document';
import { getLetterTemplate, localizeLetter } from '@/studio/templates/letter';
import { finalizeFlow } from '@/studio/engine/rtl';
import { normalizeLanguage } from '@/i18n';
import { kindLabel } from '@/studio/templates/document';

export interface ComposeOptions {
  /** Show hints for empty blocks — editor canvas only. */
  placeholders?: boolean;
}

/** Profile photo key for documents (the "documents" usage variant), or null. */
export function documentPhotoKey(profile: Profile, mode = 'circle'): string | null {
  const img = profile.profileImage;
  if (!img) return null;
  const v = img.variants.find((x) => x.id === img.usage.documents) ?? img.variants[0];
  return v ? photoKey(v.id, mode) : null;
}

export function documentMetaDefaults(doc: StudioDocument, profile: Profile): FlowDoc['meta'] {
  const author = profile.name.trim();
  const label = kindLabel(doc.kind);
  return {
    title: doc.kind === 'cover-letter' ? `${author ? `${author} — ` : ''}Cover Letter${doc.letter?.company ? ` for ${doc.letter.company}` : ''}` : doc.name || label,
    author: author || 'Unknown author',
    subject: doc.kind === 'cover-letter' ? (doc.letter?.role ? `Application for ${doc.letter.role}` : 'Cover letter') : label,
    keywords: [],
    creator: 'Portfolio OS Document Studio',
  };
}

export function documentMeta(doc: StudioDocument, profile: Profile): FlowDoc['meta'] {
  const d = documentMetaDefaults(doc, profile);
  return {
    title: doc.meta.title.trim() || d.title,
    author: doc.meta.author.trim() || d.author,
    subject: doc.meta.subject.trim() || d.subject,
    keywords: doc.meta.keywords.length ? doc.meta.keywords : d.keywords,
    creator: doc.meta.creator.trim() || d.creator,
  };
}

export function composeStudioDocument(doc: StudioDocument, profile: Profile, library: Library, opts: ComposeOptions = {}): FlowDoc {
  const meta = documentMeta(doc, profile);
  const photo = documentPhotoKey(profile);
  const lang = normalizeLanguage(doc.page.language);
  if (doc.kind === 'cover-letter' && doc.letter) {
    const t = getLetterTemplate(doc.templateId);
    return finalizeFlow(t.compose({ letter: localizeLetter(doc.letter, lang), profile, page: doc.page, photo, meta }), lang);
  }
  const t = getDocTemplate(doc.templateId);
  return finalizeFlow(t.compose({ blocks: doc.blocks, profile, library, page: doc.page, photo, meta, title: doc.name, kind: doc.kind, ...(opts.placeholders ? { placeholders: true } : {}) } as Parameters<typeof t.compose>[0]), lang);
}
