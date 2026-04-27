import { create } from 'zustand';
import type { SSHSession, SessionGroup } from '../types';
import { api } from '../lib/api';

interface SessionStore {
  sessions: SSHSession[];
  groups: SessionGroup[];
  recentSessions: SSHSession[];
  searchQuery: string;
  selectedGroupId: string | null;
  editingSession: SSHSession | null;
  isLoading: boolean;

  loadSessions: () => Promise<void>;
  loadGroups: () => Promise<void>;
  loadRecent: () => Promise<void>;
  createSession: (session: Partial<SSHSession>) => Promise<string>;
  updateSession: (id: string, session: Partial<SSHSession>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  createGroup: (group: Partial<SessionGroup>) => Promise<string>;
  updateGroup: (id: string, group: Partial<SessionGroup>) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSelectedGroupId: (id: string | null) => void;
  setEditingSession: (session: SSHSession | null) => void;
  getFilteredSessions: () => SSHSession[];
  clearRecentSession: (id: string) => Promise<void>;
  clearAllRecent: () => Promise<void>;
  exportSessions: () => Promise<boolean>;
  importSessions: () => Promise<boolean>;
}

const parseSession = (raw: Record<string, unknown>): SSHSession => ({
  ...raw as unknown as SSHSession,
  labels: typeof raw.labels === 'string' ? JSON.parse(raw.labels as string) : (raw.labels || []) as string[],
  sftpBookmarks: typeof raw.sftpBookmarks === 'string' ? JSON.parse(raw.sftpBookmarks as string) : (raw.sftpBookmarks || []) as string[],
  agentForwarding: Boolean(raw.agentForwarding),
  enableLogging: Boolean(raw.enableLogging),
});

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  groups: [],
  recentSessions: [],
  searchQuery: '',
  selectedGroupId: null,
  editingSession: null,
  isLoading: false,

  loadSessions: async () => {
    set({ isLoading: true });
    const raw = await api.sessions.getAll();
    set({ sessions: (raw as Record<string, unknown>[]).map(parseSession), isLoading: false });
  },

  loadGroups: async () => {
    const groups = await api.groups.getAll();
    set({ groups: groups as SessionGroup[] });
  },

  loadRecent: async () => {
    const raw = await api.sessions.getRecent();
    set({ recentSessions: (raw as Record<string, unknown>[]).map(parseSession) });
  },

  createSession: async (session) => {
    const id = await api.sessions.create(session);
    await get().loadSessions();
    return id as string;
  },

  updateSession: async (id, session) => {
    await api.sessions.update(id, session);
    await get().loadSessions();
  },

  deleteSession: async (id) => {
    await api.sessions.delete(id);
    await get().loadSessions();
  },

  createGroup: async (group) => {
    const id = await api.groups.create(group);
    await get().loadGroups();
    return id as string;
  },

  updateGroup: async (id, group) => {
    await api.groups.update(id, group);
    await get().loadGroups();
  },

  deleteGroup: async (id) => {
    await api.groups.delete(id);
    await get().loadGroups();
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedGroupId: (id) => set({ selectedGroupId: id }),
  setEditingSession: (session) => set({ editingSession: session }),

  getFilteredSessions: () => {
    const { sessions, searchQuery, selectedGroupId } = get();
    let filtered = sessions;
    if (selectedGroupId) {
      filtered = filtered.filter((s) => s.groupId === selectedGroupId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.host.toLowerCase().includes(q) ||
          s.username.toLowerCase().includes(q) ||
          s.labels.some((l) => l.toLowerCase().includes(q)) ||
          s.notes.toLowerCase().includes(q)
      );
    }
    return filtered;
  },

  clearRecentSession: async (id) => {
    await api.sessions.clearLastConnected(id);
    await get().loadRecent();
  },

  clearAllRecent: async () => {
    await api.sessions.clearAllRecent();
    await get().loadRecent();
  },

  exportSessions: async () => api.sessions.export() as Promise<boolean>,
  importSessions: async () => {
    const result = await api.sessions.import();
    if (result) {
      await get().loadSessions();
      await get().loadGroups();
    }
    return result as boolean;
  },
}));
