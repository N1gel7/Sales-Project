import React from 'react';

export default function Tasks(): React.ReactElement {
  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">Assign Work</div>
        <div className="card-body grid grid-cols-1 md:grid-cols-4 gap-3">
          <input className="h-10 border border-gray-200 rounded-md px-3 text-sm" placeholder="Task title" />
          <input className="h-10 border border-gray-200 rounded-md px-3 text-sm" placeholder="Assign to" />
          <input type="date" className="h-10 border border-gray-200 rounded-md px-3 text-sm" />
          <button className="h-10 rounded-md bg-blue-600 text-white text-sm px-3">Create</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">Team Tasks</div>
        <div className="card-body">
          <ul className="divide-y divide-gray-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Visit market cluster #{i + 1}</div>
                  <div className="text-xs text-gray-500">Assigned to Rep #{i + 3} • Due today</div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="h-9 rounded-md border border-gray-200 px-3 text-sm">Notify</button>
                  <button className="h-9 rounded-md bg-green-600 text-white px-3 text-sm">Mark Done</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}


