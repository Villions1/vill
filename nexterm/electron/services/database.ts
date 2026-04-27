import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuid } from 'uuid';

export class DatabaseService {
  private db: Database.Database;

  constructor(userDataPath: string) {
    const dbPath = path.join(userDataPath, 'valkyrie-tun.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initTables();
  }

  private initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parentId TEXT,
        color TEXT,
        icon TEXT,
        sortOrder INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (parentId) REFERENCES groups(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER DEFAULT 22,
        username TEXT NOT NULL,
        authMethod TEXT DEFAULT 'password',
        password TEXT,
        privateKeyId TEXT,
        privateKeyPath TEXT,
        passphrase TEXT,
        groupId TEXT,
        jumpHostId TEXT,
        labels TEXT DEFAULT '[]',
        notes TEXT DEFAULT '',
        colorTag TEXT,
        keepaliveInterval INTEGER DEFAULT 10000,
        keepaliveCountMax INTEGER DEFAULT 3,
        postLoginScript TEXT,
        proxyType TEXT,
        proxyHost TEXT,
        proxyPort INTEGER,
        proxyUsername TEXT,
        proxyPassword TEXT,
        agentForwarding INTEGER DEFAULT 0,
        enableLogging INTEGER DEFAULT 0,
        logPath TEXT,
        sftpBookmarks TEXT DEFAULT '[]',
        lastConnectedAt TEXT,
        sortOrder INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (groupId) REFERENCES groups(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS keys (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        publicKey TEXT,
        privateKeyPath TEXT NOT NULL,
        fingerprint TEXT,
        hasPassphrase INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS scripts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        content TEXT NOT NULL,
        tags TEXT DEFAULT '[]',
        hostIds TEXT DEFAULT '[]',
        groupIds TEXT DEFAULT '[]',
        variables TEXT DEFAULT '[]',
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS tunnels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sessionId TEXT NOT NULL,
        type TEXT NOT NULL,
        localHost TEXT DEFAULT '127.0.0.1',
        localPort INTEGER NOT NULL,
        remoteHost TEXT DEFAULT '127.0.0.1',
        remotePort INTEGER NOT NULL,
        autoStart INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_group ON sessions(groupId);
      CREATE INDEX IF NOT EXISTS idx_sessions_last_connected ON sessions(lastConnectedAt DESC);
      CREATE INDEX IF NOT EXISTS idx_tunnels_session ON tunnels(sessionId);
    `);

    // Insert default settings
    const defaultSettings: Record<string, string> = {
      theme: 'dark',
      fontFamily: 'JetBrains Mono',
      fontSize: '14',
      cursorStyle: 'block',
      scrollbackLines: '5000',
      accentColor: '#4A90D9',
      terminalBellSound: 'false',
      enableBroadcastMode: 'false',
      masterPassword: '',
    };
    const insert = this.db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(defaultSettings)) {
      insert.run(key, value);
    }
  }

  // Sessions
  getAllSessions() {
    return this.db.prepare('SELECT * FROM sessions ORDER BY sortOrder, name').all();
  }

  getSessionById(id: string) {
    return this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  }

  createSession(session: Record<string, unknown>) {
    const id = (session.id as string) || uuid();
    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, name, host, port, username, authMethod, password, privateKeyId,
        privateKeyPath, passphrase, groupId, jumpHostId, labels, notes, colorTag,
        keepaliveInterval, keepaliveCountMax, postLoginScript, proxyType, proxyHost, proxyPort,
        proxyUsername, proxyPassword, agentForwarding, enableLogging, logPath, sftpBookmarks)
      VALUES (@id, @name, @host, @port, @username, @authMethod, @password, @privateKeyId,
        @privateKeyPath, @passphrase, @groupId, @jumpHostId, @labels, @notes, @colorTag,
        @keepaliveInterval, @keepaliveCountMax, @postLoginScript, @proxyType, @proxyHost, @proxyPort,
        @proxyUsername, @proxyPassword, @agentForwarding, @enableLogging, @logPath, @sftpBookmarks)
    `);
    stmt.run({
      id,
      name: session.name || '',
      host: session.host || '',
      port: session.port || 22,
      username: session.username || '',
      authMethod: session.authMethod || 'password',
      password: session.password || null,
      privateKeyId: session.privateKeyId || null,
      privateKeyPath: session.privateKeyPath || null,
      passphrase: session.passphrase || null,
      groupId: session.groupId || null,
      jumpHostId: session.jumpHostId || null,
      labels: JSON.stringify(session.labels || []),
      notes: session.notes || '',
      colorTag: session.colorTag || null,
      keepaliveInterval: session.keepaliveInterval || 10000,
      keepaliveCountMax: session.keepaliveCountMax || 3,
      postLoginScript: session.postLoginScript || null,
      proxyType: session.proxyType || null,
      proxyHost: session.proxyHost || null,
      proxyPort: session.proxyPort || null,
      proxyUsername: session.proxyUsername || null,
      proxyPassword: session.proxyPassword || null,
      agentForwarding: session.agentForwarding ? 1 : 0,
      enableLogging: session.enableLogging ? 1 : 0,
      logPath: session.logPath || null,
      sftpBookmarks: JSON.stringify(session.sftpBookmarks || []),
    });
    return id;
  }

  updateSession(id: string, session: Record<string, unknown>) {
    // Sanitize: remove undefined values, stringify arrays/objects for SQLite
    const sanitized: Record<string, unknown> = { id };
    for (const [k, v] of Object.entries(session)) {
      if (k === 'id') continue;
      if (v === undefined) continue;
      if (k === 'labels' || k === 'sftpBookmarks') {
        sanitized[k] = typeof v === 'string' ? v : JSON.stringify(v ?? []);
      } else if (typeof v === 'boolean') {
        sanitized[k] = v ? 1 : 0;
      } else if (Array.isArray(v) || (typeof v === 'object' && v !== null)) {
        sanitized[k] = JSON.stringify(v);
      } else {
        sanitized[k] = v ?? null;
      }
    }

    const fields = Object.keys(sanitized)
      .filter((k) => k !== 'id')
      .map((k) => {
        if (k === 'labels' || k === 'sftpBookmarks') return `${k} = json(@${k})`;
        return `${k} = @${k}`;
      });
    if (fields.length === 0) return;
    this.db.prepare(`UPDATE sessions SET ${fields.join(', ')}, updatedAt = datetime('now') WHERE id = @id`).run(sanitized);
  }

  deleteSession(id: string) {
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  }

  getRecentSessions() {
    return this.db.prepare(
      'SELECT * FROM sessions WHERE lastConnectedAt IS NOT NULL ORDER BY lastConnectedAt DESC LIMIT 10'
    ).all();
  }

  updateLastConnected(id: string) {
    this.db.prepare("UPDATE sessions SET lastConnectedAt = datetime('now') WHERE id = ?").run(id);
  }

  // Groups
  getAllGroups() {
    return this.db.prepare('SELECT * FROM groups ORDER BY sortOrder, name').all();
  }

  createGroup(group: Record<string, unknown>) {
    const id = (group.id as string) || uuid();
    this.db.prepare(
      'INSERT INTO groups (id, name, parentId, color, icon, sortOrder) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, group.name, group.parentId || null, group.color || null, group.icon || null, group.sortOrder || 0);
    return id;
  }

  updateGroup(id: string, group: Record<string, unknown>) {
    this.db.prepare(
      "UPDATE groups SET name = ?, parentId = ?, color = ?, icon = ?, sortOrder = ?, updatedAt = datetime('now') WHERE id = ?"
    ).run(group.name, group.parentId || null, group.color || null, group.icon || null, group.sortOrder || 0, id);
  }

  deleteGroup(id: string) {
    this.db.prepare('DELETE FROM groups WHERE id = ?').run(id);
  }

  // Keys
  getAllKeys() {
    return this.db.prepare('SELECT * FROM keys ORDER BY name').all();
  }

  createKey(key: Record<string, unknown>) {
    const id = (key.id as string) || uuid();
    this.db.prepare(
      'INSERT INTO keys (id, name, type, publicKey, privateKeyPath, fingerprint, hasPassphrase) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, key.name, key.type, key.publicKey || null, key.privateKeyPath, key.fingerprint || null, key.hasPassphrase ? 1 : 0);
    return id;
  }

  deleteKey(id: string) {
    this.db.prepare('DELETE FROM keys WHERE id = ?').run(id);
  }

  // Scripts
  getAllScripts() {
    return this.db.prepare('SELECT * FROM scripts ORDER BY name').all();
  }

  createScript(script: Record<string, unknown>) {
    const id = (script.id as string) || uuid();
    this.db.prepare(
      'INSERT INTO scripts (id, name, description, content, tags, hostIds, groupIds, variables) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      id, script.name, script.description || '', script.content || '',
      JSON.stringify(script.tags || []), JSON.stringify(script.hostIds || []),
      JSON.stringify(script.groupIds || []), JSON.stringify(script.variables || [])
    );
    return id;
  }

  updateScript(id: string, script: Record<string, unknown>) {
    this.db.prepare(
      "UPDATE scripts SET name = ?, description = ?, content = ?, tags = ?, hostIds = ?, groupIds = ?, variables = ?, updatedAt = datetime('now') WHERE id = ?"
    ).run(
      script.name, script.description || '', script.content || '',
      JSON.stringify(script.tags || []), JSON.stringify(script.hostIds || []),
      JSON.stringify(script.groupIds || []), JSON.stringify(script.variables || []), id
    );
  }

  deleteScript(id: string) {
    this.db.prepare('DELETE FROM scripts WHERE id = ?').run(id);
  }

  // Tunnels
  getAllTunnels() {
    return this.db.prepare('SELECT * FROM tunnels ORDER BY name').all();
  }

  getTunnelById(id: string) {
    return this.db.prepare('SELECT * FROM tunnels WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  }

  createTunnel(tunnel: Record<string, unknown>) {
    const id = (tunnel.id as string) || uuid();
    this.db.prepare(
      'INSERT INTO tunnels (id, name, sessionId, type, localHost, localPort, remoteHost, remotePort, autoStart) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, tunnel.name, tunnel.sessionId, tunnel.type, tunnel.localHost || '127.0.0.1',
      tunnel.localPort, tunnel.remoteHost || '127.0.0.1', tunnel.remotePort, tunnel.autoStart ? 1 : 0);
    return id;
  }

  updateTunnel(id: string, tunnel: Record<string, unknown>) {
    this.db.prepare(
      'UPDATE tunnels SET name = ?, sessionId = ?, type = ?, localHost = ?, localPort = ?, remoteHost = ?, remotePort = ?, autoStart = ? WHERE id = ?'
    ).run(tunnel.name, tunnel.sessionId, tunnel.type, tunnel.localHost || '127.0.0.1',
      tunnel.localPort, tunnel.remoteHost || '127.0.0.1', tunnel.remotePort, tunnel.autoStart ? 1 : 0, id);
  }

  deleteTunnel(id: string) {
    this.db.prepare('DELETE FROM tunnels WHERE id = ?').run(id);
  }

  // Settings
  getSettings(): Record<string, string> {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value;
    return settings;
  }

  updateSettings(settings: Record<string, string>) {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    const transaction = this.db.transaction(() => {
      for (const [key, value] of Object.entries(settings)) {
        stmt.run(key, value);
      }
    });
    transaction();
  }
}
