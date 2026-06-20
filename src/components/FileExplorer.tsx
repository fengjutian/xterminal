import FileBrowser from './FileBrowser';
import './FileBrowser.css';

/**
 * Dual-pane file explorer with Local (left) and Remote (right) browsers.
 */
export default function FileExplorer() {
  return (
    <div className="file-explorer-dual">
      <FileBrowser mode="local" />
      <div className="fe-dual-divider" />
      <FileBrowser mode="remote" />
    </div>
  );
}
