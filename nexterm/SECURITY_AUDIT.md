# valkyrieTUN — Security Audit

## Audit Scope
Full codebase review of the Electron main process, preload bridge, and React renderer.

---

## Positive Findings

1. **Context isolation enabled** (`contextIsolation: true`) — renderer cannot access Node.js APIs directly.
2. **Node integration disabled** (`nodeIntegration: false`) — standard Electron security best practice.
3. **IPC-only communication** — all main ↔ renderer communication goes through a typed context bridge, preventing direct access to sensitive APIs.
4. **No remote code execution** — no `eval()`, no remote module, no dynamic `require()` in renderer.
5. **SQLite WAL mode** — database uses `journal_mode = WAL` and `foreign_keys = ON` for integrity.
6. **Parameterized queries** — all SQL uses bound parameters (`@param`), preventing SQL injection.
7. **No telemetry or cloud sync** — all data stays local.
8. **SSH keys read-only on disk** — keys are read from `~/.ssh/`, not embedded in the database.

---

## Issues Found

### HIGH — Passwords stored in plaintext in SQLite

**Location**: `electron/services/database.ts` — `sessions` table  
**Risk**: Anyone with file-system access can read SSH passwords from `~/.config/valkyrie-tun/valkyrie-tun.db`.  
**Recommendation**: Encrypt passwords at rest using the master password feature (already in settings). Derive an encryption key via PBKDF2/Argon2 from the master password and use AES-256-GCM to encrypt `password`, `passphrase` fields before storing. Decrypt on connect.

### MEDIUM — `sandbox: false` in webPreferences

**Location**: `electron/main.ts:34`  
**Risk**: Disabling the sandbox gives the preload script more access than needed. A compromised renderer page (e.g., via a malicious link in the terminal) could leverage this.  
**Recommendation**: Set `sandbox: true`. The preload already uses `contextBridge`, so this should work without changes. Test with sandbox enabled.

### MEDIUM — `fs:listLocal` has no path validation

**Location**: `electron/main.ts:184`  
**Risk**: The renderer can list any directory on the filesystem by passing an arbitrary path. While the preload limits what the renderer can call, a bug in the renderer could be exploited.  
**Recommendation**: Restrict to user's home directory or allow-listed paths. Add path normalization and validation.

### MEDIUM — `shell:openExternal` not restricted

**Location**: `electron/main.ts:275`  
**Risk**: `shell.openExternal(url)` can open arbitrary URLs and protocol handlers. A malicious link in terminal output could trigger unexpected behavior.  
**Recommendation**: Validate the URL scheme — only allow `http://`, `https://`, `ssh://`. Reject `file://`, `javascript:`, and other dangerous protocols.

### LOW — Import JSON not validated

**Location**: `electron/main.ts:252`  
**Risk**: `JSON.parse(raw)` on imported session files does not validate the schema. Malformed import files could inject unexpected fields into the database.  
**Recommendation**: Validate imported JSON against a schema (e.g., check required fields exist and are of the correct type) before inserting.

### LOW — No CSP (Content Security Policy)

**Risk**: No CSP headers are set on the Electron window. In production builds, this allows inline scripts and styles.  
**Recommendation**: Add a strict CSP via `session.defaultSession.webRequest.onHeadersReceived` that restricts `script-src` and `style-src`.

### LOW — `readyTimeout` is hardcoded at 20 seconds

**Location**: `electron/services/ssh.ts:42`  
**Risk**: Not a direct vulnerability, but a timeout of 20s could be a problem for slow connections. More importantly, there's no retry or backoff logic.  
**Recommendation**: Make `readyTimeout` configurable per session.

### INFO — No rate limiting on IPC calls

**Risk**: A renderer bug could spam IPC handlers (e.g., `ssh:write`) causing memory/CPU issues.  
**Recommendation**: Consider basic rate limiting or batching for high-frequency IPC channels.

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| HIGH     | 1     | Plaintext passwords (encrypt at rest) |
| MEDIUM   | 3     | Sandbox, fs access, openExternal |
| LOW      | 3     | JSON import, CSP, timeout |
| INFO     | 1     | IPC rate limiting |

The application follows Electron security best practices (context isolation, no node integration, typed IPC bridge). The most critical issue is plaintext password storage — this should be addressed by encrypting credentials using the master password before storing in SQLite.
