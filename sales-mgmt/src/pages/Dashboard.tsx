import { useEffect, useState } from 'react';
import { 
  Users, 
  CheckCircle, 
  DollarSign, 
  Calendar,
  Filter,
  MapPin,
  Package,
  Activity,
  BarChart3
} from 'lucide-react';

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
    _id: { lat: number; lng: number };
    count: number;
    types: string[];
  }>;
  dateRange: {
    start: string;
    end: string;
  };
};

type Activity = {
  type: 'task' | 'invoice' | 'upload';
  action: string;
  user: string;
  timestamp: string;
  data: any;
};

export default function Dashboard(): React.ReactElement {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  async function loadDashboard() {
    // Check if user is authenticated
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setLoading(false);
      setError('Please login to view dashboard data');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        startDate: dateRange.start,
        endDate: dateRange.end
      });

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const [statsRes, activityRes] = await Promise.all([
        fetch(`/api/dashboard/stats?${params}`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal
        }),
        fetch('/api/dashboard/activity?limit=10', {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal
        })
      ]);

      clearTimeout(timeoutId);

      if (!statsRes.ok || !activityRes.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const statsData = await statsRes.json();
      const activityData = await activityRes.json();

      setStats(statsData);
      setActivities(activityData);
    } catch (error: unknown) {
      console.error('Failed to load dashboard:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError('Failed to load dashboard data. Please check your connection.');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, [dateRange]);

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS'
    }).format(amount);
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString();
  }

  function getStatusColor(status: string) {
    const colors = {
      pending: 'text-yellow-600 bg-yellow-100',
      in_progress: 'text-blue-600 bg-blue-100',
      completed: 'text-green-600 bg-green-100',
      overdue: 'text-red-600 bg-red-100',
      cancelled: 'text-gray-600 bg-gray-100'
    };
    return colors[status as keyof typeof colors] || 'text-gray-600 bg-gray-100';
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="flex items-center justify-center space-x-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
        <p className="text-sm text-gray-500 mt-2">This may take a few seconds</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">{error}</p>
        <button 
          onClick={loadDashboard}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">No dashboard data available</p>
        <button 
          onClick={loadDashboard}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard Analytics</h1>
            <p className="text-gray-600 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>
                {stats?.dateRange ? `${formatDate(stats.dateRange.start)} - ${formatDate(stats.dateRange.end)}` : 'Loading...'}
              </span>
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Date Range Picker */}
            <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-2 shadow-sm">
              <Calendar className="h-4 w-4 text-gray-500" />
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-gray-500 text-sm">to</span>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            {/* Refresh Button */}
            <button
              onClick={loadDashboard}
              className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
            >
              <Filter className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card card-hover card-gradient">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Revenue</p>
                <p className="text-3xl font-bold text-green-600">
                  {formatCurrency(stats?.salesStats?.totalRevenue || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {stats?.salesStats?.totalInvoices || 0} invoices
              </p>
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                +12%
              </span>
            </div>
          </div>
        </div>

        <div className="card card-hover">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Tasks Completed</p>
                <p className="text-3xl font-bold text-blue-600">
                  {stats?.taskStats?.completed || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {stats?.taskStats?.pending || 0} pending
              </p>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                Active
              </span>
            </div>
          </div>
        </div>

        <div className="card card-hover">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Active Team</p>
                <p className="text-3xl font-bold text-purple-600">
                  {stats?.employeeActivity?.length || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                members active
              </p>
              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                Online
              </span>
            </div>
          </div>
        </div>

        <div className="card card-hover">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Avg Invoice</p>
                <p className="text-3xl font-bold text-orange-600">
                  {formatCurrency(stats?.salesStats?.averageInvoice || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-orange-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                per transaction
              </p>
              <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                Avg
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Status Overview */}
        <div className="card">
          <div className="card-header">Task Status Overview</div>
          <div className="card-body">
            <div className="space-y-3">
              {Object.entries(stats?.taskStats || {}).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                      {status.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Performers */}
        <div className="card">
          <div className="card-header">Top Performers</div>
          <div className="card-body">
            <div className="space-y-3">
              {stats?.employeeActivity?.slice(0, 5).map((employee, index) => (
                <div key={employee._id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{employee.name}</p>
                      <p className="text-xs text-gray-500">{employee.code}</p>
                    </div>
                  </div>
                  <span className="font-semibold text-green-600">
                    {employee.completedTasks} tasks
                  </span>
                </div>
              ))}
              {(!stats?.employeeActivity || stats.employeeActivity.length === 0) && (
                <p className="text-gray-500 text-center py-4">No activity data available</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Product Performance */}
        <div className="card">
          <div className="card-header">Top Products</div>
          <div className="card-body">
            <div className="space-y-3">
              {stats?.productPerformance?.slice(0, 5).map((product) => (
                <div key={product._id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="font-medium">{product._id}</p>
                      <p className="text-xs text-gray-500">{product.count} sales</p>
                    </div>
                  </div>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(product.revenue)}
                  </span>
                </div>
              ))}
              {(!stats?.productPerformance || stats.productPerformance.length === 0) && (
                <p className="text-gray-500 text-center py-4">No product data available</p>
              )}
            </div>
          </div>
        </div>

        {/* Location Activity */}
        <div className="card">
          <div className="card-header">Location Activity</div>
          <div className="card-body">
            <div className="space-y-3">
              {stats?.locationActivity?.slice(0, 5).map((location) => (
                <div key={`${location._id.lat}-${location._id.lng}`} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="font-medium text-sm">
                        {location._id.lat.toFixed(2)}, {location._id.lng.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {location.types.join(', ')}
                      </p>
                    </div>
                  </div>
                  <span className="font-semibold text-blue-600">
                    {location.count} uploads
                  </span>
                </div>
              ))}
              {(!stats?.locationActivity || stats.locationActivity.length === 0) && (
                <p className="text-gray-500 text-center py-4">No location data available</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Daily Sales Trend */}
      <div className="card">
        <div className="card-header">Sales Trend (Last 7 Days)</div>
        <div className="card-body">
          {stats?.dailySales && stats.dailySales.length > 0 ? (
            <div className="space-y-4">
              {stats?.dailySales?.map((day) => (
                <div key={`${day._id.year}-${day._id.month}-${day._id.day}`} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium">
                      {day._id.day}
                    </div>
                    <div>
                      <p className="font-medium">
                        {new Date(day._id.year, day._id.month - 1, day._id.day).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-500">{day.count} invoices</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">
                      {formatCurrency(day.revenue)}
                    </p>
                    <div className="w-32 bg-gray-200 rounded-full h-2 mt-1">
                      <div 
                        className="bg-green-500 h-2 rounded-full" 
                        style={{ 
                          width: `${Math.min(100, (day.revenue / Math.max(...(stats?.dailySales?.map(d => d.revenue) || [1]))) * 100)}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No sales data for the selected period</p>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="card-header">Recent Activity</div>
        <div className="card-body">
          <div className="space-y-3">
            {activities.map((activity) => (
              <div key={activity.timestamp} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  {activity.type === 'task' && <CheckCircle className="h-4 w-4 text-blue-600" />}
                  {activity.type === 'invoice' && <DollarSign className="h-4 w-4 text-green-600" />}
                  {activity.type === 'upload' && <Activity className="h-4 w-4 text-purple-600" />}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{activity.action}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">{activity.user}</span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500">
                      {new Date(activity.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {activities.length === 0 && (
              <p className="text-gray-500 text-center py-8">No recent activity</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}