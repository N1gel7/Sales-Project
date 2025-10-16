import React from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { LayoutDashboard, Package, ClipboardList, Upload, FileText, Map } from 'lucide-react';

import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Tasks from './pages/Tasks';
import Uploads from './pages/Uploads';
import Billing from './pages/Billing';
import MapView from './pages/MapView';

function App(): React.ReactElement {
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
              <SideLink to="/tasks" icon={<ClipboardList size={18} />} label="Tasks" />
              <SideLink to="/uploads" icon={<Upload size={18} />} label="Uploads" />
              <SideLink to="/billing" icon={<FileText size={18} />} label="Billing" />
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
              </div>
            </div>
          </header>
          <main className="p-4 md:p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/products" element={<Products />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/uploads" element={<Uploads />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/map" element={<MapView />} />
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


