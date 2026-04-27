import { useState, useEffect } from 'react';
import { Palette, Terminal, Shield, Info, Eye, EyeOff } from 'lucide-react';
import { useSettingsStore } from '../../store';
import { api } from '../../lib/api';
import { useI18n } from '../../i18n/useI18n';

const ACCENT_COLORS = [
  '#4A90D9', '#5A9EE5', '#57ab5a', '#c69026', '#986ee2',
  '#e0823d', '#39c5cf', '#e5534b', '#f778ba', '#768390',
];

export function SettingsView() {
  const { settings, updateSettings } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<'appearance' | 'terminal' | 'security' | 'about'>('appearance');
  const { t } = useI18n();

  const tabs = [
    { id: 'appearance' as const, label: t('settings.appearance'), icon: <Palette size={16} /> },
    { id: 'terminal' as const, label: t('settings.terminal'), icon: <Terminal size={16} /> },
    { id: 'security' as const, label: t('settings.security'), icon: <Shield size={16} /> },
    { id: 'about' as const, label: t('settings.about'), icon: <Info size={16} /> },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-sidebar-border">
        <h2 className="text-lg font-semibold text-text-primary">{t('settings.title')}</h2>
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
              <SettingSection title={t('settings.theme')}>
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
                    <span className="text-sm font-medium">{t('settings.dark')}</span>
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
                    <span className="text-sm font-medium">{t('settings.light')}</span>
                  </button>
                </div>
              </SettingSection>

              <SettingSection title={t('settings.accentColor')}>
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

              <SettingSection title={t('settings.language')}>
                <select
                  value={settings.language || 'ru'}
                  onChange={(e) => updateSettings({ language: e.target.value })}
                  className="select-field w-48"
                >
                  <option value="en">English</option>
                  <option value="ru">Русский</option>
                </select>
              </SettingSection>
            </>
          )}

          {activeTab === 'terminal' && (
            <>
              <SettingSection title={t('settings.font')}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">{t('settings.fontFamily')}</label>
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
                    <label className="block text-sm text-text-secondary mb-1">{t('settings.fontSize')}</label>
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

              <SettingSection title={t('settings.cursor')}>
                <select
                  value={settings.cursorStyle}
                  onChange={(e) => updateSettings({ cursorStyle: e.target.value as 'block' | 'underline' | 'bar' })}
                  className="select-field w-48"
                >
                  <option value="block">{t('common.block')}</option>
                  <option value="underline">{t('common.underline')}</option>
                  <option value="bar">{t('common.bar')}</option>
                </select>
              </SettingSection>

              <SettingSection title={t('settings.scrollback')}>
                <input
                  type="number"
                  value={settings.scrollbackLines}
                  onChange={(e) => updateSettings({ scrollbackLines: e.target.value })}
                  min={100}
                  max={100000}
                  className="input-field w-48"
                />
              </SettingSection>

              <SettingSection title={t('settings.shellEnhancement')}>
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={settings.autoSetupZsh === 'true'}
                    onChange={(e) =>
                      updateSettings({ autoSetupZsh: e.target.checked ? 'true' : 'false' })
                    }
                    className="rounded"
                  />
                  {t('settings.autoZsh')}
                </label>
                <p className="text-xs text-text-muted mt-1.5">
                  {t('settings.autoZshDesc')}
                </p>
              </SettingSection>

              <SettingSection title={t('settings.bellSound')}>
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={settings.terminalBellSound === 'true'}
                    onChange={(e) =>
                      updateSettings({ terminalBellSound: e.target.checked ? 'true' : 'false' })
                    }
                    className="rounded"
                  />
                  {t('settings.enableBell')}
                </label>
              </SettingSection>
            </>
          )}

          {activeTab === 'security' && (
            <SecuritySettings />
          )}

          {activeTab === 'about' && (
            <SettingSection title={t('about.title')}>
              <div className="space-y-3">
                <p className="text-sm text-text-primary">
                  <span className="font-semibold">valkyrieTUN</span> — Modern SSH Client for Linux
                </p>
                <p className="text-sm text-text-secondary">Version 1.0.0</p>
                <p className="text-sm text-text-muted">
                  {t('about.description')}
                </p>
                <div className="flex items-center gap-4 pt-2">
                  <span className="badge-blue">Electron</span>
                  <span className="badge-blue">React 18</span>
                  <span className="badge-blue">xterm.js</span>
                  <span className="badge-blue">ssh2</span>
                  <span className="badge-blue">SQLite</span>
                </div>
                <p className="text-xs text-text-muted pt-4">
                  {t('about.noCloud')}
                </p>
              </div>
            </SettingSection>
          )}
        </div>
      </div>
    </div>
  );
}

function SecuritySettings() {
  const [hasPassword, setHasPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { t } = useI18n();

  useEffect(() => {
    api.crypto.hasMasterPassword().then((v: boolean) => setHasPassword(v));
  }, []);

  const handleSetPassword = async () => {
    setError('');
    setMessage('');
    if (newPassword.length < 4) { setError(t('security.minChars')); return; }
    if (newPassword !== confirmPassword) { setError(t('security.noMatch')); return; }
    await api.crypto.setMasterPassword(newPassword);
    setHasPassword(true);
    setNewPassword('');
    setConfirmPassword('');
    setMessage(t('security.setSuccess'));
  };

  const handleRemovePassword = async () => {
    setError('');
    setMessage('');
    if (!currentPassword.trim()) { setError(t('security.enterCurrent')); return; }
    const ok = await api.crypto.removeMasterPassword(currentPassword);
    if (ok) {
      setHasPassword(false);
      setCurrentPassword('');
      setMessage(t('security.removeSuccess'));
    } else {
      setError(t('security.wrongPassword'));
    }
  };

  return (
    <>
      <SettingSection title={t('security.masterPassword')}>
        <p className="text-sm text-text-muted mb-3">
          {t('security.masterDesc')}
        </p>

        {hasPassword ? (
          <div className="space-y-3">
            <p className="text-sm text-success font-medium">{t('security.active')}</p>
            <div className="flex items-center gap-3">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t('security.currentToRemove')}
                className="input-field w-64"
              />
              <button onClick={handleRemovePassword} className="btn-ghost text-sm text-warning">
                {t('security.remove')}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('security.newPassword')}
                  className="input-field w-64 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
                >
                  {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('security.confirmPassword')}
                  className="input-field w-64 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
                >
                  {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button onClick={handleSetPassword} className="btn-primary text-sm">
                {t('security.setPassword')}
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
        {message && <p className="text-sm text-success mt-2">{message}</p>}
      </SettingSection>

      <SettingSection title={t('security.encryption')}>
        <p className="text-sm text-text-muted">
          {t('security.encryptionDesc')}
        </p>
      </SettingSection>
    </>
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
