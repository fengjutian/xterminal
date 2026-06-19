import { useCallback, useRef, useEffect } from "react";
import {
  VscClose,
  VscEdit,
  VscFiles,
  VscSplitHorizontal,
} from "react-icons/vsc";
import { useTerminalStore } from "../stores/terminalStore";

interface Props {
  x: number;
  y: number;
  tabId: string;
  onClose: () => void;
}

export default function TabContextMenu({ x, y, tabId, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const tabs = useTerminalStore((s) => s.tabs);
  const closeTab = useTerminalStore((s) => s.closeTab);

  const tab = tabs.find((t) => t.id === tabId);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handler);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
    };
  }, [onClose]);

  const handleClose = useCallback(() => {
    closeTab(tabId);
    onClose();
  }, [tabId, closeTab, onClose]);

  const handleCloseOthers = useCallback(() => {
    const others = tabs.filter((t) => t.id !== tabId);
    others.forEach((t) => closeTab(t.id));
    onClose();
  }, [tabs, tabId, closeTab, onClose]);

  const handleCloseRight = useCallback(() => {
    const idx = tabs.findIndex((t) => t.id === tabId);
    if (idx >= 0) {
      const rightTabs = tabs.slice(idx + 1);
      rightTabs.forEach((t) => closeTab(t.id));
    }
    onClose();
  }, [tabs, tabId, closeTab, onClose]);

  const handleRename = useCallback(() => {
    if (!tab) return;
    const newName = prompt("New tab name:", tab.title);
    if (newName && newName.trim() && newName !== tab.title) {
      useTerminalStore.setState((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId ? { ...t, title: newName.trim() } : t
        ),
      }));
    }
    onClose();
  }, [tab, tabId, onClose]);

  // Prevent menu from going off-screen
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - 150);

  return (
    <div
      ref={menuRef}
      className="tab-context-menu"
      style={{ left: adjustedX, top: adjustedY }}
    >
      <button className="context-menu-item" onClick={handleRename}>
        <VscEdit size={14} />
        <span>Rename Tab</span>
      </button>
      <div className="context-menu-separator" />
      <button className="context-menu-item" onClick={handleClose}>
        <VscClose size={14} />
        <span>Close Tab</span>
      </button>
      <button
        className="context-menu-item"
        onClick={handleCloseOthers}
        disabled={tabs.length <= 1}
      >
        <VscFiles size={14} />
        <span>Close Other Tabs</span>
      </button>
      <button
        className="context-menu-item"
        onClick={handleCloseRight}
        disabled={tabs.findIndex((t) => t.id === tabId) >= tabs.length - 1}
      >
        <VscSplitHorizontal size={14} />
        <span>Close Tabs to the Right</span>
      </button>
    </div>
  );
}
