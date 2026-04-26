import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { SSHService } from './services/ssh';
import { SFTPService } from './services/sftp';
import { DatabaseService } from './services/database';
import { KeyManagerService } from './services/keyManager';
import { TunnelManagerService } from './services/tunnelManager';
import { ScriptRunnerService } from './services/scriptRunner';

let mainWindow: BrowserWindow | null = null;
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
  ipcMain.handle('sessions:getAll', () => db.getAllSessions());
  ipcMain.handle('sessions:getById', (_, id: string) => db.getSessionById(id));
  ipcMain.handle('sessions:create', (_, session) => db.createSession(session));
  ipcMain.handle('sessions:update', (_, id: string, session) => db.updateSession(id, session));
  ipcMain.handle('sessions:delete', (_, id: string) => db.deleteSession(id));
  ipcMain.handle('sessions:getRecent', () => db.getRecentSessions());
  ipcMain.handle('sessions:updateLastConnected', (_, id: string) => db.updateLastConnected(id));

  // Groups CRUD
  ipcMain.handle('groups:getAll', () => db.getAllGroups());
  ipcMain.handle('groups:create', (_, group) => db.createGroup(group));
  ipcMain.handle('groups:update', (_, id: string, group) => db.updateGroup(id, group));
  ipcMain.handle('groups:delete', (_, id: string) => db.deleteGroup(id));

  // SSH connections
  ipcMain.handle('ssh:connect', async (_, sessionId: string, sessionData) => {
    const connId = await sshService.connect(sessionData, (data: string) => {
      mainWindow?.webContents.send(`ssh:data:${connId}`, data);
    }, () => {
      mainWindow?.webContents.send(`ssh:close:${connId}`);
    });
    db.updateLastConnected(sessionId);
    return connId;
  });
  ipcMain.on('ssh:write', (_, connId: string, data: string) => {
    sshService.write(connId, data);
  });
  ipcMain.on('ssh:resize', (_, connId: string, cols: number, rows: number) => {
    sshService.resize(connId, cols, rows);
  });
  ipcMain.handle('ssh:disconnect', (_, connId: string) => {
    sshService.disconnect(connId);
  });

  // SFTP
  ipcMain.handle('sftp:connect', async (_, sessionData) => {
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
    const fs = await import('fs/promises');
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
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
  ipcMain.handle('scripts:getAll', () => db.getAllScripts());
  ipcMain.handle('scripts:create', (_, script) => db.createScript(script));
  ipcMain.handle('scripts:update', (_, id: string, script) => db.updateScript(id, script));
  ipcMain.handle('scripts:delete', (_, id: string) => db.deleteScript(id));
  ipcMain.handle('scripts:run', async (_, connId: string, scriptContent: string) => {
    return scriptRunner.run(sshService, connId, scriptContent);
  });

  // Tunnels
  ipcMain.handle('tunnels:getAll', () => db.getAllTunnels());
  ipcMain.handle('tunnels:create', (_, tunnel) => db.createTunnel(tunnel));
  ipcMain.handle('tunnels:update', (_, id: string, tunnel) => db.updateTunnel(id, tunnel));
  ipcMain.handle('tunnels:delete', (_, id: string) => db.deleteTunnel(id));
  ipcMain.handle('tunnels:start', async (_, tunnelId: string, sessionData) => {
    const tunnel = db.getTunnelById(tunnelId);
    if (tunnel) return tunnelManager.startTunnel(tunnel as unknown as Parameters<typeof tunnelManager.startTunnel>[0], sessionData);
  });
  ipcMain.handle('tunnels:stop', (_, tunnelId: string) => {
    tunnelManager.stopTunnel(tunnelId);
  });
  ipcMain.handle('tunnels:getActive', () => tunnelManager.getActiveTunnels());

  // Settings
  ipcMain.handle('settings:get', () => db.getSettings());
  ipcMain.handle('settings:update', (_, settings) => db.updateSettings(settings));

  // Import / export
  ipcMain.handle('sessions:export', async () => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: 'nexterm-sessions.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (!result.canceled && result.filePath) {
      const fs = await import('fs/promises');
      const sessions = db.getAllSessions();
      const groups = db.getAllGroups();
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
        for (const s of data.sessions) db.createSession(s);
      }
      if (data.groups) {
        for (const g of data.groups) db.createGroup(g);
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

  // Shell
  ipcMain.handle('shell:openExternal', (_, url: string) => shell.openExternal(url));
}

app.whenReady().then(() => {
  initServices();
  registerIPCHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  sshService.disconnectAll();
  sftpService.disconnectAll();
  tunnelManager.stopAll();
  app.quit();
});
