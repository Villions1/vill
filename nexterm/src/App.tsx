import { useEffect, useState } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { TitleBar } from './components/layout/TitleBar';
import { HomeView } from './components/sessions/HomeView';
import { SessionListView } from './components/sessions/SessionListView';
import { TerminalView } from './components/terminal/TerminalView';
import { FileManagerView } from './components/sftp/FileManagerView';
import { KeyManagerView } from './components/keys/KeyManagerView';
import { ScriptLibraryView } from './components/scripts/ScriptLibraryView';
import { TunnelManagerView } from './components/tunnels/TunnelManagerView';
import { SettingsView } from './components/settings/SettingsView';
import { LockScreen } from './components/auth/LockScreen';
import { LocalTerminalPanel } from './components/terminal/LocalTerminalPanel';
import { useAppStore, useSessionStore, useSettingsStore, useTerminalStore } from './store';
import { api } from './lib/api';
import { TerminalSquare } from 'lucide-react';
import { useI18n } from './i18n/useI18n';

export default function App() {
  const currentView = useAppStore((s) => s.currentView);
  const settings = useSettingsStore((s) => s.settings);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadSessions = useSessionStore((s) => s.loadSessions);
  const loadGroups = useSessionStore((s) => s.loadGroups);
  const loadRecent = useSessionStore((s) => s.loadRecent);
  const terminalTabs = useTerminalStore((s) => s.tabs);

  const [locked, setLocked] = useState(true);
  const [checkingLock, setCheckingLock] = useState(true);
  const [showLocalTerminal, setShowLocalTerminal] = useState(false);
  const [localTerminalWidth, setLocalTerminalWidth] = useState(480);
  const { t } = useI18n();

  useEffect(() => {
    api.crypto.isUnlocked().then((unlocked: boolean) => {
      setLocked(!unlocked);
      setCheckingLock(false);
    });
  }, []);

  useEffect(() => {
    if (!locked) {
      loadSettings();
      loadSessions();
      loadGroups();
      loadRecent();
    }
  }, [locked, loadSettings, loadSessions, loadGroups, loadRecent]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
    document.documentElement.classList.toggle('light', settings.theme === 'light');
  }, [settings.theme]);

  if (checkingLock) {
    return <div className="h-screen bg-[#1a1d23]" />;
  }

  if (locked) {
    return <LockScreen onUnlock={() => setLocked(false)} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'home':
        return <HomeView />;
      case 'sessions':
        return <SessionListView />;
      case 'sftp':
        return <FileManagerView />;
      case 'keys':
        return <KeyManagerView />;
      case 'scripts':
        return <ScriptLibraryView />;
      case 'tunnels':
        return <TunnelManagerView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <HomeView />;
    }
  };

  return (
    <div className={`flex flex-col h-screen ${settings.theme === 'light' ? 'light' : ''}`}>
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden relative">
          {/* Terminal stays mounted in background to preserve SSH sessions */}
          {terminalTabs.length > 0 && (
            <div className={`absolute inset-0 ${currentView === 'terminal' ? 'z-10' : 'z-0 invisible'}`}>
              <TerminalView />
            </div>
          )}
          {currentView !== 'terminal' && (
            <div className="absolute inset-0 z-10">
              {renderView()}
            </div>
          )}
        </main>

        {/* Local Terminal Panel */}
        {showLocalTerminal && (
          <LocalTerminalPanel
            onClose={() => setShowLocalTerminal(false)}
            width={localTerminalWidth}
            onWidthChange={setLocalTerminalWidth}
          />
        )}
      </div>

      {/* Local Terminal Toggle Button */}
      {!showLocalTerminal && (
        <button
          onClick={() => setShowLocalTerminal(true)}
          className="fixed bottom-4 right-4 z-50 p-2.5 rounded-xl bg-accent text-white shadow-lg hover:bg-accent/90 transition-colors"
          title={t('localTerminal.open')}
        >
          <TerminalSquare size={20} />
        </button>
      )}
    </div>
  );
}
