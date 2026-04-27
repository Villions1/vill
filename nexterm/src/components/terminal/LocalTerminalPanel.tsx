import { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { X, GripVertical, TerminalSquare } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import { useSettingsStore } from '../../store';
import { useI18n } from '../../i18n/useI18n';

const api = (window as unknown as Record<string, unknown>).valkyrieTUN as Record<string, unknown>;
const localPtyApi = api.localPty as {
  spawn: (id: string, cols: number, rows: number) => Promise<boolean>;
  write: (id: string, data: string) => void;
  resize: (id: string, cols: number, rows: number) => void;
  kill: (id: string) => void;
  onData: (id: string, cb: (data: string) => void) => () => void;
  onExit: (id: string, cb: () => void) => () => void;
};

interface LocalTerminalPanelProps {
  onClose: () => void;
  width: number;
  onWidthChange: (width: number) => void;
}

export function LocalTerminalPanel({ onClose, width, onWidthChange }: LocalTerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const settings = useSettingsStore((s) => s.settings);
  const ptyIdRef = useRef(`local-${Date.now()}`);
  const cleanupRef = useRef<(() => void) | null>(null);
  const isDraggingRef = useRef(false);
  const { t } = useI18n();

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
        blue: '#539bf5',
        magenta: '#986ee2',
        cyan: '#39c5cf',
        white: '#e4e6ea',
        brightBlack: '#636e7b',
        brightRed: '#ff6b61',
        brightGreen: '#6bc46d',
        brightYellow: '#daaa3f',
        brightBlue: '#6cb6ff',
        brightMagenta: '#b083f0',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f3f6',
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const unicode11Addon = new Unicode11Addon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(unicode11Addon);
    term.unicode.activeVersion = '11';

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    term.open(containerRef.current);

    requestAnimationFrame(() => {
      fitAddon.fit();
      const ptyId = ptyIdRef.current;
      const cols = term.cols;
      const rows = term.rows;

      localPtyApi.spawn(ptyId, cols, rows);

      const removeData = localPtyApi.onData(ptyId, (data: string) => {
        if (terminalRef.current) {
          terminalRef.current.write(data);
        }
      });

      const removeExit = localPtyApi.onExit(ptyId, () => {
        if (terminalRef.current) {
          terminalRef.current.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n');
        }
      });

      term.onData((data: string) => {
        localPtyApi.write(ptyId, data);
      });

      term.onResize(({ cols, rows }) => {
        localPtyApi.resize(ptyId, cols, rows);
      });

      cleanupRef.current = () => {
        removeData();
        removeExit();
        localPtyApi.kill(ptyId);
      };
    });
  }, [settings]);

  useEffect(() => {
    initTerminal();

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      if (terminalRef.current) {
        terminalRef.current.dispose();
        terminalRef.current = null;
      }
    };
  }, [initTerminal]);

  // Fit terminal when width changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (fitAddonRef.current && terminalRef.current) {
        fitAddonRef.current.fit();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [width]);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (fitAddonRef.current && terminalRef.current) {
        try { fitAddonRef.current.fit(); } catch {}
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Drag to resize
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = startX - e.clientX;
      const newWidth = Math.max(300, Math.min(window.innerWidth * 0.7, startWidth + delta));
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [width, onWidthChange]);

  return (
    <div
      className="h-full flex flex-col bg-[#1a1d23] border-l border-sidebar-border relative"
      style={{ width }}
    >
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-accent/30 transition-colors z-10 flex items-center"
        onMouseDown={handleDragStart}
      >
        <GripVertical size={12} className="text-text-muted -ml-1 opacity-0 hover:opacity-100" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-sidebar border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <TerminalSquare size={14} />
          <span>{t('localTerminal.title')}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-surface-overlay rounded text-text-muted hover:text-text-primary"
          title={t('localTerminal.close')}
        >
          <X size={14} />
        </button>
      </div>

      {/* Terminal */}
      <div ref={containerRef} className="flex-1 p-1 overflow-hidden" />
    </div>
  );
}
