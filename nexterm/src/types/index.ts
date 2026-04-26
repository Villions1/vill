export interface SSHSession {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: 'password' | 'key' | 'agent';
  password?: string;
  privateKeyId?: string;
  privateKeyPath?: string;
  passphrase?: string;
  groupId?: string;
  jumpHostId?: string;
  labels: string[];
  notes: string;
  colorTag?: string;
  keepaliveInterval: number;
  keepaliveCountMax: number;
  postLoginScript?: string;
  proxyType?: string;
  proxyHost?: string;
  proxyPort?: number;
  proxyUsername?: string;
  proxyPassword?: string;
  agentForwarding: boolean;
  enableLogging: boolean;
  logPath?: string;
  sftpBookmarks: string[];
  lastConnectedAt?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SessionGroup {
  id: string;
  name: string;
  parentId?: string;
  color?: string;
  icon?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SSHKey {
  id: string;
  name: string;
  type: 'rsa' | 'ed25519' | 'ecdsa' | 'unknown';
  publicKey?: string;
  privateKeyPath: string;
  fingerprint?: string;
  hasPassphrase: boolean;
  createdAt: string;
}

export interface Script {
  id: string;
  name: string;
  description: string;
  content: string;
  tags: string[];
  hostIds: string[];
  groupIds: string[];
  variables: ScriptVariable[];
  createdAt: string;
  updatedAt: string;
}

export interface ScriptVariable {
  name: string;
  description?: string;
  defaultValue?: string;
}

export interface Tunnel {
  id: string;
  name: string;
  sessionId: string;
  type: 'local' | 'remote' | 'dynamic';
  localHost: string;
  localPort: number;
  remoteHost: string;
  remotePort: number;
  autoStart: boolean;
  createdAt: string;
}

export interface AppSettings {
  theme: 'dark' | 'light';
  fontFamily: string;
  fontSize: string;
  cursorStyle: 'block' | 'underline' | 'bar';
  scrollbackLines: string;
  accentColor: string;
  terminalBellSound: string;
  enableBroadcastMode: string;
  masterPassword: string;
  [key: string]: string;
}

export interface TerminalTab {
  id: string;
  sessionId: string;
  connectionId?: string;
  title: string;
  isConnected: boolean;
  isConnecting: boolean;
}

export interface SplitPane {
  id: string;
  direction: 'horizontal' | 'vertical';
  children: (SplitPane | TerminalLeaf)[];
}

export interface TerminalLeaf {
  id: string;
  tabId: string;
  type: 'terminal';
}

export type NavigationView =
  | 'home'
  | 'sessions'
  | 'terminal'
  | 'sftp'
  | 'keys'
  | 'scripts'
  | 'tunnels'
  | 'settings';

export interface RemoteFile {
  name: string;
  path: string;
  size: number;
  modifyTime: number;
  accessTime: number;
  isDirectory: boolean;
  isSymlink: boolean;
  permissions: number;
  owner: number;
  group: number;
}

export interface LocalFile {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface TransferItem {
  id: string;
  fileName: string;
  localPath: string;
  remotePath: string;
  direction: 'upload' | 'download';
  status: 'pending' | 'active' | 'completed' | 'failed' | 'paused';
  progress: number;
  speed: number;
  transferred: number;
  total: number;
  error?: string;
}
