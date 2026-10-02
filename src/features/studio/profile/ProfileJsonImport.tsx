import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Card } from '@/components/ui/misc';
import { hasProfileDetails } from '@/components/profile/hasProfile';
import { importCounts } from '@/studio/import/resume-json';
import { useWorkspace } from '@/studio/store/workspace';
import { toast } from '@/stores/ui';
import { applyImport, JsonImportBox, type ImportChoice } from '../shared/JsonImportBox';

/** Fill the shared profile and library from a resume .json file. */
export function ProfileJsonImport() {
  const profile = useWorkspace((s) => s.profile);
  const library = useWorkspace((s) => s.library);
  const [choice, setChoice] = useState<ImportChoice | null>(null);
  const [confirm, setConfirm] = useState(false);
  const hasContent = hasProfileDetails(profile) || Object.values(library).some((v) => Array.isArray(v) && v.length > 0);

  const apply = async (c: ImportChoice) => {
    const ws = useWorkspace.getState();
    const before = ws.library;
    const next = applyImport(ws.profile, before, c);
    ws.setProfile(next.profile);
    ws.setLibrary(next.library);
    await ws.flush();
    const n = importCounts({ library: next.library, entries: {} });
    const added = c.mode === 'merge' ? next.library.experience.length - before.experience.length + (next.library.projects.length - before.projects.length) + (next.library.education.length - before.education.length) + (next.library.skills.length - before.skills.length) : null;
    const skipped = Object.values(c.data.entries).reduce((k, l) => k + l.length, 0);
    toast({
      tone: 'success',
      title: c.mode === 'replace' ? 'Profile replaced from your resume' : 'Profile updated from your resume',
      description: `${added !== null ? `${added} new item${added === 1 ? '' : 's'} added. ` : ''}Now ${n.experience} roles, ${n.education} education, ${n.projects} projects, ${n.skills} skills.${skipped ? ` ${skipped} resume-only entr${skipped === 1 ? 'y' : 'ies'} (languages etc.) are added when you create a resume from this file.` : ''}`,
    });
    setChoice(null);
  };

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="text-[13.5px] font-semibold tracking-tight">Import a resume</h2>
      <p className="mb-3 mt-1 text-[12px] leading-relaxed text-fg-muted">Fill your profile, roles, education, projects and skills from a PDF, Word, text or JSON resume. Your photo is kept.</p>
      <JsonImportBox value={choice} onChange={setChoice} canReplace={hasContent} defaultMode={hasContent ? 'merge' : 'replace'} title="Choose a resume file" />
      {choice && (
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setChoice(null)}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" icon={<Check className="size-3.5" />} onClick={() => (choice.mode === 'replace' && hasContent ? setConfirm(true) : void apply(choice))}>
            {choice.mode === 'replace' && hasContent ? 'Replace profile' : 'Apply to profile'}
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => choice && apply(choice)}
        title="Replace your profile and library?"
        description="Your name, contact details, roles, education, projects and skills are replaced with the file's content. Every resume, document and linked portfolio uses this profile. Your photo is kept."
        confirmLabel="Replace profile"
      />
    </Card>
  );
}
