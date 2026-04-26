import { create } from 'zustand';
import type { NavigationView } from '../types';

interface AppStore {
  currentView: NavigationView;
  sidebarCollapsed: boolean;
  activeSftpSessionId: string | null;
  setCurrentView: (view: NavigationView) => void;
  toggleSidebar: () => void;
  setActiveSftpSessionId: (id: string | null) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  currentView: 'home',
  sidebarCollapsed: false,
  activeSftpSessionId: null,
  setCurrentView: (view) => set({ currentView: view }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setActiveSftpSessionId: (id) => set({ activeSftpSessionId: id }),
}));
