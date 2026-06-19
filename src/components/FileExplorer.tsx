import { useState, useEffect, useCallback, useRef } from 'react';
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
} from 'react-icons/vsc';
import { useFileExplorerStore } from '../stores/fileExplorerStore';
import { useTerminalStore } from '../stores/terminalStore';
import type { SftpFileEntry } from '../types';

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

// Breadcrumb navigation
function Breadcrumb({
  path,
  onNavigate,
}: {
  path: string;
  onNavigate: (p: string) => void;
}) {
  const parts = path === '/' ? [''] : path.split('/').filter(Boolean);
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
}

// Directory tree node (recursive)
function TreeNode({
  node,
  depth,
  sessionId,
  onNavigate,
}: {
  node: { path: string; name: string; expanded: boolean; loaded: boolean; children: any[] };
  depth: number;
  sessionId: string;
  onNavigate: (path: string) => void;
}) {
  const toggleTreeNode = useFileExplorerStore((s) => s.toggleTreeNode);
  const currentPath = useFileExplorerStore((s) => s.currentPath);
  const hasChildren = node.children.length > 0 || !node.loaded;
  const isActive = currentPath === node.path;

  return (
    <div>
      <div
        className={`tree-node-item ${isActive ? 'active' : ''}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => {
          if (hasChildren) {
            toggleTreeNode(sessionId, node.path);
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
        node.children.map((child: any) => (
          <TreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            sessionId={sessionId}
            onNavigate={onNavigate}
          />
        ))}
    </div>
  );
}

// File list column header
function FileListHeader() {
  const sortField = useFileExplorerStore((s) => s.sortField);
  const sortAsc = useFileExplorerStore((s) => s.sortAsc);
  const setSorting = useFileExplorerStore((s) => s.setSorting);

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
          onClick={() => setSorting(col.field)}
        >
          {col.label}
          {sortField === col.field && (
            <span className="sort-indicator">{sortAsc ? ' ^' : ' v'}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// Right-click context menu
function FileContextMenu({
  x,
  y,
  entry,
  sessionId,
  onClose,
  onRefresh,
}: {
  x: number;
  y: number;
  entry: SftpFileEntry;
  sessionId: string;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const createDirectory = useFileExplorerStore((s) => s.createDirectory);
  const deleteEntry = useFileExplorerStore((s) => s.deleteEntry);
  const renameEntry = useFileExplorerStore((s) => s.renameEntry);
  const downloadFile = useFileExplorerStore((s) => s.downloadFile);
  const currentPath = useFileExplorerStore((s) => s.currentPath);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const items: { icon?: React.ReactNode; label: string; danger?: boolean; action: (() => Promise<void>) | null }[] = [];
  if (entry.is_directory) {
    items.push({
      icon: <VscNewFolder size={14} />,
      label: 'New Folder...',
      action: async () => {
        const name = prompt('Folder name:');
        if (name) {
          const newPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
          await createDirectory(sessionId, newPath);
          onRefresh();
        }
        onClose();
      },
    });
    items.push({
      icon: <VscEdit size={14} />,
      label: 'Rename',
      action: async () => {
        const newName = prompt('New name:', entry.name);
        if (newName && newName !== entry.name) {
          const parentPath = entry.path.substring(0, entry.path.lastIndexOf('/')) || '/';
          const newPath = parentPath === '/' ? `/${newName}` : `${parentPath}/${newName}`;
          await renameEntry(sessionId, entry.path, newPath);
          onRefresh();
        }
        onClose();
      },
    });
  } else {
    items.push({
      icon: <VscCloudDownload size={14} />,
      label: 'Download',
      action: async () => {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const filePath = await save({
          defaultPath: entry.name,
          title: 'Save file as',
        });
        if (filePath) {
          await downloadFile(sessionId, entry.path, filePath as string);
        }
        onClose();
      },
    });
    items.push({
      icon: <VscEdit size={14} />,
      label: 'Rename',
      action: async () => {
        const newName = prompt('New name:', entry.name);
        if (newName && newName !== entry.name) {
          const parentPath = entry.path.substring(0, entry.path.lastIndexOf('/')) || '/';
          const newPath = parentPath === '/' ? `/${newName}` : `${parentPath}/${newName}`;
          await renameEntry(sessionId, entry.path, newPath);
          onRefresh();
        }
        onClose();
      },
    });
  }
  items.push({ label: 'separator', action: null });
  items.push({
    icon: <VscTrash size={14} color="var(--danger)" />,
    label: 'Delete',
    danger: true,
    action: async () => {
      const confirmed = confirm(
        `Delete "${entry.name}"?${entry.is_directory ? '\nThis will delete the directory (if empty).' : ''}`
      );
      if (confirmed) {
        await deleteEntry(sessionId, entry.path, entry.is_directory);
        onRefresh();
      }
      onClose();
    },
  });

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => {
        if (item.label === 'separator') {
          return <div key={i} className="context-menu-separator" />;
        }
        return (
          <button
            key={i}
            className={`context-menu-item ${item.danger ? 'danger' : ''}`}
            onClick={item.action ?? undefined}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Main FileExplorer component
export default function FileExplorer() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entry: SftpFileEntry;
  } | null>(null);

  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const tabs = useTerminalStore((s) => s.tabs);

  const currentPath = useFileExplorerStore((s) => s.currentPath);
  const entries = useFileExplorerStore((s) => s.entries);
  const treeNodes = useFileExplorerStore((s) => s.treeNodes);
  const loading = useFileExplorerStore((s) => s.loading);
  const error = useFileExplorerStore((s) => s.error);
  const listFiles = useFileExplorerStore((s) => s.listFiles);
  const setCurrentPath = useFileExplorerStore((s) => s.setCurrentPath);
  const clearExplorer = useFileExplorerStore((s) => s.clearExplorer);
  const uploadFile = useFileExplorerStore((s) => s.uploadFile);

  // Get active session
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeSessionId = activeTab?.sessionId ?? null;

  useEffect(() => {
    if (activeSessionId && activeSessionId !== sessionId) {
      setSessionId(activeSessionId);
      clearExplorer();
      listFiles(activeSessionId, '/');
    } else if (!activeSessionId) {
      setSessionId(null);
      clearExplorer();
    }
  }, [activeSessionId]);

  const handleNavigate = useCallback(
    (path: string) => {
      if (sessionId) {
        setCurrentPath(path);
        listFiles(sessionId, path);
      }
    },
    [sessionId, listFiles, setCurrentPath]
  );

  const handleRefresh = useCallback(() => {
    if (sessionId) {
      listFiles(sessionId, currentPath);
    }
  }, [sessionId, currentPath, listFiles]);

  const handleGoUp = useCallback(() => {
    if (currentPath === '/') return;
    const parent = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
    handleNavigate(parent);
  }, [currentPath, handleNavigate]);

  const handleUpload = useCallback(async () => {
    if (!sessionId) return;
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: true,
        title: 'Select files to upload',
      });
      if (selected && Array.isArray(selected)) {
        for (const filePath of selected) {
          const fileName = (filePath as string).replace(/\\/g, '/').split('/').pop() || 'file';
          const remotePath =
            currentPath === '/' ? `/${fileName}` : `${currentPath}/${fileName}`;
          await uploadFile(sessionId, filePath as string, remotePath);
        }
        handleRefresh();
      }
    } catch (e) {
      console.error('Upload error:', e);
    }
  }, [sessionId, currentPath, uploadFile, handleRefresh]);

  const handleNewFolder = useCallback(async () => {
    if (!sessionId) return;
    const name = prompt('New folder name:');
    if (name) {
      const newPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
      const ok = await useFileExplorerStore.getState().createDirectory(sessionId, newPath);
      if (ok) handleRefresh();
    }
  }, [sessionId, currentPath, handleRefresh]);

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

  // Drag-and-drop upload
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
      if (!sessionId) return;
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const file = e.dataTransfer.files[i];
          const filePath = (file as any).path || file.name;
          const remotePath =
            currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
          await uploadFile(sessionId, filePath, remotePath);
        }
        handleRefresh();
      }
    },
    [sessionId, currentPath, uploadFile, handleRefresh]
  );

  const rootNode = treeNodes.get('/');

  if (!sessionId) {
    return (
      <div className="file-explorer">
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          <VscWarning size={20} style={{ marginRight: 8 }} />
          No active terminal session. Connect to a remote host or open a local terminal first.
        </div>
      </div>
    );
  }

  return (
    <div className="file-explorer">
      {/* Left: Directory Tree */}
      <div className="file-tree">
        <div className="file-tree-header">
          <VscFolderOpened size={14} />
          <span>Explorer</span>
        </div>
        <div className="file-tree-content">
          {rootNode && (
            <TreeNode
              node={rootNode}
              depth={0}
              sessionId={sessionId}
              onNavigate={handleNavigate}
            />
          )}
          {!rootNode && (
            <p style={{ padding: 12, color: 'var(--text-muted)', fontSize: 12 }}>
              Loading tree...
            </p>
          )}
        </div>
      </div>

      {/* Right: File List */}
      <div
        className={`file-list ${dragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
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
            <button className="toolbar-btn" onClick={handleNewFolder} title="New Folder">
              <VscNewFolder size={16} />
            </button>
            <button className="toolbar-btn" onClick={handleUpload} title="Upload files">
              <VscCloudUpload size={16} />
            </button>
          </div>
        </div>

        <FileListHeader />

        {/* Entries */}
        <div className="file-list-body">
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
          {entries.map((entry) => (
            <div
              key={entry.path}
              className="file-row"
              onDoubleClick={() => handleFileDoubleClick(entry)}
              onContextMenu={(e) => handleContextMenu(e, entry)}
            >
              <span className="file-icon">{getFileIcon(entry)}</span>
              <span className="file-name">{entry.name}</span>
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
          ))}
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

      {/* Context Menu */}
      {contextMenu && sessionId && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          entry={contextMenu.entry}
          sessionId={sessionId}
          onClose={() => setContextMenu(null)}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  );
}
