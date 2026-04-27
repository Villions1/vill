import {
  Home,
  Server,
  Terminal,
  FolderOpen,
  KeyRound,
  FileCode,
  Network,
  Settings,
  ChevronLeft,
  ChevronRight,
  Radio,
} from 'lucide-react';
import { useAppStore, useTerminalStore } from '../../store';
import type { NavigationView } from '../../types';
import { useI18n } from '../../i18n/useI18n';
import type { TranslationKey } from '../../i18n/translations';

interface NavItem {
  id: NavigationView;
  labelKey: TranslationKey;
  icon: React.ReactNode;
  badge?: number;
}

export function Sidebar() {
  const { currentView, setCurrentView, sidebarCollapsed, toggleSidebar } = useAppStore();
  const tabCount = useTerminalStore((s) => s.tabs.length);
  const broadcastMode = useTerminalStore((s) => s.broadcastMode);
  const { t } = useI18n();

  const navItems: NavItem[] = [
    { id: 'home', labelKey: 'nav.home', icon: <Home size={20} /> },
    { id: 'sessions', labelKey: 'nav.sessions', icon: <Server size={20} /> },
    { id: 'terminal', labelKey: 'nav.terminal', icon: <Terminal size={20} />, badge: tabCount || undefined },
    { id: 'sftp', labelKey: 'nav.fileManager', icon: <FolderOpen size={20} /> },
    { id: 'keys', labelKey: 'nav.keys', icon: <KeyRound size={20} /> },
    { id: 'scripts', labelKey: 'nav.scripts', icon: <FileCode size={20} /> },
    { id: 'tunnels', labelKey: 'nav.tunnels', icon: <Network size={20} /> },
  ];

  return (
    <aside
      className={`flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-200 ${
        sidebarCollapsed ? 'w-16' : 'w-52'
      }`}
    >
      <nav className="flex-1 py-2 px-2 space-y-0.5">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
            className={`nav-item w-full ${currentView === item.id ? 'active' : ''}`}
            title={sidebarCollapsed ? t(item.labelKey) : undefined}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            {!sidebarCollapsed && (
              <>
                <span className="flex-1 text-left">{t(item.labelKey)}</span>
                {item.badge && (
                  <span className="badge-blue">{item.badge}</span>
                )}
              </>
            )}
          </button>
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-2 py-2 space-y-0.5">
        {broadcastMode && (
          <div className={`nav-item text-warning ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <Radio size={18} />
            {!sidebarCollapsed && <span className="text-xs">{t('terminal.broadcast')} ON</span>}
          </div>
        )}

        <button
          onClick={() => setCurrentView('settings')}
          className={`nav-item w-full ${currentView === 'settings' ? 'active' : ''}`}
          title={sidebarCollapsed ? t('nav.settings') : undefined}
        >
          <Settings size={20} />
          {!sidebarCollapsed && <span className="flex-1 text-left">{t('nav.settings')}</span>}
        </button>

        <button
          onClick={toggleSidebar}
          className="nav-item w-full justify-center"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
    </aside>
  );
}
