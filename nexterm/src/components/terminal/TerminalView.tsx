import { useState } from 'react';
import {
  Plus, X, Radio, Columns2, Rows2,
} from 'lucide-react';
import { useTerminalStore, useSessionStore, useAppStore } from '../../store';
import { TerminalPane } from './TerminalPane';

export function TerminalView() {
  const {
    tabs, activeTabId, broadcastMode,
    setActiveTab, closeTab, toggleBroadcastMode,
  } = useTerminalStore();
  const sessions = useSessionStore((s) => s.sessions);
  const setCurrentView = useAppStore((s) => s.setCurrentView);
  const [splitMode, setSplitMode] = useState<'none' | 'horizontal' | 'vertical'>('none');

  const handleNewTab = () => {
    if (sessions.length > 0) {
      setCurrentView('sessions');
    }
  };

  if (tabs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted">
        <div className="text-center">
          <p className="text-lg mb-4">No active terminal sessions</p>
          <button onClick={handleNewTab} className="btn-primary">
            <Plus size={16} className="inline mr-2" />
            Open a Session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div className="flex items-center bg-sidebar border-b border-sidebar-border">
        <div className="flex-1 flex items-center overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`tab-item group relative ${tab.id === activeTabId ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  tab.isConnected ? 'bg-success' : tab.isConnecting ? 'bg-warning animate-pulse' : 'bg-text-muted'
                }`}
              />
              <span className="max-w-[150px] truncate">{tab.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="p-0.5 rounded hover:bg-surface-overlay opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1 px-2 border-l border-sidebar-border">
          <button
            onClick={() => setSplitMode(splitMode === 'vertical' ? 'none' : 'vertical')}
            className={`p-1.5 rounded hover:bg-sidebar-hover ${splitMode === 'vertical' ? 'text-accent' : 'text-text-muted'}`}
            title="Split Vertical"
          >
            <Columns2 size={14} />
          </button>
          <button
            onClick={() => setSplitMode(splitMode === 'horizontal' ? 'none' : 'horizontal')}
            className={`p-1.5 rounded hover:bg-sidebar-hover ${splitMode === 'horizontal' ? 'text-accent' : 'text-text-muted'}`}
            title="Split Horizontal"
          >
            <Rows2 size={14} />
          </button>
          <button
            onClick={toggleBroadcastMode}
            className={`p-1.5 rounded hover:bg-sidebar-hover ${broadcastMode ? 'text-warning' : 'text-text-muted'}`}
            title={broadcastMode ? 'Disable Broadcast' : 'Enable Broadcast'}
          >
            {broadcastMode ? <Radio size={14} /> : <Radio size={14} className="opacity-50" />}
          </button>
          <button onClick={handleNewTab} className="p-1.5 rounded hover:bg-sidebar-hover text-text-muted" title="New Tab">
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Terminal area — all tabs always mounted, visibility controlled via CSS */}
      <div className="flex-1 overflow-hidden bg-[#1a1d23] relative">
        {tabs.map((tab) => {
          const isActiveTab = tab.id === activeTabId;
          const secondTabId = tabs.find((t) => t.id !== activeTabId)?.id;
          const isSecondInSplit = splitMode !== 'none' && tab.id === secondTabId;
          const isVisible = isActiveTab || isSecondInSplit;

          let style: React.CSSProperties = { display: 'none' };

          if (isVisible) {
            if (splitMode === 'none') {
              style = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' };
            } else if (splitMode === 'vertical') {
              style = {
                position: 'absolute',
                top: 0,
                bottom: 0,
                width: 'calc(50% - 1px)',
                ...(isActiveTab ? { left: 0 } : { right: 0 }),
              };
            } else {
              style = {
                position: 'absolute',
                left: 0,
                right: 0,
                height: 'calc(50% - 1px)',
                ...(isActiveTab ? { top: 0 } : { bottom: 0 }),
              };
            }
          }

          return (
            <div key={tab.id} style={style}>
              <TerminalPane tabId={tab.id} isActive={isActiveTab && isVisible} />
            </div>
          );
        })}
        {splitMode !== 'none' && (
          <div
            className={`absolute bg-sidebar-border z-10 ${
              splitMode === 'vertical'
                ? 'top-0 bottom-0 left-1/2 w-px'
                : 'left-0 right-0 top-1/2 h-px'
            }`}
          />
        )}
        {splitMode !== 'none' && tabs.length < 2 && (
          <div
            className="absolute flex items-center justify-center text-text-muted text-sm"
            style={splitMode === 'vertical'
              ? { top: 0, bottom: 0, right: 0, width: 'calc(50% - 1px)' }
              : { left: 0, right: 0, bottom: 0, height: 'calc(50% - 1px)' }
            }
          >
            Open another session to use split view
          </div>
        )}
      </div>
    </div>
  );
}
