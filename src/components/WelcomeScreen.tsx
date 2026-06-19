import { useState } from "react";

interface Props {
  onConnect: () => void;
}

export default function WelcomeScreen({ onConnect }: Props) {
  const [host, setHost] = useState("");

  const handleQuickConnect = () => {
    if (host.trim()) {
      // TODO: Parse host string (user@host:port) and connect
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
      <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
        Or use the sidebar to manage saved connections
      </p>
    </div>
  );
}
