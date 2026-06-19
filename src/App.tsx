import { useState } from "react";
import Sidebar from "./components/Sidebar";
import TabBar from "./components/TabBar";
import TerminalPanel from "./components/TerminalPanel";
import FileExplorer from "./components/FileExplorer";
import TransferPanel from "./components/TransferPanel";
import WelcomeScreen from "./components/WelcomeScreen";

export default function App() {
  const [activeView, setActiveView] = useState<"terminal" | "files">("terminal");
  const [connected, setConnected] = useState(false);

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
            <WelcomeScreen onConnect={() => setConnected(true)} />
          )}
        </div>
      </div>
    </div>
  );
}
