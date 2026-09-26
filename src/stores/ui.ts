import { create } from 'zustand';

export type ViewportPreset = 'desktop' | 'laptop' | 'tablet' | 'mobile' | 'custom';

export const VIEWPORTS: Record<Exclude<ViewportPreset, 'custom'>, { width: number; height: number; label: string }> = {
  desktop: { width: 1440, height: 900, label: 'Desktop' },
  laptop: { width: 1280, height: 800, label: 'Laptop' },
  tablet: { width: 820, height: 1180, label: 'Tablet' },
  mobile: { width: 390, height: 844, label: 'Mobile' },
};

export type InspectorTab = 'content' | 'style' | 'theme' | 'seo' | 'settings';
export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
  action?: { label: string; run: () => void };
}

interface UIState {
  viewport: ViewportPreset;
  customSize: { width: number; height: number };
  zoom: 'fit' | number;
  inspectorTab: InspectorTab;
  devView: 'preview' | 'html' | 'css' | 'json';
  focusMode: boolean;
  commandPaletteOpen: boolean;
  historyOpen: boolean;
  shareOpen: boolean;
  insightsOpen: boolean;
  importOpen: boolean;
  shortcutsOpen: boolean;
  mobilePanel: 'none' | 'sections' | 'inspector';
  toasts: Toast[];
  setViewport(v: ViewportPreset): void;
  setCustomSize(size: { width: number; height: number }): void;
  setZoom(z: 'fit' | number): void;
  setInspectorTab(t: InspectorTab): void;
  setDevView(v: UIState['devView']): void;
  setFocusMode(on: boolean): void;
  setCommandPalette(open: boolean): void;
  setHistoryOpen(open: boolean): void;
  setShareOpen(open: boolean): void;
  setInsightsOpen(open: boolean): void;
  setImportOpen(open: boolean): void;
  setShortcutsOpen(open: boolean): void;
  setMobilePanel(p: UIState['mobilePanel']): void;
  toast(t: Omit<Toast, 'id' | 'tone'> & { tone?: ToastTone }): void;
  dismissToast(id: number): void;
}

let toastId = 0;

export const useUI = create<UIState>()((set) => ({
  viewport: 'desktop',
  customSize: { width: 1024, height: 768 },
  zoom: 'fit',
  inspectorTab: 'content',
  devView: 'preview',
  focusMode: false,
  commandPaletteOpen: false,
  historyOpen: false,
  shareOpen: false,
  insightsOpen: false,
  importOpen: false,
  shortcutsOpen: false,
  mobilePanel: 'none',
  toasts: [],
  setViewport: (viewport) => set({ viewport }),
  setCustomSize: (customSize) => set({ customSize, viewport: 'custom' }),
  setZoom: (zoom) => set({ zoom }),
  setInspectorTab: (inspectorTab) => set({ inspectorTab }),
  setDevView: (devView) => set({ devView }),
  setFocusMode: (focusMode) => set({ focusMode }),
  setCommandPalette: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setHistoryOpen: (historyOpen) => set({ historyOpen }),
  setShareOpen: (shareOpen) => set({ shareOpen }),
  setInsightsOpen: (insightsOpen) => set({ insightsOpen }),
  setImportOpen: (importOpen) => set({ importOpen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  setMobilePanel: (mobilePanel) => set({ mobilePanel }),
  toast: (t) => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { tone: 'info', ...t, id }] }));
    window.setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), t.tone === 'error' ? 8000 : 4500);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export const toast = (t: Parameters<UIState['toast']>[0]) => useUI.getState().toast(t);
