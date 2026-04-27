# valkyrieTUN — Modern SSH Client for Linux

<p align="center">
  <strong>A production-ready SSH client with terminal emulation, SFTP file management, key management, scripting, and port forwarding.</strong>
</p>

<p align="center">
  No cloud sync · No telemetry · Fully offline · All data stays local
</p>

---

## Features

### Terminal
- Full **xterm.js** terminal emulator with true color, Unicode 11, and ligature support
- **Split panes** — horizontal and vertical within a single tab
- **Multiple tabs** — each independently scrollable
- **Broadcast mode** — send input to all connected terminals at once
- **In-terminal search** (Ctrl+F)
- Configurable font, size, cursor style, scrollback buffer
- Connection keepalive and auto-reconnect

### Session Management
- Create, edit, delete, and organize SSH hosts into **groups/folders**
- Store hostname, port, username, auth method (password / key / agent), jump host, labels, notes, color tags
- **Quick-connect** search bar (fuzzy search)
- Recent sessions on the home screen
- **Import/export** sessions (JSON)
- Duplicate sessions, bulk group actions

### SFTP File Manager
- **Dual-pane** file manager: local filesystem ↔ remote server
- Upload/download with progress tracking
- Transfer queue with status indicators
- **Right-click context menu**: rename, delete, chmod, mkdir, edit, download
- **Inline text editor** with syntax highlighting for remote files
- Path breadcrumb navigation

### Key & Credentials Manager
- Generate **RSA / ED25519 / ECDSA** keys in-app with passphrase
- Import existing keys; auto-detect from `~/.ssh/`
- View public keys, fingerprints; copy to clipboard
- Per-host key assignment

### Scripts & Automation
- Script library with named snippets, descriptions, and tags
- **`{{VARIABLE}}`** syntax with prompt-on-run
- Run scripts on connected terminals
- Post-login hook per host

### Port Forwarding & Tunnels
- **Local**, **Remote**, and **Dynamic (SOCKS5)** forwarding
- Visual tunnel status (active/inactive)
- One-click start/stop
- Auto-start on session connect

### Settings
- **Dark / Light** theme with accent color picker
- Terminal font family, size, cursor style, scrollback
- Master password for credential encryption
- Full keyboard navigation

---

## Tech Stack

| Layer      | Technology                                                            |
| ---------- | --------------------------------------------------------------------- |
| Frontend   | React 18 + TypeScript + TailwindCSS                                  |
| Terminal   | xterm.js (fit, search, web-links, unicode11 addons)                  |
| SSH        | ssh2 (Node.js)                                                       |
| SFTP       | ssh2 SFTP subsystem                                                  |
| Database   | better-sqlite3                                                       |
| State      | Zustand                                                              |
| Icons      | Lucide React                                                         |
| Build      | Vite + vite-plugin-electron + electron-builder                       |
| Targets    | `.deb`, `.rpm`, `.AppImage`, `.tar.gz` (x64 + arm64)                |

---

## Build Instructions

### Prerequisites

- **Node.js** ≥ 18 (LTS recommended)
- **npm** ≥ 9
- **Python 3** (for native module compilation)
- **GCC / G++**, **make** (build tools)

### Arch Linux / CachyOS

```bash
# Install dependencies
sudo pacman -S nodejs npm python gcc make

# Clone and build
git clone https://github.com/Villions1/vill.git
cd vill/nexterm
npm install
npm run build:linux
```

Built packages will be in `release/`.

### Debian / Ubuntu

```bash
# Install dependencies
sudo apt update
sudo apt install -y nodejs npm python3 build-essential

# Use Node.js 18+ (if distro version is older)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Clone and build
git clone https://github.com/Villions1/vill.git
cd vill/nexterm
npm install
npm run build:linux
```

### Fedora

```bash
# Install dependencies
sudo dnf install -y nodejs npm python3 gcc-c++ make

# Clone and build
git clone https://github.com/Villions1/vill.git
cd vill/nexterm
npm install
npm run build:linux
```

### Development

```bash
# Start dev server with hot reload
npm run dev

# If you see "NODE_MODULE_VERSION" mismatch error, rebuild native modules:
npm run rebuild

# Type check
npm run typecheck

# Lint
npm run lint
```

> **Note**: `npm install` automatically rebuilds `better-sqlite3` for Electron via the `postinstall` script. If you still see a `NODE_MODULE_VERSION` error, run `npm run rebuild` manually.

### Install Built Packages

```bash
# Debian/Ubuntu (.deb)
sudo dpkg -i release/valkyrie-tun_1.0.0_amd64.deb

# Fedora (.rpm)
sudo rpm -i release/valkyrie-tun-1.0.0.x86_64.rpm

# AppImage (any distro)
chmod +x release/valkyrieTUN-1.0.0.AppImage
./release/valkyrieTUN-1.0.0.AppImage

# tar.gz
tar xzf release/valkyrie-tun-1.0.0.tar.gz
cd valkyrie-tun-1.0.0
./valkyrie-tun
```

---

## Project Structure

```
nexterm/
├── electron/                 # Electron main process
│   ├── main.ts              # App entry, IPC handlers, window creation
│   ├── preload.ts           # Context bridge API
│   └── services/
│       ├── ssh.ts           # SSH connection management (ssh2)
│       ├── sftp.ts          # SFTP operations
│       ├── database.ts      # SQLite database (better-sqlite3)
│       ├── keyManager.ts    # SSH key generation & management
│       ├── tunnelManager.ts # Port forwarding (local/remote/dynamic)
│       └── scriptRunner.ts  # Script execution
├── src/                     # React renderer
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css            # TailwindCSS + custom styles
│   ├── components/
│   │   ├── layout/          # Sidebar, TitleBar
│   │   ├── sessions/        # HomeView, SessionList, SessionEditor
│   │   ├── terminal/        # TerminalView, TerminalPane
│   │   ├── sftp/            # FileManagerView (dual-pane)
│   │   ├── keys/            # KeyManagerView
│   │   ├── scripts/         # ScriptLibraryView
│   │   ├── tunnels/         # TunnelManagerView
│   │   └── settings/        # SettingsView (theme, terminal, security)
│   ├── store/               # Zustand stores
│   ├── types/               # TypeScript types
│   └── lib/                 # API bridge
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── electron-builder.yml     # Build targets config
└── README.md
```

---

## Design Language

Inspired by **Termius**:

- Dark sidebar (`#1a1d23`) with icon + label navigation
- Accent color for active state (default `#4A90D9`)
- Tab bar for open sessions
- Clean monospace terminal area
- Smooth transitions on panel resize
- Dark and light themes from settings

---

## Data Storage

All data is stored **locally** in an SQLite database at:

```
~/.config/valkyrie-tun/valkyrie-tun.db
```

Tables: `sessions`, `groups`, `keys`, `scripts`, `tunnels`, `settings`.

No data is ever sent to any server.

---

## Keyboard Shortcuts

| Shortcut        | Action                |
| --------------- | --------------------- |
| `Ctrl+F`        | Terminal search        |
| `Ctrl+T`        | New tab (planned)      |
| `Ctrl+W`        | Close tab (planned)    |
| `Ctrl+Shift+V`  | Split vertical         |
| `Ctrl+Shift+H`  | Split horizontal       |
| `Ctrl+Shift+B`  | Toggle broadcast mode  |

---

## License

MIT
