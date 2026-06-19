import { useState, useMemo } from "react";
import {
  VscTerminalBash,
  VscRemote,
  VscServer,
  VscLink,
  VscSync,
  VscKey,
  VscPass,
} from "react-icons/vsc";
import { useConnectionStore } from "../stores/connectionStore";
import type { ConnectionConfig } from "../types";

interface QuickConnectInfo {
  username: string;
  host: string;
  port: number;
}

interface Props {
  onConnect: (connection: { host: string; port: number; username: string; password: string }) => void;
  onLocalTerminal: () => void;
  onSavedConnection: (config: ConnectionConfig) => void;
}

/** Parse "user@host:22" or "host:22" or "host" */
function parseConnectString(raw: string): QuickConnectInfo | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Remove leading protocol if accidentally pasted (ssh://)
  let s = trimmed.replace(/^ssh:\/\//i, "");

  let username = "";
  let host = "";
  let port = 22;

  if (s.includes("@")) {
    const atIdx = s.indexOf("@");
    username = s.slice(0, atIdx);
    s = s.slice(atIdx + 1);
  }

  // Check for IPv6 [::1]:port
  if (s.startsWith("[")) {
    const closeBracket = s.indexOf("]");
    if (closeBracket === -1) return null;
    host = s.slice(1, closeBracket);
    const rest = s.slice(closeBracket + 1);
    if (rest.startsWith(":")) {
      const p = parseInt(rest.slice(1), 10);
      if (!isNaN(p) && p > 0 && p <= 65535) port = p;
    }
  } else if (s.includes(":")) {
    const lastColon = s.lastIndexOf(":");
    host = s.slice(0, lastColon);
    const p = parseInt(s.slice(lastColon + 1), 10);
    if (!isNaN(p) && p > 0 && p <= 65535) port = p;
    else host = s; // colon was not a port
  } else {
    host = s;
  }

  if (!host) return null;
  if (!username) username = "root";

  return { username, host, port };
}

export default function WelcomeScreen({
  onConnect,
  onLocalTerminal,
  onSavedConnection,
}: Props) {
  const [hostInput, setHostInput] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [activeCard, setActiveCard] = useState<"quick" | "local" | null>(null);

  const connections = useConnectionStore((s) => s.connections);

  const parsed = useMemo(() => parseConnectString(hostInput), [hostInput]);

  const handleQuickConnect = async () => {
    if (!parsed || connecting) return;
    setConnecting(true);
    try {
      await onConnect({
        host: parsed.host,
        port: parsed.port,
        username: parsed.username,
        password,
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleSavedClick = (config: ConnectionConfig) => {
    onSavedConnection(config);
  };

  return (
    <div className="welcome-screen">
      {/* Hero */}
      <div className="welcome-hero">
        <div className="welcome-logo">
          <VscTerminalBash size={48} />
        </div>
        <h1 className="welcome-title">X-Terminal</h1>
        <p className="welcome-subtitle">Remote Server Management Console</p>
      </div>

      {/* Quick Connect Card */}
      <div className={`welcome-card ${activeCard === "quick" ? "expanded" : ""}`}>
        <button
          className="welcome-card-trigger"
          onClick={() => setActiveCard(activeCard === "quick" ? null : "quick")}
        >
          <span className="welcome-card-icon">
            <VscRemote size={20} />
          </span>
          <div className="welcome-card-info">
            <span className="welcome-card-label">Quick Connect</span>
            <span className="welcome-card-desc">SSH to a remote server</span>
          </div>
          <VscLink size={16} className="welcome-card-chevron" />
        </button>

        <div className="welcome-card-body">
          <div className="quick-connect-form">
            <div className="quick-connect-row">
              <input
                type="text"
                className="welcome-input"
                placeholder="user@host:22"
                value={hostInput}
                onChange={(e) => setHostInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (parsed && !password) {
                      // Focus password field
                      const pwInput = document.getElementById("qc-password") as HTMLInputElement;
                      pwInput?.focus();
                    } else if (parsed && password) {
                      handleQuickConnect();
                    }
                  }
                }}
                autoFocus
              />
            </div>

            {parsed && (
              <div className="quick-connect-meta">
                <span className="qc-badge">
                  <VscServer size={12} />
                  {parsed.host}:{parsed.port}
                </span>
                <span className="qc-badge">
                  <VscPass size={12} />
                  {parsed.username}
                </span>
              </div>
            )}

            {parsed && (
              <div className="quick-connect-row">
                <div className="password-input-wrap">
                  <input
                    id="qc-password"
                    type={showPassword ? "text" : "password"}
                    className="welcome-input"
                    placeholder="Password (or use key)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && password) {
                        handleQuickConnect();
                      }
                    }}
                  />
                  <button
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    type="button"
                  >
                    <VscKey size={14} />
                  </button>
                </div>
              </div>
            )}

            <button
              className="btn welcome-connect-btn"
              disabled={!parsed || connecting}
              onClick={handleQuickConnect}
            >
              {connecting ? (
                <>
                  <VscSync size={16} className="spin" />
                  <span>Connecting…</span>
                </>
              ) : (
                <>
                  <VscRemote size={16} />
                  <span>Connect</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Local Terminal Card */}
      <div className={`welcome-card ${activeCard === "local" ? "expanded" : ""}`}>
        <button
          className="welcome-card-trigger"
          onClick={() => {
            setActiveCard(activeCard === "local" ? null : "local");
            // Immediately launch local terminal
            onLocalTerminal();
          }}
        >
          <span className="welcome-card-icon">
            <VscTerminalBash size={20} />
          </span>
          <div className="welcome-card-info">
            <span className="welcome-card-label">Open Local Terminal</span>
            <span className="welcome-card-desc">PowerShell / bash on this machine</span>
          </div>
          <VscLink size={16} className="welcome-card-chevron" />
        </button>

        <div className="welcome-card-body">
          <p className="welcome-hint">
            Launch a local shell session directly. Use{" "}
            <kbd>Ctrl+Shift+T</kbd> to open new tabs later.
          </p>
        </div>
      </div>

      {/* Saved Connections */}
      {connections.length > 0 && (
        <div className="welcome-saved-section">
          <h3 className="welcome-section-title">Saved Connections</h3>
          <div className="welcome-saved-list">
            {connections.map((conn) => (
              <button
                key={conn.id}
                className="welcome-saved-item"
                onClick={() => handleSavedClick(conn)}
              >
                <VscServer size={14} />
                <span className="welcome-saved-name">{conn.name}</span>
                <span className="welcome-saved-host">
                  {conn.username}@{conn.host}:{conn.port}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
