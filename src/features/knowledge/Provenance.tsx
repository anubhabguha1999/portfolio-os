import { useEffect, useState } from 'react';
import { PenLine } from 'lucide-react';
import { loadProvenance, PROVENANCE_EVENT } from '@/knowledge/storage/repo';
import type { ProvenanceRecord } from '@/knowledge/types';
import { cn } from '@/utils/cn';
import { SourceLine } from './InsertFromLibrary';

let cache: Record<string, ProvenanceRecord> | null = null;
let pending: Promise<Record<string, ProvenanceRecord>> | null = null;

function load(force = false) {
  if (force) pending = null;
  if (!pending)
    pending = loadProvenance()
      .catch(() => ({}))
      .then((v) => (cache = v));
  return pending;
}

/** All provenance records, shared by every note on the page and refreshed after imports. */
export function useProvenance(): Record<string, ProvenanceRecord> {
  const [map, setMap] = useState(cache ?? {});
  useEffect(() => {
    let live = true;
    void load().then((v) => live && setMap(v));
    const refresh = () => void load(true).then((v) => live && setMap(v));
    window.addEventListener(PROVENANCE_EVENT, refresh);
    return () => {
      live = false;
      window.removeEventListener(PROVENANCE_EVENT, refresh);
    };
  }, []);
  return map;
}

const norm = (v: unknown) => JSON.stringify(typeof v === 'string' ? v.trim() : (v ?? ''));

/** Fields whose current value differs from what the document said. */
export function modifiedFields(records: ProvenanceRecord[], item: Record<string, unknown>): ProvenanceRecord[] {
  return records.filter((r) => norm(item[r.field]) !== norm(r.original));
}

const FIELD_LABEL: Record<string, string> = { resumeSummary: 'resume summary', resumeBullets: 'resume bullets', start: 'start date', end: 'end date' };

/**
 * "Source: Resume.pdf — Page 1" for an imported item, plus "Modified locally" when the user has
 * changed values since import. The original document is never touched.
 */
export function ProvenanceNote({ kind, itemId, item, className }: { kind: ProvenanceRecord['kind']; itemId: string; item: Record<string, unknown>; className?: string }) {
  const map = useProvenance();
  const prefix = `${kind}:${itemId}:`;
  const records = Object.values(map).filter((r) => r.key.startsWith(prefix));
  if (!records.length) return null;
  const changed = modifiedFields(records, item);
  const source = records[0]!.source;
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-bg/60 px-2 py-1.5 text-[11px]', className)}>
      <span className="text-fg-subtle">Source:</span>
      <SourceLine source={source} />
      {changed.length > 0 && (
        <span
          className="inline-flex items-center gap-1 text-warn"
          title={changed
            .slice(0, 6)
            .map((r) => `${FIELD_LABEL[r.field] ?? r.field} — original: ${Array.isArray(r.original) ? r.original.join(', ') : String(r.original)}`)
            .join('\n')}
        >
          <PenLine className="size-3" aria-hidden="true" /> Modified locally ({changed.map((r) => FIELD_LABEL[r.field] ?? r.field).join(', ')})
        </span>
      )}
    </div>
  );
}
