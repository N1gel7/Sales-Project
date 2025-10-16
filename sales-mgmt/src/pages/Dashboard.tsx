import React, { useEffect, useState } from 'react';
import { http } from '../services/http';

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
  const [stats, setStats] = useState<{ todaySales: number; monthSales: number; tasksDone: number; tasksTotal: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await http<any>('/api/stats');
        setStats(data);
      } catch {}
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Sales (Today)" value={`GHS ${stats?.todaySales ?? 0}`} sub={`Month: GHS ${stats?.monthSales ?? 0}`} />
        <StatCard label="Tasks Done" value={`${stats?.tasksDone ?? 0}`} sub={`of ${stats?.tasksTotal ?? 0}`} />
        <StatCard label="Active Field Reps" value="—" sub="stub" />
        <StatCard label="Products Sold" value="—" />
      </div>

      <div className="card">
        <div className="card-header">Activity Feed</div>
        <div className="card-body">
          <ul className="divide-y divide-gray-100">
            <li className="py-3 text-sm text-gray-500">Recent activity feed coming next</li>
          </ul>
        </div>
      </div>
    </div>
  );
}


