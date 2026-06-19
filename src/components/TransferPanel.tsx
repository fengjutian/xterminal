import { useTransferStore } from "../stores/transferStore";

export default function TransferPanel() {
  const tasks = useTransferStore((s) => s.tasks);
  const isOpen = useTransferStore((s) => s.isPanelOpen);
  const setPanelOpen = useTransferStore((s) => s.setPanelOpen);

  if (!isOpen && tasks.length === 0) return null;

  return (
    <div className="transfer-panel">
      <div className="transfer-header">
        <span>Transfers ({tasks.length})</span>
        <button className="toolbar-btn" onClick={() => setPanelOpen(!isOpen)}>
          {isOpen ? "-" : "+"}
        </button>
      </div>
      {isOpen && (
        <div className="transfer-list">
          {tasks.length === 0 ? (
            <p style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '12px' }}>
              No active transfers
            </p>
          ) : (
            tasks.map((task) => (
              <div key={task.id} className="transfer-item">
                <span>{task.file_name}</span>
                <div className="transfer-progress">
                  <div
                    className="transfer-progress-bar"
                    style={{
                      width: `${task.file_size > 0 ? (task.transferred_bytes / task.file_size) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {task.state}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
