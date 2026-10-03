import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { create } from 'zustand';
import { Compass, FileText, FolderSearch, Globe, LayoutTemplate, Plus, ScrollText } from 'lucide-react';
import { CommandPalette, type Command } from '@/features/builder/CommandPalette';
import { useHotkeys } from '@/hooks/useHotkeys';

interface SearchState {
  open: boolean;
  setOpen(open: boolean): void;
}

/** Open state is shared so headers can show a search button. */
export const useGlobalSearch = create<SearchState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

interface Item {
  id: string;
  label: string;
  group: string;
  keywords: string;
  to: string;
}

const PAGES: Array<[string, string, string]> = [
  ['/studio', 'Dashboard', 'home studio overview'],
  ['/projects', 'Portfolios', 'projects sites websites'],
  ['/resumes', 'Resumes', 'cv'],
  ['/documents', 'Documents', 'cover letter letters'],
  ['/knowledge', 'Extract Your Data', 'knowledge pdf import files upload ocr'],
  ['/profile', 'Profile', 'identity photo me'],
  ['/templates', 'Templates', 'themes gallery designs'],
  ['/settings', 'Settings', 'preferences theme storage data'],
  ['/about', 'About', 'info'],
  ['/new', 'New portfolio', 'create start blank template import'],
];

const ICONS: Record<string, ReactNode> = {
  Pages: <Compass />,
  Portfolios: <Globe />,
  Resumes: <ScrollText />,
  Documents: <FileText />,
  'Extracted files': <FolderSearch />,
  Templates: <LayoutTemplate />,
};

/** Everything stored on this device, read fresh each time the search opens. */
async function loadItems(): Promise<Item[]> {
  const [{ listProjects }, studio, { listDocs }, { TEMPLATES }] = await Promise.all([
    import('@/lib/storage/projects'),
    import('@/studio/storage/repo'),
    import('@/knowledge/storage/repo'),
    import('@/templates'),
  ]);
  const settle = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]);
  const [projects, resumes, documents, kdocs] = await Promise.all([settle(listProjects()), settle(studio.listResumes()), settle(studio.listDocuments()), settle(listDocs())]);
  return [
    ...projects.map((p) => ({ id: `p-${p.id}`, label: p.name, group: 'Portfolios', keywords: `${p.headline} ${p.themeName}`, to: `/builder/${p.id}` })),
    ...resumes.map((r) => ({ id: `r-${r.id}`, label: r.name, group: 'Resumes', keywords: `${r.kind} ${r.templateId}`, to: `/resume/${r.id}` })),
    ...documents.map((d) => ({ id: `d-${d.id}`, label: d.name, group: 'Documents', keywords: `${d.kind} ${d.templateId}`, to: `/document/${d.id}` })),
    ...kdocs.map((k) => ({ id: `k-${k.id}`, label: k.name, group: 'Extracted files', keywords: `${k.docType} ${k.folder} ${k.tags.join(' ')}`, to: `/knowledge/${k.id}` })),
    ...TEMPLATES.map((t) => ({ id: `t-${t.id}`, label: t.name, group: 'Templates', keywords: `${t.description} ${t.audience} ${t.tags.join(' ')}`, to: `/templates?t=${t.id}` })),
  ];
}

/** ⌘K / "/" search across pages, portfolios, resumes, documents, extracted files and templates. */
export function GlobalSearch() {
  const { open, setOpen } = useGlobalSearch();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [items, setItems] = useState<Item[]>([]);
  // The builder has its own ⌘K command palette; on the runner ⌘K clears the output.
  const enabled = !pathname.startsWith('/builder/') && pathname !== '/runner';

  useHotkeys([
    { combo: 'mod+k', enabled, handler: (e) => (e.preventDefault(), setOpen(!useGlobalSearch.getState().open)) },
    { combo: '/', enabled: enabled && !open, handler: (e) => (e.preventDefault(), setOpen(true)) },
  ]);

  useEffect(() => setOpen(false), [pathname, setOpen]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void loadItems().then((next) => alive && setItems(next));
    return () => {
      alive = false;
    };
  }, [open]);

  const commands = useMemo<Command[]>(
    () => [
      ...PAGES.map(([to, label, keywords]) => ({ id: `page-${to}`, label, group: 'Pages', keywords, icon: to === '/new' ? <Plus /> : ICONS.Pages, run: () => void navigate(to) })),
      ...items.map((it) => ({ id: it.id, label: it.label || 'Untitled', group: it.group, keywords: it.keywords, icon: ICONS[it.group], run: () => void navigate(it.to) })),
    ],
    [items, navigate],
  );

  if (!enabled) return null;
  return <CommandPalette open={open} onClose={() => setOpen(false)} commands={commands} placeholder="Search portfolios, resumes, documents, pages…" label="Search" />;
}
