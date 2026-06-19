import { create } from 'zustand';
import type { ConnectionConfig } from '@/types';

interface ConnectionState {
  connections: ConnectionConfig[];
  loading: boolean;
  error: string | null;

  fetchConnections: () => Promise<void>;
  createConnection: (payload: ConnectionConfig) => Promise<void>;
  updateConnection: (id: string, updates: Partial<ConnectionConfig>) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  connections: [],
  loading: false,
  error: null,

  fetchConnections: async () => {
    set({ loading: true, error: null });
    // TODO: call Tauri command list_connections
    set({ loading: false });
  },

  createConnection: async (payload) => {
    // TODO: call Tauri command create_connection
    set((s) => ({ connections: [...s.connections, payload] }));
  },

  updateConnection: async (id, updates) => {
    // TODO: call Tauri command update_connection
    set((s) => ({
      connections: s.connections.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    }));
  },

  deleteConnection: async (id) => {
    // TODO: call Tauri command delete_connection
    set((s) => ({
      connections: s.connections.filter((c) => c.id !== id),
    }));
  },
}));
