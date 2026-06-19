import { useState } from "react";

interface Props {
  onConnect: () => void;
  onLocalTerminal: () => void;
}

export default function WelcomeScreen({ onConnect, onLocalTerminal }: Props) {
  const [host, setHost] = useState("");

  const handleQuickConnect = () => {
    if (host.trim()) {
      onConnect();
    }
  };

  return (
    <div className="welcome-screen">
      <h1>X-Terminal</h1>
      <p>Remote Server Management Console</p>
      <div className="quick-connect">
        <input
          type="text"
          placeholder="user@host:22"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleQuickConnect()}
        />
        <button className="btn" onClick={handleQuickConnect}>
          Connect
        </button>
      </div>
      <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
        <button className="btn btn-secondary" onClick={onLocalTerminal}>
          Open Local Terminal
        </button>
      </div>
      <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
        Or use the sidebar to manage saved connections
      </p>
    </div>
  );
}
