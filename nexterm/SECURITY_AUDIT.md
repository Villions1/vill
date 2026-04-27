# Security Audit Report — valkyrieTUN

**Date**: 2026-04-27  
**Scope**: Full codebase (`nexterm/`)  
**Auditor**: Devin AI  

---

## Critical Issues (must fix before release)

### CRIT-1: `shell:openExternal` accepts arbitrary URLs without validation

- **Location**: `electron/main.ts:384`
- **Description**: The `shell:openExternal` IPC handler passes the URL directly to `shell.openExternal(url)` with zero validation. A compromised or XSS-injected renderer can open arbitrary protocols including `file:///`, `smb://`, or custom protocol handlers, potentially leading to code execution on the user's machine.
- **Fix**: Whitelist URL schemes to `https://` and `http://` only:
  ```ts
  ipcMain.handle('shell:openExternal', (_, url: string) => {
    if (typeof url !== 'string') return;
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      shell.openExternal(url);
    }
  });
  ```

### CRIT-2: `fs:listLocal` IPC handler allows unrestricted filesystem traversal

- **Location**: `electron/main.ts:293-301`
- **Description**: The `fs:listLocal` handler accepts any `dirPath` string from the renderer and lists its contents without restriction. A compromised renderer can enumerate the entire filesystem (`/etc/passwd`, `/root/.ssh/`, etc.). There is no sandboxing or allowlisting of directories.
- **Fix**: Restrict to user's home directory:
  ```ts
  ipcMain.handle('fs:listLocal', async (_, dirPath: string) => {
    const resolved = path.resolve(dirPath);
    const home = app.getPath('home');
    if (!resolved.startsWith(home)) throw new Error('Access denied');
    // ... existing logic
  });
  ```

### CRIT-3: SSH host key verification is completely disabled

- **Location**: `electron/services/ssh.ts:36-108`, `electron/services/sftp.ts:33-63`, `electron/services/tunnelManager.ts:40-131`
- **Description**: None of the SSH connection configurations include a `hostVerifier` callback. The ssh2 library defaults to accepting ALL host keys silently. This makes the application vulnerable to **man-in-the-middle attacks** — an attacker can impersonate any SSH server, intercept credentials, and read/modify all traffic.
- **Fix**: Implement Trust On First Use (TOFU):
  1. Add a `known_hosts` table to the database
  2. On first connection, store the server's host key fingerprint
  3. On subsequent connections, verify the key matches — reject/warn if it changed
  ```ts
  connectConfig.hostVerifier = (key: Buffer) => {
    const fp = crypto.createHash('sha256').update(key).digest('hex');
    const stored = db.getKnownHostKey(host, port);
    if (!stored) { db.storeHostKey(host, port, fp); return true; }
    return stored === fp;
  };
  ```

### CRIT-4: Command injection in SSH key generation

- **Location**: `electron/services/keyManager.ts:29-34`
- **Description**: The key generation command is built via string concatenation with user-controlled values (`opts.comment`, `opts.passphrase`). Although `opts.name` is sanitized (line 26), `opts.comment` and `opts.passphrase` are injected directly into the shell command via double-quote interpolation. A passphrase containing `"; rm -rf /; "` would break out of the string.
- **Fix**: Use `execFile` with argument arrays instead of `exec` with string interpolation:
  ```ts
  import { execFile } from 'child_process';
  const args = ['-t', opts.type, '-f', keyPath, '-N', opts.passphrase || ''];
  if (opts.type === 'rsa') args.push('-b', String(opts.bits || 4096));
  if (opts.comment) args.push('-C', opts.comment);
  execFile('ssh-keygen', args, (err) => { ... });
  ```

---

## High Severity

### HIGH-1: Master password stored in memory as plaintext for entire session

- **Location**: `electron/main.ts:15`, line 121 (`activeMasterKey = password`), line 145
- **Description**: `activeMasterKey` holds the plaintext master password in a JavaScript string for the entire application lifetime. JavaScript strings are immutable and cannot be securely zeroed. If the process memory is dumped (crash dump, core file, swap), the master password is recoverable.
- **Fix**: Derive a key from the password immediately and discard the password. Store only the derived key in memory. Consider using `Buffer.alloc()` for the key and zero it when locking.

### HIGH-2: Exported sessions include encrypted passwords without notice

- **Location**: `electron/main.ts:339-352`
- **Description**: The `sessions:export` handler dumps all sessions as-is, including `ENC:...` encrypted passwords. While encrypted, the exported file contains all the data needed for offline brute-force against the master password. Users may not realize exports contain encrypted credentials.
- **Fix**: Strip sensitive fields (password, passphrase, proxyPassword) from exports, or warn the user and require master password confirmation before export.

### HIGH-3: Password hash comparison is not timing-safe

- **Location**: `electron/services/crypto.ts:61-67`
- **Description**: `verifyPassword` uses `===` string comparison (`hash.toString('hex') === hashHex`). This is vulnerable to timing attacks where an attacker can determine the correct hash byte-by-byte by measuring response time.
- **Fix**: Use `crypto.timingSafeEqual`:
  ```ts
  return crypto.timingSafeEqual(hash, Buffer.from(hashHex, 'hex'));
  ```

### HIGH-4: No rate limiting on master password verification

- **Location**: `electron/main.ts:141-147`
- **Description**: The `crypto:verifyMasterPassword` handler can be called unlimited times with no delay or lockout. This enables brute-force attacks against the master password from a compromised renderer process.
- **Fix**: Add exponential backoff or lockout after N failed attempts (e.g., 5 failures = 30s lockout, 10 = 5min lockout).

### HIGH-5: SQLite database file has no restricted permissions

- **Location**: `electron/services/database.ts:9-10`
- **Description**: The database file is created with default permissions (typically 0644), making it readable by any user on the system. The database contains encrypted (or plaintext if no master password) SSH credentials.
- **Fix**: Set file permissions to 0600 after creation:
  ```ts
  const dbPath = path.join(userDataPath, 'valkyrie-tun.db');
  this.db = new Database(dbPath);
  fs.chmodSync(dbPath, 0o600);
  ```

---

## Medium Severity

### MED-1: `sandbox: false` in BrowserWindow config

- **Location**: `electron/main.ts:39`
- **Description**: Setting `sandbox: false` disables Chromium's process sandboxing for the renderer. While `contextIsolation: true` and `nodeIntegration: false` are correctly set (good!), the disabled sandbox reduces defense-in-depth. If a renderer RCE vulnerability is found, the sandbox would normally limit its impact.
- **Fix**: Set `sandbox: true` if the preload script can run without Node.js APIs (it currently uses only `contextBridge` and `ipcRenderer`, which work in sandboxed mode).

### MED-2: Local PTY has no ID validation — renderer can kill arbitrary PTY processes

- **Location**: `electron/main.ts:387-432`
- **Description**: The `localPty:kill`, `localPty:write`, and `localPty:resize` handlers accept any string `id` from the renderer. While the IDs are stored in a Map and only valid IDs have effect, there's no validation that the renderer "owns" the PTY it's operating on. If multiple PTY sessions exist, one can interfere with another.
- **Fix**: Track PTY ownership or limit to a single local PTY instance.

### MED-3: SFTP readFile loads entire file into memory

- **Location**: `electron/services/sftp.ts:198-207`
- **Description**: `readFile` reads the entire remote file into memory as a string. A malicious or buggy remote server could return an extremely large file, causing an out-of-memory crash (DoS).
- **Fix**: Add a size limit check before reading:
  ```ts
  const stat = await this.stat(connId, remotePath);
  if (stat.size > 50 * 1024 * 1024) throw new Error('File too large');
  ```

### MED-4: Import handler parses untrusted JSON without schema validation

- **Location**: `electron/main.ts:353-371`
- **Description**: The `sessions:import` handler `JSON.parse`s the file and directly passes each object to `db.createSession(s)`. There's no validation of the imported data shape. Malformed or malicious JSON could inject unexpected fields into the database.
- **Fix**: Validate imported JSON against expected schema before inserting.

### MED-5: Script runner sends commands as raw text — no shell escaping

- **Location**: `electron/services/scriptRunner.ts:4-13`
- **Description**: The script runner writes each line directly to the SSH stream as terminal input. While this is by design (it simulates typing), it means any script content is executed directly. If script content comes from an untrusted source (import, shared scripts), this is arbitrary command execution on the remote host.
- **Fix**: Display a warning before running imported/shared scripts. Consider a "dry run" preview mode.

---

## Low / Informational

### LOW-1: `NODE_MODULE_VERSION` compatibility handled by manual rebuild

- **Description**: Native modules (`better-sqlite3`, `node-pty`) require `electron-rebuild` but this can fail silently if the postinstall script errors. The app then crashes at runtime.
- **Fix**: Add a startup check that catches the native module load error and shows a user-friendly dialog with rebuild instructions.

### LOW-2: Console.error logs may expose DB content in dev tools

- **Location**: `electron/main.ts:73` (safeDb catch block)
- **Description**: The `safeDb` wrapper logs the full error to console, which may include SQL query details or partial data. In production, console output should be minimized.
- **Fix**: Log only error messages, not full error objects with stack traces, in production builds.

### LOW-3: No CSP (Content Security Policy) headers

- **Description**: The renderer has no Content Security Policy configured. While `contextIsolation: true` mitigates many XSS impacts, a CSP would provide additional defense-in-depth by preventing inline script execution and restricting resource loading.
- **Fix**: Add CSP via `session.defaultSession.webRequest.onHeadersReceived`.

### LOW-4: UUID v4 used for connection IDs

- **Description**: `uuid` package has a moderate CVE (GHSA-w5hq-g745-h8pq) regarding missing buffer bounds check. The app uses `uuid.v4()` for connection IDs which doesn't use the vulnerable `buf` parameter, so impact is minimal.
- **Fix**: Update `uuid` to v14+ when convenient.

### LOW-5: No dangerouslySetInnerHTML usage — good

- **Description**: No instances of `dangerouslySetInnerHTML`, `innerHTML`, or `outerHTML` found in the renderer code. Terminal output is correctly rendered only through xterm.js which safely handles escape sequences.

### LOW-6: No credentials logged — good

- **Description**: No instances of `console.log` with password/key/secret content found.

---

## Dependency Audit

`npm audit` reports **14 vulnerabilities** (2 low, 1 moderate, 11 high):

| Package | Severity | Issue |
|---------|----------|-------|
| `tar` (via `@electron/rebuild`) | High | Path traversal |
| `make-fetch-happen` (via `@electron/rebuild`) | High | SSRF |
| `node-gyp` (via `@electron/rebuild`) | High | Transitive from tar |
| `uuid` | Moderate | Buffer bounds check (GHSA-w5hq-g745-h8pq) |
| `@tootallnate/once` | Low | Control flow scoping |

**Note**: Most high-severity issues are in `@electron/rebuild` which is a **devDependency** — it runs only during `npm install`/`npm run rebuild`, NOT at application runtime. Production attack surface is limited.

**Fix**: Run `npm audit fix --force` to update `@electron/rebuild` to v4+ and `uuid` to v14+. Test rebuild still works after updating.

---

## Recommendations

1. **Priority 1**: Fix CRIT-1 through CRIT-4 before any release — these are exploitable
2. **Priority 2**: Fix HIGH-1 through HIGH-5 — they weaken the master password feature's security guarantees
3. **Priority 3**: Enable `sandbox: true` (MED-1) for defense-in-depth
4. **Priority 4**: Add host key verification (CRIT-3) — this is table stakes for any SSH client
5. **Priority 5**: Add CSP headers (LOW-3) and schema validation for imports (MED-4)
6. **Ongoing**: Keep dependencies updated, run `npm audit` in CI

### What's Already Done Well

- `contextIsolation: true` + `nodeIntegration: false` — correct Electron security posture
- `contextBridge` used properly — no raw `ipcRenderer` exposed to renderer
- AES-256-GCM encryption with per-encryption random salt+IV — good crypto design
- PBKDF2 with 100k iterations + SHA-512 — adequate key derivation
- All SQL queries use parameterized statements (`?` placeholders) — no SQL injection
- `foreign_keys = ON` + `CASCADE` rules — good DB integrity
- No `dangerouslySetInnerHTML` or raw HTML injection in renderer
- No credentials logged to console
