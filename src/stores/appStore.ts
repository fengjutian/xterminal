import { create } from 'zustand';
import type { AppSettings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';

interface AppStoreState {
  settings: AppSettings;
  sidebarVisible: boolean;
  sidebarWidth: number;

  updateSettings: (updates: Partial<AppSettings>) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
}

export const useAppStore = create<AppStoreState>((set) => ({
  settings: DEFAULT_SETTINGS,
  sidebarVisible: true,
  sidebarWidth: 260,

  updateSettings: (updates) =>
    set((s) => ({ settings: { ...s.settings, ...updates } })),

  toggleSidebar: () =>
    set((s) => ({ sidebarVisible: !s.sidebarVisible })),

  setSidebarWidth: (width) => set({ sidebarWidth: width }),
}));
