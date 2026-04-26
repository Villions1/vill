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

interface NavItem {
  id: NavigationView;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export function Sidebar() {
  const { currentView, setCurrentView, sidebarCollapsed, toggleSidebar } = useAppStore();
  const tabCount = useTerminalStore((s) => s.tabs.length);
  const broadcastMode = useTerminalStore((s) => s.broadcastMode);

  const navItems: NavItem[] = [
    { id: 'home', label: 'Home', icon: <Home size={20} /> },
    { id: 'sessions', label: 'Sessions', icon: <Server size={20} /> },
    { id: 'terminal', label: 'Terminal', icon: <Terminal size={20} />, badge: tabCount || undefined },
    { id: 'sftp', label: 'File Manager', icon: <FolderOpen size={20} /> },
    { id: 'keys', label: 'Keys', icon: <KeyRound size={20} /> },
    { id: 'scripts', label: 'Scripts', icon: <FileCode size={20} /> },
    { id: 'tunnels', label: 'Tunnels', icon: <Network size={20} /> },
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
            title={sidebarCollapsed ? item.label : undefined}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            {!sidebarCollapsed && (
              <>
                <span className="flex-1 text-left">{item.label}</span>
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
            {!sidebarCollapsed && <span className="text-xs">Broadcast ON</span>}
          </div>
        )}

        <button
          onClick={() => setCurrentView('settings')}
          className={`nav-item w-full ${currentView === 'settings' ? 'active' : ''}`}
          title={sidebarCollapsed ? 'Settings' : undefined}
        >
          <Settings size={20} />
          {!sidebarCollapsed && <span className="flex-1 text-left">Settings</span>}
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
