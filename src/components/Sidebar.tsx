import {
  VscAdd,
  VscChevronLeft,
  VscChevronRight,
  VscServer,
  VscEdit,
  VscTrash,
  VscChevronDown,
  VscTerminalBash,
  VscFiles,
} from "react-icons/vsc";
import { useState, useMemo } from "react";
import { useConnectionStore } from "../stores/connectionStore";
import type { ConnectionConfig } from "../types";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onNewConnection: () => void;
  onEditConnection: (config: ConnectionConfig) => void;
  onConnect: (config: ConnectionConfig) => void;
  activeView: "terminal" | "files";
  onViewChange: (view: "terminal" | "files") => void;
}

interface GroupedConnections {
  groupId: string | null;
  groupName: string;
  connections: ConnectionConfig[];
}

export default function Sidebar({
  collapsed,
  onToggle,
  onNewConnection,
  onEditConnection,
  onConnect,
  activeView,
  onViewChange,
}: SidebarProps) {
  const connections = useConnectionStore((s) => s.connections);
  const deleteConnection = useConnectionStore((s) => s.deleteConnection);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string | null>>(
    new Set()
  );

  // Group connections by group_id
  const grouped = useMemo(() => {
    const map = new Map<string | null, ConnectionConfig[]>();
    for (const conn of connections) {
      const gid = conn.group_id;
      if (!map.has(gid)) map.set(gid, []);
      map.get(gid)!.push(conn);
    }
    const result: GroupedConnections[] = [];
    // Named groups first, then ungrouped
    for (const [gid, conns] of map) {
      if (gid !== null) {
        result.push({ groupId: gid, groupName: gid, connections: conns });
      }
    }
    // Ungrouped at bottom
    const ungrouped = map.get(null);
    if (ungrouped) {
      result.push({
        groupId: null,
        groupName: "未分组",
        connections: ungrouped,
      });
    }
    return result;
  }, [connections]);

  const toggleGroup = (groupId: string | null) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`确认删除连接"${name}"？`)) {
      await deleteConnection(id);
    }
  };

  return (
    <>
      <div className={`sidebar${collapsed ? " collapsed" : ""}`}>
        {!collapsed && (
          <>
            <div className="sidebar-header">
              <h2>连接列表</h2>
              <div className="sidebar-header-actions">
                <button
                  className="toolbar-btn"
                  title="新建连接"
                  onClick={onNewConnection}
                >
                  <VscAdd size={16} />
                </button>
                <button
                  className="toolbar-btn"
                  title="收起侧边栏"
                  onClick={onToggle}
                >
                  <VscChevronLeft size={16} />
                </button>
              </div>
            </div>

            {/* View Toggle — always visible */}
            <div className="sidebar-view-toggle">
              <button
                className={`sidebar-view-btn ${activeView === "terminal" ? "active" : ""}`}
                onClick={() => onViewChange("terminal")}
                title="终端"
              >
                <VscTerminalBash size={16} />
                <span>终端</span>
              </button>
              <button
                className={`sidebar-view-btn ${activeView === "files" ? "active" : ""}`}
                onClick={() => onViewChange("files")}
                title="文件管理器"
              >
                <VscFiles size={16} />
                <span>文件管理器</span>
              </button>
            </div>

            <div className="sidebar-list">
              {connections.length === 0 ? (
                <p
                  style={{
                    padding: "16px",
                    color: "var(--text-muted)",
                    fontSize: "12px",
                  }}
                >
                  暂无连接。点击 + 添加。
                </p>
              ) : (
                grouped.map((group) => (
                  <div key={group.groupId ?? "__ungrouped__"}>
                    {grouped.length > 1 && (
                      <div
                        className="sidebar-group-header"
                        onClick={() => toggleGroup(group.groupId)}
                      >
                        <span className="sidebar-group-chevron">
                          {collapsedGroups.has(group.groupId) ? (
                            <VscChevronRight size={12} />
                          ) : (
                            <VscChevronDown size={12} />
                          )}
                        </span>
                        <span className="sidebar-group-name">
                          {group.groupName}
                        </span>
                        <span className="sidebar-group-count">
                          {group.connections.length}
                        </span>
                      </div>
                    )}
                    {!collapsedGroups.has(group.groupId) &&
                      group.connections.map((conn) => (
                        <div key={conn.id} className="connection-item">
                          <VscServer size={14} className="connection-item-icon" />
                          <div
                            style={{ flex: 1, minWidth: 0 }}
                            onClick={() => onConnect(conn)}
                          >
                            <div style={{ fontSize: "13px" }}>{conn.name}</div>
                            <div
                              style={{
                                fontSize: "11px",
                                color: "var(--text-muted)",
                              }}
                            >
                              {conn.username}@{conn.host}:{conn.port}
                            </div>
                          </div>
                          <div className="connection-item-actions">
                            <button
                              className="connection-action-btn"
                              title="编辑"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditConnection(conn);
                              }}
                            >
                              <VscEdit size={12} />
                            </button>
                            <button
                              className="connection-action-btn"
                              title="删除"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(conn.id, conn.name);
                              }}
                            >
                              <VscTrash size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
      {collapsed && (
        <div className="sidebar-collapsed-strip">
          <button
            className="toolbar-btn"
            title="展开侧边栏"
            onClick={onToggle}
          >
            <VscChevronRight size={16} />
          </button>
        </div>
      )}
    </>
  );
}
