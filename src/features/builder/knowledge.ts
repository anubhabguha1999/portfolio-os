/**
 * Knowledge → portfolio canvas. Picked items are adopted into the shared library first, then
 * copied into the matching section with the library id, so a linked portfolio stays in sync.
 *
 * Placement rules live in knowledge/import/to-portfolio.
 */
import { insertIntoPortfolio } from '@/knowledge/import/to-portfolio';
import { useEditor } from '@/stores/editor';
import { useWorkspace } from '@/studio/store/workspace';
import { toast } from '@/stores/ui';
import { adoptCandidates, KIND_LABELS, type Candidate } from '@/knowledge/import/library-source';
import { addProvenance } from '@/knowledge/storage/repo';

export { insertIntoPortfolio, sectionTypeFor, toPortfolioItem } from '@/knowledge/import/to-portfolio';

/** Adopt, insert (one undo step), select the receiving section and report what happened. */
export function insertKnowledgeIntoBuilder(candidates: Candidate[], targetId?: string | null): string | null {
  const ed = useEditor.getState();
  if (!ed.portfolio || !candidates.length) return null;
  const ws = useWorkspace.getState();
  const adopted = adoptCandidates(ws.library, candidates);
  const res = insertIntoPortfolio(ed.portfolio, adopted.library, adopted.picks, targetId);
  if (res.locked.length) toast({ tone: 'error', title: 'Section locked', description: `Unlock “${res.locked.join('”, “')}” to add items to it.` });
  if (!res.added) {
    if (!res.locked.length) toast({ title: 'Already on the page', description: 'Those items are already in this portfolio.' });
    return Object.values(res.sections)[0] ?? null;
  }
  if (adopted.added) ws.setLibrary(adopted.library);
  void addProvenance(adopted.provenance);
  const kinds = [...new Set(adopted.picks.map((x) => KIND_LABELS[x.kind]))].join(', ');
  ed.apply(`Insert ${kinds.toLowerCase()} from library`, () => res.portfolio);
  const first = Object.values(res.sections)[0] ?? null;
  if (first) ed.select(first);
  toast({ tone: 'success', title: `Added ${res.added} item${res.added === 1 ? '' : 's'}`, description: `${kinds} from Extract Your Data.` });
  return first;
}
