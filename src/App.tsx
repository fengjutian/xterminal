import { useState } from "react";
import Sidebar from "./components/Sidebar";
import TabBar from "./components/TabBar";
import TerminalPanel from "./components/TerminalPanel";
import FileExplorer from "./components/FileExplorer";
import TransferPanel from "./components/TransferPanel";
import WelcomeScreen from "./components/WelcomeScreen";
import { useTerminalStore } from "./stores/terminalStore";

export default function App() {
  const [activeView, setActiveView] = useState<"terminal" | "files">("terminal");
  const [connected, setConnected] = useState(false);
  const createTab = useTerminalStore((s) => s.createTab);

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

  return (
    <div className="app-container">
      <div className="app-main">
        <Sidebar />
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
                    {"</>"}
                  </button>
                  <button
                    className={`toolbar-btn ${activeView === "files" ? "active" : ""}`}
                    onClick={() => setActiveView("files")}
                    title="File Explorer"
                  >
                    {"[ ]"}
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
              onConnect={() => setConnected(true)}
              onLocalTerminal={handleLocalTerminal}
            />
          )}
        </div>
      </div>
    </div>
  );
}
