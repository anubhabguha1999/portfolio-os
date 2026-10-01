import { useDeferredValue, useMemo } from 'react';
import type { StudioDocument } from '@/studio/model/types';
import { composeStudioDocument } from '@/studio/model/compose-document';
import { layoutFlow } from '@/studio/engine/layout';
import { collectImageKeys, useImageUrls } from '@/studio/images/service';
import { useWorkspace } from '@/studio/store/workspace';

/** Compose + lay out a document for on-screen display. Deferred so typing stays responsive. */
export function useDocumentLayout(doc: StudioDocument | null, opts: { placeholders?: boolean } = {}) {
  const profile = useWorkspace((s) => s.profile);
  const library = useWorkspace((s) => s.library);
  const deferred = useDeferredValue(doc);
  const placeholders = opts.placeholders ?? true;
  const flow = useMemo(() => (deferred ? composeStudioDocument(deferred, profile, library, { placeholders }) : null), [deferred, profile, library, placeholders]);
  const laid = useMemo(() => (flow ? layoutFlow(flow) : null), [flow]);
  const keys = useMemo(() => (laid ? collectImageKeys(laid.pages.flatMap((p) => p.prims)) : []), [laid]);
  const imageUrl = useImageUrls(keys);
  return { flow, laid, imageUrl, stale: deferred !== doc };
}
