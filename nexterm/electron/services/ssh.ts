import { Client, ClientChannel } from 'ssh2';
import { v4 as uuid } from 'uuid';
import fs from 'fs';

interface SSHSessionData {
  host: string;
  port: number;
  username: string;
  authMethod: 'password' | 'key' | 'agent';
  password?: string;
  privateKeyPath?: string;
  privateKey?: string;
  passphrase?: string;
  jumpHost?: SSHSessionData;
  keepaliveInterval?: number;
  keepaliveCountMax?: number;
}

interface ActiveConnection {
  client: Client;
  stream: ClientChannel | null;
  jumpClient: Client | null;
}

export class SSHService {
  private connections = new Map<string, ActiveConnection>();

  async connect(
    sessionData: SSHSessionData,
    onData: (data: string) => void,
    onClose: () => void
  ): Promise<string> {
    const connId = uuid();

    let jumpClient: Client | null = null;
    let connectConfig: Record<string, unknown> = {
      host: sessionData.host,
      port: sessionData.port || 22,
      username: sessionData.username,
      keepaliveInterval: sessionData.keepaliveInterval || 10000,
      keepaliveCountMax: sessionData.keepaliveCountMax || 3,
      readyTimeout: 20000,
    };

    if (sessionData.authMethod === 'password') {
      connectConfig.password = sessionData.password;
    } else if (sessionData.authMethod === 'key') {
      if (sessionData.privateKey) {
        connectConfig.privateKey = sessionData.privateKey;
      } else if (sessionData.privateKeyPath) {
        connectConfig.privateKey = fs.readFileSync(sessionData.privateKeyPath, 'utf-8');
      }
      if (sessionData.passphrase) {
        connectConfig.passphrase = sessionData.passphrase;
      }
    } else if (sessionData.authMethod === 'agent') {
      connectConfig.agent = process.env.SSH_AUTH_SOCK;
    }

    // Handle jump host
    if (sessionData.jumpHost) {
      jumpClient = await this.createJumpConnection(sessionData.jumpHost);
      const stream = await new Promise<ClientChannel>((resolve, reject) => {
        jumpClient!.forwardOut(
          '127.0.0.1', 0,
          sessionData.host, sessionData.port || 22,
          (err, channel) => {
            if (err) reject(err);
            else resolve(channel);
          }
        );
      });
      connectConfig = { ...connectConfig, sock: stream };
      delete connectConfig.host;
      delete connectConfig.port;
    }

    const client = new Client();

    return new Promise((resolve, reject) => {
      client.on('ready', () => {
        client.shell(
          { term: 'xterm-256color', cols: 120, rows: 30 },
          (err, stream) => {
            if (err) {
              reject(err);
              return;
            }

            stream.on('data', (data: Buffer) => onData(data.toString('utf-8')));
            stream.on('close', () => {
              this.connections.delete(connId);
              onClose();
            });

            this.connections.set(connId, { client, stream, jumpClient });
            resolve(connId);
          }
        );
      });

      client.on('error', (err) => {
        this.connections.delete(connId);
        reject(err);
      });

      client.connect(connectConfig as Parameters<Client['connect']>[0]);
    });
  }

  private createJumpConnection(jumpData: SSHSessionData): Promise<Client> {
    const client = new Client();
    const config: Record<string, unknown> = {
      host: jumpData.host,
      port: jumpData.port || 22,
      username: jumpData.username,
      readyTimeout: 20000,
    };

    if (jumpData.authMethod === 'password') {
      config.password = jumpData.password;
    } else if (jumpData.authMethod === 'key') {
      if (jumpData.privateKey) {
        config.privateKey = jumpData.privateKey;
      } else if (jumpData.privateKeyPath) {
        config.privateKey = fs.readFileSync(jumpData.privateKeyPath, 'utf-8');
      }
      if (jumpData.passphrase) {
        config.passphrase = jumpData.passphrase;
      }
    } else if (jumpData.authMethod === 'agent') {
      config.agent = process.env.SSH_AUTH_SOCK;
    }

    return new Promise((resolve, reject) => {
      client.on('ready', () => resolve(client));
      client.on('error', reject);
      client.connect(config as Parameters<Client['connect']>[0]);
    });
  }

  write(connId: string, data: string) {
    const conn = this.connections.get(connId);
    if (conn?.stream) {
      conn.stream.write(data);
    }
  }

  resize(connId: string, cols: number, rows: number) {
    const conn = this.connections.get(connId);
    if (conn?.stream) {
      conn.stream.setWindow(rows, cols, 0, 0);
    }
  }

  disconnect(connId: string) {
    const conn = this.connections.get(connId);
    if (conn) {
      conn.stream?.close();
      conn.client.end();
      conn.jumpClient?.end();
      this.connections.delete(connId);
    }
  }

  disconnectAll() {
    for (const connId of this.connections.keys()) {
      this.disconnect(connId);
    }
  }
}
