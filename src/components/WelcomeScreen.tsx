import { useState } from "react";
import { VscTerminalBash, VscLink } from "react-icons/vsc";

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
          <VscLink size={16} />
          <span>Connect</span>
        </button>
      </div>
      <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
        <button className="btn btn-secondary" onClick={onLocalTerminal}>
          <VscTerminalBash size={16} />
          <span>Open Local Terminal</span>
        </button>
      </div>
      <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
        Or use the sidebar to manage saved connections
      </p>
    </div>
  );
}