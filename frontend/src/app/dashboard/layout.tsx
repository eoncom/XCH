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
  Receipt,
  Zap,
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
import { usePermissions } from '@/hooks/usePermissions';
import { ShieldAlert } from 'lucide-react';
import { GlobalSearch } from '@/components/layout/GlobalSearch';
import { NotificationInbox } from '@/components/layout/NotificationInbox';
import { rightLabel } from '@/lib/labels';
import { AppearanceProvider } from '@/components/AppearanceProvider';

// Navigation items with optional moduleKey for feature-flag filtering
// permResource: if set, requires can(permResource, 'read') to show
// external: if true, opens in a new tab
const navigation: Array<{
  name: string;
  href: string;
  icon: any;
  moduleKey?: string;
  permResource?: string;
  external?: boolean;
}> = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Sites', href: '/dashboard/sites', icon: MapPin, moduleKey: 'sites' },
  { name: 'Équipements', href: '/dashboard/assets', icon: Package, moduleKey: 'assets' },
  { name: 'Baies', href: '/dashboard/racks', icon: Server, moduleKey: 'racks' },
  { name: 'Tâches', href: '/dashboard/tasks', icon: CheckSquare, moduleKey: 'tasks' },
  { name: 'Plans', href: '/dashboard/floor-plans', icon: LayoutTemplate, moduleKey: 'floor_plans' },
  { name: 'Contacts', href: '/dashboard/contacts', icon: Contact2, moduleKey: 'contacts' },
  { name: 'Monitoring', href: '/dashboard/monitoring', icon: Activity, moduleKey: 'monitoring', permResource: 'monitoring' },
  { name: 'NetBox', href: '/dashboard/netbox', icon: Database, moduleKey: 'integrations_netbox', permResource: 'netbox' },
  { name: 'Dashboard TV', href: '/tv', icon: Monitor, external: true },
  { name: 'Alertes', href: '/dashboard/alerts', icon: AlertTriangle, moduleKey: 'alerts' },
  { name: 'Coûts', href: '/dashboard/costs', icon: Receipt, moduleKey: 'costs', permResource: 'expenses' },
  { name: 'Consommation', href: '/dashboard/consumption', icon: Zap, moduleKey: 'consumption' },
];

// Adminisation-only items (delegation MANAGE or SuperAdmin).
const adminNavigation = [
  { name: 'Utilisateurs', href: '/dashboard/users', icon: Users },
  { name: 'Journal d\'audit', href: '/dashboard/admin/audit', icon: Activity },
];

// Personal items — always visible to any authenticated user because every user
// (READ, WRITE, MANAGE, SuperAdmin) has access to Profile / Sécurité / Apparence
// in the settings page. See AUTH_MODEL.md §7.
const personalNavigation = [
  { name: 'Paramètres', href: '/dashboard/settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppearanceProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </AppearanceProvider>
  );
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, logout, checkSession, isLoading } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const { logoUrl, orgName } = useBranding();
  const { isModuleEnabled } = useTenantModules();
  const { can, hasAnySiteAccess, hasDelegation, isLoadingPerms, isSuperAdmin, role: localRole } = usePermissions();

  // Filter navigation based on enabled modules + permissions
  const filteredNavigation = useMemo(
    () => navigation.filter((item) => {
      // Check module is enabled
      if (item.moduleKey && !isModuleEnabled(item.moduleKey)) return false;

      // Check permission-gated items (monitoring, netbox, expenses)
      if (item.permResource) {
        // Must have the read permission for this resource
        if (!can(item.permResource, 'read')) return false;
        // For site-scoped resources: must have at least one site assigned
        const orgLevelResources = ['expenses', 'billing-entities'];
        if (!orgLevelResources.includes(item.permResource) && !hasAnySiteAccess()) return false;
      }

      return true;
    }),
    [isModuleEnabled, can, hasAnySiteAccess],
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

  // localRole = UserDelegation.right for the active delegation (MANAGE/WRITE/READ)
  const isAdmin = localRole === 'MANAGE' || isSuperAdmin;

  // No delegation = no access — show blocking screen
  const noAccess = hasDelegation === false;

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — flex-col so the nav is scrollable while header + user card
          stay pinned. Fix audit post-v1.4: logout button could disappear when
          the nav overflowed on short screens. */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 flex flex-col transform bg-card border-r shadow-lg transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex h-16 flex-shrink-0 items-center justify-between border-b px-4">
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

        {!noAccess && (
          <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
            {filteredNavigation.map((item) => {
              const isActive = item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href);
              const linkProps = item.external ? { target: '_blank' as const, rel: 'noopener noreferrer' } : {};
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  {...linkProps}
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

            {/* Personal section — always visible (Profil / Sécurité / Apparence). */}
            <div className="my-4 border-t" />
            <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Personnel
            </p>
            {personalNavigation.map((item) => {
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
          </nav>
        )}

        {noAccess && (
          <div className="flex-1 flex items-center justify-center px-6">
            <p className="text-xs text-muted-foreground text-center">Aucun module accessible</p>
          </div>
        )}

        <div className="border-t p-4 flex-shrink-0">
          <div className="mb-3 px-3">
            <p className="text-sm font-medium text-foreground truncate" title={user.name}>{user.name}</p>
            <p className="text-xs text-muted-foreground">{isSuperAdmin ? 'Super Admin' : rightLabel(localRole)}</p>
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
          <div className="flex items-center gap-2">
            {!noAccess && <GlobalSearch />}
            {!noAccess && <NotificationInbox />}
            <ThemeToggle />
          </div>
        </div>

        {/* Desktop top bar with search + notifications */}
        {!noAccess && (
          <div className="hidden lg:flex h-14 items-center justify-end border-b bg-card px-6 gap-3">
            <GlobalSearch />
            <NotificationInbox />
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6 bg-background">
          {noAccess ? (
            <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center space-y-6">
              <div className="rounded-full bg-destructive/10 p-6">
                <ShieldAlert className="h-16 w-16 text-destructive" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-foreground">Aucun accès</h2>
                <p className="text-muted-foreground">
                  Votre compte n&apos;a aucune portée d&apos;accès configurée.
                  Vous ne pouvez accéder à aucun module ni donnée.
                </p>
              </div>
              <div className="bg-muted/50 border rounded-lg p-4 w-full">
                <p className="text-sm text-muted-foreground">
                  Contactez un administrateur pour qu&apos;il vous attribue une délégation.
                </p>
              </div>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Se déconnecter
              </Button>
            </div>
          ) : (
            <ErrorBoundary key={pathname}>{children}</ErrorBoundary>
          )}
        </main>
      </div>
    </div>
  );
}
