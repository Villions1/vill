import { useState, useEffect } from 'react';
import {
  FolderOpen, Upload, Download, RefreshCw, Home, ChevronRight,
  File, Folder, Trash2, Edit2, FolderPlus, FileCode,
  ChevronUp, Shield,
} from 'lucide-react';
import { useSessionStore, useAppStore } from '../../store';
import { api } from '../../lib/api';
import type { SSHSession, RemoteFile, LocalFile, TransferItem } from '../../types';
import { v4 as uuid } from 'uuid';

export function FileManagerView() {
  const sessions = useSessionStore((s) => s.sessions);
  const setActiveSftpSessionId = useAppStore((s) => s.setActiveSftpSessionId);

  const [sftpConnId, setSftpConnId] = useState<string | null>(null);
  const [remotePath, setRemotePath] = useState('/');
  const [localPath, setLocalPath] = useState('');
  const [remoteFiles, setRemoteFiles] = useState<RemoteFile[]>([]);
  const [localFiles, setLocalFiles] = useState<LocalFile[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: RemoteFile } | null>(null);
  const [editingFile, setEditingFile] = useState<{ path: string; content: string } | null>(null);

  useEffect(() => {
    const loadHome = async () => {
      const home = await api.fs.getHomeDir();
      setLocalPath(home as string);
    };
    loadHome();
  }, []);

  useEffect(() => {
    if (localPath) loadLocalFiles(localPath);
  }, [localPath]);

  const connectSFTP = async (session: SSHSession) => {
    setIsConnecting(true);
    setError(null);
    try {
      const connId = await api.sftp.connect({
        host: session.host,
        port: session.port,
        username: session.username,
        authMethod: session.authMethod,
        password: session.password,
        privateKeyPath: session.privateKeyPath,
        passphrase: session.passphrase,
      });
      setSftpConnId(connId as string);
      setActiveSftpSessionId(session.id);
      await loadRemoteFiles(connId as string, '/home/' + session.username);
      setRemotePath('/home/' + session.username);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  };

  const loadRemoteFiles = async (connId: string, path: string) => {
    try {
      const files = await api.sftp.list(connId, path);
      setRemoteFiles(files as RemoteFile[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list files');
    }
  };

  const loadLocalFiles = async (path: string) => {
    try {
      const files = await api.fs.listLocal(path);
      setLocalFiles(files as LocalFile[]);
    } catch {
      // ignore
    }
  };

  const navigateRemote = async (path: string) => {
    if (!sftpConnId) return;
    setRemotePath(path);
    await loadRemoteFiles(sftpConnId, path);
  };

  const navigateLocal = async (path: string) => {
    setLocalPath(path);
  };

  const uploadFile = async (localFilePath: string, remoteDir: string) => {
    if (!sftpConnId) return;
    const fileName = localFilePath.split('/').pop() || 'file';
    const remoteDest = `${remoteDir}/${fileName}`;
    const transferId = uuid();

    setTransfers((prev) => [
      ...prev,
      {
        id: transferId,
        fileName,
        localPath: localFilePath,
        remotePath: remoteDest,
        direction: 'upload',
        status: 'active',
        progress: 0,
        speed: 0,
        transferred: 0,
        total: 0,
      },
    ]);

    try {
      await api.sftp.upload(sftpConnId, localFilePath, remoteDest);
      setTransfers((prev) =>
        prev.map((t) => (t.id === transferId ? { ...t, status: 'completed' as const, progress: 100 } : t))
      );
      await loadRemoteFiles(sftpConnId, remotePath);
    } catch (err) {
      setTransfers((prev) =>
        prev.map((t) =>
          t.id === transferId
            ? { ...t, status: 'failed' as const, error: err instanceof Error ? err.message : 'Failed' }
            : t
        )
      );
    }
  };

  const downloadFile = async (remoteFilePath: string, localDir: string) => {
    if (!sftpConnId) return;
    const fileName = remoteFilePath.split('/').pop() || 'file';
    const localDest = `${localDir}/${fileName}`;
    const transferId = uuid();

    setTransfers((prev) => [
      ...prev,
      {
        id: transferId,
        fileName,
        localPath: localDest,
        remotePath: remoteFilePath,
        direction: 'download',
        status: 'active',
        progress: 0,
        speed: 0,
        transferred: 0,
        total: 0,
      },
    ]);

    try {
      await api.sftp.download(sftpConnId, remoteFilePath, localDest);
      setTransfers((prev) =>
        prev.map((t) => (t.id === transferId ? { ...t, status: 'completed' as const, progress: 100 } : t))
      );
      await loadLocalFiles(localPath);
    } catch (err) {
      setTransfers((prev) =>
        prev.map((t) =>
          t.id === transferId
            ? { ...t, status: 'failed' as const, error: err instanceof Error ? err.message : 'Failed' }
            : t
        )
      );
    }
  };

  const handleRemoteContextMenu = (e: React.MouseEvent, file: RemoteFile) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  };

  const handleDeleteRemote = async (file: RemoteFile) => {
    if (!sftpConnId) return;
    if (!confirm(`Delete "${file.name}"?`)) return;
    try {
      await api.sftp.delete(sftpConnId, file.path);
      await loadRemoteFiles(sftpConnId, remotePath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleRenameRemote = async (file: RemoteFile) => {
    if (!sftpConnId) return;
    const newName = prompt('New name:', file.name);
    if (!newName || newName === file.name) return;
    try {
      const newPath = file.path.replace(/[^/]+$/, newName);
      await api.sftp.rename(sftpConnId, file.path, newPath);
      await loadRemoteFiles(sftpConnId, remotePath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rename failed');
    }
  };

  const handleMkdirRemote = async () => {
    if (!sftpConnId) return;
    const name = prompt('Directory name:');
    if (!name) return;
    try {
      await api.sftp.mkdir(sftpConnId, `${remotePath}/${name}`);
      await loadRemoteFiles(sftpConnId, remotePath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create directory failed');
    }
  };

  const handleChmodRemote = async (file: RemoteFile) => {
    if (!sftpConnId) return;
    const mode = prompt('Permissions (octal):', file.permissions.toString(8));
    if (!mode) return;
    try {
      await api.sftp.chmod(sftpConnId, file.path, mode);
      await loadRemoteFiles(sftpConnId, remotePath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chmod failed');
    }
  };

  const handleEditFile = async (file: RemoteFile) => {
    if (!sftpConnId) return;
    try {
      const content = await api.sftp.readFile(sftpConnId, file.path);
      setEditingFile({ path: file.path, content: content as string });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file');
    }
  };

  const handleSaveFile = async () => {
    if (!sftpConnId || !editingFile) return;
    try {
      await api.sftp.writeFile(sftpConnId, editingFile.path, editingFile.content);
      setEditingFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save file');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  };

  const formatPermissions = (mode: number) => {
    const perms = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];
    const u = (mode >> 6) & 7;
    const g = (mode >> 3) & 7;
    const o = mode & 7;
    return perms[u] + perms[g] + perms[o];
  };

  // If no SFTP session, show session picker
  if (!sftpConnId) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-sidebar-border">
          <h2 className="text-lg font-semibold text-text-primary">File Manager (SFTP)</h2>
          <p className="text-sm text-text-secondary mt-1">Select a session to connect</p>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {isConnecting && (
            <div className="text-center py-8 text-text-secondary">Connecting...</div>
          )}
          {error && (
            <div className="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-lg text-sm text-danger">{error}</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => connectSFTP(session)}
                className="card hover:border-accent/50 transition-colors text-left"
                disabled={isConnecting}
              >
                <div className="flex items-center gap-3">
                  <FolderOpen size={20} className="text-accent" />
                  <div>
                    <div className="font-medium text-sm">{session.name}</div>
                    <div className="text-xs text-text-muted">
                      {session.username}@{session.host}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // File editor
  if (editingFile) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between p-3 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <FileCode size={16} className="text-accent" />
            <span className="text-sm font-medium text-text-primary">{editingFile.path}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSaveFile} className="btn-primary text-sm">Save</button>
            <button onClick={() => setEditingFile(null)} className="btn-ghost text-sm">Close</button>
          </div>
        </div>
        <textarea
          value={editingFile.content}
          onChange={(e) => setEditingFile({ ...editingFile, content: e.target.value })}
          className="flex-1 bg-surface p-4 font-mono text-sm text-text-primary resize-none outline-none"
          spellCheck={false}
        />
      </div>
    );
  }

  // Dual-pane file manager
  return (
    <div className="h-full flex flex-col">
      {error && (
        <div className="flex items-center justify-between px-4 py-2 bg-danger/10 border-b border-danger/30">
          <span className="text-sm text-danger">{error}</span>
          <button onClick={() => setError(null)} className="text-danger"><span className="text-xs">Dismiss</span></button>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {/* Local pane */}
        <div className="flex-1 flex flex-col border-r border-sidebar-border min-w-0">
          <div className="flex items-center gap-2 p-2 border-b border-sidebar-border bg-surface-raised">
            <Home size={14} className="text-text-muted flex-shrink-0" />
            <div className="flex-1 flex items-center gap-1 text-xs text-text-secondary overflow-hidden">
              {localPath.split('/').filter(Boolean).map((part, i, arr) => (
                <span key={i} className="flex items-center gap-1">
                  <button
                    onClick={() => navigateLocal('/' + arr.slice(0, i + 1).join('/'))}
                    className="hover:text-accent truncate"
                  >
                    {part}
                  </button>
                  {i < arr.length - 1 && <ChevronRight size={10} />}
                </span>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <button
              onClick={() => {
                const parent = localPath.split('/').slice(0, -1).join('/') || '/';
                navigateLocal(parent);
              }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-raised"
            >
              <ChevronUp size={14} />
              <span>..</span>
            </button>
            {localFiles.map((file) => (
              <div
                key={file.name}
                className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface-raised cursor-pointer group"
                onClick={() => file.isDirectory && navigateLocal(file.path)}
                onDoubleClick={() => {
                  if (!file.isDirectory) uploadFile(file.path, remotePath);
                }}
              >
                {file.isDirectory ? (
                  <Folder size={14} className="text-accent flex-shrink-0" />
                ) : (
                  <File size={14} className="text-text-muted flex-shrink-0" />
                )}
                <span className="text-text-primary truncate flex-1">{file.name}</span>
                {!file.isDirectory && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      uploadFile(file.path, remotePath);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-surface-overlay rounded"
                    title="Upload"
                  >
                    <Upload size={12} className="text-accent" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="px-3 py-1.5 border-t border-sidebar-border text-2xs text-text-muted">
            Local — {localFiles.length} items
          </div>
        </div>

        {/* Remote pane */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-2 p-2 border-b border-sidebar-border bg-surface-raised">
            <FolderOpen size={14} className="text-accent flex-shrink-0" />
            <div className="flex-1 flex items-center gap-1 text-xs text-text-secondary overflow-hidden">
              {remotePath.split('/').filter(Boolean).map((part, i, arr) => (
                <span key={i} className="flex items-center gap-1">
                  <button
                    onClick={() => navigateRemote('/' + arr.slice(0, i + 1).join('/'))}
                    className="hover:text-accent truncate"
                  >
                    {part}
                  </button>
                  {i < arr.length - 1 && <ChevronRight size={10} />}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={handleMkdirRemote}
                className="p-1 hover:bg-sidebar-hover rounded"
                title="New Directory"
              >
                <FolderPlus size={14} className="text-text-muted" />
              </button>
              <button
                onClick={() => sftpConnId && loadRemoteFiles(sftpConnId, remotePath)}
                className="p-1 hover:bg-sidebar-hover rounded"
                title="Refresh"
              >
                <RefreshCw size={14} className="text-text-muted" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <button
              onClick={() => {
                const parent = remotePath.split('/').slice(0, -1).join('/') || '/';
                navigateRemote(parent);
              }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-raised"
            >
              <ChevronUp size={14} />
              <span>..</span>
            </button>
            {remoteFiles.map((file) => (
              <div
                key={file.name}
                className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface-raised cursor-pointer group"
                onClick={() => file.isDirectory && navigateRemote(file.path)}
                onDoubleClick={() => {
                  if (!file.isDirectory) handleEditFile(file);
                }}
                onContextMenu={(e) => handleRemoteContextMenu(e, file)}
              >
                {file.isDirectory ? (
                  <Folder size={14} className="text-accent flex-shrink-0" />
                ) : (
                  <File size={14} className="text-text-muted flex-shrink-0" />
                )}
                <span className="text-text-primary truncate flex-1">{file.name}</span>
                <span className="text-2xs text-text-muted font-mono flex-shrink-0">
                  {formatPermissions(file.permissions)}
                </span>
                <span className="text-2xs text-text-muted flex-shrink-0 w-16 text-right">
                  {file.isDirectory ? '—' : formatSize(file.size)}
                </span>
                {!file.isDirectory && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadFile(file.path, localPath);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-surface-overlay rounded"
                    title="Download"
                  >
                    <Download size={12} className="text-accent" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="px-3 py-1.5 border-t border-sidebar-border text-2xs text-text-muted">
            Remote — {remoteFiles.length} items
          </div>
        </div>
      </div>

      {/* Transfer queue */}
      {transfers.length > 0 && (
        <div className="border-t border-sidebar-border max-h-40 overflow-auto">
          <div className="px-3 py-1.5 text-xs font-medium text-text-secondary bg-surface-raised flex items-center justify-between">
            <span>Transfers ({transfers.filter((t) => t.status === 'active').length} active)</span>
            <button
              onClick={() => setTransfers((prev) => prev.filter((t) => t.status === 'active'))}
              className="text-2xs text-text-muted hover:text-text-primary"
            >
              Clear completed
            </button>
          </div>
          {transfers.map((transfer) => (
            <div key={transfer.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
              {transfer.direction === 'upload' ? (
                <Upload size={12} className="text-accent" />
              ) : (
                <Download size={12} className="text-accent" />
              )}
              <span className="text-text-primary truncate flex-1">{transfer.fileName}</span>
              {transfer.status === 'active' && (
                <div className="w-24 h-1.5 bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all"
                    style={{ width: `${transfer.progress}%` }}
                  />
                </div>
              )}
              <span
                className={`text-2xs ${
                  transfer.status === 'completed'
                    ? 'text-success'
                    : transfer.status === 'failed'
                      ? 'text-danger'
                      : 'text-text-muted'
                }`}
              >
                {transfer.status === 'completed'
                  ? 'Done'
                  : transfer.status === 'failed'
                    ? transfer.error || 'Failed'
                    : `${transfer.progress}%`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
            {!contextMenu.file.isDirectory && (
              <button
                className="context-menu-item w-full"
                onClick={() => {
                  downloadFile(contextMenu.file.path, localPath);
                  setContextMenu(null);
                }}
              >
                <Download size={14} /> Download
              </button>
            )}
            {!contextMenu.file.isDirectory && (
              <button
                className="context-menu-item w-full"
                onClick={() => {
                  handleEditFile(contextMenu.file);
                  setContextMenu(null);
                }}
              >
                <FileCode size={14} /> Edit
              </button>
            )}
            <button
              className="context-menu-item w-full"
              onClick={() => {
                handleRenameRemote(contextMenu.file);
                setContextMenu(null);
              }}
            >
              <Edit2 size={14} /> Rename
            </button>
            <button
              className="context-menu-item w-full"
              onClick={() => {
                handleChmodRemote(contextMenu.file);
                setContextMenu(null);
              }}
            >
              <Shield size={14} /> Chmod
            </button>
            <hr className="border-sidebar-border my-1" />
            <button
              className="context-menu-item w-full text-danger hover:!text-danger"
              onClick={() => {
                handleDeleteRemote(contextMenu.file);
                setContextMenu(null);
              }}
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
