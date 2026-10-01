import { useRef, useState } from 'react';
import { AlertTriangle, Download, FileJson, X } from 'lucide-react';
import { Truncate } from 'dead-lock-react-lib';
import { Button, IconButton } from '@/components/ui/Button';
import { importCounts, mergeLibrary, mergeProfile, parseResumeJson, personaToJsonResume, ResumeJsonError, type ResumeJsonImport } from '@/studio/import/resume-json';
import { getPersona } from '@/studio/model/sample';
import type { Library, Profile } from '@/studio/model/types';
import { cn } from '@/utils/cn';

export interface ImportChoice {
  fileName: string;
  data: ResumeJsonImport;
  /** replace: the file becomes the shared profile + library; merge: fill blanks and add new items. */
  mode: 'replace' | 'merge';
}

/** Profile and library once an import is applied. The current photo is always kept. */
export function applyImport(profile: Profile, library: Library, i: ImportChoice): { profile: Profile; library: Library } {
  if (i.mode === 'replace') return { profile: { ...i.data.profile, ...(profile.profileImage ? { profileImage: profile.profileImage } : {}) }, library: i.data.library };
  return { profile: mergeProfile(profile, i.data.profile), library: mergeLibrary(library, i.data.library) };
}

export function downloadSampleJson(personaId = 'engineer-lead'): void {
  const blob = new Blob([JSON.stringify(personaToJsonResume(getPersona(personaId)), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'resume-sample.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Drop zone / picker for a resume .json file, then a summary of what it contains and
 * a merge-or-replace choice. Shared by the New Resume dialog and Profile Studio.
 */
export function JsonImportBox({
  value,
  onChange,
  canReplace,
  defaultMode,
  samplePersona,
  title = 'Pre-fill from a .json file',
  className,
}: {
  value: ImportChoice | null;
  onChange: (next: ImportChoice | null) => void;
  /** Offer the merge/replace choice (only meaningful when there is existing content). */
  canReplace: boolean;
  defaultMode: ImportChoice['mode'];
  samplePersona?: string;
  title?: string;
  className?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const read = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!/\.json$/i.test(file.name) && file.type !== 'application/json') {
      setError(`“${file.name}” is not a .json file.`);
      return;
    }
    try {
      onChange({ fileName: file.name, data: parseResumeJson(await file.text()), mode: defaultMode });
    } catch (err) {
      setError(err instanceof ResumeJsonError ? err.message : 'The file could not be read.');
    }
  };

  return (
    <div
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void read(e.dataTransfer.files[0]);
      }}
      className={cn('rounded-xl border border-dashed px-3.5 py-3 transition-colors', dragging ? 'border-accent bg-accent-soft/50' : 'border-line-strong bg-panel/60', className)}
    >
      <input ref={input} type="file" accept=".json,application/json" className="sr-only" aria-label="Import values from a JSON file" onChange={(e) => (void read(e.target.files?.[0]), (e.target.value = ''))} />
      {value ? (
        <ImportSummary choice={value} canReplace={canReplace} onMode={(mode) => onChange({ ...value, mode })} onClear={() => onChange(null)} />
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <FileJson className="size-4 shrink-0 text-accent" aria-hidden="true" />
          <p className="min-w-0 flex-1 basis-48 text-[12.5px] text-fg-muted">
            <span className="font-medium text-fg">{title}</span>: drop it here or browse. Supports JSON Resume and Portfolio OS exports.
          </p>
          <div className="flex gap-1.5">
            <Button size="sm" icon={<FileJson className="size-3.5" />} onClick={() => input.current?.click()}>
              Import JSON
            </Button>
            <Button size="sm" variant="ghost" icon={<Download className="size-3.5" />} onClick={() => downloadSampleJson(samplePersona)}>
              Sample file
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 flex items-start gap-1.5 text-[12px] text-danger">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}

function ImportSummary({ choice, canReplace, onMode, onClear }: { choice: ImportChoice; canReplace: boolean; onMode: (m: ImportChoice['mode']) => void; onClear: () => void }) {
  const c = importCounts(choice.data);
  const parts = [
    [c.experience, 'role'],
    [c.education, 'education entry', 'education entries'],
    [c.projects, 'project'],
    [c.skills, 'skill'],
    [c.certifications, 'certification'],
    [c.achievements, 'achievement'],
    [c.languages, 'language'],
    [c.other, 'other entry', 'other entries'],
  ] as const;
  const found = parts.filter(([n]) => n > 0).map(([n, one, many]) => `${n} ${n === 1 ? one : many ?? `${one}s`}`);
  const p = choice.data.profile;
  return (
    <div className="space-y-2.5">
      <div className="flex items-start gap-3">
        <FileJson className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <Truncate className="font-mono text-[12.5px] font-semibold" style={{ display: 'block', maxWidth: '100%' }}>
            {choice.fileName}
          </Truncate>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            {choice.data.source === 'json-resume' ? 'JSON Resume' : 'Portfolio OS export'}
            {p.name && (
              <>
                {' '}· <strong className="text-fg">{p.name}</strong>
                {p.headline && <>, {p.headline}</>}
              </>
            )}
          </p>
          <p className="mt-0.5 text-[11.5px] text-fg-subtle">{found.length ? found.join(' · ') : 'No items found'}</p>
        </div>
        <IconButton size="xs" label="Remove imported file" onClick={onClear}>
          <X className="size-3.5" />
        </IconButton>
      </div>
      {canReplace && (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="How to use the imported values">
          {(
            [
              ['merge', 'Add to my profile', 'Fills empty profile fields and adds new library items. Nothing is removed.'],
              ['replace', 'Replace my profile', 'The file becomes your shared profile and library, which other resumes and linked portfolios also use.'],
            ] as const
          ).map(([mode, label, help]) => (
            <button key={mode} type="button" role="radio" aria-checked={choice.mode === mode} title={help} onClick={() => onMode(mode)} className={cn('rounded-lg border px-2.5 py-1 text-[12px]', choice.mode === mode ? 'border-accent bg-accent-soft text-fg' : 'border-line text-fg-muted hover:border-line-strong')}>
              {label}
            </button>
          ))}
          {choice.mode === 'replace' && <span className="self-center text-[11.5px] text-warn">Your other resumes will show the imported content too.</span>}
        </div>
      )}
      {choice.data.warnings.map((w) => (
        <p key={w} className="flex items-start gap-1.5 text-[11.5px] text-warn">
          <AlertTriangle className="mt-0.5 size-3 shrink-0" /> {w}
        </p>
      ))}
    </div>
  );
}
