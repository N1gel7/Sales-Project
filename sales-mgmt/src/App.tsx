import React from 'react';
import { NavLink, Route, Routes, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, ClipboardList, Upload, FileText, Map, ListTree } from 'lucide-react';

import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Tasks from './pages/Tasks';
import Uploads from './pages/Uploads';
import Billing from './pages/Billing';
import MapView from './pages/MapView';
import Login from './pages/Login';
import Categories from './pages/Categories';
import Invoices from './pages/Invoices';
import { decodeJwt } from './services/http';

function useUser() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  if (!token) return null;
  const payload = decodeJwt<{ uid?: string; role?: string; code?: string; name?: string; email?: string }>(token);
  return payload ? { 
    id: payload.uid, 
    role: payload.role, 
    code: payload.code, 
    name: payload.name, 
    email: payload.email 
  } : null;
}

function useRole(): string | null {
  const user = useUser();
  return user?.role ?? null;
}

function RequireAuth({ children, roles }: { children: React.ReactElement; roles?: string[] }) {
  const role = useRole();
  const location = useLocation();
  if (!role) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && !roles.includes(role)) return <Navigate to="/" replace />;
  return children;
}

function UserInfo() {
  const user = useUser();
  if (!user) return null;
  
  const roleColors = {
    admin: 'bg-red-100 text-red-800',
    manager: 'bg-blue-100 text-blue-800', 
    sales: 'bg-green-100 text-green-800'
  };
  
  return (
    <div className="flex items-center gap-2">
      <div className="text-sm">
        <div className="font-medium">{user.name}</div>
        <div className="text-xs text-gray-500">{user.code}</div>
      </div>
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColors[user.role as keyof typeof roleColors] || 'bg-gray-100 text-gray-800'}`}>
        {user.role?.toUpperCase()}
      </span>
    </div>
  );
}

function LogoutButton() {
  const navigate = useNavigate();
  function logout() {
    localStorage.removeItem('auth_token');
    navigate('/login');
  }
  return (
    <button onClick={logout} className="h-9 px-3 rounded-md border border-gray-200 text-sm hover:bg-gray-50">
      Logout
    </button>
  );
}

function App(): React.ReactElement {
  const location = useLocation();
  const isAuthRoute = location.pathname === '/login';

  if (isAuthRoute) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="flex">
        <aside className="hidden md:flex md:w-64 lg:w-72 min-h-screen bg-white border-r border-gray-200">
          <div className="flex flex-col w-full">
            <div className="px-6 py-5 border-b border-gray-100">
              <div className="text-xl font-semibold">Sales Manager</div>
              <div className="text-xs text-gray-500">Field ops & tracking</div>
            </div>
            <nav className="flex-1 p-4 space-y-1">
              <SideLink to="/" icon={<LayoutDashboard size={18} />} label="Dashboard" />
              <SideLink to="/products" icon={<Package size={18} />} label="Products" />
              <SideLink to="/categories" icon={<ListTree size={18} />} label="Categories" />
              <SideLink to="/tasks" icon={<ClipboardList size={18} />} label="Tasks" />
              <SideLink to="/uploads" icon={<Upload size={18} />} label="Uploads" />
              <SideLink to="/billing" icon={<FileText size={18} />} label="Billing" />
              <SideLink to="/invoices" icon={<FileText size={18} />} label="Invoices" />
              <SideLink to="/map" icon={<Map size={18} />} label="Map" />
            </nav>
            <div className="p-4 text-xs text-gray-500">v0.1.0</div>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
            <div className="px-4 md:px-6 py-3 flex items-center justify-between">
              <div className="font-medium">Sales & Marketing Team Management</div>
              <div className="flex items-center gap-2">
                <input className="h-9 w-56 rounded-md border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Search products, people..." />
                <button className="h-9 rounded-md border border-gray-200 px-3 text-sm hover:bg-gray-50">Export</button>
                <UserInfo />
                <LogoutButton />
              </div>
            </div>
          </header>
          <main className="p-4 md:p-6">
            <Routes>
              <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
              <Route path="/products" element={<RequireAuth roles={["admin","manager"]}><Products /></RequireAuth>} />
              <Route path="/categories" element={<RequireAuth roles={["admin","manager"]}><Categories /></RequireAuth>} />
              <Route path="/tasks" element={<RequireAuth roles={["sales","manager","admin"]}><Tasks /></RequireAuth>} />
              <Route path="/uploads" element={<RequireAuth roles={["sales","manager","admin"]}><Uploads /></RequireAuth>} />
              <Route path="/billing" element={<RequireAuth roles={["sales","manager","admin"]}><Billing /></RequireAuth>} />
              <Route path="/invoices" element={<RequireAuth roles={["sales","manager","admin"]}><Invoices /></RequireAuth>} />
              <Route path="/map" element={<RequireAuth><MapView /></RequireAuth>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}

function SideLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }): React.ReactElement {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
          isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
        }`
      }
      end={to === '/'}
    >
      <span className="text-gray-500">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}

export default App;


