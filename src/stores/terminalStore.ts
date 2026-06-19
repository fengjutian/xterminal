import { create } from "zustand";
import type { SshSession } from "@/types";

interface TerminalTab {
  id: string;
  sessionId: string;
  title: string;
  kind: "local" | "ssh";
  isActive: boolean;
}

interface TerminalState {
  tabs: TerminalTab[];
  sessions: Map<string, SshSession>;
  activeTabId: string | null;
  /** Set when a tab is freshly created; cleared on normal tab switch */
  pendingNewSessionId: string | null;

  createTab: (session: SshSession) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateSessionState: (sessionId: string, state: string) => void;
}

export const useTerminalStore = create<TerminalState>((set, _get) => ({
  tabs: [],
  sessions: new Map(),
  activeTabId: null,
  pendingNewSessionId: null,

  createTab: (session) => {
    const tabId = crypto.randomUUID();
    const tab: TerminalTab = {
      id: tabId,
      sessionId: session.id,
      title: session.name,
      kind: session.connection_id === "local" ? "local" : "ssh",
      isActive: true,
    };
    set((s) => {
      const newSessions = new Map(s.sessions);
      newSessions.set(session.id, session);
      return {
        tabs: s.tabs.map((t) => ({ ...t, isActive: false })).concat(tab),
        sessions: newSessions,
        activeTabId: tabId,
        pendingNewSessionId: session.id,
      };
    });
  },

  closeTab: (tabId) => {
    set((s) => {
      const tab = s.tabs.find((t) => t.id === tabId);
      const remaining = s.tabs.filter((t) => t.id !== tabId);
      let newActive = s.activeTabId;
      if (s.activeTabId === tabId) {
        newActive =
          remaining.length > 0 ? remaining[remaining.length - 1].id : null;
      }
      const newSessions = new Map(s.sessions);
      if (tab && !remaining.some((t) => t.sessionId === tab.sessionId)) {
        newSessions.delete(tab.sessionId);

        // Clean up backend resources: kill/disconnect
        const kind = tab.kind;
        const sessionId = tab.sessionId;
        // Fire-and-forget async cleanup
        (async () => {
          try {
            const { invoke } = await import("@tauri-apps/api/core");
            if (kind === "local") {
              await invoke("local_shell_kill", { sessionId });
            } else {
              await invoke("ssh_disconnect", { sessionId });
            }
          } catch (e) {
            console.error(`Failed to clean up ${kind} session ${sessionId}:`, e);
          }
        })();
      }
      return { tabs: remaining, sessions: newSessions, activeTabId: newActive };
    });
  },

  setActiveTab: (tabId) => {
    set((s) => ({
      tabs: s.tabs.map((t) => ({ ...t, isActive: t.id === tabId })),
      activeTabId: tabId,
      pendingNewSessionId: null,
    }));
  },

  updateSessionState: (sessionId, state) => {
    set((s) => {
      const newSessions = new Map(s.sessions);
      const session = newSessions.get(sessionId);
      if (session) {
        newSessions.set(sessionId, {
          ...session,
          state: state as SshSession["state"],
        });
      }
      return { sessions: newSessions };
    });
  },
}));
