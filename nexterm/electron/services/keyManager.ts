import { execSync, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { DatabaseService } from './database';

interface KeyGenerateOptions {
  name: string;
  type: 'rsa' | 'ed25519' | 'ecdsa';
  bits?: number;
  passphrase?: string;
  comment?: string;
}

export class KeyManagerService {
  private db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  async generateKey(opts: KeyGenerateOptions): Promise<string> {
    const keyDir = path.join(os.homedir(), '.ssh');
    if (!fs.existsSync(keyDir)) fs.mkdirSync(keyDir, { mode: 0o700, recursive: true });

    const keyName = `nexterm_${opts.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}`;
    const keyPath = path.join(keyDir, keyName);

    let cmd = `ssh-keygen -t ${opts.type}`;
    if (opts.type === 'rsa') cmd += ` -b ${opts.bits || 4096}`;
    if (opts.type === 'ecdsa') cmd += ` -b ${opts.bits || 521}`;
    cmd += ` -f "${keyPath}"`;
    cmd += ` -N "${opts.passphrase || ''}"`;
    if (opts.comment) cmd += ` -C "${opts.comment}"`;

    return new Promise((resolve, reject) => {
      exec(cmd, (err) => {
        if (err) { reject(err); return; }
        const publicKey = fs.readFileSync(`${keyPath}.pub`, 'utf-8').trim();
        const fingerprint = this.getFingerprint(keyPath);
        const id = this.db.createKey({
          name: opts.name,
          type: opts.type,
          publicKey,
          privateKeyPath: keyPath,
          fingerprint,
          hasPassphrase: !!opts.passphrase,
        });
        resolve(id);
      });
    });
  }

  async importKey(keyPath: string): Promise<string> {
    if (!fs.existsSync(keyPath)) throw new Error(`Key file not found: ${keyPath}`);

    const content = fs.readFileSync(keyPath, 'utf-8');
    const type = this.detectKeyType(content);
    const name = path.basename(keyPath);
    const fingerprint = this.getFingerprint(keyPath);

    let publicKey: string | undefined;
    const pubPath = `${keyPath}.pub`;
    if (fs.existsSync(pubPath)) {
      publicKey = fs.readFileSync(pubPath, 'utf-8').trim();
    }

    return this.db.createKey({
      name,
      type,
      publicKey,
      privateKeyPath: keyPath,
      fingerprint,
      hasPassphrase: content.includes('ENCRYPTED'),
    });
  }

  async detectLocalKeys(): Promise<Array<{ path: string; name: string; type: string; imported: boolean }>> {
    const sshDir = path.join(os.homedir(), '.ssh');
    if (!fs.existsSync(sshDir)) return [];

    const existing = this.db.getAllKeys() as Array<{ privateKeyPath: string }>;
    const existingPaths = new Set(existing.map((k) => k.privateKeyPath));

    const files = fs.readdirSync(sshDir);
    const keys: Array<{ path: string; name: string; type: string; imported: boolean }> = [];

    for (const file of files) {
      if (file.endsWith('.pub') || file === 'known_hosts' || file === 'config' || file === 'authorized_keys') continue;
      const filePath = path.join(sshDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (content.includes('PRIVATE KEY')) {
          keys.push({
            path: filePath,
            name: file,
            type: this.detectKeyType(content),
            imported: existingPaths.has(filePath),
          });
        }
      } catch {
        // skip non-readable files
      }
    }
    return keys;
  }

  deleteKey(id: string) {
    this.db.deleteKey(id);
  }

  getAllKeys() {
    return this.db.getAllKeys();
  }

  private detectKeyType(content: string): string {
    if (content.includes('RSA')) return 'rsa';
    if (content.includes('ED25519') || content.includes('ed25519')) return 'ed25519';
    if (content.includes('EC') || content.includes('ecdsa')) return 'ecdsa';
    return 'unknown';
  }

  private getFingerprint(keyPath: string): string {
    try {
      return execSync(`ssh-keygen -lf "${keyPath}" 2>/dev/null`).toString().trim().split(' ')[1] || '';
    } catch {
      return '';
    }
  }
}
