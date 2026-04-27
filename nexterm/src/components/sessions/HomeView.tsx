import { useEffect, useState } from 'react';
import { Clock, Server, Plus, Search, ArrowRight, Zap, KeyRound, Lock, X, FolderPlus } from 'lucide-react';
import { useSessionStore, useAppStore, useTerminalStore } from '../../store';
import type { SSHSession, SessionGroup } from '../../types';
import { useI18n } from '../../i18n/useI18n';

export function HomeView() {
  const { recentSessions, loadRecent, sessions, groups, loadGroups, createSession, createGroup, clearRecentSession, clearAllRecent } = useSessionStore();
  const { setCurrentView } = useAppStore();
  const openTab = useTerminalStore((s) => s.openTab);
  const [quickHost, setQuickHost] = useState('');

  // Quick Connect form state
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [parsedUser, setParsedUser] = useState('root');
  const [parsedHost, setParsedHost] = useState('');
  const [parsedPort, setParsedPort] = useState(22);
  const [qcAuthMethod, setQcAuthMethod] = useState<'password' | 'key' | 'agent'>('password');
  const [qcPassword, setQcPassword] = useState('');
  const [qcKeyPath, setQcKeyPath] = useState('');
  const [qcPassphrase, setQcPassphrase] = useState('');
  const [qcSaveSession, setQcSaveSession] = useState(false);
  const [qcSessionName, setQcSessionName] = useState('');
  const [qcGroupId, setQcGroupId] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    loadRecent();
    loadGroups();
  }, [loadRecent, loadGroups]);

  const parseInput = () => {
    if (!quickHost.trim()) return;
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

    setParsedUser(username);
    setParsedHost(host);
    setParsedPort(port);
    setQcSessionName(`${username}@${host}`);
    setShowQuickForm(true);
  };

  const handleQuickConnect = async () => {
    const sessionData: Record<string, unknown> = {
      host: parsedHost,
      port: parsedPort,
      username: parsedUser,
      authMethod: qcAuthMethod,
    };

    if (qcAuthMethod === 'password') sessionData.password = qcPassword;
    if (qcAuthMethod === 'key') {
      sessionData.privateKeyPath = qcKeyPath;
      if (qcPassphrase) sessionData.passphrase = qcPassphrase;
    }

    // Save session if requested
    if (qcSaveSession && qcSessionName.trim()) {
      let groupId = qcGroupId;
      if (showNewGroup && newGroupName.trim()) {
        groupId = await createGroup({ name: newGroupName.trim() });
      }
      await createSession({
        name: qcSessionName,
        host: parsedHost,
        port: parsedPort,
        username: parsedUser,
        authMethod: qcAuthMethod,
        password: qcAuthMethod === 'password' ? qcPassword : undefined,
        privateKeyPath: qcAuthMethod === 'key' ? qcKeyPath : undefined,
        passphrase: qcAuthMethod === 'key' ? qcPassphrase : undefined,
        groupId: groupId || undefined,
        labels: [],
        notes: '',
        keepaliveInterval: 10000,
        keepaliveCountMax: 3,
        agentForwarding: false,
        enableLogging: false,
        sftpBookmarks: [],
      } as Partial<SSHSession>);
    }

    const tabId = openTab('quick-connect', `${parsedUser}@${parsedHost}`);
    setCurrentView('terminal');
    window.sessionStorage.setItem(
      `quick-connect-${tabId}`,
      JSON.stringify(sessionData)
    );

    // Reset form
    setShowQuickForm(false);
    setQuickHost('');
    setQcPassword('');
    setQcKeyPath('');
    setQcPassphrase('');
    setQcSaveSession(false);
    setQcSessionName('');
    setQcGroupId('');
    setNewGroupName('');
    setShowNewGroup(false);
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
          <h1 className="text-2xl font-semibold text-text-primary">{t('home.welcome')}</h1>
          <p className="text-sm text-text-secondary mt-1">
            {t('home.subtitle')}
          </p>
        </div>

        {/* Quick Connect */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={18} className="text-accent" />
            <h2 className="text-sm font-semibold text-text-primary">{t('home.quickConnect')}</h2>
          </div>

          {!showQuickForm ? (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder={t('home.quickPlaceholder')}
                  value={quickHost}
                  onChange={(e) => setQuickHost(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && parseInput()}
                  className="input-field pl-9"
                />
              </div>
              <button onClick={parseInput} className="btn-primary flex items-center gap-2">
                <ArrowRight size={16} />
                {t('home.connect')}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Connection info header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-text-primary">
                  <Server size={16} className="text-accent" />
                  <span className="font-mono">{parsedUser}@{parsedHost}:{parsedPort}</span>
                </div>
                <button onClick={() => setShowQuickForm(false)} className="btn-ghost p-1">
                  <X size={16} />
                </button>
              </div>

              {/* Auth method */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">{t('home.authMethod')}</label>
                <div className="flex gap-2">
                  {(['password', 'key', 'agent'] as const).map((method) => (
                    <button
                      key={method}
                      onClick={() => setQcAuthMethod(method)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                        qcAuthMethod === method
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-sidebar-border text-text-secondary hover:border-text-muted'
                      }`}
                    >
                      {method === 'password' && <Lock size={14} />}
                      {method === 'key' && <KeyRound size={14} />}
                      {method === 'agent' && <Server size={14} />}
                      {method === 'password' ? t('home.password') : method === 'key' ? t('home.privateKey') : t('home.sshAgent')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auth fields */}
              {qcAuthMethod === 'password' && (
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">{t('home.password')}</label>
                  <input
                    type="password"
                    value={qcPassword}
                    onChange={(e) => setQcPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleQuickConnect()}
                    placeholder="Enter password..."
                    className="input-field"
                    autoFocus
                  />
                </div>
              )}

              {qcAuthMethod === 'key' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">{t('home.keyPath')}</label>
                    <input
                      type="text"
                      value={qcKeyPath}
                      onChange={(e) => setQcKeyPath(e.target.value)}
                      placeholder="~/.ssh/id_ed25519"
                      className="input-field"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">{t('home.passphrase')}</label>
                    <input
                      type="password"
                      value={qcPassphrase}
                      onChange={(e) => setQcPassphrase(e.target.value)}
                      className="input-field"
                    />
                  </div>
                </div>
              )}

              {/* Save session option */}
              <div className="border-t border-sidebar-border pt-3">
                <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={qcSaveSession}
                    onChange={(e) => setQcSaveSession(e.target.checked)}
                    className="rounded"
                  />
                  {t('home.saveSession')}
                </label>

                {qcSaveSession && (
                  <div className="mt-3 space-y-3 pl-6">
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1.5">{t('home.sessionName')}</label>
                      <input
                        type="text"
                        value={qcSessionName}
                        onChange={(e) => setQcSessionName(e.target.value)}
                        placeholder="My Server"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1.5">{t('home.group')}</label>
                      <div className="flex gap-2">
                        {!showNewGroup ? (
                          <>
                            <select
                              value={qcGroupId}
                              onChange={(e) => setQcGroupId(e.target.value)}
                              className="select-field flex-1"
                            >
                              <option value="">{t('home.noGroup')}</option>
                              {groups.map((g: SessionGroup) => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => setShowNewGroup(true)}
                              className="btn-ghost flex items-center gap-1 text-sm"
                              title="Create new group"
                            >
                              <FolderPlus size={14} />
                              {t('home.newGroup')}
                            </button>
                          </>
                        ) : (
                          <>
                            <input
                              type="text"
                              value={newGroupName}
                              onChange={(e) => setNewGroupName(e.target.value)}
                              placeholder={t('home.newGroupName')}
                              className="input-field flex-1"
                              autoFocus
                            />
                            <button
                              onClick={() => { setShowNewGroup(false); setNewGroupName(''); }}
                              className="btn-ghost text-sm"
                            >
                              {t('home.cancel')}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Connect button */}
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowQuickForm(false)} className="btn-ghost">
                  {t('home.cancel')}
                </button>
                <button onClick={handleQuickConnect} className="btn-primary flex items-center gap-2">
                  <ArrowRight size={16} />
                  {t('home.connect')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Recent Sessions */}
        {recentSessions.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={18} className="text-text-secondary" />
              <h2 className="text-sm font-semibold text-text-primary">{t('home.recentSessions')}</h2>
              <button
                onClick={() => clearAllRecent()}
                className="ml-auto text-xs text-text-muted hover:text-warning transition-colors"
                title="Clear all recent sessions"
              >
                {t('home.clearAll')}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentSessions.map((session) => (
                <div
                  key={session.id}
                  className="card hover:border-accent/50 transition-colors text-left group relative"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearRecentSession(session.id);
                    }}
                    className="absolute top-2 right-2 p-1 rounded-full hover:bg-surface-overlay text-text-muted hover:text-warning opacity-0 group-hover:opacity-100 transition-all z-10"
                    title="Forget this session"
                  >
                    <X size={12} />
                  </button>
                  <button
                    onClick={() => connectSession(session)}
                    className="w-full text-left"
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
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card text-center">
            <Server size={24} className="mx-auto text-accent mb-2" />
            <div className="text-2xl font-bold text-text-primary">{sessions.length}</div>
            <div className="text-xs text-text-secondary">{t('home.savedSessions')}</div>
          </div>
          <button onClick={() => setCurrentView('sessions')} className="card text-center hover:border-accent/50 transition-colors">
            <Plus size={24} className="mx-auto text-accent mb-2" />
            <div className="text-sm font-medium text-text-primary">{t('sessions.newSession')}</div>
            <div className="text-xs text-text-secondary">{t('home.openSession')}</div>
          </button>
          <button onClick={() => setCurrentView('keys')} className="card text-center hover:border-accent/50 transition-colors">
            <KeyRound size={24} className="mx-auto text-accent mb-2" />
            <div className="text-sm font-medium text-text-primary">{t('keys.title')}</div>
            <div className="text-xs text-text-secondary">{t('home.sshKeys')}</div>
          </button>
        </div>
      </div>
    </div>
  );
}
