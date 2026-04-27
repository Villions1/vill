import { useState } from 'react';
import {
  Search, Plus, FolderPlus, Server, MoreVertical, Edit, Trash2, Copy,
  Download, Upload, ChevronRight, ChevronDown,
} from 'lucide-react';
import { useSessionStore, useAppStore, useTerminalStore } from '../../store';
import { SessionEditor } from './SessionEditor';
import type { SSHSession } from '../../types';
import { useI18n } from '../../i18n/useI18n';

export function SessionListView() {
  const {
    groups, searchQuery,
    setSearchQuery, deleteSession, deleteGroup, updateGroup,
    exportSessions, importSessions, createGroup,
  } = useSessionStore();
  const setCurrentView = useAppStore((s) => s.setCurrentView);
  const openTab = useTerminalStore((s) => s.openTab);
  const [editingSession, setEditingSession] = useState<SSHSession | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; session: SSHSession } | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['__all__']));
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const { t } = useI18n();

  const allSessions = useSessionStore((s) => {
    const { sessions, searchQuery: q } = s;
    if (!q.trim()) return sessions;
    const ql = q.toLowerCase();
    return sessions.filter(
      (s) =>
        s.name.toLowerCase().includes(ql) ||
        s.host.toLowerCase().includes(ql) ||
        s.username.toLowerCase().includes(ql) ||
        s.labels.some((l) => l.toLowerCase().includes(ql)) ||
        s.notes.toLowerCase().includes(ql)
    );
  });

  const connectSession = (session: SSHSession) => {
    openTab(session.id, session.name);
    setCurrentView('terminal');
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleContextMenu = (e: React.MouseEvent, session: SSHSession) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, session });
  };

  const handleCreateGroup = () => {
    if (newGroupName.trim()) {
      createGroup({ name: newGroupName.trim() });
      setNewGroupName('');
      setShowNewGroup(false);
    }
  };

  const handleRenameGroup = (groupId: string) => {
    if (editGroupName.trim()) {
      updateGroup(groupId, { name: editGroupName.trim() });
      setEditingGroupId(null);
      setEditGroupName('');
    }
  };

  const ungroupedSessions = allSessions.filter((s) => !s.groupId);
  const getGroupSessions = (groupId: string) => allSessions.filter((s) => s.groupId === groupId);

  if (editingSession || isCreating) {
    return (
      <SessionEditor
        session={editingSession}
        onClose={() => {
          setEditingSession(null);
          setIsCreating(false);
        }}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        <h2 className="text-lg font-semibold text-text-primary">{t('sessions.title')}</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => importSessions()} className="btn-ghost" title={t('sessions.import')}>
            <Upload size={16} />
          </button>
          <button onClick={() => exportSessions()} className="btn-ghost" title={t('sessions.export')}>
            <Download size={16} />
          </button>
          <button onClick={() => { setShowNewGroup(true); }} className="btn-ghost flex items-center gap-1">
            <FolderPlus size={16} />
          </button>
          <button onClick={() => setIsCreating(true)} className="btn-primary flex items-center gap-1">
            <Plus size={16} />
            {t('sessions.newSession')}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 pb-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder={t('sessions.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-9"
          />
        </div>
      </div>

      {/* New Group Input */}
      {showNewGroup && (
        <div className="px-4 pb-2 flex gap-2">
          <input
            type="text"
            placeholder={t('sessions.groupName')}
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
            className="input-field flex-1"
            autoFocus
          />
          <button onClick={handleCreateGroup} className="btn-primary">{t('sessions.create')}</button>
          <button onClick={() => setShowNewGroup(false)} className="btn-ghost">{t('common.cancel')}</button>
        </div>
      )}

      {/* Session List */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        {/* Grouped sessions */}
        {groups.map((group) => {
          const groupSessions = getGroupSessions(group.id);
          if (groupSessions.length === 0 && searchQuery) return null;
          const isExpanded = expandedGroups.has(group.id);

          return (
            <div key={group.id} className="mb-2 group/grp">
              <div className="flex items-center gap-2 w-full py-2 text-sm font-medium text-text-secondary">
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="flex items-center gap-2 flex-1 hover:text-text-primary"
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  {editingGroupId === group.id ? (
                    <input
                      type="text"
                      value={editGroupName}
                      onChange={(e) => setEditGroupName(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') handleRenameGroup(group.id);
                        if (e.key === 'Escape') setEditingGroupId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="input-field text-sm py-0.5 px-1.5 w-40"
                      autoFocus
                    />
                  ) : (
                    <span style={{ color: group.color || undefined }}>{group.name}</span>
                  )}
                  <span className="text-2xs text-text-muted">({groupSessions.length})</span>
                </button>
                <div className="flex items-center gap-0.5 opacity-0 group-hover/grp:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingGroupId(group.id);
                      setEditGroupName(group.name);
                    }}
                    className="p-1 hover:bg-surface-overlay rounded"
                    title={t('sessions.editGroup')}
                  >
                    <Edit size={12} className="text-text-secondary" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`${t('sessions.confirmDeleteGroup')} "${group.name}"?`)) deleteGroup(group.id);
                    }}
                    className="p-1 hover:bg-danger/20 rounded"
                    title={t('sessions.deleteGroup')}
                  >
                    <Trash2 size={12} className="text-danger" />
                  </button>
                </div>
              </div>
              {isExpanded && (
                <div className="ml-4 space-y-1">
                  {groupSessions.map((session) => (
                    <SessionItem
                      key={session.id}
                      session={session}
                      onConnect={connectSession}
                      onEdit={setEditingSession}
                      onDelete={deleteSession}
                      onContextMenu={handleContextMenu}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Ungrouped */}
        {ungroupedSessions.length > 0 && (
          <div className="space-y-1">
            {groups.length > 0 && (
              <div className="text-xs text-text-muted py-2 font-medium">{t('sessions.ungrouped')}</div>
            )}
            {ungroupedSessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                onConnect={connectSession}
                onEdit={setEditingSession}
                onDelete={deleteSession}
                onContextMenu={handleContextMenu}
              />
            ))}
          </div>
        )}

        {allSessions.length === 0 && (
          <div className="text-center py-12 text-text-muted">
            <Server size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{t('sessions.noSessions')}</p>
            <button onClick={() => setIsCreating(true)} className="btn-primary mt-4">
              <Plus size={16} className="inline mr-1" />
              {t('sessions.createSession')}
            </button>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              className="context-menu-item w-full"
              onClick={() => {
                connectSession(contextMenu.session);
                setContextMenu(null);
              }}
            >
              <Server size={14} /> {t('sessions.connect')}
            </button>
            <button
              className="context-menu-item w-full"
              onClick={() => {
                setEditingSession(contextMenu.session);
                setContextMenu(null);
              }}
            >
              <Edit size={14} /> {t('sessions.edit')}
            </button>
            <button
              className="context-menu-item w-full"
              onClick={() => {
                const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = contextMenu.session;
                useSessionStore.getState().createSession({ ...rest, name: `${rest.name} (copy)` });
                setContextMenu(null);
              }}
            >
              <Copy size={14} /> {t('sessions.duplicate')}
            </button>
            <hr className="border-sidebar-border my-1" />
            <button
              className="context-menu-item w-full text-danger hover:!text-danger"
              onClick={() => {
                if (confirm(`${t('sessions.delete')} "${contextMenu.session.name}"?`)) {
                  deleteSession(contextMenu.session.id);
                }
                setContextMenu(null);
              }}
            >
              <Trash2 size={14} /> {t('sessions.delete')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SessionItem({
  session,
  onConnect,
  onEdit,
  onDelete,
  onContextMenu,
}: {
  session: SSHSession;
  onConnect: (s: SSHSession) => void;
  onEdit: (s: SSHSession) => void;
  onDelete: (id: string) => Promise<void>;
  onContextMenu: (e: React.MouseEvent, s: SSHSession) => void;
}) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-raised cursor-pointer group transition-colors"
      onClick={() => onConnect(session)}
      onContextMenu={(e) => onContextMenu(e, session)}
    >
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: session.colorTag || '#4A90D9' }}
      />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-text-primary">{session.name}</div>
        <div className="text-xs text-text-muted">
          {session.username}@{session.host}:{session.port}
        </div>
      </div>
      {session.labels.length > 0 && (
        <div className="flex gap-1">
          {session.labels.slice(0, 2).map((label) => (
            <span key={label} className="badge-blue">{label}</span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(session);
          }}
          className="p-1.5 hover:bg-surface-overlay rounded"
        >
          <Edit size={14} className="text-text-secondary" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Delete "${session.name}"?`)) {
              onDelete(session.id);
            }
          }}
          className="p-1.5 hover:bg-danger/20 rounded"
        >
          <Trash2 size={14} className="text-danger" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(e, session);
          }}
          className="p-1.5 hover:bg-surface-overlay rounded"
        >
          <MoreVertical size={14} className="text-text-secondary" />
        </button>
      </div>
    </div>
  );
}
