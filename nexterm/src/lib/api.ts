import type { NexTermAPI } from '../../electron/preload';

declare global {
  interface Window {
    nexterm: NexTermAPI;
  }
}

export const api = typeof window !== 'undefined' ? window.nexterm : (null as unknown as NexTermAPI);
