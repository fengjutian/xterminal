import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { useTerminalStore } from "../stores/terminalStore";
import "@xterm/xterm/css/xterm.css";

export default function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const tabs = useTerminalStore((s) => s.tabs);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "Consolas, 'Courier New', monospace",
      theme: {
        background: "#1e1e2e",
        foreground: "#cdd6f4",
        cursor: "#89b4fa",
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    // Listen for local terminal output events
    const setupListener = async () => {
      const { listen } = await import("@tauri-apps/api/event");
      const unlisten = await listen<{ session_id: string; data: number[] }>(
        "local-terminal-output",
        (event) => {
          if (event.payload.session_id === sessionIdRef.current) {
            const data = new Uint8Array(event.payload.data);
            term.write(data);
          }
        }
      );
      return unlisten;
    };

    let cleanup: (() => void) | undefined;
    setupListener().then((fn) => {
      cleanup = fn;
    });

    return () => {
      cleanup?.();
      term.dispose();
    };
  }, []);

  // Track active session
  useEffect(() => {
    if (activeTab) {
      sessionIdRef.current = activeTab.sessionId;
    }
  }, [activeTab]);

  // Handle keyboard input
  useEffect(() => {
    const term = terminalRef.current;
    if (!term) return;

    const handleData = async (data: string) => {
      if (!sessionIdRef.current) return;
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const encoder = new TextEncoder();
        await invoke("local_shell_write", {
          sessionId: sessionIdRef.current,
          data: Array.from(encoder.encode(data)),
        });
      } catch (e) {
        console.error("Failed to write to shell:", e);
      }
    };

    const disposable = term.onData(handleData);
    return () => {
      disposable.dispose();
    };
  }, []);

  // Handle resize
  useEffect(() => {
    const fitAddon = fitAddonRef.current;
    const term = terminalRef.current;
    if (!fitAddon || !term) return;

    const handleResize = () => {
      fitAddon.fit();
      // Notify backend of resize
      if (sessionIdRef.current && term.rows > 0 && term.cols > 0) {
        import("@tauri-apps/api/core").then(({ invoke }) => {
          invoke("local_shell_resize", {
            sessionId: sessionIdRef.current,
            cols: term.cols,
            rows: term.rows,
          }).catch(() => {});
        });
      }
    };

    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    handleResize();

    return () => observer.disconnect();
  }, []);

  return <div className="terminal-container" ref={containerRef} />;
}
