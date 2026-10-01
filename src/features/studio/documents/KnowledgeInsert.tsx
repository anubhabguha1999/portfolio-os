import { useState } from 'react';
import { BookPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { InsertFromLibraryDialog, type InsertPick } from '@/features/knowledge/InsertFromLibrary';
import { adoptCandidates, type TextCandidate } from '@/knowledge/import/library-source';
import { addProvenance } from '@/knowledge/storage/repo';
import { createBlock } from '@/studio/model/defaults';
import type { DocBlockNode, LibExperience, LibProject, Library, LibraryKind } from '@/studio/model/types';
import { useDocumentEditor } from '@/studio/store/document-editor';
import { useWorkspace } from '@/studio/store/workspace';

const DOC_KINDS: LibraryKind[] = ['experience', 'projects', 'education', 'skills', 'certifications', 'achievements'];

const range = (a: string, b: string, current?: boolean) => [a, current ? 'Present' : b].filter(Boolean).join(' – ');

function textBlock(t: TextCandidate): DocBlockNode {
  if (t.type === 'heading') return { ...createBlock('heading'), text: t.text, level: 2 } as DocBlockNode;
  if (t.type === 'list' && t.items?.length) return { ...createBlock('list'), items: t.items } as DocBlockNode;
  if (t.type === 'table' && t.rows && t.rows.length > 1) return { ...createBlock('table'), header: t.rows[0]!, rows: t.rows.slice(1) } as DocBlockNode;
  return { ...createBlock('paragraph'), text: t.text } as DocBlockNode;
}

/** Library items as document blocks: experience and projects stay linked to the library. */
function itemBlocks(library: Library, picks: Array<{ kind: LibraryKind; id: string }>): DocBlockNode[] {
  const out: DocBlockNode[] = [];
  const get = <K extends LibraryKind>(kind: K, id: string) => (library[kind] as Array<{ id: string }>).find((x) => x.id === id) as Library[K][number] | undefined;
  const lines: Partial<Record<LibraryKind, string[]>> = {};
  for (const { kind, id } of picks) {
    if (kind === 'experience') {
      const e = get('experience', id) as LibExperience | undefined;
      if (e) out.push({ ...createBlock('experience'), libId: id, role: e.role, company: e.company, dates: range(e.start, e.end, e.current), text: e.description } as DocBlockNode);
    } else if (kind === 'projects') {
      const p = get('projects', id) as LibProject | undefined;
      if (p) out.push({ ...createBlock('project'), libId: id, title: p.title, text: p.resumeSummary || p.description, tags: p.technologies, url: p.live || p.github } as DocBlockNode);
    } else {
      const v = get(kind, id) as unknown as Record<string, string> | undefined;
      if (!v) continue;
      const line =
        kind === 'skills'
          ? v.name
          : kind === 'education'
            ? [[v.degree, v.field].filter(Boolean).join(', '), v.institution, range(v.start ?? '', v.end ?? '')].filter(Boolean).join(' — ')
            : kind === 'certifications'
              ? [v.name, v.issuer, v.date].filter(Boolean).join(' — ')
              : [v.title, v.description].filter(Boolean).join(' — ');
      (lines[kind] ??= []).push(line!);
    }
  }
  for (const [kind, items] of Object.entries(lines) as Array<[LibraryKind, string[]]>) {
    if (kind === 'skills') out.push({ ...createBlock('paragraph'), text: items.join(' · ') } as DocBlockNode);
    else out.push({ ...createBlock('list'), items } as DocBlockNode);
  }
  return out;
}

/** "+ Insert from Library" for block documents: inserted below the selection, one undo step. */
export function DocumentInsertFromLibrary({ onDone }: { onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const insert = (pick: InsertPick) => {
    const ws = useWorkspace.getState();
    const adopted = adoptCandidates(ws.library, pick.items);
    if (adopted.added) ws.setLibrary(adopted.library);
    void addProvenance(adopted.provenance);
    const blocks = [...itemBlocks(adopted.library, adopted.picks), ...pick.text.map(textBlock)];
    if (!blocks.length) return;
    const ed = useDocumentEditor.getState();
    const i = ed.doc ? ed.doc.blocks.findIndex((b) => b.id === ed.selected) : -1;
    ed.apply('Insert from library', (d) => {
      const next = [...d.blocks];
      next.splice(i >= 0 ? i + 1 : next.length, 0, ...blocks);
      return { ...d, blocks: next };
    });
    ed.select(blocks[0]!.id);
    onDone?.();
  };
  return (
    <>
      <Button size="sm" className="w-full" icon={<BookPlus className="size-3.5" />} onClick={() => setOpen(true)}>
        Insert from Library
      </Button>
      <InsertFromLibraryDialog open={open} onClose={() => setOpen(false)} kinds={DOC_KINDS} text onInsert={insert} />
    </>
  );
}

/** Cover letter: append picked text (document paragraphs or item summaries) to the body. */
export function LetterInsertFromLibrary({ body, onChange }: { body: string; onChange: (body: string) => void }) {
  const [open, setOpen] = useState(false);
  const insert = (pick: InsertPick) => {
    const ws = useWorkspace.getState();
    const adopted = adoptCandidates(ws.library, pick.items);
    if (adopted.added) ws.setLibrary(adopted.library);
    void addProvenance(adopted.provenance);
    const paras: string[] = [];
    const skills: string[] = [];
    for (const { kind, id } of adopted.picks) {
      const v = (adopted.library[kind] as unknown as Array<Record<string, unknown> & { id: string }>).find((x) => x.id === id);
      if (!v) continue;
      if (kind === 'skills') skills.push(String(v.name));
      else if (kind === 'experience') {
        const lead = `As ${v.role} at ${v.company}`;
        const desc = String(v.description || '').trim();
        const wins = ((v.achievements as string[]) ?? []).slice(0, 2).join(' ');
        paras.push([desc ? `${lead}, ${desc.replace(/^\w/, (c) => c.toLowerCase())}` : `${lead}.`, wins].filter(Boolean).join(' '));
      } else if (kind === 'projects') {
        const desc = String(v.resumeSummary || v.description || '').trim();
        paras.push(desc ? `${v.title}: ${desc}` : String(v.title));
      }
    }
    if (skills.length) paras.push(`Skills: ${skills.join(', ')}.`);
    const text = [...paras, ...pick.text.map((t) => (t.items?.length ? t.items.map((x) => `- ${x}`).join('\n') : t.text))].filter(Boolean);
    if (text.length) onChange([body.trim(), ...text].filter(Boolean).join('\n\n'));
  };
  return (
    <>
      <Button size="xs" variant="ghost" icon={<BookPlus className="size-3.5" />} onClick={() => setOpen(true)}>
        Insert from Library
      </Button>
      <InsertFromLibraryDialog open={open} onClose={() => setOpen(false)} kinds={['experience', 'projects', 'skills']} text title="Insert into the letter body" onInsert={insert} />
    </>
  );
}
