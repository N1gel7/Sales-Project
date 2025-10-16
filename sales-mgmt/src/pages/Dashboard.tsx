import React from 'react';

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }): React.ReactElement {
  return (
    <div className="card">
      <div className="card-body">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
        {sub ? <div className="text-xs text-gray-500 mt-1">{sub}</div> : null}
      </div>
    </div>
  );
}

export default function Dashboard(): React.ReactElement {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Sales (Today)" value="$4,830" sub="+12% vs yesterday" />
        <StatCard label="Orders" value="63" sub="-3% vs last week" />
        <StatCard label="Active Field Reps" value="12" sub="of 18 total" />
        <StatCard label="Products Sold" value="147" />
      </div>

      <div className="card">
        <div className="card-header">Activity Feed</div>
        <div className="card-body">
          <ul className="divide-y divide-gray-100">
            {[1, 2, 3, 4, 5].map((i) => (
              <li key={i} className="py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Client visit completed</div>
                  <div className="text-xs text-gray-500">Rep #{i} • 2:3{i} PM • Accra</div>
                </div>
                <button className="text-blue-600 text-sm">View</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}


