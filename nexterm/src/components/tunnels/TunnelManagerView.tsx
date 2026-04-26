import { useState, useEffect } from 'react';
import { Plus, Play, Square, Trash2, Network, Edit, Save, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useSessionStore } from '../../store';
import type { Tunnel, SSHSession } from '../../types';

export function TunnelManagerView() {
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const [activeTunnels, setActiveTunnels] = useState<string[]>([]);
  const [editing, setEditing] = useState<Tunnel | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const sessions = useSessionStore((s) => s.sessions);

  const loadTunnels = async () => {
    const result = await api.tunnels.getAll();
    setTunnels(result as Tunnel[]);
    const active = await api.tunnels.getActive();
    setActiveTunnels(active as string[]);
  };

  useEffect(() => {
    loadTunnels();
    const interval = setInterval(async () => {
      const active = await api.tunnels.getActive();
      setActiveTunnels(active as string[]);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async (tunnel: Tunnel) => {
    const session = sessions.find((s) => s.id === tunnel.sessionId);
    if (!session) {
      alert('Session not found');
      return;
    }
    try {
      await api.tunnels.start(tunnel.id, {
        host: session.host,
        port: session.port,
        username: session.username,
        authMethod: session.authMethod,
        password: session.password,
        privateKeyPath: session.privateKeyPath,
        passphrase: session.passphrase,
      });
      const active = await api.tunnels.getActive();
      setActiveTunnels(active as string[]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to start tunnel');
    }
  };

  const handleStop = async (tunnelId: string) => {
    await api.tunnels.stop(tunnelId);
    const active = await api.tunnels.getActive();
    setActiveTunnels(active as string[]);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this tunnel rule?')) return;
    await api.tunnels.delete(id);
    await loadTunnels();
  };

  if (editing || isCreating) {
    return (
      <TunnelEditorPanel
        tunnel={editing}
        sessions={sessions}
        onSave={async (data) => {
          if (editing) await api.tunnels.update(editing.id, data);
          else await api.tunnels.create(data);
          await loadTunnels();
          setEditing(null);
          setIsCreating(false);
        }}
        onClose={() => {
          setEditing(null);
          setIsCreating(false);
        }}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Port Forwarding & Tunnels</h2>
          <p className="text-sm text-text-secondary">
            Local, remote, and dynamic (SOCKS5) forwarding
          </p>
        </div>
        <button onClick={() => setIsCreating(true)} className="btn-primary flex items-center gap-1">
          <Plus size={14} /> New Tunnel
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-2">
        {tunnels.map((tunnel) => {
          const isActive = activeTunnels.includes(tunnel.id);
          const session = sessions.find((s) => s.id === tunnel.sessionId);

          return (
            <div key={tunnel.id} className="card flex items-center gap-4">
              <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-success animate-pulse' : 'bg-text-muted'}`} />
              <Network size={20} className={isActive ? 'text-accent' : 'text-text-muted'} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-text-primary">{tunnel.name}</div>
                <div className="text-xs text-text-muted flex items-center gap-2 mt-0.5">
                  <span className={`badge ${
                    tunnel.type === 'local' ? 'badge-blue' : tunnel.type === 'remote' ? 'badge-green' : 'badge-yellow'
                  }`}>
                    {tunnel.type.toUpperCase()}
                  </span>
                  {tunnel.type === 'dynamic' ? (
                    <span>SOCKS5 on {tunnel.localHost}:{tunnel.localPort}</span>
                  ) : (
                    <span>
                      {tunnel.localHost}:{tunnel.localPort} ↔ {tunnel.remoteHost}:{tunnel.remotePort}
                    </span>
                  )}
                  {session && <span className="text-text-muted">via {session.name}</span>}
                  {tunnel.autoStart && <span className="badge-green">Auto</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {isActive ? (
                  <button
                    onClick={() => handleStop(tunnel.id)}
                    className="p-1.5 hover:bg-danger/20 rounded"
                    title="Stop"
                  >
                    <Square size={14} className="text-danger" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleStart(tunnel)}
                    className="p-1.5 hover:bg-success/20 rounded"
                    title="Start"
                  >
                    <Play size={14} className="text-success" />
                  </button>
                )}
                <button onClick={() => setEditing(tunnel)} className="p-1.5 hover:bg-surface-overlay rounded">
                  <Edit size={14} className="text-text-secondary" />
                </button>
                <button onClick={() => handleDelete(tunnel.id)} className="p-1.5 hover:bg-danger/20 rounded">
                  <Trash2 size={14} className="text-danger" />
                </button>
              </div>
            </div>
          );
        })}
        {tunnels.length === 0 && (
          <div className="text-center py-12 text-text-muted">
            <Network size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No tunnel rules configured</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TunnelEditorPanel({
  tunnel,
  sessions,
  onSave,
  onClose,
}: {
  tunnel: Tunnel | null;
  sessions: SSHSession[];
  onSave: (data: Partial<Tunnel>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: tunnel?.name || '',
    sessionId: tunnel?.sessionId || (sessions[0]?.id || ''),
    type: tunnel?.type || 'local' as 'local' | 'remote' | 'dynamic',
    localHost: tunnel?.localHost || '127.0.0.1',
    localPort: tunnel?.localPort || 8080,
    remoteHost: tunnel?.remoteHost || '127.0.0.1',
    remotePort: tunnel?.remotePort || 80,
    autoStart: tunnel?.autoStart || false,
  });

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        <h2 className="text-lg font-semibold text-text-primary">
          {tunnel ? 'Edit Tunnel' : 'New Tunnel'}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!form.name.trim() || !form.sessionId) return;
              onSave(form);
            }}
            className="btn-primary flex items-center gap-1"
          >
            <Save size={14} /> Save
          </button>
          <button onClick={onClose} className="btn-ghost"><X size={14} /></button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Web Server Forward"
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">Session</label>
          <select
            value={form.sessionId}
            onChange={(e) => setForm({ ...form, sessionId: e.target.value })}
            className="select-field"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.host})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">Type</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as 'local' | 'remote' | 'dynamic' })}
            className="select-field"
          >
            <option value="local">Local Forward (-L)</option>
            <option value="remote">Remote Forward (-R)</option>
            <option value="dynamic">Dynamic (SOCKS5, -D)</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Local Host</label>
            <input
              type="text"
              value={form.localHost}
              onChange={(e) => setForm({ ...form, localHost: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">Local Port</label>
            <input
              type="number"
              value={form.localPort}
              onChange={(e) => setForm({ ...form, localPort: parseInt(e.target.value) || 0 })}
              className="input-field"
            />
          </div>
        </div>
        {form.type !== 'dynamic' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Remote Host</label>
              <input
                type="text"
                value={form.remoteHost}
                onChange={(e) => setForm({ ...form, remoteHost: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Remote Port</label>
              <input
                type="number"
                value={form.remotePort}
                onChange={(e) => setForm({ ...form, remotePort: parseInt(e.target.value) || 0 })}
                className="input-field"
              />
            </div>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={form.autoStart}
            onChange={(e) => setForm({ ...form, autoStart: e.target.checked })}
            className="rounded"
          />
          Auto-start when session connects
        </label>
      </div>
    </div>
  );
}
