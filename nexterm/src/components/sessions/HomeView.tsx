import { useEffect, useState } from 'react';
import { Clock, Server, Plus, Search, ArrowRight, Zap } from 'lucide-react';
import { useSessionStore, useAppStore, useTerminalStore } from '../../store';
import type { SSHSession } from '../../types';

export function HomeView() {
  const { recentSessions, loadRecent, sessions } = useSessionStore();
  const { setCurrentView } = useAppStore();
  const openTab = useTerminalStore((s) => s.openTab);
  const [quickHost, setQuickHost] = useState('');

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const handleQuickConnect = () => {
    if (!quickHost.trim()) return;
    // Parse user@host:port format
    let username = 'root';
    let host = quickHost.trim();
    let port = 22;

    if (host.includes('@')) {
      const parts = host.split('@');
      username = parts[0];
      host = parts[1];
    }
    if (host.includes(':')) {
      const parts = host.split(':');
      host = parts[0];
      port = parseInt(parts[1]) || 22;
    }

    const tabId = openTab('quick-connect', `${username}@${host}`);
    setCurrentView('terminal');
    // Store quick connect data for the terminal to use
    window.sessionStorage.setItem(
      `quick-connect-${tabId}`,
      JSON.stringify({ host, port, username, authMethod: 'agent' })
    );
  };

  const connectSession = (session: SSHSession) => {
    openTab(session.id, session.name);
    setCurrentView('terminal');
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Welcome to NexTerm</h1>
          <p className="text-sm text-text-secondary mt-1">
            Modern SSH client — connect to your servers securely
          </p>
        </div>

        {/* Quick Connect */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={18} className="text-accent" />
            <h2 className="text-sm font-semibold text-text-primary">Quick Connect</h2>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="user@hostname:port  or search saved sessions..."
                value={quickHost}
                onChange={(e) => setQuickHost(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQuickConnect()}
                className="input-field pl-9"
              />
            </div>
            <button onClick={handleQuickConnect} className="btn-primary flex items-center gap-2">
              <ArrowRight size={16} />
              Connect
            </button>
          </div>
        </div>

        {/* Recent Sessions */}
        {recentSessions.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={18} className="text-text-secondary" />
              <h2 className="text-sm font-semibold text-text-primary">Recent Sessions</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => connectSession(session)}
                  className="card hover:border-accent/50 transition-colors text-left group"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                      style={{ backgroundColor: session.colorTag || '#4A90D9' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-text-primary group-hover:text-accent line-clamp-1">
                        {session.name}
                      </div>
                      <div className="text-xs text-text-muted mt-0.5">
                        {session.username}@{session.host}:{session.port}
                      </div>
                      {session.lastConnectedAt && (
                        <div className="text-2xs text-text-muted mt-1">
                          {new Date(session.lastConnectedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <ArrowRight
                      size={14}
                      className="text-text-muted group-hover:text-accent mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card text-center">
            <Server size={24} className="mx-auto text-accent mb-2" />
            <div className="text-2xl font-bold text-text-primary">{sessions.length}</div>
            <div className="text-xs text-text-secondary">Saved Sessions</div>
          </div>
          <button onClick={() => setCurrentView('sessions')} className="card text-center hover:border-accent/50 transition-colors">
            <Plus size={24} className="mx-auto text-accent mb-2" />
            <div className="text-sm font-medium text-text-primary">New Session</div>
            <div className="text-xs text-text-secondary">Add a host</div>
          </button>
          <button onClick={() => setCurrentView('keys')} className="card text-center hover:border-accent/50 transition-colors">
            <Server size={24} className="mx-auto text-accent mb-2" />
            <div className="text-sm font-medium text-text-primary">Manage Keys</div>
            <div className="text-xs text-text-secondary">SSH keys</div>
          </button>
        </div>
      </div>
    </div>
  );
}
