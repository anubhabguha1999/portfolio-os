import { useDeferredValue, useMemo } from 'react';
import { embeddedResumeData } from '@/studio/export/embedded';
import type { FlowDoc, LaidDocument } from '@/studio/engine/flow';
import { layoutFlow } from '@/studio/engine/layout';
import { resolveResume, type ResolvedResume } from '@/studio/model/resolve';
import type { FitAdjust, Library, Profile, ResumeDoc } from '@/studio/model/types';
import { getResumeTemplate } from '@/studio/templates/resume';
import type { ResumeTemplateDef } from '@/studio/templates/types';
import { useWorkspace } from '@/studio/store/workspace';
import { collectImageKeys } from '@/studio/images/service';

export interface ResumeLayout {
  resolved: ResolvedResume;
  flow: FlowDoc;
  laid: LaidDocument;
  template: ResumeTemplateDef;
  imageKeys: string[];
}

export function composeResume(resume: ResumeDoc, library: Library, profile: Profile, templateId = resume.templateId, fit: FitAdjust | null | undefined = undefined): { resolved: ResolvedResume; flow: FlowDoc; template: ResumeTemplateDef } {
  const template = getResumeTemplate(templateId);
  const style = fit === undefined ? resume.style : { ...resume.style, fit };
  const resolved = resolveResume({ ...resume, style }, library, profile);
  // Embedded in the PDF (when document metadata is on) so it imports back exactly.
  return { resolved, flow: { ...template.compose(resolved), data: JSON.stringify(embeddedResumeData(resolved)) }, template };
}

export function layoutResume(resume: ResumeDoc, library: Library, profile: Profile, templateId?: string): ResumeLayout {
  const { resolved, flow, template } = composeResume(resume, library, profile, templateId);
  const laid = layoutFlow(flow);
  return { resolved, flow, laid, template, imageKeys: collectImageKeys(laid.pages.flatMap((p) => p.prims)) };
}

/** Live layout for the editor; deferred so typing never waits for pagination. */
export function useResumeLayout(resume: ResumeDoc | null, templateId?: string): ResumeLayout | null {
  const profile = useWorkspace((s) => s.profile);
  const library = useWorkspace((s) => s.library);
  const input = useDeferredValue({ resume, profile, library, templateId });
  return useMemo(() => {
    if (!input.resume) return null;
    try {
      return layoutResume(input.resume, input.library, input.profile, input.templateId);
    } catch (err) {
      console.error('Resume layout failed', err);
      return null;
    }
  }, [input]);
}
