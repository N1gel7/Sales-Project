import React, { useState } from 'react';
import { NavLink, Route, Routes, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  ClipboardList, 
  Upload, 
  FileText, 
  Map, 
  ListTree, 
  MessageCircle, 
  FileText as ReportIcon,
  Menu,
  X,
  LogOut,
  User,
  Settings,
  Bell,
  Search,
  ChevronDown
} from 'lucide-react';

import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Tasks from './pages/Tasks';
import Uploads from './pages/Uploads';
import Billing from './pages/Billing';
import MapViewSimple from './pages/MapViewSimple';
import Login from './pages/Login';
import Categories from './pages/Categories';
import Invoices from './pages/Invoices';
import Chat from './pages/Chat';
import Reports from './pages/Reports';
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
  const [showDropdown, setShowDropdown] = useState(false);
  if (!user) return null;
  
  const roleColors = {
    admin: 'bg-red-100 text-red-800 border-red-200',
    manager: 'bg-blue-100 text-blue-800 border-blue-200', 
    sales: 'bg-green-100 text-green-800 border-green-200'
  };
  
  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
          <User className="h-4 w-4 text-blue-600" />
        </div>
        <div className="hidden sm:block text-left">
          <div className="text-sm font-medium text-gray-900">{user.name}</div>
          <div className="text-xs text-gray-500">{user.code}</div>
        </div>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>
      
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="font-medium text-gray-900">{user.name}</div>
                <div className="text-sm text-gray-500">{user.email}</div>
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${roleColors[user.role as keyof typeof roleColors] || 'bg-gray-100 text-gray-800'}`}>
                  {user.role?.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
          <div className="py-1">
            <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </button>
            <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LogoutButton() {
  const navigate = useNavigate();
  function logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    navigate('/login');
  }
  return (
    <button 
      onClick={logout} 
      className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">Logout</span>
    </button>
  );
}

function App(): React.ReactElement {
  const location = useLocation();
  const isAuthRoute = location.pathname === '/login';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (isAuthRoute) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 text-gray-900">
      <div className="flex">
        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setMobileMenuOpen(false)} />
            <div className="fixed inset-y-0 left-0 w-80 bg-white shadow-xl">
              <div className="flex flex-col h-full">
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <div className="text-xl font-bold text-gray-900">Sales Manager</div>
                    <div className="text-sm text-gray-500">Field ops & tracking</div>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 rounded-lg hover:bg-gray-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                  <SideLink to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" />
                  <SideLink to="/products" icon={<Package size={20} />} label="Products" />
                  <SideLink to="/categories" icon={<ListTree size={20} />} label="Categories" />
                  <SideLink to="/tasks" icon={<ClipboardList size={20} />} label="Tasks" />
                  <SideLink to="/uploads" icon={<Upload size={20} />} label="Uploads" />
                  <SideLink to="/billing" icon={<FileText size={20} />} label="Billing" />
                  <SideLink to="/invoices" icon={<FileText size={20} />} label="Invoices" />
                  <SideLink to="/chat" icon={<MessageCircle size={20} />} label="Chat" />
                  <SideLink to="/reports" icon={<ReportIcon size={20} />} label="Reports" />
                  <SideLink to="/map" icon={<Map size={20} />} label="Map" />
                </nav>
                <div className="p-4 border-t border-gray-100">
                  <div className="text-xs text-gray-500 mb-2">Version 0.1.0</div>
                  <div className="flex items-center justify-between">
                    <UserInfo />
                    <LogoutButton />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex lg:w-72 xl:w-80 min-h-screen bg-white border-r border-gray-200 shadow-sm">
          <div className="flex flex-col w-full">
            <div className="px-6 py-6 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <LayoutDashboard className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xl font-bold">Sales Manager</div>
                  <div className="text-sm text-blue-100">Field ops & tracking</div>
                </div>
              </div>
            </div>
            <nav className="flex-1 p-4 space-y-2">
              <SideLink to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" />
              <SideLink to="/products" icon={<Package size={20} />} label="Products" />
              <SideLink to="/categories" icon={<ListTree size={20} />} label="Categories" />
              <SideLink to="/tasks" icon={<ClipboardList size={20} />} label="Tasks" />
              <SideLink to="/uploads" icon={<Upload size={20} />} label="Uploads" />
              <SideLink to="/billing" icon={<FileText size={20} />} label="Billing" />
              <SideLink to="/invoices" icon={<FileText size={20} />} label="Invoices" />
              <SideLink to="/chat" icon={<MessageCircle size={20} />} label="Chat" />
              <SideLink to="/reports" icon={<ReportIcon size={20} />} label="Reports" />
              <SideLink to="/map" icon={<Map size={20} />} label="Map" />
            </nav>
            <div className="p-4 border-t border-gray-100 bg-gray-50">
              
              <div className="flex items-center justify-between">
                <UserInfo />
                <LogoutButton />
              </div>
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col">
          {/* Header */}
          <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-sm border-b border-gray-200 shadow-sm">
            <div className="px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex items-center justify-between">
                {/* Mobile Menu Button */}
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Menu className="h-6 w-6" />
                </button>

                {/* Page Title */}
                <div className="flex-1 lg:flex-none">
                  <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                    Sales & Marketing Team Management
                  </h1>
                </div>

                {/* Search and Actions */}
                <div className="flex items-center gap-3">
                  {/* Search */}
                  <div className="hidden sm:block relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input 
                      className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                      placeholder="Search products, people..." 
                    />
                  </div>

                  {/* Notifications */}
                  <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors relative">
                    <Bell className="h-5 w-5 text-gray-600" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                  </button>

                  {/* User Menu */}
                  <div className="hidden sm:flex items-center gap-3">
                    <UserInfo />
                    <LogoutButton />
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <Routes>
              <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
              <Route path="/products" element={<RequireAuth roles={["admin","manager"]}><Products /></RequireAuth>} />
              <Route path="/categories" element={<RequireAuth roles={["admin","manager"]}><Categories /></RequireAuth>} />
              <Route path="/tasks" element={<RequireAuth roles={["sales","manager","admin"]}><Tasks /></RequireAuth>} />
              <Route path="/uploads" element={<RequireAuth roles={["sales","manager","admin"]}><Uploads /></RequireAuth>} />
              <Route path="/billing" element={<RequireAuth roles={["sales","manager","admin"]}><Billing /></RequireAuth>} />
              <Route path="/invoices" element={<RequireAuth roles={["sales","manager","admin"]}><Invoices /></RequireAuth>} />
              <Route path="/chat" element={<RequireAuth roles={["sales","manager","admin"]}><Chat /></RequireAuth>} />
              <Route path="/reports" element={<RequireAuth roles={["sales","manager","admin"]}><Reports /></RequireAuth>} />
              <Route path="/map" element={<RequireAuth><MapViewSimple /></RequireAuth>} />
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
        `group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
          isActive 
            ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25' 
            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 hover:shadow-sm'
        }`
      }
      end={to === '/'}
    >
      {({ isActive }) => (
        <>
          <span className={`transition-colors ${
            isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'
          }`}>
            {icon}
          </span>
          <span className="truncate">{label}</span>
          {isActive && (
            <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
          )}
        </>
      )}
    </NavLink>
  );
}

export default App;


