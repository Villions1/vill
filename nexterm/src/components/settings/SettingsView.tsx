import { useState } from 'react';
import { Palette, Terminal, Shield, Info } from 'lucide-react';
import { useSettingsStore } from '../../store';

const ACCENT_COLORS = [
  '#4A90D9', '#5A9EE5', '#57ab5a', '#c69026', '#986ee2',
  '#e0823d', '#39c5cf', '#e5534b', '#f778ba', '#768390',
];

export function SettingsView() {
  const { settings, updateSettings } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<'appearance' | 'terminal' | 'security' | 'about'>('appearance');

  const tabs = [
    { id: 'appearance' as const, label: 'Appearance', icon: <Palette size={16} /> },
    { id: 'terminal' as const, label: 'Terminal', icon: <Terminal size={16} /> },
    { id: 'security' as const, label: 'Security', icon: <Shield size={16} /> },
    { id: 'about' as const, label: 'About', icon: <Info size={16} /> },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-sidebar-border">
        <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Tab nav */}
        <div className="w-48 border-r border-sidebar-border p-2 space-y-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`nav-item w-full ${activeTab === tab.id ? 'active' : ''}`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {activeTab === 'appearance' && (
            <>
              <SettingSection title="Theme">
                <div className="flex gap-3">
                  <button
                    onClick={() => updateSettings({ theme: 'dark' })}
                    className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                      settings.theme === 'dark'
                        ? 'border-accent bg-accent/10'
                        : 'border-sidebar-border hover:border-sidebar-active'
                    }`}
                  >
                    <div className="w-full h-16 rounded bg-[#1a1d23] mb-2 flex items-end p-1.5 gap-1">
                      <div className="w-8 h-full rounded bg-[#22262e]" />
                      <div className="flex-1 h-full rounded bg-[#1e2128]" />
                    </div>
                    <span className="text-sm font-medium">Dark</span>
                  </button>
                  <button
                    onClick={() => updateSettings({ theme: 'light' })}
                    className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                      settings.theme === 'light'
                        ? 'border-accent bg-accent/10'
                        : 'border-sidebar-border hover:border-sidebar-active'
                    }`}
                  >
                    <div className="w-full h-16 rounded bg-[#f5f6f8] mb-2 flex items-end p-1.5 gap-1">
                      <div className="w-8 h-full rounded bg-[#e8e9ec]" />
                      <div className="flex-1 h-full rounded bg-white" />
                    </div>
                    <span className="text-sm font-medium">Light</span>
                  </button>
                </div>
              </SettingSection>

              <SettingSection title="Accent Color">
                <div className="flex gap-3">
                  {ACCENT_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => updateSettings({ accentColor: color })}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        settings.accentColor === color ? 'border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </SettingSection>
            </>
          )}

          {activeTab === 'terminal' && (
            <>
              <SettingSection title="Font">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">Font Family</label>
                    <select
                      value={settings.fontFamily}
                      onChange={(e) => updateSettings({ fontFamily: e.target.value })}
                      className="select-field"
                    >
                      <option value="'JetBrainsMono Nerd Font', monospace">JetBrains Mono Nerd (bundled)</option>
                      <option value="JetBrains Mono">JetBrains Mono</option>
                      <option value="Fira Code">Fira Code</option>
                      <option value="Cascadia Code">Cascadia Code</option>
                      <option value="Source Code Pro">Source Code Pro</option>
                      <option value="Menlo">Menlo</option>
                      <option value="monospace">System Monospace</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">Font Size</label>
                    <input
                      type="number"
                      value={settings.fontSize}
                      onChange={(e) => updateSettings({ fontSize: e.target.value })}
                      min={8}
                      max={32}
                      className="input-field"
                    />
                  </div>
                </div>
              </SettingSection>

              <SettingSection title="Cursor">
                <select
                  value={settings.cursorStyle}
                  onChange={(e) => updateSettings({ cursorStyle: e.target.value as 'block' | 'underline' | 'bar' })}
                  className="select-field w-48"
                >
                  <option value="block">Block</option>
                  <option value="underline">Underline</option>
                  <option value="bar">Bar</option>
                </select>
              </SettingSection>

              <SettingSection title="Scrollback Buffer (lines)">
                <input
                  type="number"
                  value={settings.scrollbackLines}
                  onChange={(e) => updateSettings({ scrollbackLines: e.target.value })}
                  min={100}
                  max={100000}
                  className="input-field w-48"
                />
              </SettingSection>

              <SettingSection title="Shell Enhancement">
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={settings.autoSetupZsh === 'true'}
                    onChange={(e) =>
                      updateSettings({ autoSetupZsh: e.target.checked ? 'true' : 'false' })
                    }
                    className="rounded"
                  />
                  Auto-install Oh My Zsh + Powerlevel10k on first connect
                </label>
                <p className="text-xs text-text-muted mt-1.5">
                  When enabled, automatically sets up zsh with Oh My Zsh and Powerlevel10k
                  theme on remote servers that don&apos;t have it. Requires root or sudo access.
                </p>
              </SettingSection>

              <SettingSection title="Terminal Bell Sound">
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={settings.terminalBellSound === 'true'}
                    onChange={(e) =>
                      updateSettings({ terminalBellSound: e.target.checked ? 'true' : 'false' })
                    }
                    className="rounded"
                  />
                  Enable bell sound in terminal
                </label>
              </SettingSection>
            </>
          )}

          {activeTab === 'security' && (
            <>
              <SettingSection title="Master Password">
                <p className="text-sm text-text-muted mb-3">
                  Set a master password to encrypt stored credentials. Once set, you'll need to
                  enter it each time you launch the app.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="password"
                    value={settings.masterPassword}
                    onChange={(e) => updateSettings({ masterPassword: e.target.value })}
                    placeholder="Enter master password"
                    className="input-field w-64"
                  />
                  <button
                    onClick={() => updateSettings({ masterPassword: '' })}
                    className="btn-ghost text-sm"
                  >
                    Clear
                  </button>
                </div>
              </SettingSection>
            </>
          )}

          {activeTab === 'about' && (
            <SettingSection title="About valkyrieTUN">
              <div className="space-y-3">
                <p className="text-sm text-text-primary">
                  <span className="font-semibold">valkyrieTUN</span> — Modern SSH Client for Linux
                </p>
                <p className="text-sm text-text-secondary">Version 1.0.0</p>
                <p className="text-sm text-text-muted">
                  A production-ready SSH client with terminal emulation, SFTP file management,
                  key management, scripts, and port forwarding. Built with Electron, React,
                  and xterm.js.
                </p>
                <div className="flex items-center gap-4 pt-2">
                  <span className="badge-blue">Electron</span>
                  <span className="badge-blue">React 18</span>
                  <span className="badge-blue">xterm.js</span>
                  <span className="badge-blue">ssh2</span>
                  <span className="badge-blue">SQLite</span>
                </div>
                <p className="text-xs text-text-muted pt-4">
                  No cloud sync. No telemetry. Fully offline. All data stays local.
                </p>
              </div>
            </SettingSection>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary mb-3">{title}</h3>
      {children}
    </div>
  );
}
