'use client';

import { useAuthStore } from '@/stores/auth-store';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  MapPin,
  Package,
  Server,
  CheckSquare,
  LayoutTemplate,
  Settings,
  Users,
  LogOut,
  Menu,
  LayoutDashboard,
  Contact2,
  Activity,
  AlertTriangle,
  Monitor,
  Database,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { useBranding } from '@/components/BrandingProvider';
import { useMemo } from 'react';
import { useTenantModules } from '@/hooks/useTenantModules';

// Navigation items with optional moduleKey for feature-flag filtering
const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Sites', href: '/dashboard/sites', icon: MapPin, moduleKey: 'sites' },
  { name: 'Équipements', href: '/dashboard/assets', icon: Package, moduleKey: 'assets' },
  { name: 'Baies', href: '/dashboard/racks', icon: Server, moduleKey: 'racks' },
  { name: 'Tâches', href: '/dashboard/tasks', icon: CheckSquare, moduleKey: 'tasks' },
  { name: 'Plans', href: '/dashboard/floor-plans', icon: LayoutTemplate, moduleKey: 'floor_plans' },
  { name: 'Contacts', href: '/dashboard/contacts', icon: Contact2, moduleKey: 'contacts' },
  { name: 'Monitoring', href: '/dashboard/monitoring', icon: Activity, moduleKey: 'monitoring' },
  { name: 'NetBox', href: '/dashboard/netbox', icon: Database, moduleKey: 'integrations_netbox' },
  { name: 'Dashboard TV', href: '/tv', icon: Monitor },
  { name: 'Alertes', href: '/dashboard/alerts', icon: AlertTriangle, moduleKey: 'alerts' },
];

const adminNavigation = [
  { name: 'Utilisateurs', href: '/dashboard/users', icon: Users },
  { name: 'Paramètres', href: '/dashboard/settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, logout, checkSession, isLoading } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const { logoUrl, orgName } = useBranding();
  const { isModuleEnabled } = useTenantModules();

  // Filter navigation based on enabled modules
  const filteredNavigation = useMemo(
    () => navigation.filter((item) => !item.moduleKey || isModuleEnabled(item.moduleKey)),
    [isModuleEnabled],
  );

  // Check session on mount (verify HTTP-only cookie is valid)
  useEffect(() => {
    checkSession().finally(() => setSessionChecked(true));
  }, [checkSession]);

  // Only redirect after session check is complete
  useEffect(() => {
    if (sessionChecked && !isAuthenticated) {
      router.push('/login');
    }
  }, [sessionChecked, isAuthenticated, router]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  // Show skeleton while checking session
  if (!sessionChecked || isLoading) {
    return (
      <div className="flex h-screen bg-background">
        {/* Skeleton sidebar */}
        <div className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r lg:bg-card">
          <div className="flex h-16 items-center border-b px-6">
            <div className="h-6 w-20 animate-pulse rounded bg-muted" />
          </div>
          <div className="flex-1 p-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </div>
        {/* Skeleton main */}
        <div className="flex-1 p-6">
          <DashboardSkeleton />
        </div>
      </div>
    );
  }

  // Redirect handled by useEffect above
  if (!isAuthenticated || !user) {
    return null;
  }

  const isAdmin = user.role === 'ADMIN';

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 transform bg-card border-r shadow-lg transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {logoUrl && (
              <img src={logoUrl} alt={orgName} className="h-7 w-7 object-contain rounded flex-shrink-0" />
            )}
            <h1 className="text-lg font-bold text-primary truncate" title={orgName || 'XCH'}>
              {orgName || 'XCH'}
            </h1>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {filteredNavigation.map((item) => {
            const isActive = item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon
                  className={cn(
                    'mr-3 h-5 w-5 flex-shrink-0 transition-colors',
                    isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-accent-foreground'
                  )}
                />
                {item.name}
              </Link>
            );
          })}

          {isAdmin && (
            <>
              <div className="my-4 border-t" />
              <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Administration
              </p>
              {adminNavigation.map((item) => {
                const isActive = item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon
                      className={cn(
                        'mr-3 h-5 w-5 flex-shrink-0 transition-colors',
                        isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-accent-foreground'
                      )}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        <div className="border-t p-4">
          <div className="mb-3 px-3">
            <p className="text-sm font-medium text-foreground">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.role}</p>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-foreground"
            onClick={handleLogout}
            data-testid="logout-button"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Déconnexion
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="flex h-16 items-center justify-between border-b bg-card px-4 lg:hidden">
          <div className="flex items-center min-w-0 flex-1">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="flex-shrink-0">
              <Menu className="h-5 w-5" />
            </Button>
            <div className="ml-3 flex items-center gap-2 min-w-0">
              {logoUrl && (
                <img src={logoUrl} alt={orgName} className="h-6 w-6 object-contain rounded flex-shrink-0" />
              )}
              <h1 className="text-lg font-bold text-primary truncate" title={orgName || 'XCH'}>
                {orgName || 'XCH'}
              </h1>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6 bg-background">
          <ErrorBoundary key={pathname}>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
