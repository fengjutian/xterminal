import { create } from 'zustand';
import type { SshSession } from '@/types';

interface TerminalTab {
  id: string;
  sessionId: string;
  title: string;
  isActive: boolean;
}

interface TerminalState {
  tabs: TerminalTab[];
  sessions: Map<string, SshSession>;
  activeTabId: string | null;

  createTab: (session: SshSession) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateSessionState: (sessionId: string, state: string) => void;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  tabs: [],
  sessions: new Map(),
  activeTabId: null,

  createTab: (session) => {
    const tabId = crypto.randomUUID();
    const tab: TerminalTab = {
      id: tabId,
      sessionId: session.id,
      title: session.name,
      isActive: true,
    };
    set((s) => {
      const newSessions = new Map(s.sessions);
      newSessions.set(session.id, session);
      return {
        tabs: s.tabs.map((t) => ({ ...t, isActive: false })).concat(tab),
        sessions: newSessions,
        activeTabId: tabId,
      };
    });
  },

  closeTab: (tabId) => {
    set((s) => {
      const tab = s.tabs.find((t) => t.id === tabId);
      const remaining = s.tabs.filter((t) => t.id !== tabId);
      let newActive = s.activeTabId;
      if (s.activeTabId === tabId) {
        newActive = remaining.length > 0 ? remaining[remaining.length - 1].id : null;
      }
      const newSessions = new Map(s.sessions);
      if (tab && !remaining.some((t) => t.sessionId === tab.sessionId)) {
        newSessions.delete(tab.sessionId);
      }
      return { tabs: remaining, sessions: newSessions, activeTabId: newActive };
    });
  },

  setActiveTab: (tabId) => {
    set((s) => ({
      tabs: s.tabs.map((t) => ({ ...t, isActive: t.id === tabId })),
      activeTabId: tabId,
    }));
  },

  updateSessionState: (sessionId, state) => {
    set((s) => {
      const newSessions = new Map(s.sessions);
      const session = newSessions.get(sessionId);
      if (session) {
        newSessions.set(sessionId, { ...session, state: state as SshSession['state'] });
      }
      return { sessions: newSessions };
    });
  },
}));
