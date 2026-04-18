import React, { useMemo, useState } from 'react';
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
  LogOut,
  User,
  Users as UsersIcon,
  Settings,
  ChevronDown,
} from 'lucide-react';

import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Tasks from './pages/Tasks';
import Uploads from './pages/Uploads';
import Billing from './pages/Billing';
import MapViewSimple from './pages/MapViewSimple';
import Login from './pages/Login';
import Categories from './pages/Categories';
import Chat from './pages/Chat';
import Reports from './pages/Reports';
import Users from './pages/Users.tsx';
import { ShellProvider, useShell, type DateRangePreset } from './context/ShellContext';
import { GlobalSearchTrigger } from './components/GlobalSearch';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { UserRole } from './constants/roles';

function useUser() {
  const userInfo = typeof window !== 'undefined' ? localStorage.getItem('user_info') : null;
  if (!userInfo) return null;
  try {
    return JSON.parse(userInfo) as {
      name?: string;
      email?: string;
      role?: string;
      code?: string;
      id?: string;
      _id?: string;
    };
  } catch {
    return null;
  }
}

function useRole(): string | null {
  const user = useUser();
  return user?.role ?? null;
}

function isUserRole(role: string): role is UserRole {
  return role === UserRole.ADMIN || role === UserRole.MANAGER || role === UserRole.SALES;
}

function RequireAuth({ children, roles }: { children: React.ReactElement; roles?: UserRole[] }) {
  const role = useRole();
  const location = useLocation();
  if (!role) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!isUserRole(role)) return <Navigate to="/" replace />;
  if (roles && !roles.includes(role)) return <Navigate to="/" replace />;
  return children;
}

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/products': 'Products',
  '/categories': 'Categories',
  '/tasks': 'Tasks',
  '/uploads': 'Uploads',
  '/billing': 'Billing',
  '/chat': 'Chat',
  '/reports': 'Reports',
  '/users': 'Users',
  '/map': 'Map',
};

function pageTitle(pathname: string): string {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
  return 'SalesOps';
}

function initials(name?: string): string {
  if (!name?.trim()) return '?';
  const p = name.trim().split(/\s+/);
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function SidebarNav({
  role,
  onNavigate,
  linkClass,
}: {
  role: string | null;
  onNavigate?: () => void;
  linkClass?: string;
}): React.ReactElement {
  return (
    <nav className={cn('flex flex-1 flex-col gap-0.5 p-2', linkClass)}>
      <SideLink to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" onNavigate={onNavigate} />
      {role === UserRole.ADMIN && (
        <>
          <SideLink to="/users" icon={<UsersIcon size={20} />} label="Users" onNavigate={onNavigate} />
          <SideLink to="/products" icon={<Package size={20} />} label="Products" onNavigate={onNavigate} />
          <SideLink to="/categories" icon={<ListTree size={20} />} label="Categories" onNavigate={onNavigate} />
        </>
      )}
      <SideLink to="/tasks" icon={<ClipboardList size={20} />} label="Tasks" onNavigate={onNavigate} />
      <SideLink to="/uploads" icon={<Upload size={20} />} label="Uploads" onNavigate={onNavigate} />
      {(role === UserRole.ADMIN || role === UserRole.MANAGER) && (
        <SideLink to="/billing" icon={<FileText size={20} />} label="Billing" onNavigate={onNavigate} />
      )}
      <SideLink to="/chat" icon={<MessageCircle size={20} />} label="Chat" onNavigate={onNavigate} />
      <SideLink to="/reports" icon={<ReportIcon size={20} />} label="Reports" onNavigate={onNavigate} />
      {(role === UserRole.ADMIN || role === UserRole.MANAGER) && (
        <SideLink to="/map" icon={<Map size={20} />} label="Map" onNavigate={onNavigate} />
      )}
    </nav>
  );
}

function SideLink({
  to,
  icon,
  label,
  onNavigate,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  onNavigate?: () => void;
}): React.ReactElement {
  return (
    <NavLink
      to={to}
      onClick={() => onNavigate?.()}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-lg py-2.5 pl-2.5 pr-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-[rgba(99,153,34,0.2)] text-white'
            : 'text-white/70 hover:bg-white/5 hover:text-white'
        )
      }
      end={to === '/'}
    >
      {({ isActive }) => (
        <>
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
            {icon}
            {isActive && (
              <span className="absolute -right-0.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[var(--brand-green)]" />
            )}
          </span>
          <span className="min-w-0 flex-1 truncate opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100">
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

function DateRangePills(): React.ReactElement {
  const { datePreset, setDatePreset } = useShell();
  const presets: DateRangePreset[] = ['7d', '30d', '90d'];
  return (
    <div className="flex items-center gap-1 rounded-full border border-[var(--color-border-tertiary)] bg-[var(--surface-2)] p-0.5">
      {presets.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => setDatePreset(p)}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition-colors',
            datePreset === p
              ? 'bg-[var(--brand-dark)] text-white'
              : 'text-muted-foreground hover:bg-background'
          )}
        >
          {p === '7d' ? '7d' : p === '30d' ? '30d' : '90d'}
        </button>
      ))}
    </div>
  );
}

function UserMenu(): React.ReactElement {
  const user = useUser();
  const navigate = useNavigate();
  if (!user) return <></>;

  function logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    navigate('/login');
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-9 items-center gap-2 rounded-full border-0 bg-transparent px-2 outline-none hover:bg-muted">
        <Avatar className="h-8 w-8 border border-border">
          <AvatarFallback className="bg-[var(--brand-green-light)] text-xs font-medium text-[var(--brand-green-dark)]">
            {initials(user.name)}
          </AvatarFallback>
        </Avatar>
        <ChevronDown className="hidden h-4 w-4 opacity-50 sm:inline" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{user.role}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AppShell(): React.ReactElement {
  const role = useRole();
  const location = useLocation();
  const title = useMemo(() => pageTitle(location.pathname), [location.pathname]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = useUser();

  return (
    <ShellProvider>
      <div className="min-h-screen bg-[var(--surface-2)] text-foreground">
        <div className="flex min-h-screen">
          {/* Desktop sidebar */}
          <aside className="group/sidebar fixed inset-y-0 left-0 z-40 hidden w-[56px] overflow-hidden border-r border-white/10 bg-[var(--brand-dark)] transition-[width] duration-200 ease-out hover:w-[220px] lg:block">
            <div className="flex h-full flex-col">
              <div className="flex h-14 shrink-0 items-center gap-2 border-b border-white/10 px-3 pt-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--brand-green)]" />
                <span className="page-title min-w-0 truncate text-lg text-white opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100">
                  SalesOps
                </span>
              </div>
              <SidebarNav role={role} />
              <div className="mt-auto border-t border-white/10 p-3">
                <div className="flex items-center gap-2">
                  <Avatar className="h-9 w-9 shrink-0 border border-white/20">
                    <AvatarFallback className="bg-white/10 text-xs text-white">{initials(user?.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100">
                    <p className="truncate text-xs font-medium text-white">{user?.name}</p>
                    <p className="truncate text-[10px] uppercase text-white/50">{user?.role}</p>
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-white/30 opacity-0 group-hover/sidebar:opacity-100">v0.1.0</p>
              </div>
            </div>
          </aside>

          {/* Mobile sheet */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="w-[280px] border-[var(--brand-dark)] bg-[var(--brand-dark)] p-0 text-white">
              <SheetHeader className="border-b border-white/10 p-4 text-left">
                <SheetTitle className="page-title text-xl text-white">SalesOps</SheetTitle>
              </SheetHeader>
              <SidebarNav role={role} onNavigate={() => setMobileOpen(false)} linkClass="py-1" />
            </SheetContent>
          </Sheet>

          <div className="flex min-h-screen flex-1 flex-col lg:pl-[56px]">
            <header className="sticky top-0 z-30 border-b border-[var(--color-border-tertiary)] bg-[var(--surface)] backdrop-blur-sm">
              <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 lg:hidden"
                    onClick={() => setMobileOpen(true)}
                    aria-label="Open menu"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                  <h1 className="page-title min-w-0 truncate text-[20px] font-normal leading-tight">{title}</h1>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                  {location.pathname === '/' && <DateRangePills />}
                  <Tooltip>
                    <TooltipTrigger className="inline-flex">
                      <GlobalSearchTrigger className="h-9 border-[var(--color-border-tertiary)] bg-background" />
                    </TooltipTrigger>
                    <TooltipContent>Search (⌘K)</TooltipContent>
                  </Tooltip>
                  <UserMenu />
                </div>
              </div>
            </header>

            <main className="flex-1 p-4 sm:p-6 lg:p-8">
              <Routes>
                <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
                <Route path="/products" element={<RequireAuth roles={[UserRole.ADMIN]}><Products /></RequireAuth>} />
                <Route path="/categories" element={<RequireAuth roles={[UserRole.ADMIN]}><Categories /></RequireAuth>} />
                <Route path="/tasks" element={<RequireAuth roles={[UserRole.SALES, UserRole.MANAGER, UserRole.ADMIN]}><Tasks /></RequireAuth>} />
                <Route path="/uploads" element={<RequireAuth roles={[UserRole.SALES, UserRole.MANAGER, UserRole.ADMIN]}><Uploads /></RequireAuth>} />
                <Route path="/billing" element={<RequireAuth roles={[UserRole.MANAGER, UserRole.ADMIN]}><Billing /></RequireAuth>} />
                <Route path="/chat" element={<RequireAuth roles={[UserRole.SALES, UserRole.MANAGER, UserRole.ADMIN]}><Chat /></RequireAuth>} />
                <Route path="/reports" element={<RequireAuth roles={[UserRole.SALES, UserRole.MANAGER, UserRole.ADMIN]}><Reports /></RequireAuth>} />
                <Route path="/users" element={<RequireAuth roles={[UserRole.ADMIN]}><Users /></RequireAuth>} />
                <Route path="/map" element={<RequireAuth roles={[UserRole.ADMIN, UserRole.MANAGER]}><MapViewSimple /></RequireAuth>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </div>
      </div>
    </ShellProvider>
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

  return <AppShell />;
}

export default App;
