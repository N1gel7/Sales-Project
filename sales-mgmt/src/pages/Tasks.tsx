import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

export default function Tasks(): React.ReactElement {
  const [tasks, setTasks] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');

  async function load() {
    const data = await api.listTasks();
    setTasks(data as any[]);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!title || !assignee) return;
    await api.createTask({ title, assignee });
    setTitle('');
    setAssignee('');
    await load();
  }

  async function markDone(id: string) {
    await api.updateTaskStatus(id, 'done');
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">Assign Work</div>
        <div className="card-body grid grid-cols-1 md:grid-cols-4 gap-3">
          <input className="h-10 border border-gray-200 rounded-md px-3 text-sm" placeholder="Task title" value={title} onChange={(e)=>setTitle(e.target.value)} />
          <input className="h-10 border border-gray-200 rounded-md px-3 text-sm" placeholder="Assign to (email)" value={assignee} onChange={(e)=>setAssignee(e.target.value)} />
          <div />
          <button onClick={create} className="h-10 rounded-md bg-blue-600 text-white text-sm px-3">Create</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">Team Tasks</div>
        <div className="card-body">
          <ul className="divide-y divide-gray-100">
            {tasks.map((t) => (
              <li key={t._id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{t.title}</div>
                  <div className="text-xs text-gray-500">Assignee: {t.assignee} • Status: {t.status}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={()=>markDone(t._id)} className="h-9 rounded-md bg-green-600 text-white px-3 text-sm">Mark Done</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}


