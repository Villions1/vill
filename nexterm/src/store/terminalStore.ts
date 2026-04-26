import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { TerminalTab } from '../types';
import { api } from '../lib/api';

interface TerminalStore {
  tabs: TerminalTab[];
  activeTabId: string | null;
  broadcastMode: boolean;

  openTab: (sessionId: string, title: string) => string;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<TerminalTab>) => void;
  connectTab: (tabId: string, sessionData: Record<string, unknown>) => Promise<void>;
  disconnectTab: (tabId: string) => Promise<void>;
  toggleBroadcastMode: () => void;
  getActiveTab: () => TerminalTab | undefined;
}

export const useTerminalStore = create<TerminalStore>((set, get) => ({
  tabs: [],
  activeTabId: null,
  broadcastMode: false,

  openTab: (sessionId, title) => {
    const id = uuid();
    const tab: TerminalTab = {
      id,
      sessionId,
      title,
      isConnected: false,
      isConnecting: false,
    };
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: id,
    }));
    return id;
  },

  closeTab: (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (tab?.connectionId) {
      api.ssh.disconnect(tab.connectionId);
    }
    set((state) => {
      const tabs = state.tabs.filter((t) => t.id !== tabId);
      const activeTabId =
        state.activeTabId === tabId
          ? tabs.length > 0
            ? tabs[tabs.length - 1].id
            : null
          : state.activeTabId;
      return { tabs, activeTabId };
    });
  },

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  updateTab: (tabId, updates) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, ...updates } : t)),
    }));
  },

  connectTab: async (tabId, sessionData) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab) return;

    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, isConnecting: true } : t
      ),
    }));

    try {
      const connId = await api.ssh.connect(tab.sessionId, sessionData);
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tabId
            ? { ...t, connectionId: connId as string, isConnected: true, isConnecting: false }
            : t
        ),
      }));
    } catch (err) {
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tabId ? { ...t, isConnecting: false } : t
        ),
      }));
      throw err;
    }
  },

  disconnectTab: async (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (tab?.connectionId) {
      await api.ssh.disconnect(tab.connectionId);
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tabId
            ? { ...t, connectionId: undefined, isConnected: false }
            : t
        ),
      }));
    }
  },

  toggleBroadcastMode: () => set((state) => ({ broadcastMode: !state.broadcastMode })),

  getActiveTab: () => {
    const { tabs, activeTabId } = get();
    return tabs.find((t) => t.id === activeTabId);
  },
}));
