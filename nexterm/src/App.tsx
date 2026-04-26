import { useEffect } from 'react';
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
import { useAppStore, useSessionStore, useSettingsStore } from './store';

export default function App() {
  const currentView = useAppStore((s) => s.currentView);
  const settings = useSettingsStore((s) => s.settings);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadSessions = useSessionStore((s) => s.loadSessions);
  const loadGroups = useSessionStore((s) => s.loadGroups);
  const loadRecent = useSessionStore((s) => s.loadRecent);

  useEffect(() => {
    loadSettings();
    loadSessions();
    loadGroups();
    loadRecent();
  }, [loadSettings, loadSessions, loadGroups, loadRecent]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
    document.documentElement.classList.toggle('light', settings.theme === 'light');
  }, [settings.theme]);

  const renderView = () => {
    switch (currentView) {
      case 'home':
        return <HomeView />;
      case 'sessions':
        return <SessionListView />;
      case 'terminal':
        return <TerminalView />;
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
        <main className="flex-1 overflow-hidden">{renderView()}</main>
      </div>
    </div>
  );
}
