import React from 'react';

export default function Products(): React.ReactElement {
  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">Categories</div>
        <div className="card-body grid grid-cols-1 md:grid-cols-3 gap-3">
          <select className="h-10 border border-gray-200 rounded-md px-3 text-sm">
            <option>All Categories</option>
            <option>Beverages</option>
            <option>Snacks</option>
          </select>
          <input placeholder="Price min" className="h-10 border border-gray-200 rounded-md px-3 text-sm" />
          <input placeholder="Price max" className="h-10 border border-gray-200 rounded-md px-3 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card">
            <div className="card-body">
              <div className="font-medium">Product #{i + 1}</div>
              <div className="text-xs text-gray-500">Category • GHS {(i + 1) * 10}</div>
              <div className="mt-3 flex items-center gap-2">
                <button className="h-9 px-3 rounded-md border border-gray-200 text-sm">Edit</button>
                <button className="h-9 px-3 rounded-md bg-blue-600 text-white text-sm">Add</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


