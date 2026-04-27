import { create } from 'zustand';
import type { AppSettings } from '../types';
import { api } from '../lib/api';

interface SettingsStore {
  settings: AppSettings;
  isLoaded: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
}

const defaultSettings: AppSettings = {
  theme: 'dark',
  fontFamily: 'JetBrains Mono',
  fontSize: '14',
  cursorStyle: 'block',
  scrollbackLines: '5000',
  accentColor: '#4A90D9',
  terminalBellSound: 'false',
  enableBroadcastMode: 'false',
  masterPassword: '',
  language: 'ru',
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: defaultSettings,
  isLoaded: false,

  loadSettings: async () => {
    const settings = await api.settings.get();
    const merged: AppSettings = { ...defaultSettings };
    const raw = settings as Record<string, string>;
    for (const key of Object.keys(raw)) {
      if (raw[key] !== undefined) merged[key] = raw[key];
    }
    set({ settings: merged, isLoaded: true });
  },

  updateSettings: async (updates) => {
    const current = get().settings;
    const newSettings: AppSettings = { ...current };
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) newSettings[k] = v;
    }
    await api.settings.update(updates as Record<string, string>);
    set({ settings: newSettings });
  },
}));
