import { Client, SFTPWrapper } from 'ssh2';
import { v4 as uuid } from 'uuid';
import fs from 'fs';
import path from 'path';

interface SFTPSessionData {
  host: string;
  port: number;
  username: string;
  authMethod: 'password' | 'key' | 'agent';
  password?: string;
  privateKeyPath?: string;
  privateKey?: string;
  passphrase?: string;
}

interface SFTPConnection {
  client: Client;
  sftp: SFTPWrapper;
}

interface ProgressCallback {
  (progress: { transferred: number; total: number; percent: number; speed: number }): void;
}

export class SFTPService {
  private connections = new Map<string, SFTPConnection>();

  async connect(sessionData: SFTPSessionData): Promise<string> {
    const connId = uuid();
    const client = new Client();

    const config: Record<string, unknown> = {
      host: sessionData.host,
      port: sessionData.port || 22,
      username: sessionData.username,
      readyTimeout: 20000,
    };

    if (sessionData.authMethod === 'password') {
      config.password = sessionData.password;
    } else if (sessionData.authMethod === 'key') {
      if (sessionData.privateKey) {
        config.privateKey = sessionData.privateKey;
      } else if (sessionData.privateKeyPath) {
        config.privateKey = fs.readFileSync(sessionData.privateKeyPath, 'utf-8');
      }
      if (sessionData.passphrase) config.passphrase = sessionData.passphrase;
    } else if (sessionData.authMethod === 'agent') {
      config.agent = process.env.SSH_AUTH_SOCK;
    }

    return new Promise((resolve, reject) => {
      client.on('ready', () => {
        client.sftp((err, sftp) => {
          if (err) { reject(err); return; }
          this.connections.set(connId, { client, sftp });
          resolve(connId);
        });
      });
      client.on('error', reject);
      client.connect(config as Parameters<Client['connect']>[0]);
    });
  }

  async list(connId: string, remotePath: string) {
    const conn = this.getConn(connId);
    return new Promise((resolve, reject) => {
      conn.sftp.readdir(remotePath, (err, list) => {
        if (err) { reject(err); return; }
        const items = list.map((item) => ({
          name: item.filename,
          path: path.posix.join(remotePath, item.filename),
          size: item.attrs.size,
          modifyTime: item.attrs.mtime * 1000,
          accessTime: item.attrs.atime * 1000,
          isDirectory: (item.attrs.mode & 0o40000) !== 0,
          isSymlink: (item.attrs.mode & 0o120000) === 0o120000,
          permissions: item.attrs.mode & 0o7777,
          owner: item.attrs.uid,
          group: item.attrs.gid,
        }));
        resolve(items.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        }));
      });
    });
  }

  async upload(connId: string, localPath: string, remotePath: string, onProgress?: ProgressCallback) {
    const conn = this.getConn(connId);
    const stats = fs.statSync(localPath);
    const total = stats.size;
    let transferred = 0;
    const startTime = Date.now();

    return new Promise<void>((resolve, reject) => {
      const readStream = fs.createReadStream(localPath);
      const writeStream = conn.sftp.createWriteStream(remotePath);

      readStream.on('data', (chunk: Buffer) => {
        transferred += chunk.length;
        if (onProgress) {
          const elapsed = (Date.now() - startTime) / 1000;
          onProgress({
            transferred,
            total,
            percent: Math.round((transferred / total) * 100),
            speed: elapsed > 0 ? transferred / elapsed : 0,
          });
        }
      });

      writeStream.on('close', () => resolve());
      writeStream.on('error', reject);
      readStream.on('error', reject);
      readStream.pipe(writeStream);
    });
  }

  async download(connId: string, remotePath: string, localPath: string, onProgress?: ProgressCallback) {
    const conn = this.getConn(connId);
    const stats = await this.stat(connId, remotePath) as { size: number };
    const total = stats.size;
    let transferred = 0;
    const startTime = Date.now();

    return new Promise<void>((resolve, reject) => {
      const readStream = conn.sftp.createReadStream(remotePath);
      const writeStream = fs.createWriteStream(localPath);

      readStream.on('data', (chunk: Buffer) => {
        transferred += chunk.length;
        if (onProgress) {
          const elapsed = (Date.now() - startTime) / 1000;
          onProgress({
            transferred,
            total,
            percent: Math.round((transferred / total) * 100),
            speed: elapsed > 0 ? transferred / elapsed : 0,
          });
        }
      });

      writeStream.on('close', () => resolve());
      writeStream.on('error', reject);
      readStream.on('error', reject);
      readStream.pipe(writeStream);
    });
  }

  async mkdir(connId: string, remotePath: string) {
    const conn = this.getConn(connId);
    return new Promise<void>((resolve, reject) => {
      conn.sftp.mkdir(remotePath, (err) => {
        if (err) reject(err); else resolve();
      });
    });
  }

  async delete(connId: string, remotePath: string) {
    const conn = this.getConn(connId);
    const stats = await this.stat(connId, remotePath) as { isDirectory: boolean };
    if (stats.isDirectory) {
      return new Promise<void>((resolve, reject) => {
        conn.sftp.rmdir(remotePath, (err) => {
          if (err) reject(err); else resolve();
        });
      });
    }
    return new Promise<void>((resolve, reject) => {
      conn.sftp.unlink(remotePath, (err) => {
        if (err) reject(err); else resolve();
      });
    });
  }

  async rename(connId: string, oldPath: string, newPath: string) {
    const conn = this.getConn(connId);
    return new Promise<void>((resolve, reject) => {
      conn.sftp.rename(oldPath, newPath, (err) => {
        if (err) reject(err); else resolve();
      });
    });
  }

  async chmod(connId: string, remotePath: string, mode: string) {
    const conn = this.getConn(connId);
    return new Promise<void>((resolve, reject) => {
      conn.sftp.chmod(remotePath, parseInt(mode, 8), (err) => {
        if (err) reject(err); else resolve();
      });
    });
  }

  async readFile(connId: string, remotePath: string): Promise<string> {
    const conn = this.getConn(connId);
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const stream = conn.sftp.createReadStream(remotePath);
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      stream.on('error', reject);
    });
  }

  async writeFile(connId: string, remotePath: string, content: string) {
    const conn = this.getConn(connId);
    return new Promise<void>((resolve, reject) => {
      const stream = conn.sftp.createWriteStream(remotePath);
      stream.on('close', () => resolve());
      stream.on('error', reject);
      stream.end(content);
    });
  }

  async stat(connId: string, remotePath: string) {
    const conn = this.getConn(connId);
    return new Promise((resolve, reject) => {
      conn.sftp.stat(remotePath, (err, stats) => {
        if (err) { reject(err); return; }
        resolve({
          size: stats.size,
          modifyTime: stats.mtime * 1000,
          accessTime: stats.atime * 1000,
          isDirectory: (stats.mode & 0o40000) !== 0,
          permissions: stats.mode & 0o7777,
          owner: stats.uid,
          group: stats.gid,
        });
      });
    });
  }

  disconnect(connId: string) {
    const conn = this.connections.get(connId);
    if (conn) {
      conn.client.end();
      this.connections.delete(connId);
    }
  }

  disconnectAll() {
    for (const connId of this.connections.keys()) {
      this.disconnect(connId);
    }
  }

  private getConn(connId: string): SFTPConnection {
    const conn = this.connections.get(connId);
    if (!conn) throw new Error(`SFTP connection ${connId} not found`);
    return conn;
  }
}
