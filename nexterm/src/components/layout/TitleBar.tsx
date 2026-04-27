import { useState, useEffect } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';
import { api } from '../../lib/api';

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const checkMax = async () => {
      const max = await api.window.isMaximized();
      setIsMaximized(max as boolean);
    };
    checkMax();
    const interval = setInterval(checkMax, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="titlebar flex items-center justify-between h-9 bg-sidebar px-3 border-b border-sidebar-border select-none">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 titlebar-nodrag">
          <div className="w-3 h-3 rounded-full bg-danger/80" />
          <div className="w-3 h-3 rounded-full bg-warning/80" />
          <div className="w-3 h-3 rounded-full bg-success/80" />
        </div>
        <span className="text-xs text-text-muted ml-2 font-medium">valkyrieTUN</span>
      </div>
      <div className="flex items-center titlebar-nodrag">
        <button
          onClick={() => api.window.minimize()}
          className="p-1.5 hover:bg-sidebar-hover rounded transition-colors"
        >
          <Minus size={14} className="text-text-secondary" />
        </button>
        <button
          onClick={() => {
            api.window.maximize();
            setIsMaximized(!isMaximized);
          }}
          className="p-1.5 hover:bg-sidebar-hover rounded transition-colors"
        >
          {isMaximized ? (
            <Copy size={12} className="text-text-secondary" />
          ) : (
            <Square size={12} className="text-text-secondary" />
          )}
        </button>
        <button
          onClick={() => api.window.close()}
          className="p-1.5 hover:bg-danger/20 rounded transition-colors"
        >
          <X size={14} className="text-text-secondary hover:text-danger" />
        </button>
      </div>
    </div>
  );
}
