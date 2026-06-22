import { useState, useEffect, useCallback } from "react";
import { VscAdd, VscHome } from "react-icons/vsc";
import Sidebar from "./components/Sidebar";
import TabBar from "./components/TabBar";
import TerminalPanel from "./components/TerminalPanel";
import FileExplorer from "./components/FileExplorer";
import TransferPanel from "./components/TransferPanel";
import ConnectionDialog from "./components/ConnectionDialog";
import HostKeyDialog from "./components/HostKeyDialog";
import WelcomeScreen from "./components/WelcomeScreen";
import { useTerminalStore } from "./stores/terminalStore";
import { useConnectionStore } from "./stores/connectionStore";
import { useAppStore } from "./stores/appStore";
import type { AppSettings, ConnectionConfig, HostKeyVerificationPayload, HostKeyChangedPayload } from "./types";

export default function App() {
  const [activeView, setActiveView] = useState<"terminal" | "files">("terminal");
  const [connected, setConnected] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<ConnectionConfig | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [hostKeyVerifyPayload, setHostKeyVerifyPayload] = useState<HostKeyVerificationPayload | null>(null);
  const [hostKeyChangedPayload, setHostKeyChangedPayload] = useState<HostKeyChangedPayload | null>(null);
  const createTab = useTerminalStore((s) => s.createTab);
  const closeTab = useTerminalStore((s) => s.closeTab);
  const tabs = useTerminalStore((s) => s.tabs);
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const setActiveTab = useTerminalStore((s) => s.setActiveTab);

  // Sidebar state from appStore (single source of truth)
  const sidebarVisible = useAppStore((s) => s.sidebarVisible);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  // Fetch saved connections on mount
  const fetchConnections = useConnectionStore((s) => s.fetchConnections);
  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  // Load persisted settings from backend on mount
  const updateSettings = useAppStore((s) => s.updateSettings);
  useEffect(() => {
    (async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const settings: AppSettings = await invoke("get_app_settings");
        updateSettings(settings);
      } catch (e) {
        console.warn("Failed to load settings from backend, using defaults:", e);
      }
    })();
  }, [updateSettings]);

  // Ctrl+Tab / Ctrl+Shift+Tab keyboard shortcut for tab switching
  // Ctrl+Shift+T keyboard shortcut for new local terminal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+T: New local terminal tab
      if (e.ctrlKey && e.shiftKey && e.key === "T") {
        e.preventDefault();
        handleLocalTerminal();
        return;
      }

      // Ctrl+Tab / Ctrl+Shift+Tab: Tab switching
      if (!e.ctrlKey || e.key !== "Tab") return;
      e.preventDefault();

      if (tabs.length < 2) return;

      const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
      if (currentIndex === -1) {
        setActiveTab(tabs[0].id);
        return;
      }

      if (e.shiftKey) {
        const prevIndex =
          currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
        setActiveTab(tabs[prevIndex].id);
      } else {
        const nextIndex =
          currentIndex === tabs.length - 1 ? 0 : currentIndex + 1;
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
    setConnectionError(null);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const sessionId: string = await invoke("ssh_connect", {
        host: info.host,
        port: info.port,
        username: info.username,
        password: info.password || null,
        privateKeyPath: null,
        passphrase: null,
        timeoutSecs: 30,
        keepAliveSecs: 60,
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
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Failed to connect:", e);
      setConnectionError(msg);
    }
  };

  const handleLocalTerminal = useCallback(async () => {
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
  }, [createTab]);

  const handleSavedConnection = async (config: ConnectionConfig) => {
    // 如果已有该连接的标签，直接切换到它，不重复创建
    const sessions = useTerminalStore.getState().sessions;
    const existingTab = tabs.find((t) => {
      const session = sessions.get(t.sessionId);
      return session?.connection_id === config.id;
    });
    if (existingTab) {
      setActiveTab(existingTab.id);
      setConnected(true);
      return;
    }
    setConnectionError(null);
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
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Failed to connect via saved config:", e);
      setConnectionError(msg);
    }
  };

  const handleNewConnection = useCallback(() => {
    setEditingConnection(null);
    setDialogOpen(true);
  }, []);

  const handleEditConnection = useCallback((config: ConnectionConfig) => {
    setEditingConnection(config);
    setDialogOpen(true);
  }, []);

  const handleDialogClose = useCallback(() => {
    setDialogOpen(false);
    setEditingConnection(null);
  }, []);

  const handleDialogSaved = useCallback(() => {
    setDialogOpen(false);
    setEditingConnection(null);
  }, []);

  const handleGoHome = useCallback(() => {
    // Close all tabs to clean up backend resources
    tabs.forEach((tab) => closeTab(tab.id));
    setConnected(false);
    setActiveView("terminal");
  }, [tabs, closeTab]);

  // ── Host key verification event listeners ──
  useEffect(() => {
    let cancelled = false;
    const cleanups: (() => void)[] = [];

    const setup = async () => {
      const { listen } = await import("@tauri-apps/api/event");
      if (cancelled) return;

      const unlistenConfirm = await listen<HostKeyVerificationPayload>(
        "host-key-confirm",
        (event) => {
          if (!cancelled) {
            setHostKeyVerifyPayload(event.payload);
          }
        }
      );
      cleanups.push(unlistenConfirm);

      const unlistenChanged = await listen<HostKeyChangedPayload>(
        "host-key-changed",
        (event) => {
          if (!cancelled) {
            setHostKeyChangedPayload(event.payload);
          }
        }
      );
      cleanups.push(unlistenChanged);
    };

    setup();

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
  }, []);

  const handleHostKeyAccept = useCallback(async (payload: HostKeyVerificationPayload) => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("ssh_confirm_host_key", {
        sessionId: payload.session_id,
        accept: true,
        host: payload.host,
        port: payload.port,
        keyType: payload.key_type,
        fingerprint: payload.fingerprint,
      });
    } catch (e) {
      console.error("Failed to confirm host key:", e);
    }
    setHostKeyVerifyPayload(null);
    setHostKeyChangedPayload(null);
  }, []);

  const handleHostKeyReject = useCallback(async (sessionId: string) => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("ssh_confirm_host_key", {
        sessionId,
        accept: false,
        host: "",
        port: 0,
        keyType: "",
        fingerprint: "",
      });
    } catch (e) {
      console.error("Failed to reject host key:", e);
    }
    setHostKeyVerifyPayload(null);
    setHostKeyChangedPayload(null);
  }, []);

  const handleHostKeyClose = useCallback(() => {
    // If user dismisses via X, reject any pending verification
    const sessionId = hostKeyVerifyPayload?.session_id ?? hostKeyChangedPayload?.session_id;
    if (sessionId) {
      handleHostKeyReject(sessionId);
    }
    setHostKeyVerifyPayload(null);
    setHostKeyChangedPayload(null);
  }, [hostKeyVerifyPayload, hostKeyChangedPayload, handleHostKeyReject]);

  return (
    <div className="app-container">
      <div className="app-main">
        <Sidebar
          collapsed={!sidebarVisible}
          onToggle={toggleSidebar}
          onNewConnection={handleNewConnection}
          onEditConnection={handleEditConnection}
          onConnect={handleSavedConnection}
          activeView={activeView}
          onViewChange={setActiveView}
        />
        <div className="app-workspace">
          {connectionError && (
            <div className="connection-error-banner">
              <span className="connection-error-text">{connectionError}</span>
              <button
                className="connection-error-close"
                onClick={() => setConnectionError(null)}
              >
                ×
              </button>
            </div>
          )}
          {connected ? (
            <>
              <div className="workspace-toolbar">
                <TabBar />
                <div className="toolbar-actions">
                  <button
                    className="toolbar-btn"
                    onClick={handleGoHome}
                    title="回到首页"
                  >
                    <VscHome size={16} />
                  </button>
                  <div className="toolbar-divider" />
                  <button
                    className="toolbar-btn"
                    onClick={handleLocalTerminal}
                    title="新建终端（Ctrl+Shift+T）"
                  >
                    <VscAdd size={16} />
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
      {dialogOpen && (
        <ConnectionDialog
          editConfig={editingConnection}
          onClose={handleDialogClose}
          onSaved={handleDialogSaved}
        />
      )}
      <HostKeyDialog
        verifyPayload={hostKeyVerifyPayload}
        changedPayload={hostKeyChangedPayload}
        onAccept={handleHostKeyAccept}
        onReject={handleHostKeyReject}
        onClose={handleHostKeyClose}
      />
    </div>
  );
}
