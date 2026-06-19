import { create } from 'zustand';
import type { TransferTask } from '@/types';

interface TransferState {
  tasks: TransferTask[];
  isPanelOpen: boolean;

  setPanelOpen: (open: boolean) => void;
  addTask: (task: TransferTask) => void;
  updateTask: (id: string, updates: Partial<TransferTask>) => void;
  clearCompleted: () => void;
}

export const useTransferStore = create<TransferState>((set) => ({
  tasks: [],
  isPanelOpen: false,

  setPanelOpen: (open) => set({ isPanelOpen: open }),

  addTask: (task) => {
    set((s) => ({ tasks: [...s.tasks, task] }));
  },

  updateTask: (id, updates) => {
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
  },

  clearCompleted: () => {
    set((s) => ({
      tasks: s.tasks.filter(
        (t) => t.state !== 'completed' && t.state !== 'cancelled'
      ),
    }));
  },
}));
