import { VscAdd, VscChevronLeft, VscChevronRight } from "react-icons/vsc";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <>
      <div className={`sidebar${collapsed ? " collapsed" : ""}`}>
        {!collapsed && (
          <>
            <div className="sidebar-header">
              <h2>Connections</h2>
              <div className="sidebar-header-actions">
                <button className="toolbar-btn" title="New Connection">
                  <VscAdd size={16} />
                </button>
                <button className="toolbar-btn" title="Collapse Sidebar" onClick={onToggle}>
                  <VscChevronLeft size={16} />
                </button>
              </div>
            </div>
            <div className="sidebar-list">
              <p style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                No connections yet. Click + to add one.
              </p>
            </div>
          </>
        )}
      </div>
      {collapsed && (
        <div className="sidebar-collapsed-strip">
          <button className="toolbar-btn" title="Expand Sidebar" onClick={onToggle}>
            <VscChevronRight size={16} />
          </button>
        </div>
      )}
    </>
  );
}