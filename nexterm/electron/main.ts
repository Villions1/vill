import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { SSHService } from './services/ssh';
import { SFTPService } from './services/sftp';
import { DatabaseService } from './services/database';
import { KeyManagerService } from './services/keyManager';
import { TunnelManagerService } from './services/tunnelManager';
import { ScriptRunnerService } from './services/scriptRunner';
import { encrypt, decrypt, hashPassword, verifyPassword } from './services/crypto';
import * as pty from 'node-pty';
import os from 'os';

let mainWindow: BrowserWindow | null = null;
const localPtys: Map<string, pty.IPty> = new Map();
let activeMasterKey: string | null = null;
let db: DatabaseService;
let sshService: SSHService;
let sftpService: SFTPService;
let keyManager: KeyManagerService;
let tunnelManager: TunnelManagerService;
let scriptRunner: ScriptRunnerService;

const DIST = path.join(__dirname, '../dist');
const ELECTRON_DIST = path.join(__dirname);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#1e2128',
    webPreferences: {
      preload: path.join(ELECTRON_DIST, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(DIST, '../resources/icon.png'),
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(DIST, 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function initServices() {
  try {
    const userDataPath = app.getPath('userData');
    db = new DatabaseService(userDataPath);
    sshService = new SSHService();
    sftpService = new SFTPService();
    keyManager = new KeyManagerService(db);
    tunnelManager = new TunnelManagerService();
    scriptRunner = new ScriptRunnerService();
    console.log('All services initialized successfully');
  } catch (err) {
    console.error('Failed to initialize services:', err);
    throw err;
  }
}

function safeDb<T>(fn: () => T, fallback: T): T {
  if (!db) return fallback;
  try { return fn(); } catch (err) { console.error('DB error:', err); return fallback; }
}

function registerIPCHandlers() {
  // Window controls
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on('window:close', () => mainWindow?.close());
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);

  // Sessions CRUD
  ipcMain.handle('sessions:getAll', () => safeDb(() => db.getAllSessions(), []));
  ipcMain.handle('sessions:getById', (_, id: string) => safeDb(() => db.getSessionById(id), null));
  ipcMain.handle('sessions:create', (_, session) => {
    if (activeMasterKey) {
      if (session.password && !session.password.startsWith('ENC:')) {
        session.password = encrypt(session.password, activeMasterKey);
      }
      if (session.passphrase && !session.passphrase.startsWith('ENC:')) {
        session.passphrase = encrypt(session.passphrase, activeMasterKey);
      }
    }
    return safeDb(() => db.createSession(session), null);
  });
  ipcMain.handle('sessions:update', (_, id: string, session) => {
    if (activeMasterKey) {
      if (session.password && !session.password.startsWith('ENC:')) {
        session.password = encrypt(session.password, activeMasterKey);
      }
      if (session.passphrase && !session.passphrase.startsWith('ENC:')) {
        session.passphrase = encrypt(session.passphrase, activeMasterKey);
      }
    }
    return safeDb(() => db.updateSession(id, session), null);
  });
  ipcMain.handle('sessions:delete', (_, id: string) => safeDb(() => db.deleteSession(id), null));
  ipcMain.handle('sessions:getRecent', () => safeDb(() => db.getRecentSessions(), []));
  ipcMain.handle('sessions:updateLastConnected', (_, id: string) => safeDb(() => db.updateLastConnected(id), null));
  ipcMain.handle('sessions:clearLastConnected', (_, id: string) => safeDb(() => db.clearLastConnected(id), null));
  ipcMain.handle('sessions:clearAllRecent', () => safeDb(() => db.clearAllRecent(), null));

  // Crypto / Master Password
  ipcMain.handle('crypto:setMasterPassword', (_, password: string) => {
    const hash = hashPassword(password);
    safeDb(() => db.updateSettings({ masterPasswordHash: hash }), null);
    activeMasterKey = password;
    // Encrypt all existing plaintext passwords
    safeDb(() => {
      const sessions = db.getAllSessions() as Array<Record<string, unknown>>;
      for (const s of sessions) {
        const updates: Record<string, unknown> = {};
        if (s.password && typeof s.password === 'string' && !s.password.startsWith('ENC:')) {
          updates.password = encrypt(s.password as string, password);
        }
        if (s.passphrase && typeof s.passphrase === 'string' && !s.passphrase.startsWith('ENC:')) {
          updates.passphrase = encrypt(s.passphrase as string, password);
        }
        if (Object.keys(updates).length > 0) {
          db.updateSession(s.id as string, updates);
        }
      }
    }, null);
    return true;
  });

  ipcMain.handle('crypto:verifyMasterPassword', (_, password: string) => {
    const settings = safeDb(() => db.getSettings(), {} as Record<string, string>);
    if (!settings.masterPasswordHash) return false;
    const ok = verifyPassword(password, settings.masterPasswordHash);
    if (ok) activeMasterKey = password;
    return ok;
  });

  ipcMain.handle('crypto:hasMasterPassword', () => {
    const settings = safeDb(() => db.getSettings(), {} as Record<string, string>);
    return !!settings.masterPasswordHash;
  });

  ipcMain.handle('crypto:removeMasterPassword', (_, currentPassword: string) => {
    const settings = safeDb(() => db.getSettings(), {} as Record<string, string>);
    if (!settings.masterPasswordHash) return true;
    if (!verifyPassword(currentPassword, settings.masterPasswordHash)) return false;
    // Decrypt all stored passwords back to plaintext
    safeDb(() => {
      const sessions = db.getAllSessions() as Array<Record<string, unknown>>;
      for (const s of sessions) {
        const updates: Record<string, unknown> = {};
        if (s.password && typeof s.password === 'string' && s.password.startsWith('ENC:')) {
          try { updates.password = decrypt(s.password as string, currentPassword); } catch { /* skip */ }
        }
        if (s.passphrase && typeof s.passphrase === 'string' && s.passphrase.startsWith('ENC:')) {
          try { updates.passphrase = decrypt(s.passphrase as string, currentPassword); } catch { /* skip */ }
        }
        if (Object.keys(updates).length > 0) {
          db.updateSession(s.id as string, updates);
        }
      }
    }, null);
    safeDb(() => db.updateSettings({ masterPasswordHash: '' }), null);
    activeMasterKey = null;
    return true;
  });

  ipcMain.handle('crypto:isUnlocked', () => {
    const settings = safeDb(() => db.getSettings(), {} as Record<string, string>);
    if (!settings.masterPasswordHash) return true; // no password set = always unlocked
    return activeMasterKey !== null;
  });

  // Groups CRUD
  ipcMain.handle('groups:getAll', () => safeDb(() => db.getAllGroups(), []));
  ipcMain.handle('groups:create', (_, group) => safeDb(() => db.createGroup(group), null));
  ipcMain.handle('groups:update', (_, id: string, group) => safeDb(() => db.updateGroup(id, group), null));
  ipcMain.handle('groups:delete', (_, id: string) => safeDb(() => db.deleteGroup(id), null));

  // SSH connections — buffer data until renderer signals ready
  // Key: connId, Value: { buffer: string[], ready: boolean }
  const sshState = new Map<string, { buffer: string[]; ready: boolean }>();

  ipcMain.handle('ssh:connect', async (_, sessionId: string, sessionData) => {
    // Decrypt credentials if master password is active
    if (activeMasterKey) {
      if (sessionData.password && typeof sessionData.password === 'string' && sessionData.password.startsWith('ENC:')) {
        try { sessionData.password = decrypt(sessionData.password, activeMasterKey); } catch { /* use as-is */ }
      }
      if (sessionData.passphrase && typeof sessionData.passphrase === 'string' && sessionData.passphrase.startsWith('ENC:')) {
        try { sessionData.passphrase = decrypt(sessionData.passphrase, activeMasterKey); } catch { /* use as-is */ }
      }
    }

    const state = { buffer: [] as string[], ready: false };
    let resolvedConnId: string | null = null;

    const connId = await sshService.connect(sessionData, (data: string) => {
      const s = resolvedConnId ? sshState.get(resolvedConnId) : state;
      if (s && !s.ready) {
        s.buffer.push(data);
      } else {
        mainWindow?.webContents.send(`ssh:data:${resolvedConnId}`, data);
      }
    }, () => {
      if (resolvedConnId) sshState.delete(resolvedConnId);
      mainWindow?.webContents.send(`ssh:close:${resolvedConnId}`);
    });

    resolvedConnId = connId;
    sshState.set(connId, state);
    safeDb(() => db.updateLastConnected(sessionId), null);
    return connId;
  });

  ipcMain.handle('ssh:ready', (_, connId: string) => {
    const state = sshState.get(connId);
    if (state) {
      // Flush buffered data
      for (const data of state.buffer) {
        mainWindow?.webContents.send(`ssh:data:${connId}`, data);
      }
      state.buffer = [];
      state.ready = true;
    }
  });

  ipcMain.on('ssh:write', (_, connId: string, data: string) => {
    sshService.write(connId, data);
  });
  ipcMain.on('ssh:resize', (_, connId: string, cols: number, rows: number) => {
    sshService.resize(connId, cols, rows);
  });
  ipcMain.handle('ssh:disconnect', (_, connId: string) => {
    sshState.delete(connId);
    sshService.disconnect(connId);
  });

  // SFTP
  ipcMain.handle('sftp:connect', async (_, sessionData) => {
    // Decrypt credentials if master password is active (same as ssh:connect)
    if (activeMasterKey) {
      if (sessionData.password && typeof sessionData.password === 'string' && sessionData.password.startsWith('ENC:')) {
        try { sessionData.password = decrypt(sessionData.password, activeMasterKey); } catch { /* use as-is */ }
      }
      if (sessionData.passphrase && typeof sessionData.passphrase === 'string' && sessionData.passphrase.startsWith('ENC:')) {
        try { sessionData.passphrase = decrypt(sessionData.passphrase, activeMasterKey); } catch { /* use as-is */ }
      }
    }
    return sftpService.connect(sessionData);
  });
  ipcMain.handle('sftp:list', async (_, connId: string, remotePath: string) => {
    return sftpService.list(connId, remotePath);
  });
  ipcMain.handle('sftp:upload', async (event, connId: string, localPath: string, remotePath: string) => {
    return sftpService.upload(connId, localPath, remotePath, (progress) => {
      mainWindow?.webContents.send('sftp:progress', { connId, localPath, remotePath, ...progress });
    });
  });
  ipcMain.handle('sftp:download', async (event, connId: string, remotePath: string, localPath: string) => {
    return sftpService.download(connId, remotePath, localPath, (progress) => {
      mainWindow?.webContents.send('sftp:progress', { connId, localPath, remotePath, ...progress });
    });
  });
  ipcMain.handle('sftp:mkdir', async (_, connId: string, remotePath: string) => {
    return sftpService.mkdir(connId, remotePath);
  });
  ipcMain.handle('sftp:delete', async (_, connId: string, remotePath: string) => {
    return sftpService.delete(connId, remotePath);
  });
  ipcMain.handle('sftp:rename', async (_, connId: string, oldPath: string, newPath: string) => {
    return sftpService.rename(connId, oldPath, newPath);
  });
  ipcMain.handle('sftp:chmod', async (_, connId: string, remotePath: string, mode: string) => {
    return sftpService.chmod(connId, remotePath, mode);
  });
  ipcMain.handle('sftp:readFile', async (_, connId: string, remotePath: string) => {
    return sftpService.readFile(connId, remotePath);
  });
  ipcMain.handle('sftp:writeFile', async (_, connId: string, remotePath: string, content: string) => {
    return sftpService.writeFile(connId, remotePath, content);
  });
  ipcMain.handle('sftp:stat', async (_, connId: string, remotePath: string) => {
    return sftpService.stat(connId, remotePath);
  });
  ipcMain.handle('sftp:disconnect', async (_, connId: string) => {
    return sftpService.disconnect(connId);
  });

  // Local filesystem for SFTP pane
  ipcMain.handle('fs:listLocal', async (_, dirPath: string) => {
    const resolved = path.resolve(dirPath);
    const home = app.getPath('home');
    if (!resolved.startsWith(home + path.sep) && resolved !== home && !resolved.startsWith('/tmp' + path.sep) && resolved !== '/tmp') {
      throw new Error('Access denied: path outside home directory');
    }
    const fs = await import('fs/promises');
    const entries = await fs.readdir(resolved, { withFileTypes: true });
    return entries.map((e) => ({
      name: e.name,
      isDirectory: e.isDirectory(),
      path: path.join(dirPath, e.name),
    }));
  });
  ipcMain.handle('fs:getHomeDir', () => app.getPath('home'));

  // Key manager
  ipcMain.handle('keys:getAll', () => keyManager.getAllKeys());
  ipcMain.handle('keys:generate', (_, opts) => keyManager.generateKey(opts));
  ipcMain.handle('keys:import', (_, keyPath: string) => keyManager.importKey(keyPath));
  ipcMain.handle('keys:delete', (_, id: string) => keyManager.deleteKey(id));
  ipcMain.handle('keys:detectLocal', () => keyManager.detectLocalKeys());

  // Scripts
  ipcMain.handle('scripts:getAll', () => safeDb(() => db.getAllScripts(), []));
  ipcMain.handle('scripts:create', (_, script) => safeDb(() => db.createScript(script), null));
  ipcMain.handle('scripts:update', (_, id: string, script) => safeDb(() => db.updateScript(id, script), null));
  ipcMain.handle('scripts:delete', (_, id: string) => safeDb(() => db.deleteScript(id), null));
  ipcMain.handle('scripts:run', async (_, connId: string, scriptContent: string) => {
    return scriptRunner.run(sshService, connId, scriptContent);
  });

  // Tunnels
  ipcMain.handle('tunnels:getAll', () => safeDb(() => db.getAllTunnels(), []));
  ipcMain.handle('tunnels:create', (_, tunnel) => safeDb(() => db.createTunnel(tunnel), null));
  ipcMain.handle('tunnels:update', (_, id: string, tunnel) => safeDb(() => db.updateTunnel(id, tunnel), null));
  ipcMain.handle('tunnels:delete', (_, id: string) => safeDb(() => db.deleteTunnel(id), null));
  ipcMain.handle('tunnels:start', async (_, tunnelId: string, sessionData) => {
    // Decrypt credentials if master password is active
    if (activeMasterKey && sessionData) {
      if (sessionData.password && typeof sessionData.password === 'string' && sessionData.password.startsWith('ENC:')) {
        try { sessionData.password = decrypt(sessionData.password, activeMasterKey); } catch { /* use as-is */ }
      }
      if (sessionData.passphrase && typeof sessionData.passphrase === 'string' && sessionData.passphrase.startsWith('ENC:')) {
        try { sessionData.passphrase = decrypt(sessionData.passphrase, activeMasterKey); } catch { /* use as-is */ }
      }
    }
    const tunnel = safeDb(() => db.getTunnelById(tunnelId), null);
    if (tunnel) return tunnelManager.startTunnel(tunnel as unknown as Parameters<typeof tunnelManager.startTunnel>[0], sessionData);
  });
  ipcMain.handle('tunnels:stop', (_, tunnelId: string) => {
    tunnelManager.stopTunnel(tunnelId);
  });
  ipcMain.handle('tunnels:getActive', () => tunnelManager.getActiveTunnels());

  // Settings
  ipcMain.handle('settings:get', () => safeDb(() => db.getSettings(), {}));
  ipcMain.handle('settings:update', (_, settings) => safeDb(() => db.updateSettings(settings), null));

  // Import / export
  ipcMain.handle('sessions:export', async () => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: 'valkyrie-tun-sessions.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (!result.canceled && result.filePath) {
      const fs = await import('fs/promises');
      const sessions = safeDb(() => db.getAllSessions(), []);
      const groups = safeDb(() => db.getAllGroups(), []);
      await fs.writeFile(result.filePath, JSON.stringify({ sessions, groups }, null, 2));
      return true;
    }
    return false;
  });
  ipcMain.handle('sessions:import', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (!result.canceled && result.filePaths[0]) {
      const fs = await import('fs/promises');
      const raw = await fs.readFile(result.filePaths[0], 'utf-8');
      const data = JSON.parse(raw);
      if (data.sessions) {
        for (const s of data.sessions) safeDb(() => db.createSession(s), null);
      }
      if (data.groups) {
        for (const g of data.groups) safeDb(() => db.createGroup(g), null);
      }
      return true;
    }
    return false;
  });

  // Dialog helpers
  ipcMain.handle('dialog:openFile', async (_, options) => {
    const result = await dialog.showOpenDialog(mainWindow!, options);
    return result;
  });
  ipcMain.handle('dialog:saveFile', async (_, options) => {
    const result = await dialog.showSaveDialog(mainWindow!, options);
    return result;
  });

  // Shell — whitelist to http/https only
  ipcMain.handle('shell:openExternal', (_, url: string) => {
    if (typeof url !== 'string') return;
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        shell.openExternal(url);
      }
    } catch { /* invalid URL, ignore */ }
  });

  // Local Terminal (PTY)
  ipcMain.handle('localPty:spawn', (event, id: string, cols: number, rows: number) => {
    const shellPath = process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : '/bin/bash');
    const homeDir = os.homedir();
    const ptyProcess = pty.spawn(shellPath, [], {
      name: 'xterm-256color',
      cols: cols || 80,
      rows: rows || 24,
      cwd: homeDir,
      env: { ...process.env } as Record<string, string>,
    });

    localPtys.set(id, ptyProcess);

    ptyProcess.onData((data: string) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(`localPty:data:${id}`, data);
      }
    });

    ptyProcess.onExit(() => {
      localPtys.delete(id);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(`localPty:exit:${id}`);
      }
    });

    return true;
  });

  ipcMain.handle('localPty:write', (_, id: string, data: string) => {
    const p = localPtys.get(id);
    if (p) p.write(data);
  });

  ipcMain.handle('localPty:resize', (_, id: string, cols: number, rows: number) => {
    const p = localPtys.get(id);
    if (p) p.resize(cols, rows);
  });

  ipcMain.handle('localPty:kill', (_, id: string) => {
    const p = localPtys.get(id);
    if (p) {
      p.kill();
      localPtys.delete(id);
    }
  });
}

let servicesReady = false;

app.whenReady().then(() => {
  try {
    initServices();
    servicesReady = true;
  } catch (err) {
    console.error('Service initialization failed:', err);
    console.error('The app will start but database features will be unavailable.');
    console.error('Run "npm run rebuild" or "npx electron-rebuild -f -w better-sqlite3" to fix.');
  }
  registerIPCHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (servicesReady) {
    sshService.disconnectAll();
    sftpService.disconnectAll();
    tunnelManager.stopAll();
  }
  for (const [, p] of localPtys) {
    try { p.kill(); } catch {}
  }
  localPtys.clear();
  app.quit();
});
