export default function Sidebar() {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Connections</h2>
        <button className="toolbar-btn" title="New Connection">+</button>
      </div>
      <div className="sidebar-list">
        <p style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '12px' }}>
          No connections yet. Click + to add one.
        </p>
      </div>
    </div>
  );
}
