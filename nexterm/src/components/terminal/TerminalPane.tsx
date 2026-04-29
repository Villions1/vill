import { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { Search, X, AlertCircle, Loader2 } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import { useTerminalStore, useSessionStore, useSettingsStore, useAppStore } from '../../store';
import { api } from '../../lib/api';

interface TerminalPaneProps {
  tabId: string;
  isActive?: boolean;
}

export function TerminalPane({ tabId, isActive }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const tab = useTerminalStore((s) => s.tabs.find((t) => t.id === tabId));
  const updateTab = useTerminalStore((s) => s.updateTab);
  const sessions = useSessionStore((s) => s.sessions);
  const settings = useSettingsStore((s) => s.settings);

  const currentView = useAppStore((s) => s.currentView);
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const connectInitiatedRef = useRef(false);

  const initTerminal = useCallback(() => {
    if (!containerRef.current || terminalRef.current) return;

    const term = new Terminal({
      allowProposedApi: true,
      fontFamily: settings.fontFamily || "'JetBrainsMono Nerd Font', 'JetBrains Mono', 'Fira Code', monospace",
      fontSize: parseInt(settings.fontSize) || 14,
      cursorStyle: (settings.cursorStyle as 'block' | 'underline' | 'bar') || 'block',
      cursorBlink: true,
      scrollback: parseInt(settings.scrollbackLines) || 5000,
      theme: {
        background: '#1a1d23',
        foreground: '#e4e6ea',
        cursor: '#e4e6ea',
        cursorAccent: '#1a1d23',
        selectionBackground: '#4A90D940',
        black: '#1a1d23',
        red: '#e5534b',
        green: '#57ab5a',
        yellow: '#c69026',
        blue: '#4A90D9',
        magenta: '#986ee2',
        cyan: '#39c5cf',
        white: '#e4e6ea',
        brightBlack: '#636e7b',
        brightRed: '#e5534b',
        brightGreen: '#57ab5a',
        brightYellow: '#c69026',
        brightBlue: '#4A90D9',
        brightMagenta: '#986ee2',
        brightCyan: '#39c5cf',
        brightWhite: '#ffffff',
      },
      allowTransparency: false,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon();
    const unicode11Addon = new Unicode11Addon();

    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(unicode11Addon);
    term.unicode.activeVersion = '11';

    term.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch {
        // ignore resize errors
      }
    });
    resizeObserver.observe(containerRef.current);

    term.attachCustomKeyEventHandler((event) => {
      if (event.ctrlKey && event.key === 'f' && event.type === 'keydown') {
        setShowSearch(true);
        return false;
      }
      return true;
    });

    return () => {
      resizeObserver.disconnect();
      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      searchAddonRef.current = null;
    };
  }, [settings.fontFamily, settings.fontSize, settings.cursorStyle, settings.scrollbackLines]);

  // Initialize terminal
  useEffect(() => {
    const cleanup = initTerminal();
    return () => cleanup?.();
  }, [initTerminal]);

  // Re-fit terminal when switching back to terminal view or when tab becomes active
  useEffect(() => {
    if (currentView === 'terminal' && fitAddonRef.current && terminalRef.current) {
      const term = terminalRef.current;
      const fit = fitAddonRef.current;
      // Delay to allow CSS layout to settle after visibility change
      const timer = setTimeout(() => {
        try {
          fit.fit();
          // Sync remote PTY size after re-fit
          const currentTab = useTerminalStore.getState().tabs.find((t) => t.id === tabId);
          if (currentTab?.connectionId) {
            api.ssh.resize(currentTab.connectionId, term.cols, term.rows);
          }
          if (isActive !== false) term.focus();
        } catch {
          // ignore fit errors during transition
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [currentView, isActive, tabId]);

  // Connect to SSH
  useEffect(() => {
    if (!tab || !terminalRef.current || tab.isConnected || tab.isConnecting) return;
    if (connectInitiatedRef.current) return;
    connectInitiatedRef.current = true;

    const term = terminalRef.current;
    const session = sessions.find((s) => s.id === tab.sessionId);

    const quickData = window.sessionStorage.getItem(`quick-connect-${tabId}`);
    const sessionData = quickData
      ? JSON.parse(quickData)
      : session
        ? {
            host: session.host,
            port: session.port,
            username: session.username,
            authMethod: session.authMethod,
            password: session.password,
            privateKeyPath: session.privateKeyPath,
            passphrase: session.passphrase,
            keepaliveInterval: session.keepaliveInterval,
            keepaliveCountMax: session.keepaliveCountMax,
          }
        : null;

    if (!sessionData) {
      term.writeln('\r\n\x1b[31mSession not found\x1b[0m');
      connectInitiatedRef.current = false;
      return;
    }

    if (quickData) window.sessionStorage.removeItem(`quick-connect-${tabId}`);

    term.writeln(`\x1b[90mConnecting to ${sessionData.username}@${sessionData.host}:${sessionData.port}...\x1b[0m\r\n`);

    const doConnect = async () => {
      try {
        // Connect SSH — main process buffers data until we call ssh:ready
        const connId = await api.ssh.connect(tab.sessionId, sessionData);
        if (!connId) return;

        // Safety: verify terminal ref is still the same instance after async
        if (terminalRef.current !== term) {
          api.ssh.disconnect(connId as string);
          updateTab(tabId, { isConnecting: false });
          connectInitiatedRef.current = false;
          return;
        }

        // Update tab state with connectionId
        updateTab(tabId, { connectionId: connId as string, isConnected: true, isConnecting: false });

        // Register listeners BEFORE telling main process to flush buffer
        const removeData = api.ssh.onData(connId as string, (data: string) => {
          term.write(data);
        });

        const removeClose = api.ssh.onClose(connId as string, () => {
          term.writeln('\r\n\x1b[31mConnection closed\x1b[0m');
          updateTab(tabId, { isConnected: false, connectionId: undefined });
        });

        // Handle terminal input
        const onDataDisposable = term.onData((data: string) => {
          const currentTab = useTerminalStore.getState().tabs.find((t) => t.id === tabId);
          if (currentTab?.connectionId) {
            api.ssh.write(currentTab.connectionId, data);

            if (useTerminalStore.getState().broadcastMode) {
              const otherTabs = useTerminalStore.getState().tabs.filter(
                (t) => t.id !== tabId && t.isConnected && t.connectionId
              );
              for (const other of otherTabs) {
                api.ssh.write(other.connectionId!, data);
              }
            }
          }
        });

        const onResizeDisposable = term.onResize(({ cols, rows }) => {
          const currentTab = useTerminalStore.getState().tabs.find((t) => t.id === tabId);
          if (currentTab?.connectionId) {
            api.ssh.resize(currentTab.connectionId, cols, rows);
          }
        });

        // Send initial resize
        if (fitAddonRef.current) {
          fitAddonRef.current.fit();
          api.ssh.resize(connId as string, term.cols, term.rows);
        }

        // Focus terminal so keyboard input works
        term.focus();

        // NOW tell main process to flush buffered data and start direct forwarding
        await api.ssh.ready(connId as string);

        // Auto-setup Oh My Zsh if enabled in settings
        const currentSettings = useSettingsStore.getState().settings;
        if (currentSettings.autoSetupZsh === 'true') {
          setTimeout(() => {
            const currentTab = useTerminalStore.getState().tabs.find((t) => t.id === tabId);
            if (currentTab?.connectionId) {
              const setupScript = [
                '# valkyrieTUN: Auto-setup Oh My Zsh',
                'if ! command -v zsh >/dev/null 2>&1; then',
                '  if command -v apt-get >/dev/null 2>&1; then apt-get install -y zsh >/dev/null 2>&1;',
                '  elif command -v yum >/dev/null 2>&1; then yum install -y zsh >/dev/null 2>&1;',
                '  elif command -v pacman >/dev/null 2>&1; then pacman -S --noconfirm zsh >/dev/null 2>&1;',
                '  fi',
                'fi',
                'if [ ! -d "$HOME/.oh-my-zsh" ] && command -v zsh >/dev/null 2>&1; then',
                '  RUNZSH=no CHSH=no sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" >/dev/null 2>&1',
                '  git clone --depth=1 https://github.com/romkatv/powerlevel10k.git ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k >/dev/null 2>&1',
                '  git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/plugins/zsh-autosuggestions >/dev/null 2>&1',
                '  git clone https://github.com/zsh-users/zsh-syntax-highlighting ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting >/dev/null 2>&1',
                '  sed -i \'s/ZSH_THEME="robbyrussell"/ZSH_THEME="powerlevel10k\\/powerlevel10k"/\' $HOME/.zshrc',
                '  sed -i \'s/plugins=(git)/plugins=(git zsh-autosuggestions zsh-syntax-highlighting)/\' $HOME/.zshrc',
                'fi',
                'if command -v zsh >/dev/null 2>&1 && [ -d "$HOME/.oh-my-zsh" ]; then exec zsh; fi',
              ].join('\n');
              api.ssh.write(currentTab.connectionId, setupScript + '\n');
            }
          }, 500);
        }

        // Run post-login script if set
        if (session?.postLoginScript) {
          setTimeout(() => {
            const currentTab = useTerminalStore.getState().tabs.find((t) => t.id === tabId);
            if (currentTab?.connectionId) {
              api.scripts.run(currentTab.connectionId, session.postLoginScript!);
            }
          }, 1500);
        }

        cleanupRef.current = () => {
          removeData();
          removeClose();
          onDataDisposable.dispose();
          onResizeDisposable.dispose();
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Connection failed';
        term.writeln(`\r\n\x1b[31mError: ${message}\x1b[0m`);
        setError(message);
        updateTab(tabId, { isConnecting: false });
      }
    };

    updateTab(tabId, { isConnecting: true });
    doConnect();

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [tab?.sessionId, tabId]);

  const handleSearch = (direction: 'next' | 'prev') => {
    if (!searchAddonRef.current || !searchText) return;
    if (direction === 'next') searchAddonRef.current.findNext(searchText);
    else searchAddonRef.current.findPrevious(searchText);
  };

  if (!tab) return null;

  return (
    <div className="h-full flex flex-col relative">
      {/* Search bar */}
      {showSearch && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2 bg-surface-overlay border border-sidebar-border rounded-lg px-3 py-2 shadow-lg">
          <Search size={14} className="text-text-muted" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch(e.shiftKey ? 'prev' : 'next');
              if (e.key === 'Escape') setShowSearch(false);
            }}
            placeholder="Search..."
            className="bg-transparent text-text-primary text-sm outline-none w-48"
            autoFocus
          />
          <button onClick={() => handleSearch('prev')} className="p-1 hover:bg-sidebar-hover rounded text-text-secondary text-xs">
            Prev
          </button>
          <button onClick={() => handleSearch('next')} className="p-1 hover:bg-sidebar-hover rounded text-text-secondary text-xs">
            Next
          </button>
          <button onClick={() => setShowSearch(false)} className="p-1 hover:bg-sidebar-hover rounded">
            <X size={14} className="text-text-muted" />
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2 bg-danger/10 border-b border-danger/30">
          <AlertCircle size={14} className="text-danger" />
          <span className="text-sm text-danger">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X size={14} className="text-danger" />
          </button>
        </div>
      )}

      {/* Connecting indicator */}
      {tab.isConnecting && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-surface-overlay border border-sidebar-border rounded-lg px-4 py-2 shadow-lg">
          <Loader2 size={14} className="text-accent animate-spin" />
          <span className="text-sm text-text-secondary">Connecting...</span>
        </div>
      )}

      {/* Terminal container */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-hidden"
        onClick={() => terminalRef.current?.focus()}
      />
    </div>
  );
}
