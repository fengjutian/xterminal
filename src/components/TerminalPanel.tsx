import { useEffect, useRef } from "react";

export default function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // TODO: Initialize xterm.js Terminal instance
    // const term = new Terminal({ ... });
    // const fitAddon = new FitAddon();
    // term.open(containerRef.current!);
    // fitAddon.fit();
    console.log("Terminal panel mounted");
  }, []);

  return <div className="terminal-container" ref={containerRef} />;
}
