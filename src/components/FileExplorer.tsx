export default function FileExplorer() {
  return (
    <div className="file-explorer">
      <div className="file-tree">
        <p style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '12px' }}>
          Remote file tree (SFTP/FTP)
        </p>
      </div>
      <div className="file-list">
        <p style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '12px' }}>
          Select a directory to view files
        </p>
      </div>
    </div>
  );
}
