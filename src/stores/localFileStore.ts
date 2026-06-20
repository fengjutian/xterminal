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

interface LocalFileState {
  currentPath: string;
  entries: SftpFileEntry[];
  treeNodes: Map<string, TreeNode>;
  loading: boolean;
  error: string | null;
  selectedEntry: SftpFileEntry | null;
  sortField: 'name' | 'size' | 'modified' | 'permissions';
  sortAsc: boolean;

  setCurrentPath: (path: string) => void;
  listFiles: (sessionId: string | null, path: string) => Promise<void>;
  toggleTreeNode: (sessionId: string | null, path: string) => Promise<void>;
  setSorting: (field: 'name' | 'size' | 'modified' | 'permissions') => void;
  clearExplorer: () => void;
  createDirectory: (path: string) => Promise<boolean>;
  deleteEntry: (path: string, isDir: boolean) => Promise<boolean>;
  renameEntry: (oldPath: string, newPath: string) => Promise<boolean>;
}

// Convert a LocalFileEntry from Rust to SftpFileEntry shape
interface LocalFileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  is_symlink: boolean;
  size: number;
  modified: string;
  permissions: string;
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

function getLocalRootPath(): string {
  // On Windows, start with drive letters; on Unix, '/'
  // For simplicity start with platform root
  if (navigator.platform.startsWith('Win')) {
    return 'C:\\';
  }
  return '/';
}

export const useLocalFileStore = create<LocalFileState>((set, get) => ({
  currentPath: getLocalRootPath(),
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

  listFiles: async (_sessionId, path) => {
    set({ loading: true, error: null });
    try {
      const raw: LocalFileEntry[] = await invoke('list_local_files', { path });
      const entries: SftpFileEntry[] = raw.map((e) => ({
        name: e.name,
        path: e.path,
        is_directory: e.is_directory,
        is_symlink: e.is_symlink,
        size: e.size,
        modified: e.modified,
        permissions: e.permissions,
        owner: null,
        group: null,
      }));
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
      } else {
        // For local FS, create tree nodes on the fly
        const normalizedPath = path.replace(/\\/g, '/');
        const parts = normalizedPath.split('/').filter(Boolean);
        let acc = '';
        for (const part of parts) {
          acc = acc ? `${acc}/${part}` : `/${part}`;
          if (!treeNodes.has(acc)) {
            treeNodes.set(acc, {
              path: acc,
              name: part,
              expanded: false,
              loaded: acc === normalizedPath,
              children: acc === normalizedPath
                ? entries.filter((e) => e.is_directory).map((e) => ({
                    path: e.path,
                    name: e.name,
                    expanded: false,
                    loaded: false,
                    children: [],
                  }))
                : [],
            });
          }
        }
        set({ treeNodes });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ error: msg, loading: false, entries: [] });
    }
  },

  toggleTreeNode: async (_sessionId, path) => {
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
        const raw: LocalFileEntry[] = await invoke('list_local_files', { path });
        node.loaded = true;
        node.children = raw
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
      currentPath: getLocalRootPath(),
      entries: [],
      treeNodes: new Map([['/', buildTreeRoot()]]),
      error: null,
      selectedEntry: null,
    });
  },

  createDirectory: async (path) => {
    try {
      await invoke('create_local_directory', { path });
      await get().listFiles(null, get().currentPath);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ error: msg });
      return false;
    }
  },

  deleteEntry: async (path, isDirectory) => {
    try {
      await invoke('delete_local_file', { path, isDirectory });
      await get().listFiles(null, get().currentPath);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ error: msg });
      return false;
    }
  },

  renameEntry: async (oldPath, newPath) => {
    try {
      await invoke('rename_local_file', { oldPath, newPath });
      await get().listFiles(null, get().currentPath);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ error: msg });
      return false;
    }
  },
}));
