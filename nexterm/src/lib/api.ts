import type { NexTermAPI } from '../../electron/preload';

declare global {
  interface Window {
    valkyrieTUN: NexTermAPI;
  }
}

export const api = typeof window !== 'undefined' ? window.valkyrieTUN : (null as unknown as NexTermAPI);
