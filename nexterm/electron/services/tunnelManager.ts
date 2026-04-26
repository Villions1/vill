import { Client } from 'ssh2';
import net from 'net';
import fs from 'fs';

interface TunnelRule {
  id: string;
  type: string; // 'local' | 'remote' | 'dynamic'
  localHost: string;
  localPort: number;
  remoteHost: string;
  remotePort: number;
  sessionId: string;
}

interface SessionData {
  host: string;
  port: number;
  username: string;
  authMethod: string;
  password?: string;
  privateKeyPath?: string;
  privateKey?: string;
  passphrase?: string;
}

interface ActiveTunnel {
  id: string;
  server: net.Server | null;
  client: Client;
  type: string;
}

export class TunnelManagerService {
  private activeTunnels = new Map<string, ActiveTunnel>();

  async startTunnel(tunnel: TunnelRule, sessionData: SessionData): Promise<void> {
    if (this.activeTunnels.has(tunnel.id)) return;

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
      if (sessionData.privateKey) config.privateKey = sessionData.privateKey;
      else if (sessionData.privateKeyPath) config.privateKey = fs.readFileSync(sessionData.privateKeyPath, 'utf-8');
      if (sessionData.passphrase) config.passphrase = sessionData.passphrase;
    } else if (sessionData.authMethod === 'agent') {
      config.agent = process.env.SSH_AUTH_SOCK;
    }

    return new Promise((resolve, reject) => {
      client.on('ready', () => {
        if (tunnel.type === 'local') {
          const server = net.createServer((sock) => {
            client.forwardOut(
              sock.remoteAddress || '127.0.0.1',
              sock.remotePort || 0,
              tunnel.remoteHost,
              tunnel.remotePort,
              (err, stream) => {
                if (err) { sock.end(); return; }
                sock.pipe(stream).pipe(sock);
              }
            );
          });
          server.listen(tunnel.localPort, tunnel.localHost, () => {
            this.activeTunnels.set(tunnel.id, { id: tunnel.id, server, client, type: tunnel.type });
            resolve();
          });
          server.on('error', reject);
        } else if (tunnel.type === 'remote') {
          client.forwardIn(tunnel.remoteHost, tunnel.remotePort, (err) => {
            if (err) { reject(err); return; }
            this.activeTunnels.set(tunnel.id, { id: tunnel.id, server: null, client, type: tunnel.type });
            resolve();
          });
          client.on('tcp connection', (_info, accept) => {
            const stream = accept();
            const sock = net.createConnection(tunnel.localPort, tunnel.localHost);
            stream.pipe(sock).pipe(stream);
          });
        } else if (tunnel.type === 'dynamic') {
          // SOCKS5 proxy
          const server = net.createServer((sock) => {
            sock.once('data', (data: Buffer) => {
              // SOCKS5 handshake
              if (data[0] === 0x05) {
                sock.write(Buffer.from([0x05, 0x00]));
                sock.once('data', (req: Buffer) => {
                  const cmd = req[1];
                  if (cmd !== 0x01) { sock.end(); return; } // only CONNECT

                  let host: string;
                  let port: number;
                  const addrType = req[3];
                  if (addrType === 0x01) { // IPv4
                    host = `${req[4]}.${req[5]}.${req[6]}.${req[7]}`;
                    port = (req as Buffer).readUInt16BE(8);
                  } else if (addrType === 0x03) { // Domain
                    const len = req[4] as number;
                    host = (req as Buffer).subarray(5, 5 + len).toString();
                    port = (req as Buffer).readUInt16BE(5 + len);
                  } else { sock.end(); return; }

                  client.forwardOut('127.0.0.1', 0, host, port, (err, stream) => {
                    if (err) { sock.end(); return; }
                    const reply = Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]);
                    sock.write(reply);
                    sock.pipe(stream).pipe(sock);
                  });
                });
              }
            });
          });
          server.listen(tunnel.localPort, tunnel.localHost, () => {
            this.activeTunnels.set(tunnel.id, { id: tunnel.id, server, client, type: tunnel.type });
            resolve();
          });
          server.on('error', reject);
        }
      });

      client.on('error', reject);
      client.connect(config as Parameters<Client['connect']>[0]);
    });
  }

  stopTunnel(tunnelId: string) {
    const active = this.activeTunnels.get(tunnelId);
    if (active) {
      active.server?.close();
      active.client.end();
      this.activeTunnels.delete(tunnelId);
    }
  }

  getActiveTunnels(): string[] {
    return Array.from(this.activeTunnels.keys());
  }

  stopAll() {
    for (const id of this.activeTunnels.keys()) {
      this.stopTunnel(id);
    }
  }
}
