import { useEffect, useMemo, useState } from 'react';
import Chart from 'react-apexcharts';
import {
  DollarSign,
  CheckCircle,
  Users,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Upload,
} from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import LocationText from '../components/LocationText';
import { useShell } from '../context/ShellContext';
import { StatusBadge } from '@/components/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type DashboardStats = {
  taskStats: Record<string, number>;
  salesStats: {
    totalRevenue: number;
    totalInvoices: number;
    averageInvoice: number;
  };
  dailySales: Array<{
    _id: { year: number; month: number; day: number };
    revenue: number;
    count: number;
  }>;
  employeeActivity: Array<{
    _id: string;
    name: string;
    code: string;
    completedTasks: number;
  }>;
  productPerformance: Array<{
    _id: string;
    revenue: number;
    count: number;
  }>;
  locationActivity: Array<{
    _id: { lat: number; lng: number } | string;
    count: number;
    types: string[];
  }>;
  dateRange: { start: string; end: string };
};

type Activity = {
  _id?: string;
  type: 'task' | 'invoice' | 'upload';
  action: string;
  user: string;
  timestamp: string;
  data: unknown;
};

type TaskRow = {
  _id: string;
  title: string;
  status: string;
  assignee: { name: string } | null;
  dueAt?: string;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(amount);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString();
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Dashboard(): React.ReactElement {
  const { dateRange } = useShell();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [openTasks, setOpenTasks] = useState<TaskRow[]>([]);
  const [uploadCount, setUploadCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [mapFilterImg, setMapFilterImg] = useState(true);
  const [mapFilterVid, setMapFilterVid] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem('user_info');
    if (!raw) return;
    try {
      const u = JSON.parse(raw) as { role?: string; id?: string; _id?: string };
      setRole(u.role ?? null);
      setUserId(u.id ?? u._id ?? null);
    } catch {
      /* ignore */
    }
  }, []);

  async function loadDashboard() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setLoading(false);
      setError('Please sign in to view the dashboard.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      const r = role;
      const uid = userId;
      if (r === 'sales' && uid) params.set('userId', uid);

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 12000);

      const headers = { Authorization: `Bearer ${token}` };
      const [statsRes, activityRes, tasksRes, uploadsRes] = await Promise.all([
        fetch(`/api/dashboard/stats?${params}`, { headers, signal: controller.signal }),
        fetch('/api/dashboard/activity?limit=5', { headers, signal: controller.signal }),
        fetch('/api/tasks', { headers, signal: controller.signal }),
        fetch('/api/uploads', { headers, signal: controller.signal }).catch(() => null),
      ]);

      window.clearTimeout(timeoutId);

      if (statsRes.status === 401 || activityRes.status === 401) {
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
        return;
      }

      if (!statsRes.ok || !activityRes.ok) {
        throw new Error('Could not load dashboard data.');
      }

      const statsData = (await statsRes.json()) as DashboardStats;
      const activityData = await activityRes.json();
      setStats(statsData);
      setActivities(Array.isArray(activityData) ? activityData : []);

      if (tasksRes.ok) {
        const td = await tasksRes.json();
        const arr = Array.isArray(td) ? td : [];
        const open = arr
          .filter(
            (t: TaskRow) =>
              t.status === 'pending' || t.status === 'in_progress' || t.status === 'overdue'
          )
          .slice(0, 5) as TaskRow[];
        setOpenTasks(open);
      }

      if (uploadsRes?.ok) {
        const ud = await uploadsRes.json();
        setUploadCount(Array.isArray(ud) ? ud.length : 0);
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        setError('Request timed out. Try again.');
      } else {
        setError('We could not load the dashboard. Check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, [dateRange.start, dateRange.end, role, userId]);

  const mapPoints = useMemo(() => {
    if (!stats?.locationActivity?.length) return [];
    return stats.locationActivity
      .map((loc, idx) => {
        let lat: number | undefined;
        let lng: number | undefined;
        const id = loc._id;
        if (id && typeof id === 'object') {
          lat = id.lat;
          lng = id.lng;
        } else if (typeof id === 'string') {
          try {
            const p = JSON.parse(id) as { lat?: number; lng?: number };
            lat = p.lat;
            lng = p.lng;
          } catch {
            /* ignore */
          }
        }
        if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const types = Array.isArray(loc.types) ? loc.types : [];
        const isImg = types.some((t) => /image/i.test(t));
        const isVid = types.some((t) => /video/i.test(t));
        if (!mapFilterImg && isImg && !isVid) return null;
        if (!mapFilterVid && isVid && !isImg) return null;
        if (!mapFilterImg && !mapFilterVid) return null;
        return { lat, lng, count: loc.count, types, idx };
      })
      .filter(Boolean) as Array<{ lat: number; lng: number; count: number; types: string[]; idx: number }>;
  }, [stats?.locationActivity, mapFilterImg, mapFilterVid]);

  const center = useMemo(() => {
    if (mapPoints.length) return [mapPoints[0].lat, mapPoints[0].lng] as [number, number];
    return [5.6037, -0.187] as [number, number];
  }, [mapPoints]);

  const barSeries = useMemo(() => {
    const pp = stats?.productPerformance?.slice(0, 6) ?? [];
    return {
      cats: pp.map((p) => p._id),
      vals: pp.map((p) => p.revenue ?? 0),
    };
  }, [stats?.productPerformance]);

  const sparkSeries = useMemo(() => {
    const ds = stats?.dailySales?.slice(-7) ?? [];
    return ds.map((d) => d.revenue ?? 0);
  }, [stats?.dailySales]);

  if (loading && !stats) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-xl lg:col-span-1" />
          <Skeleton className="h-80 rounded-xl lg:col-span-1" />
          <Skeleton className="h-80 rounded-xl lg:col-span-1" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-6 text-center text-sm text-destructive">
        {error}
        <button
          type="button"
          className="mt-3 block w-full rounded-lg bg-[var(--brand-dark)] py-2 text-white"
          onClick={() => void loadDashboard()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center text-muted-foreground">
        No dashboard data.
        <button type="button" className="mt-2 block text-[var(--brand-green)]" onClick={() => void loadDashboard()}>
          Retry
        </button>
      </div>
    );
  }

  const ts = stats.taskStats || {};
  const completed = ts.completed ?? 0;
  const revenue = stats.salesStats?.totalRevenue ?? 0;
  const team = stats.employeeActivity?.length ?? 0;
  const avgInv = stats.salesStats?.averageInvoice ?? 0;

  function KpiCard({
    label,
    value,
    sub,
    delta,
    icon: Icon,
  }: {
    label: string;
    value: string;
    sub?: string;
    delta?: number;
    icon: React.ElementType;
  }) {
    const up = delta != null && delta >= 0;
    return (
      <div className="rounded-xl border border-[var(--color-border-tertiary)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="page-title mt-1 text-[26px] leading-none text-foreground">{value}</p>
            {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className="rounded-lg bg-[var(--surface-2)] p-2">
            <Icon className="h-5 w-5 text-[var(--brand-green)]" />
          </div>
        </div>
        {delta != null && (
          <p
            className={cn(
              'mt-3 flex items-center gap-1 text-xs font-medium',
              up ? 'text-[var(--brand-green-dark)]' : 'text-[var(--accent-red)]'
            )}
          >
            {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {up ? '+' : ''}
            {delta}% vs prior period
          </p>
        )}
      </div>
    );
  }

  const showAdminKpis = role === 'admin';
  const showManagerKpis = role === 'manager';
  const showSalesKpis = role === 'sales';

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {stats.dateRange
          ? `${formatDate(stats.dateRange.start)} – ${formatDate(stats.dateRange.end)}`
          : `${formatDate(dateRange.start)} – ${formatDate(dateRange.end)}`}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {showAdminKpis && (
          <>
            <KpiCard
              label="Total revenue"
              value={formatCurrency(revenue)}
              sub={`${stats.salesStats?.totalInvoices ?? 0} invoices`}
              delta={12}
              icon={DollarSign}
            />
            <KpiCard label="Tasks completed" value={String(completed)} sub={`${ts.pending ?? 0} pending`} delta={4} icon={CheckCircle} />
            <KpiCard label="Active team" value={String(team)} sub="members" delta={2} icon={Users} />
            <KpiCard label="Avg invoice" value={formatCurrency(avgInv)} sub="per transaction" delta={-1} icon={BarChart3} />
          </>
        )}
        {showManagerKpis && (
          <>
            <KpiCard label="Total revenue" value={formatCurrency(revenue)} sub="In range" delta={8} icon={DollarSign} />
            <KpiCard label="Tasks completed" value={String(completed)} sub="Pipeline" delta={5} icon={CheckCircle} />
          </>
        )}
        {showSalesKpis && (
          <>
            <KpiCard label="Your tasks" value={String(completed)} sub="Completed in range" delta={3} icon={CheckCircle} />
            <KpiCard
              label="Uploads"
              value={uploadCount != null ? String(uploadCount) : '—'}
              sub="Total uploads visible to you"
              delta={6}
              icon={Upload}
            />
          </>
        )}
        {!showAdminKpis && !showManagerKpis && !showSalesKpis && (
          <KpiCard label="Tasks completed" value={String(completed)} sub="All statuses" icon={CheckCircle} />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {(showAdminKpis || showManagerKpis) && (
          <div className="rounded-xl border border-[var(--color-border-tertiary)] bg-[var(--surface)] p-4 shadow-sm lg:col-span-1">
            <h3 className="text-sm font-medium text-foreground">Revenue by category</h3>
            {barSeries.vals.length > 0 ? (
              <>
                <div className="h-56">
                  <Chart
                    type="bar"
                    height="100%"
                    width="100%"
                    series={[{ name: 'Revenue', data: barSeries.vals }]}
                    options={{
                      chart: { type: 'bar', fontFamily: 'DM Sans, sans-serif', toolbar: { show: false } },
                      plotOptions: { bar: { horizontal: true, barHeight: '70%', distributed: true, borderRadius: 4 } },
                      colors: ['#639922', '#378ADD', '#BA7517', '#94a3b8', '#64748b', '#cbd5e1'],
                      dataLabels: { enabled: false },
                      xaxis: {
                        categories: barSeries.cats,
                        labels: {
                          formatter: (v: string | number) =>
                            new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', maximumFractionDigits: 0 }).format(Number(v)),
                        },
                      },
                      grid: { borderColor: 'var(--color-border-tertiary)', strokeDashArray: 4 },
                    }}
                  />
                </div>
                <div className="mt-2 h-16">
                  <Chart
                    type="area"
                    height="64"
                    width="100%"
                    series={[{ name: 'Trend', data: sparkSeries.length ? sparkSeries : [0] }]}
                    options={{
                      chart: { sparkline: { enabled: true }, fontFamily: 'DM Sans, sans-serif' },
                      stroke: { curve: 'smooth', width: 2 },
                      fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05 } },
                      colors: ['#639922'],
                      tooltip: { enabled: false },
                    }}
                  />
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No category revenue in this range.</p>
            )}
          </div>
        )}

        <div
          className={cn(
            'rounded-xl border border-[var(--color-border-tertiary)] bg-[var(--surface)] p-4 shadow-sm',
            showAdminKpis || showManagerKpis ? 'lg:col-span-1' : 'lg:col-span-2'
          )}
        >
          <h3 className="text-sm font-medium text-foreground">Tasks & activity</h3>
          <div className="mt-3 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Open tasks</p>
            <ul className="space-y-2">
              {openTasks.map((t) => (
                <li
                  key={t._id}
                  className="flex items-center gap-2 rounded-lg border border-[var(--color-border-tertiary)] px-2 py-2 text-sm"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--brand-green)]" />
                  <span className="min-w-0 flex-1 truncate font-medium">{t.title}</span>
                  <StatusBadge status={t.status as 'pending' | 'in_progress' | 'overdue'} />
                </li>
              ))}
              {openTasks.length === 0 && (
                <li className="text-sm text-muted-foreground">No open tasks in view.</li>
              )}
            </ul>
          </div>
          {(role === 'admin' || role === 'manager') && (
            <div className="mt-6 border-t border-[var(--color-border-tertiary)] pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recent activity</p>
              <ul className="mt-2 space-y-2">
                {activities.slice(0, 5).map((a) => (
                  <li key={a._id || a.timestamp} className="flex gap-2 text-sm">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs font-medium">
                      {(a.user || '?').slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-foreground">{a.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.user} · {relTime(a.timestamp)}
                      </p>
                    </div>
                  </li>
                ))}
                {activities.length === 0 && <li className="text-sm text-muted-foreground">No recent activity.</li>}
              </ul>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[var(--color-border-tertiary)] bg-[var(--surface)] p-4 shadow-sm lg:col-span-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium text-foreground">Field map</h3>
            <div className="ml-auto flex gap-1">
              <button
                type="button"
                onClick={() => setMapFilterImg((v) => !v)}
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-medium',
                  mapFilterImg ? 'bg-[var(--brand-dark)] text-white' : 'bg-muted text-muted-foreground'
                )}
              >
                Image
              </button>
              <button
                type="button"
                onClick={() => setMapFilterVid((v) => !v)}
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-medium',
                  mapFilterVid ? 'bg-[var(--brand-dark)] text-white' : 'bg-muted text-muted-foreground'
                )}
              >
                Video
              </button>
            </div>
          </div>
          <div className="h-64 overflow-hidden rounded-lg">
            <MapContainer center={center} zoom={mapPoints.length ? 8 : 6} className="h-full w-full" scrollWheelZoom>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM" />
              {mapPoints.map((p) => (
                <CircleMarker
                  key={`${p.lat}-${p.lng}-${p.idx}`}
                  center={[p.lat, p.lng]}
                  radius={8 + Math.min(p.count, 12)}
                  pathOptions={{
                    color: p.types.some((t) => /video/i.test(t)) ? '#378ADD' : '#639922',
                    fillColor: p.types.some((t) => /video/i.test(t)) ? '#378ADD' : '#639922',
                    fillOpacity: 0.35,
                  }}
                >
                  <Popup>
                    <div className="min-w-[180px] text-xs">
                      <p className="font-medium">
                        <LocationText lat={p.lat} lng={p.lng} />
                      </p>
                      <p className="text-muted-foreground">{p.count} uploads</p>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
          <div className="mt-2 flex gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[var(--brand-green)]" /> Image
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[var(--accent-blue)]" /> Video
            </span>
          </div>
        </div>
      </div>

      {role === 'admin' && stats.dailySales && stats.dailySales.length > 0 && (
        <div className="rounded-xl border border-[var(--color-border-tertiary)] bg-[var(--surface)] p-4 shadow-sm">
          <h3 className="text-sm font-medium">Revenue trend</h3>
          <div className="h-72">
            <Chart
              type="area"
              height="100%"
              width="100%"
              series={[{ name: 'Revenue', data: stats.dailySales.map((d) => d.revenue ?? 0) }]}
              options={{
                chart: { fontFamily: 'DM Sans, sans-serif', toolbar: { show: false } },
                colors: ['#639922'],
                stroke: { curve: 'smooth', width: 2 },
                fill: {
                  type: 'gradient',
                  gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05 },
                },
                xaxis: {
                  categories: stats.dailySales.map((day) => {
                    const { year, month, day: dd } = day._id;
                    return year != null && month != null && dd != null
                      ? new Date(year, month - 1, dd).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                      : '';
                  }),
                },
                yaxis: {
                  labels: {
                    formatter: (v: number) =>
                      new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', maximumFractionDigits: 0 }).format(v),
                  },
                },
                grid: { borderColor: 'var(--color-border-tertiary)', strokeDashArray: 4 },
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
