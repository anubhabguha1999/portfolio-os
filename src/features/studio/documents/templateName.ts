import type { StudioDocument } from '@/studio/model/types';
import { getDocTemplate } from '@/studio/templates/document';
import { getLetterTemplate } from '@/studio/templates/letter';

export function templateName(doc: Pick<StudioDocument, 'kind' | 'templateId'>): string {
  return doc.kind === 'cover-letter' ? getLetterTemplate(doc.templateId).name : getDocTemplate(doc.templateId).name;
}
