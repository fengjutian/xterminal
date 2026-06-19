import { useState, useEffect } from "react";
import { VscTerminalBash, VscFiles } from "react-icons/vsc";
import Sidebar from "./components/Sidebar";
import TabBar from "./components/TabBar";
import TerminalPanel from "./components/TerminalPanel";
import FileExplorer from "./components/FileExplorer";
import TransferPanel from "./components/TransferPanel";
import WelcomeScreen from "./components/WelcomeScreen";
import { useTerminalStore } from "./stores/terminalStore";
import type { ConnectionConfig } from "./types";

export default function App() {
  const [activeView, setActiveView] = useState<"terminal" | "files">("terminal");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [connected, setConnected] = useState(false);
  const createTab = useTerminalStore((s) => s.createTab);
  const tabs = useTerminalStore((s) => s.tabs);
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const setActiveTab = useTerminalStore((s) => s.setActiveTab);

  // Ctrl+Tab / Ctrl+Shift+Tab keyboard shortcut for tab switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.key !== "Tab") return;
      e.preventDefault();

      if (tabs.length < 2) return;

      const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
      if (currentIndex === -1) {
        setActiveTab(tabs[0].id);
        return;
      }

      if (e.shiftKey) {
        const prevIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
        setActiveTab(tabs[prevIndex].id);
      } else {
        const nextIndex = currentIndex === tabs.length - 1 ? 0 : currentIndex + 1;
        setActiveTab(tabs[nextIndex].id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tabs, activeTabId, setActiveTab]);

  const handleQuickConnect = async (info: {
    host: string;
    port: number;
    username: string;
    password: string;
  }) => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const sessionId: string = await invoke("ssh_connect", {
        host: info.host,
        port: info.port,
        username: info.username,
        password: info.password || null,
      });
      createTab({
        id: sessionId,
        connection_id: `quick-${info.host}`,
        name: `${info.username}@${info.host}`,
        host: `${info.host}:${info.port}`,
        state: "connected",
        connected_at: new Date().toISOString(),
      });
      setConnected(true);
    } catch (e) {
      console.error("Failed to connect:", e);
    }
  };

  const handleLocalTerminal = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const sessionId: string = await invoke("local_shell_spawn", {
        cols: 80,
        rows: 24,
      });
      createTab({
        id: sessionId,
        connection_id: "local",
        name: "Local Terminal",
        host: "localhost",
        state: "connected",
        connected_at: new Date().toISOString(),
      });
      setConnected(true);
    } catch (e) {
      console.error("Failed to spawn local terminal:", e);
    }
  };

  const handleSavedConnection = async (config: ConnectionConfig) => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const sessionId: string = await invoke("ssh_connect_from_config", {
        configId: config.id,
      });
      createTab({
        id: sessionId,
        connection_id: config.id,
        name: config.name,
        host: `${config.host}:${config.port}`,
        state: "connected",
        connected_at: new Date().toISOString(),
      });
      setConnected(true);
    } catch (e) {
      console.error("Failed to connect via saved config:", e);
    }
  };

  return (
    <div className="app-container">
      <div className="app-main">
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((v) => !v)} />
        <div className="app-workspace">
          {connected ? (
            <>
              <div className="workspace-toolbar">
                <TabBar />
                <div className="toolbar-actions">
                  <button
                    className={`toolbar-btn ${activeView === "terminal" ? "active" : ""}`}
                    onClick={() => setActiveView("terminal")}
                    title="Terminal"
                  >
                    <VscTerminalBash size={16} />
                  </button>
                  <button
                    className={`toolbar-btn ${activeView === "files" ? "active" : ""}`}
                    onClick={() => setActiveView("files")}
                    title="File Explorer"
                  >
                    <VscFiles size={16} />
                  </button>
                </div>
              </div>
              <div className="workspace-content">
                {activeView === "terminal" ? <TerminalPanel /> : <FileExplorer />}
              </div>
              <TransferPanel />
            </>
          ) : (
            <WelcomeScreen
              onConnect={handleQuickConnect}
              onLocalTerminal={handleLocalTerminal}
              onSavedConnection={handleSavedConnection}
            />
          )}
        </div>
      </div>
    </div>
  );
}