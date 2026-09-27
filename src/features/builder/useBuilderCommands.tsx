import { useMemo } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import {
  Activity,
  Briefcase,
  Code2,
  Dices,
  Download,
  Eye,
  FileJson,
  FileText,
  FileType,
  FolderKanban,
  FolderArchive,
  Globe,
  History,
  Keyboard,
  Maximize,
  Monitor,
  Moon,
  Palette,
  Plus,
  Presentation,
  Printer,
  Redo2,
  Save,
  Settings,
  Share2,
  Smartphone,
  Tablet,
  Undo2,
  Upload,
  Search,
} from 'lucide-react';
import type { Command } from './CommandPalette';
import { useEditor } from '@/stores/editor';
import { useUI } from '@/stores/ui';
import { THEMES } from '@/lib/theme/themes';
import { generateTheme } from '@/lib/theme/randomizer';
import { SECTION_REGISTRY, SECTION_TYPES } from '@/sections/registry';
import { createProjectItem } from '@/sections/defs/projects';
import { createExperienceItem } from '@/sections/defs/experience';
import { SectionIcon } from './SectionIcon';
import type { SectionType } from '@/types/portfolio';

export interface CommandDeps {
  navigate: NavigateFunction;
  projectId: string;
  saveNow: (label?: string) => Promise<void>;
  present: () => void;
  print: () => void;
  exportJson: () => void;
}

/** Append an item to a list section (creating the section first when needed). */
function addListItem(type: 'projects' | 'experience') {
  const ed = useEditor.getState();
  let section = ed.portfolio?.sections.find((s) => s.type === type);
  if (!section) {
    const id = ed.addSection(type);
    if (!id) return;
    useUI.getState().setInspectorTab('content');
    return;
  }
  if (section.locked) {
    ed.updateSectionData(section.id, 'items', []); // triggers the locked rejection toast
    return;
  }
  const item = type === 'projects' ? createProjectItem() : createExperienceItem();
  section = useEditor.getState().portfolio!.sections.find((s) => s.id === section!.id)!;
  const items = (section.data as { items: unknown[] }).items;
  ed.updateSectionData(section.id, 'items', [...items, item]);
  ed.select(section.id);
  useUI.getState().setInspectorTab('content');
}

export function useBuilderCommands(d: CommandDeps): Command[] {
  const sectionsKey = useEditor((s) => s.portfolio?.sections.map((x) => `${x.id}:${x.name}`).join('|') ?? '');
  return useMemo(() => {
    const ed = () => useEditor.getState();
    const ui = () => useUI.getState();
    const go = (path: string) => () => {
      void d.navigate(path);
    };
    const sections = [...(ed().portfolio?.sections ?? [])].sort((a, b) => a.order - b.order);

    const cmds: Command[] = [
      { id: 'add-project', group: 'Content', label: 'Add Project', icon: <FolderKanban />, run: () => addListItem('projects') },
      { id: 'add-experience', group: 'Content', label: 'Add Experience', icon: <Briefcase />, run: () => addListItem('experience') },
      {
        id: 'add-section',
        group: 'Content',
        label: 'Add Section…',
        icon: <Plus />,
        keywords: 'insert block',
        run: () =>
          SECTION_TYPES.map((t: SectionType) => ({
            id: `add-${t}`,
            group: 'Sections',
            label: SECTION_REGISTRY[t].label,
            keywords: SECTION_REGISTRY[t].description,
            icon: <SectionIcon name={SECTION_REGISTRY[t].icon} />,
            run: () => {
              ed().addSection(t);
              ui().setInspectorTab('content');
            },
          })),
      },
      {
        id: 'goto-section',
        group: 'Content',
        label: 'Go to Section…',
        icon: <Search />,
        keywords: 'jump find select',
        run: () =>
          sections.map((s) => ({
            id: `goto-${s.id}`,
            group: 'Sections',
            label: s.name,
            icon: <SectionIcon name={SECTION_REGISTRY[s.type].icon} />,
            run: () => {
              ed().select(s.id);
              ui().setInspectorTab('content');
            },
          })),
      },
      {
        id: 'change-theme',
        group: 'Design',
        label: 'Change Theme…',
        icon: <Palette />,
        run: () => THEMES.map((t) => ({ id: `theme-${t.id}`, group: 'Themes', label: t.name, keywords: t.description, icon: <span className="size-3 rounded-full" style={{ background: t.palettes[t.defaultScheme].primary }} />, run: () => ed().setTheme(t.id) })),
      },
      {
        id: 'toggle-dark',
        group: 'Design',
        label: 'Toggle Dark Mode',
        icon: <Moon />,
        run: () => {
          const p = ed().portfolio!;
          const cur = p.settings.colorScheme === 'system' ? p.theme.defaultScheme : p.settings.colorScheme;
          ed().updateSettings('colorScheme', cur === 'dark' ? 'light' : 'dark');
        },
      },
      { id: 'generate-design', group: 'Design', label: 'Generate Design', keywords: 'random theme randomize', icon: <Dices />, run: () => ed().replaceTheme(generateTheme(ed().portfolio!.theme, Math.floor(Math.random() * 2 ** 31)), 'Generate design') },
      { id: 'preview', group: 'View', label: 'Preview', shortcut: 'mod+p', icon: <Eye />, run: go(`/preview/${d.projectId}`) },
      { id: 'focus', group: 'View', label: 'Focus Mode', shortcut: 'mod+.', icon: <Maximize />, run: () => ui().setFocusMode(!ui().focusMode) },
      { id: 'present', group: 'View', label: 'Presentation Mode', icon: <Presentation />, run: d.present },
      { id: 'print', group: 'View', label: 'Print', keywords: 'printable', icon: <Printer />, run: d.print },
      { id: 'vp-desktop', group: 'View', label: 'Desktop Viewport', icon: <Monitor />, run: () => ui().setViewport('desktop') },
      { id: 'vp-tablet', group: 'View', label: 'Tablet Viewport', icon: <Tablet />, run: () => ui().setViewport('tablet') },
      { id: 'vp-mobile', group: 'View', label: 'Mobile Viewport', icon: <Smartphone />, run: () => ui().setViewport('mobile') },
      { id: 'dev-html', group: 'View', label: 'Show Generated HTML', icon: <Code2 />, run: () => ui().setDevView('html') },
      { id: 'dev-css', group: 'View', label: 'Show Generated CSS', icon: <Code2 />, run: () => ui().setDevView('css') },
      { id: 'dev-json', group: 'View', label: 'Show Project JSON', icon: <Code2 />, run: () => ui().setDevView('json') },
      { id: 'dev-canvas', group: 'View', label: 'Show Canvas', icon: <Eye />, run: () => ui().setDevView('preview') },
      { id: 'export', group: 'Export', label: 'Open Export Studio', shortcut: 'mod+e', icon: <Download />, run: go(`/export/${d.projectId}`) },
      { id: 'export-html', group: 'Export', label: 'Export HTML', icon: <Globe />, run: go(`/export/${d.projectId}?format=html`) },
      { id: 'export-pdf', group: 'Export', label: 'Export PDF', icon: <FileText />, run: go(`/export/${d.projectId}?format=pdf`) },
      { id: 'export-word', group: 'Export', label: 'Export Word', keywords: 'docx', icon: <FileType />, run: go(`/export/${d.projectId}?format=docx`) },
      { id: 'export-zip', group: 'Export', label: 'Export ZIP', keywords: 'website static deploy', icon: <FolderArchive />, run: go(`/export/${d.projectId}?format=zip`) },
      { id: 'resume', group: 'Export', label: 'Generate Resume', keywords: 'cv ats', icon: <FileText />, run: go(`/export/${d.projectId}?format=resume`) },
      { id: 'export-project', group: 'Project', label: 'Export Project', keywords: 'json backup download', icon: <FileJson />, run: d.exportJson },
      { id: 'import-project', group: 'Project', label: 'Import Project', keywords: 'json html resume upload', icon: <Upload />, run: () => ui().setImportOpen(true) },
      { id: 'save', group: 'Project', label: 'Save Version', shortcut: 'mod+s', icon: <Save />, run: () => void d.saveNow() },
      { id: 'history', group: 'Project', label: 'Version History', icon: <History />, run: () => ui().setHistoryOpen(true) },
      { id: 'share', group: 'Project', label: 'Share Link & QR', icon: <Share2 />, run: () => ui().setShareOpen(true) },
      { id: 'insights', group: 'Project', label: 'Insights & Audits', keywords: 'accessibility performance content health', icon: <Activity />, run: () => ui().setInsightsOpen(true) },
      { id: 'undo', group: 'Edit', label: 'Undo', shortcut: 'mod+z', icon: <Undo2 />, run: () => ed().undo() },
      { id: 'redo', group: 'Edit', label: 'Redo', shortcut: 'mod+shift+z', icon: <Redo2 />, run: () => ed().redo() },
      { id: 'site-settings', group: 'Settings', label: 'Open Site Settings', icon: <Settings />, run: () => ui().setInspectorTab('settings') },
      { id: 'app-settings', group: 'Settings', label: 'Open App Settings', icon: <Settings />, run: go('/settings') },
      { id: 'shortcuts', group: 'Settings', label: 'Keyboard Shortcuts', shortcut: 'mod+/', icon: <Keyboard />, run: () => ui().setShortcutsOpen(true) },
    ];
    return cmds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.projectId, sectionsKey]);
}
