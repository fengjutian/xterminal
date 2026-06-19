import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { SftpFileEntry } from '@/types';

export interface TreeNode {
  path: string;
  name: string;
  expanded: boolean;
  loaded: boolean;
  children: TreeNode[];
}

interface FileExplorerState {
  currentPath: string;
  entries: SftpFileEntry[];
  treeNodes: Map<string, TreeNode>;
  loading: boolean;
  error: string | null;
  selectedEntry: SftpFileEntry | null;
  sortField: 'name' | 'size' | 'modified' | 'permissions';
  sortAsc: boolean;

  setCurrentPath: (path: string) => void;
  listFiles: (sessionId: string, path: string) => Promise<void>;
  toggleTreeNode: (sessionId: string, path: string) => Promise<void>;
  setSorting: (field: 'name' | 'size' | 'modified' | 'permissions') => void;
  clearExplorer: () => void;
  createDirectory: (sessionId: string, path: string) => Promise<boolean>;
  deleteEntry: (sessionId: string, path: string, isDir: boolean) => Promise<boolean>;
  renameEntry: (sessionId: string, oldPath: string, newPath: string) => Promise<boolean>;
  uploadFile: (sessionId: string, localPath: string, remotePath: string) => Promise<string | null>;
  downloadFile: (sessionId: string, remotePath: string, localPath: string) => Promise<string | null>;
}

function buildTreeRoot(): TreeNode {
  return {
    path: '/',
    name: '/',
    expanded: true,
    loaded: false,
    children: [],
  };
}

function sortEntries(entries: SftpFileEntry[], field: string, asc: boolean): SftpFileEntry[] {
  return [...entries].sort((a, b) => {
    // Directories first
    if (a.is_directory !== b.is_directory) {
      return a.is_directory ? -1 : 1;
    }
    let cmp = 0;
    switch (field) {
      case 'name':
        cmp = a.name.localeCompare(b.name);
        break;
      case 'size':
        cmp = a.size - b.size;
        break;
      case 'modified':
        cmp = a.modified.localeCompare(b.modified);
        break;
      case 'permissions':
        cmp = a.permissions.localeCompare(b.permissions);
        break;
    }
    return asc ? cmp : -cmp;
  });
}

export const useFileExplorerStore = create<FileExplorerState>((set, get) => ({
  currentPath: '/',
  entries: [],
  treeNodes: new Map([['/', buildTreeRoot()]]),
  loading: false,
  error: null,
  selectedEntry: null,
  sortField: 'name',
  sortAsc: true,

  setCurrentPath: (path) => {
    set({ currentPath: path, selectedEntry: null });
  },

  listFiles: async (sessionId, path) => {
    if (!sessionId) return;
    set({ loading: true, error: null });
    try {
      const entries: SftpFileEntry[] = await invoke('sftp_list_files', {
        sessionId,
        remotePath: path,
      });
      const { sortField, sortAsc } = get();
      const sorted = sortEntries(entries, sortField, sortAsc);
      set({ entries: sorted, loading: false, currentPath: path });

      // Update tree node as loaded
      const treeNodes = new Map(get().treeNodes);
      const node = treeNodes.get(path);
      if (node) {
        node.loaded = true;
        node.children = entries
          .filter((e) => e.is_directory)
          .map((e) => ({
            path: e.path,
            name: e.name,
            expanded: false,
            loaded: false,
            children: [],
          }));
        treeNodes.set(path, { ...node });
        set({ treeNodes });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({
        error: msg,
        loading: false,
        entries: [],
      });
    }
  },

  toggleTreeNode: async (sessionId, path) => {
    const treeNodes = new Map(get().treeNodes);
    const node = treeNodes.get(path);
    if (!node) return;

    const willExpand = !node.expanded;
    node.expanded = willExpand;
    treeNodes.set(path, { ...node });
    set({ treeNodes });

    if (willExpand && !node.loaded) {
      set({ loading: true, error: null });
      try {
        const entries: SftpFileEntry[] = await invoke('sftp_list_files', {
          sessionId,
          remotePath: path,
        });
        node.loaded = true;
        node.children = entries
          .filter((e) => e.is_directory)
          .map((e) => ({
            path: e.path,
            name: e.name,
            expanded: false,
            loaded: false,
            children: [],
          }));
        treeNodes.set(path, { ...node });
        set({ treeNodes, loading: false });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        set({ error: msg, loading: false });
        node.expanded = false;
        treeNodes.set(path, { ...node });
        set({ treeNodes });
      }
    }
  },

  setSorting: (field) => {
    const { sortField, sortAsc, entries } = get();
    const newAsc = field === sortField ? !sortAsc : true;
    const sorted = sortEntries(entries, field, newAsc);
    set({ sortField: field, sortAsc: newAsc, entries: sorted });
  },

  clearExplorer: () => {
    set({
      currentPath: '/',
      entries: [],
      treeNodes: new Map([['/', buildTreeRoot()]]),
      error: null,
      selectedEntry: null,
    });
  },

  createDirectory: async (sessionId, path) => {
    if (!sessionId) return false;
    try {
      await invoke('sftp_create_directory', { sessionId, remotePath: path });
      // Refresh current directory
      await get().listFiles(sessionId, get().currentPath);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ error: msg });
      return false;
    }
  },

  deleteEntry: async (sessionId, path, _isDir) => {
    if (!sessionId) return false;
    try {
      await invoke('sftp_delete_file', {
        sessionId,
        remotePath: path,
      });
      await get().listFiles(sessionId, get().currentPath);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ error: msg });
      return false;
    }
  },

  renameEntry: async (sessionId, oldPath, newPath) => {
    if (!sessionId) return false;
    try {
      await invoke('sftp_rename_file', { sessionId, oldPath, newPath });
      await get().listFiles(sessionId, get().currentPath);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ error: msg });
      return false;
    }
  },

  uploadFile: async (sessionId, localPath, remotePath) => {
    if (!sessionId) return null;
    try {
      const taskId: string = await invoke('sftp_upload_file', {
        sessionId,
        localPath,
        remotePath,
      });
      await get().listFiles(sessionId, get().currentPath);
      return taskId;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ error: msg });
      return null;
    }
  },

  downloadFile: async (sessionId, remotePath, localPath) => {
    if (!sessionId) return null;
    try {
      const taskId: string = await invoke('sftp_download_file', {
        sessionId,
        remotePath,
        localPath,
      });
      return taskId;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ error: msg });
      return null;
    }
  },
}));
