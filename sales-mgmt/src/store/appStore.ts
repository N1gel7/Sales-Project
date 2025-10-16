import { create } from 'zustand';

export type Task = {
  id: string;
  title: string;
  assignee: string;
  status: 'pending' | 'done';
};

type AppState = {
  tasks: Task[];
  addTask: (task: Task) => void;
  markDone: (id: string) => void;
};

export const useAppStore = create<AppState>((set) => ({
  tasks: [],
  addTask: (task) => set((s) => ({ tasks: [task, ...s.tasks] })),
  markDone: (id) => set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: 'done' } : t)) })),
}));


