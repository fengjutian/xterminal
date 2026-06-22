import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { ConnectionConfig, CreateConnectionPayload, UpdateConnectionPayload } from "@/types";

interface ConnectionState {
  connections: ConnectionConfig[];
  loading: boolean;
  error: string | null;

  fetchConnections: () => Promise<void>;
  createConnection: (payload: CreateConnectionPayload) => Promise<ConnectionConfig>;
  updateConnection: (id: string, updates: Partial<ConnectionConfig> & { password?: string | null; passphrase?: string | null }) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  connections: [],
  loading: false,
  error: null,

  fetchConnections: async () => {
    set({ loading: true, error: null });
    try {
      const list: ConnectionConfig[] = await invoke("list_connections");
      set({ connections: list, loading: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Failed to fetch connections:", msg);
      set({ error: msg, loading: false });
    }
  },

  createConnection: async (payload) => {
    set({ loading: true, error: null });
    try {
      const created: ConnectionConfig = await invoke("create_connection", {
        payload,
      });
      set((s) => ({
        connections: [...s.connections, created],
        loading: false,
      }));
      return created;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Failed to create connection:", msg);
      set({ error: msg, loading: false });
      throw e;
    }
  },

  updateConnection: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const payload: UpdateConnectionPayload = { id, ...updates };
      const updated: ConnectionConfig = await invoke("update_connection", {
        payload,
      });
      set((s) => ({
        connections: s.connections.map((c) => (c.id === id ? updated : c)),
        loading: false,
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Failed to update connection:", msg);
      set({ error: msg, loading: false });
      throw e;
    }
  },

  deleteConnection: async (id) => {
    set({ loading: true, error: null });
    try {
      await invoke("delete_connection", { id });
      set((s) => ({
        connections: s.connections.filter((c) => c.id !== id),
        loading: false,
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Failed to delete connection:", msg);
      set({ error: msg, loading: false });
      throw e;
    }
  },
}));
