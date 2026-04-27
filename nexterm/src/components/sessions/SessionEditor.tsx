import { useState, useEffect } from 'react';
import { X, Save, FolderPlus } from 'lucide-react';
import { useSessionStore } from '../../store';
import type { SSHSession, SessionGroup } from '../../types';

interface SessionEditorProps {
  session: SSHSession | null;
  onClose: () => void;
}

const COLOR_OPTIONS = [
  '#4A90D9', '#57ab5a', '#e5534b', '#c69026', '#986ee2',
  '#e0823d', '#39c5cf', '#d2a8ff', '#768390', '#f778ba',
];

export function SessionEditor({ session, onClose }: SessionEditorProps) {
  const { createSession, updateSession, groups, createGroup, loadGroups } = useSessionStore();
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [form, setForm] = useState({
    name: '',
    host: '',
    port: 22,
    username: 'root',
    authMethod: 'password' as 'password' | 'key' | 'agent',
    password: '',
    privateKeyPath: '',
    passphrase: '',
    groupId: '',
    labels: '',
    notes: '',
    colorTag: '#4A90D9',
    keepaliveInterval: 10000,
    keepaliveCountMax: 3,
    postLoginScript: '',
    proxyType: '',
    proxyHost: '',
    proxyPort: 0,
    agentForwarding: false,
    enableLogging: false,
    logPath: '',
  });
  const [activeTab, setActiveTab] = useState<'general' | 'auth' | 'advanced' | 'proxy'>('general');
  const [error, setError] = useState('');

  useEffect(() => {
    if (session) {
      setForm({
        name: session.name,
        host: session.host,
        port: session.port,
        username: session.username,
        authMethod: session.authMethod,
        password: session.password || '',
        privateKeyPath: session.privateKeyPath || '',
        passphrase: session.passphrase || '',
        groupId: session.groupId || '',
        labels: session.labels.join(', '),
        notes: session.notes,
        colorTag: session.colorTag || '#4A90D9',
        keepaliveInterval: session.keepaliveInterval,
        keepaliveCountMax: session.keepaliveCountMax,
        postLoginScript: session.postLoginScript || '',
        proxyType: session.proxyType || '',
        proxyHost: session.proxyHost || '',
        proxyPort: session.proxyPort || 0,
        agentForwarding: session.agentForwarding,
        enableLogging: session.enableLogging,
        logPath: session.logPath || '',
      });
    }
  }, [session]);

  const handleSave = async () => {
    if (!form.name.trim() || !form.host.trim() || !form.username.trim()) {
      setError('Name, host, and username are required');
      return;
    }
    setError('');

    const data = {
      ...form,
      labels: form.labels
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean),
      groupId: form.groupId || undefined,
      proxyPort: form.proxyPort || undefined,
    };

    if (session) {
      await updateSession(session.id, data);
    } else {
      await createSession(data);
    }
    onClose();
  };

  const tabs = [
    { id: 'general' as const, label: 'General' },
    { id: 'auth' as const, label: 'Authentication' },
    { id: 'advanced' as const, label: 'Advanced' },
    { id: 'proxy' as const, label: 'Proxy' },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        <h2 className="text-lg font-semibold text-text-primary">
          {session ? 'Edit Session' : 'New Session'}
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} className="btn-primary flex items-center gap-1">
            <Save size={16} />
            Save
          </button>
          <button onClick={onClose} className="btn-ghost">
            <X size={16} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-4 p-3 bg-danger/10 border border-danger/30 rounded-lg text-sm text-danger">
          {error}
        </div>
      )}

      <div className="flex border-b border-sidebar-border px-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {activeTab === 'general' && (
          <>
            <Field label="Session Name">
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="My Server"
                className="input-field"
              />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Hostname / IP" className="col-span-2">
                <input
                  type="text"
                  value={form.host}
                  onChange={(e) => setForm({ ...form, host: e.target.value })}
                  placeholder="192.168.1.1"
                  className="input-field"
                />
              </Field>
              <Field label="Port">
                <input
                  type="number"
                  value={form.port}
                  onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 22 })}
                  className="input-field"
                />
              </Field>
            </div>
            <Field label="Username">
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="root"
                className="input-field"
              />
            </Field>
            <Field label="Group">
              <div className="flex gap-2">
                {!showNewGroup ? (
                  <>
                    <select
                      value={form.groupId}
                      onChange={(e) => setForm({ ...form, groupId: e.target.value })}
                      className="select-field flex-1"
                    >
                      <option value="">No group</option>
                      {groups.map((g: SessionGroup) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNewGroup(true)}
                      className="btn-ghost flex items-center gap-1 text-sm flex-shrink-0"
                      title="Create new group"
                    >
                      <FolderPlus size={14} />
                      New
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="New group name..."
                      className="input-field flex-1"
                      autoFocus
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && newGroupName.trim()) {
                          const id = await createGroup({ name: newGroupName.trim() });
                          setForm({ ...form, groupId: id });
                          setShowNewGroup(false);
                          setNewGroupName('');
                        }
                        if (e.key === 'Escape') {
                          setShowNewGroup(false);
                          setNewGroupName('');
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (newGroupName.trim()) {
                          const id = await createGroup({ name: newGroupName.trim() });
                          setForm({ ...form, groupId: id });
                        }
                        setShowNewGroup(false);
                        setNewGroupName('');
                      }}
                      className="btn-primary text-sm flex-shrink-0"
                    >
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowNewGroup(false); setNewGroupName(''); }}
                      className="btn-ghost text-sm flex-shrink-0"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </Field>
            <Field label="Color Tag">
              <div className="flex gap-2">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setForm({ ...form, colorTag: color })}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      form.colorTag === color ? 'border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </Field>
            <Field label="Labels (comma-separated)">
              <input
                type="text"
                value={form.labels}
                onChange={(e) => setForm({ ...form, labels: e.target.value })}
                placeholder="production, web, nginx"
                className="input-field"
              />
            </Field>
            <Field label="Notes">
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notes about this server..."
                rows={3}
                className="input-field resize-none"
              />
            </Field>
          </>
        )}

        {activeTab === 'auth' && (
          <>
            <Field label="Authentication Method">
              <select
                value={form.authMethod}
                onChange={(e) => setForm({ ...form, authMethod: e.target.value as 'password' | 'key' | 'agent' })}
                className="select-field"
              >
                <option value="password">Password</option>
                <option value="key">SSH Key</option>
                <option value="agent">SSH Agent</option>
              </select>
            </Field>
            {form.authMethod === 'password' && (
              <Field label="Password">
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input-field"
                />
              </Field>
            )}
            {form.authMethod === 'key' && (
              <>
                <Field label="Private Key Path">
                  <input
                    type="text"
                    value={form.privateKeyPath}
                    onChange={(e) => setForm({ ...form, privateKeyPath: e.target.value })}
                    placeholder="~/.ssh/id_ed25519"
                    className="input-field"
                  />
                </Field>
                <Field label="Passphrase (optional)">
                  <input
                    type="password"
                    value={form.passphrase}
                    onChange={(e) => setForm({ ...form, passphrase: e.target.value })}
                    className="input-field"
                  />
                </Field>
              </>
            )}
            <Field label="">
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={form.agentForwarding}
                  onChange={(e) => setForm({ ...form, agentForwarding: e.target.checked })}
                  className="rounded"
                />
                Enable SSH Agent Forwarding
              </label>
            </Field>
          </>
        )}

        {activeTab === 'advanced' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Keepalive Interval (ms)">
                <input
                  type="number"
                  value={form.keepaliveInterval}
                  onChange={(e) => setForm({ ...form, keepaliveInterval: parseInt(e.target.value) || 10000 })}
                  className="input-field"
                />
              </Field>
              <Field label="Keepalive Max Count">
                <input
                  type="number"
                  value={form.keepaliveCountMax}
                  onChange={(e) => setForm({ ...form, keepaliveCountMax: parseInt(e.target.value) || 3 })}
                  className="input-field"
                />
              </Field>
            </div>
            <Field label="Post-Login Script">
              <textarea
                value={form.postLoginScript}
                onChange={(e) => setForm({ ...form, postLoginScript: e.target.value })}
                placeholder="Commands to run after connecting..."
                rows={4}
                className="input-field font-mono text-xs resize-none"
              />
            </Field>
            <Field label="">
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={form.enableLogging}
                  onChange={(e) => setForm({ ...form, enableLogging: e.target.checked })}
                  className="rounded"
                />
                Enable Session Logging
              </label>
            </Field>
            {form.enableLogging && (
              <Field label="Log File Path">
                <input
                  type="text"
                  value={form.logPath}
                  onChange={(e) => setForm({ ...form, logPath: e.target.value })}
                  placeholder="/var/log/valkyrie-tun/session.log"
                  className="input-field"
                />
              </Field>
            )}
          </>
        )}

        {activeTab === 'proxy' && (
          <>
            <Field label="Proxy Type">
              <select
                value={form.proxyType}
                onChange={(e) => setForm({ ...form, proxyType: e.target.value })}
                className="select-field"
              >
                <option value="">None</option>
                <option value="socks5">SOCKS5</option>
                <option value="http">HTTP</option>
              </select>
            </Field>
            {form.proxyType && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Proxy Host" className="col-span-2">
                    <input
                      type="text"
                      value={form.proxyHost}
                      onChange={(e) => setForm({ ...form, proxyHost: e.target.value })}
                      placeholder="proxy.example.com"
                      className="input-field"
                    />
                  </Field>
                  <Field label="Proxy Port">
                    <input
                      type="number"
                      value={form.proxyPort}
                      onChange={(e) => setForm({ ...form, proxyPort: parseInt(e.target.value) || 0 })}
                      className="input-field"
                    />
                  </Field>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-text-secondary mb-1.5">{label}</label>}
      {children}
    </div>
  );
}
