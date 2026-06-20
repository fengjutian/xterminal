import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  VscFolderOpened,
  VscFolder,
  VscFile,
  VscSymbolMisc,
  VscChevronRight,
  VscChevronDown,
  VscNewFolder,
  VscRefresh,
  VscArrowUp,
  VscCloudUpload,
  VscCloudDownload,
  VscEdit,
  VscTrash,
  VscHome,
  VscWarning,
  VscCheck,
  VscClose,
  VscServer,
  VscVm,
} from 'react-icons/vsc';
import { useFileExplorerStore } from '../stores/fileExplorerStore';
import type { TreeNode } from '../stores/fileExplorerStore';
import { useLocalFileStore } from '../stores/localFileStore';
import { useTerminalStore } from '../stores/terminalStore';
import type { SftpFileEntry } from '../types';

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes === 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(iso: string): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function getFileIcon(entry: SftpFileEntry) {
  if (entry.is_symlink) return <VscSymbolMisc size={14} color="var(--warning)" />;
  if (entry.is_directory) return <VscFolder size={14} color="var(--accent)" />;
  return <VscFile size={14} color="var(--text-secondary)" />;
}

function clampMenuPos(x: number, y: number, menuW: number, menuH: number) {
  const clampedX = Math.min(x, window.innerWidth - menuW - 8);
  const clampedY = Math.min(y, window.innerHeight - menuH - 8);
  return { x: Math.max(8, clampedX), y: Math.max(8, clampedY) };
}

// ─── Sub-components ────────────────────────────────────────────────────────

const Breadcrumb = memo(function Breadcrumb({
  path,
  onNavigate,
}: {
  path: string;
  onNavigate: (p: string) => void;
}) {
  const parts = path === '/' || path === '' ? [''] : path.replace(/\\/g, '/').split('/').filter(Boolean);
  return (
    <div className="file-breadcrumb">
      <button
        className="breadcrumb-item"
        onClick={() => onNavigate('/')}
        title="Root"
      >
        <VscHome size={14} />
      </button>
      {parts.map((part, i) => {
        const fullPath =
          i === 0 ? `/${part}` : `/${parts.slice(0, i + 1).join('/')}`;
        return (
          <span key={fullPath} className="breadcrumb-segment">
            <span className="breadcrumb-sep">/</span>
            <button
              className="breadcrumb-item"
              onClick={() => onNavigate(fullPath)}
            >
              {part || '/'}
            </button>
          </span>
        );
      })}
    </div>
  );
});

const FileRow = memo(function FileRow({
  entry,
  onDoubleClick,
  onContextMenu,
  isRenaming,
  renameValue,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
}: {
  entry: SftpFileEntry;
  onDoubleClick: (entry: SftpFileEntry) => void;
  onContextMenu: (e: React.MouseEvent, entry: SftpFileEntry) => void;
  isRenaming: boolean;
  renameValue: string;
  onRenameChange: (v: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
}) {
  return (
    <div
      className="file-row"
      onDoubleClick={() => onDoubleClick(entry)}
      onContextMenu={(e) => onContextMenu(e, entry)}
    >
      <span className="file-icon">{getFileIcon(entry)}</span>
      {isRenaming ? (
        <span className="file-name" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            className="file-rename-input"
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRenameSubmit();
              if (e.key === 'Escape') onRenameCancel();
            }}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
          <button className="toolbar-btn" onClick={onRenameSubmit} title="Confirm">
            <VscCheck size={14} />
          </button>
          <button className="toolbar-btn" onClick={onRenameCancel} title="Cancel">
            <VscClose size={14} />
          </button>
        </span>
      ) : (
        <span className="file-name">{entry.name}</span>
      )}
      <span className="file-size" style={{ width: 100 }}>
        {entry.is_directory ? '-' : formatSize(entry.size)}
      </span>
      <span className="file-date" style={{ width: 150 }}>
        {formatDate(entry.modified)}
      </span>
      <span className="file-perms" style={{ width: 100 }}>
        {entry.permissions}
      </span>
    </div>
  );
});

const FileListHeader = memo(function FileListHeader({
  sortField,
  sortAsc,
  onSort,
}: {
  sortField: string;
  sortAsc: boolean;
  onSort: (field: 'name' | 'size' | 'modified' | 'permissions') => void;
}) {
  const columns: { field: 'name' | 'size' | 'modified' | 'permissions'; label: string; width: string }[] = [
    { field: 'name', label: 'Name', width: '1fr' },
    { field: 'size', label: 'Size', width: '100px' },
    { field: 'modified', label: 'Modified', width: '150px' },
    { field: 'permissions', label: 'Perms', width: '100px' },
  ];

  return (
    <div className="file-list-header">
      {columns.map((col) => (
        <button
          key={col.field}
          className={`file-col-header ${sortField === col.field ? 'sorted' : ''}`}
          style={{ width: col.width }}
          onClick={() => onSort(col.field)}
        >
          {col.label}
          {sortField === col.field && (
            <span className="sort-indicator">{sortAsc ? ' ^' : ' v'}</span>
          )}
        </button>
      ))}
    </div>
  );
});

function FileContextMenu({
  x,
  y,
  entry,
  mode,
  sessionId,
  onClose,
  onRefresh,
  onStartRename,
}: {
  x: number;
  y: number;
  entry: SftpFileEntry;
  mode: 'local' | 'remote';
  sessionId: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onStartRename: (entry: SftpFileEntry) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  const remoteStore = useFileExplorerStore;
  const localStore = useLocalFileStore;

  const currentPath = mode === 'remote'
    ? remoteStore((s) => s.currentPath)
    : localStore((s) => s.currentPath);

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      setPos(clampMenuPos(x, y, rect.width, rect.height));
    }
  }, [x, y]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleAction = useCallback(
    async (fn: () => Promise<void>) => {
      await fn();
      onClose();
    },
    [onClose]
  );

  const items: { icon?: React.ReactNode; label: string; danger?: boolean; action: (() => Promise<void>) | null }[] = [];

  if (entry.is_directory) {
    items.push({
      icon: <VscNewFolder size={14} />,
      label: 'New Folder...',
      action: async () => {
        onClose();
        const name = prompt('Folder name:');
        if (name) {
          const newPath = currentPath === '/' || currentPath === ''
            ? `/${name}`
            : `${currentPath}/${name}`;
          if (mode === 'remote' && sessionId) {
            await remoteStore.getState().createDirectory(sessionId, newPath);
          } else {
            await localStore.getState().createDirectory(newPath);
          }
          onRefresh();
        }
      },
    });
  }
  items.push({
    icon: <VscEdit size={14} />,
    label: 'Rename',
    action: async () => {
      onClose();
      onStartRename(entry);
    },
  });
  if (!entry.is_directory && mode === 'remote') {
    items.push({
      icon: <VscCloudDownload size={14} />,
      label: 'Download',
      action: async () => {
        onClose();
        const { save } = await import('@tauri-apps/plugin-dialog');
        const filePath = await save({
          defaultPath: entry.name,
          title: 'Save file as',
        });
        if (filePath && sessionId) {
          await remoteStore.getState().downloadFile(sessionId, entry.path, filePath as string);
        }
      },
    });
  }
  items.push({ label: 'separator', action: null });
  items.push({
    icon: <VscTrash size={14} color="var(--danger)" />,
    label: 'Delete',
    danger: true,
    action: async () => {
      onClose();
      const confirmed = confirm(
        `Delete "${entry.name}"?${entry.is_directory ? '\nThis will delete the directory (if empty).' : ''}`
      );
      if (confirmed) {
        if (mode === 'remote' && sessionId) {
          await remoteStore.getState().deleteEntry(sessionId, entry.path, entry.is_directory);
        } else {
          await localStore.getState().deleteEntry(entry.path, entry.is_directory);
        }
        onRefresh();
      }
    },
  });

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: pos.x, top: pos.y }}
    >
      {items.map((item, i) => {
        if (item.label === 'separator') {
          return <div key={i} className="context-menu-separator" />;
        }
        return (
          <button
            key={i}
            className={`context-menu-item ${item.danger ? 'danger' : ''}`}
            onClick={() => item.action && handleAction(item.action)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function TreeView({
  rootNode,
  mode,
  sessionId,
  onNavigate,
}: {
  rootNode: TreeNode | undefined;
  mode: 'local' | 'remote';
  sessionId: string | null;
  onNavigate: (path: string) => void;
}) {
  const remoteToggle = useFileExplorerStore((s) => s.toggleTreeNode);
  const localToggle = useLocalFileStore((s) => s.toggleTreeNode);
  const remoteCurrentPath = useFileExplorerStore((s) => s.currentPath);
  const localCurrentPath = useLocalFileStore((s) => s.currentPath);
  const currentPath = mode === 'remote' ? remoteCurrentPath : localCurrentPath;

  function TreeNodeItem({
    node,
    depth,
  }: {
    node: TreeNode;
    depth: number;
  }) {
    const hasChildren = node.children.length > 0 || !node.loaded;
    const isActive = currentPath === node.path;

    return (
      <div>
        <div
          className={`tree-node-item ${isActive ? 'active' : ''}`}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={() => {
            if (hasChildren) {
              if (mode === 'remote' && sessionId) {
                remoteToggle(sessionId, node.path);
              } else {
                localToggle(null, node.path);
              }
            }
            onNavigate(node.path);
          }}
        >
          <span className="tree-node-arrow">
            {hasChildren ? (
              node.expanded ? (
                <VscChevronDown size={12} />
              ) : (
                <VscChevronRight size={12} />
              )
            ) : (
              <span style={{ width: 12, display: 'inline-block' }} />
            )}
          </span>
          <span className="tree-node-icon">
            <VscFolder size={14} color="var(--accent)" />
          </span>
          <span className="tree-node-name">{node.name}</span>
        </div>
        {node.expanded &&
          node.children.map((child) => (
            <TreeNodeItem key={child.path} node={child} depth={depth + 1} />
          ))}
      </div>
    );
  }

  if (!rootNode) {
    return (
      <p style={{ padding: 12, color: 'var(--text-muted)', fontSize: 12 }}>
        Loading tree...
      </p>
    );
  }

  return <TreeNodeItem node={rootNode} depth={0} />;
}

// ─── FileBrowser (reusable) ────────────────────────────────────────────────

export interface FileBrowserProps {
  mode: 'local' | 'remote';
}

export default function FileBrowser({ mode }: FileBrowserProps) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entry: SftpFileEntry;
  } | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderValue, setNewFolderValue] = useState('');

  // Terminal store for remote session
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const tabs = useTerminalStore((s) => s.tabs);

  // Remote state
  const remoteCurrentPath = useFileExplorerStore((s) => s.currentPath);
  const remoteEntries = useFileExplorerStore((s) => s.entries);
  const remoteTreeNodes = useFileExplorerStore((s) => s.treeNodes);
  const remoteLoading = useFileExplorerStore((s) => s.loading);
  const remoteError = useFileExplorerStore((s) => s.error);
  const remoteList = useFileExplorerStore((s) => s.listFiles);
  const remoteSetPath = useFileExplorerStore((s) => s.setCurrentPath);
  const remoteClear = useFileExplorerStore((s) => s.clearExplorer);
  const remoteUpload = useFileExplorerStore((s) => s.uploadFile);
  const remoteCreateDir = useFileExplorerStore((s) => s.createDirectory);
  const remoteRename = useFileExplorerStore((s) => s.renameEntry);
  const remoteSortField = useFileExplorerStore((s) => s.sortField);
  const remoteSortAsc = useFileExplorerStore((s) => s.sortAsc);
  const remoteSetSorting = useFileExplorerStore((s) => s.setSorting);

  // Local state
  const localCurrentPath = useLocalFileStore((s) => s.currentPath);
  const localEntries = useLocalFileStore((s) => s.entries);
  const localTreeNodes = useLocalFileStore((s) => s.treeNodes);
  const localLoading = useLocalFileStore((s) => s.loading);
  const localError = useLocalFileStore((s) => s.error);
  const localList = useLocalFileStore((s) => s.listFiles);
  const localSetPath = useLocalFileStore((s) => s.setCurrentPath);
  const localCreateDir = useLocalFileStore((s) => s.createDirectory);
  const localRename = useLocalFileStore((s) => s.renameEntry);
  const localSortField = useLocalFileStore((s) => s.sortField);
  const localSortAsc = useLocalFileStore((s) => s.sortAsc);
  const localSetSorting = useLocalFileStore((s) => s.setSorting);

  // Select current state based on mode
  const isRemote = mode === 'remote';
  const currentPath = isRemote ? remoteCurrentPath : localCurrentPath;
  const entries = isRemote ? remoteEntries : localEntries;
  const treeNodes = isRemote ? remoteTreeNodes : localTreeNodes;
  const loading = isRemote ? remoteLoading : localLoading;
  const error = isRemote ? remoteError : localError;
  const sortField = isRemote ? remoteSortField : localSortField;
  const sortAsc = isRemote ? remoteSortAsc : localSortAsc;

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const sessionId = activeTab?.sessionId ?? null;

  // Initialize remote explorer when session changes
  useEffect(() => {
    if (isRemote) {
      if (sessionId) {
        remoteClear();
        remoteList(sessionId, '/');
      } else {
        remoteClear();
      }
    }
  }, [sessionId]); // only re-run when sessionId changes

  const handleNavigate = useCallback(
    (path: string) => {
      if (isRemote) {
        if (sessionId) {
          remoteSetPath(path);
          remoteList(sessionId, path);
          // Auto-expand tree
          const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
          const treeStore = useFileExplorerStore.getState();
          let acc = '';
          for (const part of parts) {
            acc += `/${part}`;
            const node = treeStore.treeNodes.get(acc);
            if (node && !node.expanded && node.path !== '/') {
              treeStore.toggleTreeNode(sessionId, acc);
            }
          }
        }
      } else {
        localSetPath(path);
        localList(null, path);
      }
    },
    [isRemote, sessionId, remoteSetPath, remoteList, localSetPath, localList]
  );

  const handleRefresh = useCallback(() => {
    if (isRemote) {
      if (sessionId) remoteList(sessionId, currentPath);
    } else {
      localList(null, currentPath);
    }
  }, [isRemote, sessionId, currentPath, remoteList, localList]);

  const handleGoUp = useCallback(() => {
    if (currentPath === '/' || currentPath === '') return;
    const parent = currentPath.replace(/\\/g, '/').substring(0, currentPath.replace(/\\/g, '/').lastIndexOf('/')) || '/';
    handleNavigate(parent);
  }, [currentPath, handleNavigate]);

  const handleUpload = useCallback(async () => {
    if (!isRemote || !sessionId) return;
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: true,
        title: 'Select files to upload',
      });
      if (selected && Array.isArray(selected)) {
        await Promise.all(
          selected.map(async (filePath) => {
            const fileName = (filePath as string).replace(/\\/g, '/').split('/').pop() || 'file';
            const remotePath =
              currentPath === '/' ? `/${fileName}` : `${currentPath}/${fileName}`;
            return remoteUpload(sessionId, filePath as string, remotePath);
          })
        );
        handleRefresh();
      }
    } catch (e) {
      console.error('Upload error:', e);
    }
  }, [isRemote, sessionId, currentPath, remoteUpload, handleRefresh]);

  const handleNewFolderToggle = useCallback(() => {
    setShowNewFolder((v) => !v);
    setNewFolderValue('');
  }, []);

  const handleNewFolderSubmit = useCallback(async () => {
    if (!newFolderValue.trim()) return;
    const name = newFolderValue.trim();
    const newPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    let ok: boolean;
    if (isRemote && sessionId) {
      ok = await remoteCreateDir(sessionId, newPath);
    } else {
      ok = await localCreateDir(newPath);
    }
    if (ok) handleRefresh();
    setShowNewFolder(false);
    setNewFolderValue('');
  }, [currentPath, newFolderValue, isRemote, sessionId, remoteCreateDir, localCreateDir, handleRefresh]);

  const handleStartRename = useCallback((entry: SftpFileEntry) => {
    setRenamingPath(entry.path);
    setRenameValue(entry.name);
  }, []);

  const handleRenameSubmit = useCallback(async () => {
    if (!renamingPath || !renameValue.trim()) return;
    const parentPath = renamingPath.substring(0, renamingPath.lastIndexOf('/')) || '/';
    const newPath = parentPath === '/' ? `/${renameValue}` : `${parentPath}/${renameValue}`;
    if (isRemote && sessionId) {
      await remoteRename(sessionId, renamingPath, newPath);
    } else {
      await localRename(renamingPath, newPath);
    }
    handleRefresh();
    setRenamingPath(null);
    setRenameValue('');
  }, [renamingPath, renameValue, isRemote, sessionId, remoteRename, localRename, handleRefresh]);

  const handleRenameCancel = useCallback(() => {
    setRenamingPath(null);
    setRenameValue('');
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, entry: SftpFileEntry) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, entry });
    },
    []
  );

  const handleFileDoubleClick = useCallback(
    (entry: SftpFileEntry) => {
      if (entry.is_directory) {
        handleNavigate(entry.path);
      }
    },
    [handleNavigate]
  );

  const handleSort = useCallback(
    (field: 'name' | 'size' | 'modified' | 'permissions') => {
      if (isRemote) {
        remoteSetSorting(field);
      } else {
        localSetSorting(field);
      }
    },
    [isRemote, remoteSetSorting, localSetSorting]
  );

  // Drag-and-drop upload (remote only)
  const [dragOver, setDragOver] = useState(false);
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      if (!isRemote || !sessionId) return;
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        await Promise.all(
          Array.from(e.dataTransfer.files).map(async (file) => {
            const filePath = (file as any).path || file.name;
            const remotePath =
              currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
            return remoteUpload(sessionId, filePath, remotePath);
          })
        );
        handleRefresh();
      }
    },
    [isRemote, sessionId, currentPath, remoteUpload, handleRefresh]
  );

  // Virtual scrolling
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 30,
    overscan: 10,
  });

  const rootNode = treeNodes.get('/');

  // Empty state for remote when no session
  if (isRemote && !sessionId) {
    return (
      <div className="fb-pane">
        <div className="fb-pane-header">
          <VscServer size={14} />
          <span>Remote</span>
        </div>
        <div className="fb-pane-empty">
          <VscWarning size={20} />
          <span>No active session</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fb-pane ${dragOver ? 'drag-over' : ''}`}
      onDragOver={isRemote ? handleDragOver : undefined}
      onDragLeave={isRemote ? handleDragLeave : undefined}
      onDrop={isRemote ? handleDrop : undefined}
    >
      {/* Header */}
      <div className="fb-pane-header">
        {isRemote ? <VscServer size={14} /> : <VscVm size={14} />}
        <span>{isRemote ? 'Remote' : 'Local'}</span>
      </div>

      {/* Body: tree + file list */}
      <div className="fb-pane-body">
        {/* Directory Tree */}
        <div className="file-tree">
          <div className="file-tree-header">
            <VscFolderOpened size={14} />
            <span>Explorer</span>
          </div>
          <div className="file-tree-content">
            <TreeView
              rootNode={rootNode}
              mode={mode}
              sessionId={sessionId}
              onNavigate={handleNavigate}
            />
          </div>
        </div>

        {/* File List */}
        <div className="file-list">
          {/* Toolbar */}
          <div className="file-toolbar">
            <Breadcrumb path={currentPath} onNavigate={handleNavigate} />
            <div className="file-toolbar-actions">
              <button className="toolbar-btn" onClick={handleGoUp} title="Go up">
                <VscArrowUp size={16} />
              </button>
              <button className="toolbar-btn" onClick={handleRefresh} title="Refresh">
                <VscRefresh size={16} className={loading ? 'spin' : ''} />
              </button>
              <button className="toolbar-btn" onClick={handleNewFolderToggle} title="New Folder">
                <VscNewFolder size={16} />
              </button>
              {isRemote && (
                <button className="toolbar-btn" onClick={handleUpload} title="Upload files">
                  <VscCloudUpload size={16} />
                </button>
              )}
            </div>
          </div>

          <FileListHeader
            sortField={sortField}
            sortAsc={sortAsc}
            onSort={handleSort}
          />

          {/* Virtualized file rows */}
          <div className="file-list-body" ref={scrollRef}>
            {loading && entries.length === 0 && (
              <div className="file-list-message">Loading...</div>
            )}
            {error && (
              <div className="file-list-message" style={{ color: 'var(--danger)' }}>
                <VscWarning size={16} style={{ marginRight: 6 }} />
                {error}
              </div>
            )}
            {!loading && !error && entries.length === 0 && (
              <div className="file-list-message">Empty directory</div>
            )}

            {/* Inline new-folder input */}
            {showNewFolder && (
              <div style={{ display: 'flex', gap: 4, padding: '4px 8px', alignItems: 'center' }}>
                <VscFolder size={14} color="var(--accent)" />
                <input
                  className="file-rename-input"
                  placeholder="folder name"
                  value={newFolderValue}
                  onChange={(e) => setNewFolderValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleNewFolderSubmit();
                    if (e.key === 'Escape') {
                      setShowNewFolder(false);
                      setNewFolderValue('');
                    }
                  }}
                  autoFocus
                />
                <button className="toolbar-btn" onClick={handleNewFolderSubmit} title="Confirm">
                  <VscCheck size={14} />
                </button>
                <button
                  className="toolbar-btn"
                  onClick={() => {
                    setShowNewFolder(false);
                    setNewFolderValue('');
                  }}
                  title="Cancel"
                >
                  <VscClose size={14} />
                </button>
              </div>
            )}

            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const entry = entries[virtualItem.index];
                if (!entry) return null;
                return (
                  <div
                    key={entry.path}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <FileRow
                      entry={entry}
                      onDoubleClick={handleFileDoubleClick}
                      onContextMenu={handleContextMenu}
                      isRenaming={renamingPath === entry.path}
                      renameValue={renamingPath === entry.path ? renameValue : ''}
                      onRenameChange={setRenameValue}
                      onRenameSubmit={handleRenameSubmit}
                      onRenameCancel={handleRenameCancel}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status bar */}
          <div className="file-statusbar">
            {entries.length} item{entries.length !== 1 ? 's' : ''}
            {error && (
              <span style={{ color: 'var(--danger)', marginLeft: 12 }}>
                Error: {error}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          entry={contextMenu.entry}
          mode={mode}
          sessionId={sessionId}
          onClose={() => setContextMenu(null)}
          onRefresh={handleRefresh}
          onStartRename={handleStartRename}
        />
      )}
    </div>
  );
}
