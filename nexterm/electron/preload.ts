import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // Window controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  },

  // Sessions
  sessions: {
    getAll: () => ipcRenderer.invoke('sessions:getAll'),
    getById: (id: string) => ipcRenderer.invoke('sessions:getById', id),
    create: (session: unknown) => ipcRenderer.invoke('sessions:create', session),
    update: (id: string, session: unknown) => ipcRenderer.invoke('sessions:update', id, session),
    delete: (id: string) => ipcRenderer.invoke('sessions:delete', id),
    getRecent: () => ipcRenderer.invoke('sessions:getRecent'),
    updateLastConnected: (id: string) => ipcRenderer.invoke('sessions:updateLastConnected', id),
    export: () => ipcRenderer.invoke('sessions:export'),
    import: () => ipcRenderer.invoke('sessions:import'),
    clearLastConnected: (id: string) => ipcRenderer.invoke('sessions:clearLastConnected', id),
    clearAllRecent: () => ipcRenderer.invoke('sessions:clearAllRecent'),
  },

  // Groups
  groups: {
    getAll: () => ipcRenderer.invoke('groups:getAll'),
    create: (group: unknown) => ipcRenderer.invoke('groups:create', group),
    update: (id: string, group: unknown) => ipcRenderer.invoke('groups:update', id, group),
    delete: (id: string) => ipcRenderer.invoke('groups:delete', id),
  },

  // SSH
  ssh: {
    connect: (sessionId: string, sessionData: unknown) =>
      ipcRenderer.invoke('ssh:connect', sessionId, sessionData),
    ready: (connId: string) => ipcRenderer.invoke('ssh:ready', connId),
    write: (connId: string, data: string) => ipcRenderer.send('ssh:write', connId, data),
    resize: (connId: string, cols: number, rows: number) =>
      ipcRenderer.send('ssh:resize', connId, cols, rows),
    disconnect: (connId: string) => ipcRenderer.invoke('ssh:disconnect', connId),
    onData: (connId: string, callback: (data: string) => void) => {
      const channel = `ssh:data:${connId}`;
      const handler = (_: unknown, data: string) => callback(data);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },
    onClose: (connId: string, callback: () => void) => {
      const channel = `ssh:close:${connId}`;
      const handler = () => callback();
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },
  },

  // SFTP
  sftp: {
    connect: (sessionData: unknown) => ipcRenderer.invoke('sftp:connect', sessionData),
    list: (connId: string, path: string) => ipcRenderer.invoke('sftp:list', connId, path),
    upload: (connId: string, localPath: string, remotePath: string) =>
      ipcRenderer.invoke('sftp:upload', connId, localPath, remotePath),
    download: (connId: string, remotePath: string, localPath: string) =>
      ipcRenderer.invoke('sftp:download', connId, remotePath, localPath),
    mkdir: (connId: string, path: string) => ipcRenderer.invoke('sftp:mkdir', connId, path),
    delete: (connId: string, path: string) => ipcRenderer.invoke('sftp:delete', connId, path),
    rename: (connId: string, oldPath: string, newPath: string) =>
      ipcRenderer.invoke('sftp:rename', connId, oldPath, newPath),
    chmod: (connId: string, path: string, mode: string) =>
      ipcRenderer.invoke('sftp:chmod', connId, path, mode),
    readFile: (connId: string, path: string) => ipcRenderer.invoke('sftp:readFile', connId, path),
    writeFile: (connId: string, path: string, content: string) =>
      ipcRenderer.invoke('sftp:writeFile', connId, path, content),
    stat: (connId: string, path: string) => ipcRenderer.invoke('sftp:stat', connId, path),
    disconnect: (connId: string) => ipcRenderer.invoke('sftp:disconnect', connId),
    onProgress: (callback: (data: unknown) => void) => {
      const handler = (_: unknown, data: unknown) => callback(data);
      ipcRenderer.on('sftp:progress', handler);
      return () => ipcRenderer.removeListener('sftp:progress', handler);
    },
  },

  // Local filesystem
  fs: {
    listLocal: (path: string) => ipcRenderer.invoke('fs:listLocal', path),
    getHomeDir: () => ipcRenderer.invoke('fs:getHomeDir'),
  },

  // Keys
  keys: {
    getAll: () => ipcRenderer.invoke('keys:getAll'),
    generate: (opts: unknown) => ipcRenderer.invoke('keys:generate', opts),
    import: (keyPath: string) => ipcRenderer.invoke('keys:import', keyPath),
    delete: (id: string) => ipcRenderer.invoke('keys:delete', id),
    detectLocal: () => ipcRenderer.invoke('keys:detectLocal'),
  },

  // Scripts
  scripts: {
    getAll: () => ipcRenderer.invoke('scripts:getAll'),
    create: (script: unknown) => ipcRenderer.invoke('scripts:create', script),
    update: (id: string, script: unknown) => ipcRenderer.invoke('scripts:update', id, script),
    delete: (id: string) => ipcRenderer.invoke('scripts:delete', id),
    run: (connId: string, content: string) => ipcRenderer.invoke('scripts:run', connId, content),
  },

  // Tunnels
  tunnels: {
    getAll: () => ipcRenderer.invoke('tunnels:getAll'),
    create: (tunnel: unknown) => ipcRenderer.invoke('tunnels:create', tunnel),
    update: (id: string, tunnel: unknown) => ipcRenderer.invoke('tunnels:update', id, tunnel),
    delete: (id: string) => ipcRenderer.invoke('tunnels:delete', id),
    start: (tunnelId: string, sessionData: unknown) =>
      ipcRenderer.invoke('tunnels:start', tunnelId, sessionData),
    stop: (tunnelId: string) => ipcRenderer.invoke('tunnels:stop', tunnelId),
    getActive: () => ipcRenderer.invoke('tunnels:getActive'),
  },

  // Crypto / Master Password
  crypto: {
    hasMasterPassword: () => ipcRenderer.invoke('crypto:hasMasterPassword'),
    setMasterPassword: (password: string) => ipcRenderer.invoke('crypto:setMasterPassword', password),
    verifyMasterPassword: (password: string) => ipcRenderer.invoke('crypto:verifyMasterPassword', password),
    removeMasterPassword: (currentPassword: string) => ipcRenderer.invoke('crypto:removeMasterPassword', currentPassword),
    isUnlocked: () => ipcRenderer.invoke('crypto:isUnlocked'),
  },

  // Settings
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (settings: unknown) => ipcRenderer.invoke('settings:update', settings),
  },

  // Dialogs
  dialog: {
    openFile: (options: unknown) => ipcRenderer.invoke('dialog:openFile', options),
    saveFile: (options: unknown) => ipcRenderer.invoke('dialog:saveFile', options),
  },

  // Shell
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },

  // Local Terminal (PTY)
  localPty: {
    spawn: (id: string, cols: number, rows: number) => ipcRenderer.invoke('localPty:spawn', id, cols, rows),
    write: (id: string, data: string) => ipcRenderer.invoke('localPty:write', id, data),
    resize: (id: string, cols: number, rows: number) => ipcRenderer.invoke('localPty:resize', id, cols, rows),
    kill: (id: string) => ipcRenderer.invoke('localPty:kill', id),
    onData: (id: string, callback: (data: string) => void) => {
      const channel = `localPty:data:${id}`;
      const handler = (_: unknown, data: string) => callback(data);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },
    onExit: (id: string, callback: () => void) => {
      const channel = `localPty:exit:${id}`;
      const handler = () => callback();
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },
  },
};

contextBridge.exposeInMainWorld('valkyrieTUN', api);

export type NexTermAPI = typeof api;
