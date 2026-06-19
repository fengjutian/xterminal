import { useState, useCallback } from "react";
import { VscClose } from "react-icons/vsc";
import { useTerminalStore } from "../stores/terminalStore";
import TabContextMenu from "./TabContextMenu";

export default function TabBar() {
  const tabs = useTerminalStore((s) => s.tabs);
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const setActiveTab = useTerminalStore((s) => s.setActiveTab);
  const closeTab = useTerminalStore((s) => s.closeTab);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tabId: string;
  } | null>(null);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, tabId });
    },
    []
  );

  if (tabs.length === 0) {
    return <div className="tab-bar" />;
  }

  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab-item ${tab.id === activeTabId ? "active" : ""}`}
          onClick={() => {
            if (tab.id !== activeTabId) setActiveTab(tab.id);
          }}
          onContextMenu={(e) => handleContextMenu(e, tab.id)}
        >
          <span className="tab-title-text">{tab.title}</span>
          <span
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              closeTab(tab.id);
            }}
          >
            <VscClose size={14} />
          </span>
        </div>
      ))}
      {contextMenu && (
        <TabContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          tabId={contextMenu.tabId}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
