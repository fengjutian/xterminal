import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { useTerminalStore } from "../stores/terminalStore";
import { useAppStore } from "../stores/appStore";
import "@xterm/xterm/css/xterm.css";

type SessionKind = "local" | "ssh";

interface TerminalOutputEvent {
  session_id: string;
  data: number[];
}

export default function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const sessionKindRef = useRef<SessionKind | null>(null);

  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const tabs = useTerminalStore((s) => s.tabs);
  const pendingNewSessionId = useTerminalStore((s) => s.pendingNewSessionId);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  const cursorStyle = useAppStore((s) => s.settings.cursor_style);

  // Initialize xterm.js instance once
  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      allowProposedApi: true,
      cursorBlink: true,
      cursorStyle: cursorStyle as "block" | "underline" | "bar",
      fontSize: 14,
      fontFamily:
        "Consolas, 'Microsoft YaHei Mono', 'Noto Sans Mono CJK SC', 'Courier New', monospace",
      theme: {
        background: "#1e1e2e",
        foreground: "#cdd6f4",
        cursor: "#89b4fa",
      },
    });

    const unicode11Addon = new Unicode11Addon();
    term.loadAddon(unicode11Addon);
    term.unicode.activeVersion = "11";

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    return () => {
      term.dispose();
    };
  }, []);

  // Set up event listeners for both local and SSH output
  useEffect(() => {
    let cancelled = false;
    const cleanups: (() => void)[] = [];

    const setupListeners = async () => {
      const { listen } = await import("@tauri-apps/api/event");
      if (cancelled) return;

      // Listen for local terminal output
      const unlistenLocal = await listen<TerminalOutputEvent>(
        "local-terminal-output",
        (event) => {
          if (
            event.payload.session_id === sessionIdRef.current &&
            sessionKindRef.current === "local"
          ) {
            terminalRef.current?.write(new Uint8Array(event.payload.data));
          }
        }
      );
      if (cancelled) {
        unlistenLocal();
        return;
      }
      cleanups.push(unlistenLocal);

      // Listen for SSH terminal output
      const unlistenSsh = await listen<TerminalOutputEvent>(
        "ssh-terminal-output",
        (event) => {
          if (
            event.payload.session_id === sessionIdRef.current &&
            sessionKindRef.current === "ssh"
          ) {
            terminalRef.current?.write(new Uint8Array(event.payload.data));
          }
        }
      );
      if (cancelled) {
        unlistenSsh();
        return;
      }
      cleanups.push(unlistenSsh);
    };

    setupListeners();

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
  }, []);

  const writeToBackend = useCallback(
    async (data: string) => {
      const sessionId = sessionIdRef.current;
      const kind = sessionKindRef.current;
      if (!sessionId || !kind) return;

      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const encoder = new TextEncoder();
        const bytes = Array.from(encoder.encode(data));

        if (kind === "local") {
          await invoke("local_shell_write", { sessionId, data: bytes });
        } else {
          await invoke("ssh_write", { sessionId, data: bytes });
        }
      } catch (e) {
        console.error(`Failed to write to ${kind} shell:`, e);
      }
    },
    []
  );

  const resizeBackend = useCallback(
    async (cols: number, rows: number) => {
      const sessionId = sessionIdRef.current;
      const kind = sessionKindRef.current;
      if (!sessionId || !kind || cols <= 0 || rows <= 0) return;

      try {
        const { invoke } = await import("@tauri-apps/api/core");
        if (kind === "local") {
          await invoke("local_shell_resize", { sessionId, cols, rows });
        } else {
          await invoke("ssh_resize", { sessionId, cols, rows });
        }
      } catch {
        // best-effort resize
      }
    },
    []
  );

  // Attach keyboard input handler to terminal
  useEffect(() => {
    const term = terminalRef.current;
    if (!term) return;

    const disposable = term.onData((data: string) => {
      // Windows shells (cmd/PowerShell) expect BS (0x08) for backspace,
      // but xterm.js sends DEL (0x7f) by default — convert it.
      const normalized = data.replace(/\x7f/g, "\x08");
      writeToBackend(normalized);
    });

    return () => {
      disposable.dispose();
    };
  }, [writeToBackend]);

  // Handle resize observer
  useEffect(() => {
    const fitAddon = fitAddonRef.current;
    const term = terminalRef.current;
    if (!fitAddon || !term) return;

    const handleResize = () => {
      fitAddon.fit();
      resizeBackend(term.cols, term.rows);
    };

    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    handleResize();

    return () => observer.disconnect();
  }, [resizeBackend]);

  // Track the last session ID to avoid re-clearing on same-tab re-render
  const prevSessionRef = useRef<string | null>(null);

  // React to tab switches: clear only when a brand-new tab is activated
  useEffect(() => {
    const term = terminalRef.current;
    if (!term) return;

    if (activeTab) {
      // Same session — no-op
      if (prevSessionRef.current === activeTab.sessionId) return;

      const isNew = activeTab.sessionId === pendingNewSessionId;

      prevSessionRef.current = activeTab.sessionId;
      sessionIdRef.current = activeTab.sessionId;
      sessionKindRef.current = activeTab.kind;

      if (isNew) {
        // Newly created tab — clear so its shell output starts fresh
        term.write("\x1b[2J\x1b[H");
        term.clear();
      }
      // Existing tab switch — preserve current screen content
    } else {
      // Already showing the "no session" prompt — skip
      if (prevSessionRef.current === null) return;
      prevSessionRef.current = null;
      sessionIdRef.current = null;
      sessionKindRef.current = null;
      term.clear();
      term.writeln("\x1b[1;37mNo active terminal session.\x1b[0m");
      term.writeln(
        "\x1b[2;37mOpen a local terminal or connect to a remote host.\x1b[0m"
      );
    }
  }, [activeTab, pendingNewSessionId]);

  return <div className="terminal-container" ref={containerRef} />;
}
