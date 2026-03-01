'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { sitesApi } from '@/lib/api/sites';
import { assetsApi } from '@/lib/api/assets';
import { racksApi } from '@/lib/api/racks';
import { tasksApi } from '@/lib/api/tasks';
import { integrationsApi } from '@/lib/api/integrations';
import { Badge } from '@/components/ui/badge';
import { MapPin, Package, Server, CheckSquare, MapIcon, AlertTriangle, Clock, Ban, ArrowRight, ShieldAlert, Activity, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Task, Asset, Site } from '@/types';
import { getWarrantyStatus, getWarrantyDaysLeft, useWarrantyThresholds, type WarrantyStatus } from '@/lib/warranty';

// Dynamically import map component (client-side only)
const SitesMap = dynamic(() => import('@/components/maps/SitesMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] flex items-center justify-center bg-gray-50 rounded-md">
      Chargement de la carte...
    </div>
  ),
});

interface DashboardStats {
  sites: { total: number; active: number; critical: number; healthy: number; warning: number; criticalHealth: number; unknown: number };
  assets: { total: number; inService: number; inStock: number };
  racks: { total: number; activeU: number; totalU: number };
  tasks: { total: number; todo: number; inProgress: number; done: number };
}

export default function DashboardPage() {
  // Fetch real data from APIs
  const { data: sites = [], isLoading: sitesLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: sitesApi.getAll,
  });

  const { data: assets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ['assets'],
    queryFn: () => assetsApi.getAll(),
  });

  const { data: racks = [], isLoading: racksLoading } = useQuery({
    queryKey: ['racks'],
    queryFn: () => racksApi.getAll(),
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.getAll(),
  });

  // Fetch Uptime Kuma monitors (non-blocking, silent failure)
  const { data: monitors = [] } = useQuery<Array<{ id: number; name: string; type: string; status: 'up' | 'down' | 'unknown'; responseTime: number; certExpiry?: number }>>({
    queryKey: ['uptime-kuma-monitors'],
    queryFn: () => integrationsApi.uptimeKuma.getMonitors(),
    retry: 1,
    staleTime: 60_000,
  });

  // Calculate stats from real data
  const stats: DashboardStats = useMemo(() => {
    // Sites stats
    const activeSites = sites.filter((s) => s.status === 'ACTIVE').length;
    const criticalSites = sites.filter(
      (s) => s.healthStatus === 'CRITICAL' || s.healthStatus === 'WARNING'
    ).length;
    const healthySites = sites.filter((s) => s.healthStatus === 'HEALTHY').length;
    const warningSites = sites.filter((s) => s.healthStatus === 'WARNING').length;
    const criticalHealthSites = sites.filter((s) => s.healthStatus === 'CRITICAL').length;
    const unknownSites = sites.filter((s) => s.healthStatus === 'UNKNOWN' || !s.healthStatus).length;

    // Assets stats
    const inServiceAssets = assets.filter((a) => a.status === 'IN_SERVICE').length;
    const inStockAssets = assets.filter((a) => a.status === 'STOCK').length;

    // Racks stats (calculate used U)
    let totalUsedU = 0;
    let totalAvailableU = 0;
    racks.forEach((rack) => {
      totalAvailableU += rack.heightU;
      // Calculate used U from mounted assets
      const mountedAssets = assets.filter((a) => a.rackId === rack.id && a.rackPositionU);
      mountedAssets.forEach((asset) => {
        totalUsedU += asset.rackHeightU || 1;
      });
    });

    // Tasks stats
    const todoTasks = tasks.filter((t) => t.status === 'TODO').length;
    const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const doneTasks = tasks.filter((t) => t.status === 'DONE').length;

    return {
      sites: {
        total: sites.length,
        active: activeSites,
        critical: criticalSites,
        healthy: healthySites,
        warning: warningSites,
        criticalHealth: criticalHealthSites,
        unknown: unknownSites,
      },
      assets: {
        total: assets.length,
        inService: inServiceAssets,
        inStock: inStockAssets,
      },
      racks: {
        total: racks.length,
        activeU: totalUsedU,
        totalU: totalAvailableU,
      },
      tasks: {
        total: tasks.length,
        todo: todoTasks,
        inProgress: inProgressTasks,
        done: doneTasks,
      },
    };
  }, [sites, assets, racks, tasks]);

  // Warranty thresholds from tenant config
  const warrantyThresholds = useWarrantyThresholds();

  // Calculate critical alerts across all sites
  const alerts = useMemo(() => {
    const blockedTasks = tasks.filter((t: Task) => t.status === 'BLOCKED');
    const urgentTasks = tasks.filter((t: Task) => t.priority === 'URGENT' && t.status !== 'DONE' && t.status !== 'CANCELLED');
    const now = new Date();
    const overdueTasks = tasks.filter((t: Task) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE' && t.status !== 'CANCELLED');
    const outOfServiceAssets = assets.filter((a: Asset) => a.status === 'OUT_OF_SERVICE');

    // Warranty alerts
    const warrantyExpired = assets.filter((a: Asset) => getWarrantyStatus(a.warrantyEnd, warrantyThresholds) === 'expired');
    const warrantyCritical = assets.filter((a: Asset) => getWarrantyStatus(a.warrantyEnd, warrantyThresholds) === 'expiring_critical');
    const warrantyWarning = assets.filter((a: Asset) => getWarrantyStatus(a.warrantyEnd, warrantyThresholds) === 'expiring_warning');
    const warrantyTotal = warrantyExpired.length + warrantyCritical.length + warrantyWarning.length;

    // Monitoring/health alerts
    const criticalHealthSites = sites.filter((s: Site) => s.healthStatus === 'CRITICAL');
    const warningHealthSites = sites.filter((s: Site) => s.healthStatus === 'WARNING');
    const downMonitors = monitors.filter((m) => m.status === 'down');

    // Group alerts by site for "sites en souffrance"
    const siteAlertMap = new Map<string, { blocked: Task[]; urgent: Task[]; overdue: Task[]; broken: Asset[]; warrantyExpired: Asset[]; warrantyCritical: Asset[]; warrantyWarning: Asset[] }>();

    const ensureSite = (siteId: string | undefined) => {
      if (!siteId) return;
      if (!siteAlertMap.has(siteId)) {
        siteAlertMap.set(siteId, { blocked: [], urgent: [], overdue: [], broken: [], warrantyExpired: [], warrantyCritical: [], warrantyWarning: [] });
      }
    };

    blockedTasks.forEach((t: Task) => { ensureSite(t.siteId); if (t.siteId) siteAlertMap.get(t.siteId)!.blocked.push(t); });
    urgentTasks.forEach((t: Task) => { ensureSite(t.siteId); if (t.siteId) siteAlertMap.get(t.siteId)!.urgent.push(t); });
    overdueTasks.forEach((t: Task) => { ensureSite(t.siteId); if (t.siteId) siteAlertMap.get(t.siteId)!.overdue.push(t); });
    outOfServiceAssets.forEach((a: Asset) => { ensureSite(a.siteId); if (a.siteId) siteAlertMap.get(a.siteId)!.broken.push(a); });
    warrantyExpired.forEach((a: Asset) => { ensureSite(a.siteId); if (a.siteId) siteAlertMap.get(a.siteId)!.warrantyExpired.push(a); });
    warrantyCritical.forEach((a: Asset) => { ensureSite(a.siteId); if (a.siteId) siteAlertMap.get(a.siteId)!.warrantyCritical.push(a); });
    warrantyWarning.forEach((a: Asset) => { ensureSite(a.siteId); if (a.siteId) siteAlertMap.get(a.siteId)!.warrantyWarning.push(a); });

    // Include sites with CRITICAL/WARNING health status even if no task/warranty alerts
    criticalHealthSites.forEach((s: Site) => { ensureSite(s.id); });
    warningHealthSites.forEach((s: Site) => { ensureSite(s.id); });

    // Sort sites by total alert count
    const sitesWithAlerts = Array.from(siteAlertMap.entries())
      .map(([siteId, a]) => ({
        siteId,
        site: sites.find((s: Site) => s.id === siteId),
        total: a.blocked.length + a.urgent.length + a.overdue.length + a.broken.length + a.warrantyExpired.length + a.warrantyCritical.length + a.warrantyWarning.length,
        ...a,
      }))
      .filter(s => s.total > 0)
      .sort((a, b) => b.total - a.total);

    return {
      blockedTasks,
      urgentTasks,
      overdueTasks,
      outOfServiceAssets,
      warrantyExpired,
      warrantyCritical,
      warrantyWarning,
      warrantyTotal,
      criticalHealthSites,
      warningHealthSites,
      downMonitors,
      totalAlerts: blockedTasks.length + urgentTasks.length + overdueTasks.length + outOfServiceAssets.length + warrantyTotal + criticalHealthSites.length + downMonitors.length,
      sitesWithAlerts,
    };
  }, [tasks, assets, sites, monitors, warrantyThresholds]);

  const isLoading = sitesLoading || assetsLoading || racksLoading || tasksLoading;
  const router = useRouter();

  // Handle site click on map
  const handleSiteClick = (site: any) => {
    router.push(`/dashboard/sites/${site.id}`);
  };

  // Check if we have sites with coordinates
  const sitesWithCoords = useMemo(() => {
    return sites.filter((s) => s.latitude != null && s.longitude != null);
  }, [sites]);

  if (isLoading) {
    return <div className="text-center py-8">Chargement des données...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Vue d'ensemble de vos sites</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/dashboard/sites">
          <Card data-testid="stats-card-sites" className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sites</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.sites.total}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                {stats.sites.healthy > 0 && <><span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />{stats.sites.healthy} sain{stats.sites.healthy > 1 ? 's' : ''}</>}
                {stats.sites.warning > 0 && <><span className="mx-0.5">•</span><span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />{stats.sites.warning} attention</>}
                {stats.sites.criticalHealth > 0 && <><span className="mx-0.5">•</span><span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />{stats.sites.criticalHealth} critique{stats.sites.criticalHealth > 1 ? 's' : ''}</>}
                {stats.sites.healthy === 0 && stats.sites.warning === 0 && stats.sites.criticalHealth === 0 && <>{stats.sites.active} actif{stats.sites.active > 1 ? 's' : ''}</>}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/assets">
          <Card data-testid="stats-card-assets" className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Équipements</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.assets.total}</div>
              <p className="text-xs text-muted-foreground">
                {stats.assets.inService} en service • {stats.assets.inStock} en stock
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/racks">
          <Card data-testid="stats-card-racks" className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Baies</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.racks.total}</div>
              <p className="text-xs text-muted-foreground">
                {stats.racks.activeU}U / {stats.racks.totalU}U utilisés
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/tasks">
          <Card data-testid="stats-card-tasks" className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tâches</CardTitle>
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.tasks.total}</div>
              <p className="text-xs text-muted-foreground">
                {stats.tasks.inProgress} en cours • {stats.tasks.todo} à faire
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* État de santé des sites */}
      {sites.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-5 w-5 text-primary" />
                État de santé des sites
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/integrations/monitoring">Monitoring →</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Sites health grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {sites
                .filter(s => s.status === 'ACTIVE')
                .sort((a, b) => {
                  const order: Record<string, number> = { CRITICAL: 0, WARNING: 1, UNKNOWN: 2, HEALTHY: 3 };
                  return (order[a.healthStatus] ?? 2) - (order[b.healthStatus] ?? 2);
                })
                .slice(0, 12)
                .map((site) => (
                  <Link
                    key={site.id}
                    href={`/dashboard/sites/${site.id}`}
                    className="flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      site.healthStatus === 'HEALTHY' ? 'bg-green-500' :
                      site.healthStatus === 'WARNING' ? 'bg-amber-500' :
                      site.healthStatus === 'CRITICAL' ? 'bg-red-500 animate-pulse' :
                      'bg-gray-400'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{site.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {site.healthStatus === 'HEALTHY' ? 'OK' :
                         site.healthStatus === 'WARNING' ? 'Attention' :
                         site.healthStatus === 'CRITICAL' ? 'Critique' : 'Non supervisé'}
                      </p>
                    </div>
                  </Link>
                ))}
            </div>
            {sites.filter(s => s.status === 'ACTIVE').length > 12 && (
              <p className="text-xs text-muted-foreground text-center">
                + {sites.filter(s => s.status === 'ACTIVE').length - 12} autre(s) site(s)
              </p>
            )}

            {/* Monitoring summary bar */}
            {monitors.length > 0 && (
              <div className="flex items-center gap-4 pt-2 border-t text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  {monitors.filter(m => m.status === 'up').length} UP
                </span>
                {monitors.filter(m => m.status === 'down').length > 0 && (
                  <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    {monitors.filter(m => m.status === 'down').length} DOWN
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-gray-400" />
                  {monitors.filter(m => m.status === 'unknown').length} inconnu(s)
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Alertes critiques globales */}
      {alerts.totalAlerts > 0 && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Alertes critiques
              <Badge variant="destructive" className="ml-1">{alerts.totalAlerts}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Compteurs résumés en ligne */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {alerts.blockedTasks.length > 0 && (
                <div className="flex items-center gap-2 p-2.5 bg-red-100 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
                  <Ban className="h-4 w-4 text-red-600 flex-shrink-0" />
                  <div>
                    <p className="text-lg font-bold text-red-700 dark:text-red-300">{alerts.blockedTasks.length}</p>
                    <p className="text-xs text-red-600 dark:text-red-400">Bloquée{alerts.blockedTasks.length > 1 ? 's' : ''}</p>
                  </div>
                </div>
              )}
              {alerts.urgentTasks.length > 0 && (
                <div className="flex items-center gap-2 p-2.5 bg-orange-100 dark:bg-orange-900/30 rounded-lg border border-orange-200 dark:border-orange-800">
                  <AlertTriangle className="h-4 w-4 text-orange-600 flex-shrink-0" />
                  <div>
                    <p className="text-lg font-bold text-orange-700 dark:text-orange-300">{alerts.urgentTasks.length}</p>
                    <p className="text-xs text-orange-600 dark:text-orange-400">Urgente{alerts.urgentTasks.length > 1 ? 's' : ''}</p>
                  </div>
                </div>
              )}
              {alerts.overdueTasks.length > 0 && (
                <div className="flex items-center gap-2 p-2.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-800">
                  <Clock className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <div>
                    <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{alerts.overdueTasks.length}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">En retard</p>
                  </div>
                </div>
              )}
              {alerts.outOfServiceAssets.length > 0 && (
                <div className="flex items-center gap-2 p-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg border border-purple-200 dark:border-purple-800">
                  <Package className="h-4 w-4 text-purple-600 flex-shrink-0" />
                  <div>
                    <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{alerts.outOfServiceAssets.length}</p>
                    <p className="text-xs text-purple-600 dark:text-purple-400">Hors service</p>
                  </div>
                </div>
              )}
              {alerts.warrantyTotal > 0 && (
                <div className="flex items-center gap-2 p-2.5 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <ShieldAlert className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                  <div>
                    <p className="text-lg font-bold text-yellow-700 dark:text-yellow-300">{alerts.warrantyTotal}</p>
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">Garantie{alerts.warrantyTotal > 1 ? 's' : ''}</p>
                  </div>
                </div>
              )}
              {alerts.criticalHealthSites.length > 0 && (
                <div className="flex items-center gap-2 p-2.5 bg-red-100 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
                  <Activity className="h-4 w-4 text-red-600 flex-shrink-0" />
                  <div>
                    <p className="text-lg font-bold text-red-700 dark:text-red-300">{alerts.criticalHealthSites.length}</p>
                    <p className="text-xs text-red-600 dark:text-red-400">Site{alerts.criticalHealthSites.length > 1 ? 's' : ''} critique{alerts.criticalHealthSites.length > 1 ? 's' : ''}</p>
                  </div>
                </div>
              )}
              {alerts.downMonitors.length > 0 && (
                <div className="flex items-center gap-2 p-2.5 bg-red-100 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
                  <WifiOff className="h-4 w-4 text-red-600 flex-shrink-0" />
                  <div>
                    <p className="text-lg font-bold text-red-700 dark:text-red-300">{alerts.downMonitors.length}</p>
                    <p className="text-xs text-red-600 dark:text-red-400">Moniteur{alerts.downMonitors.length > 1 ? 's' : ''} DOWN</p>
                  </div>
                </div>
              )}
            </div>

            {/* Sites en souffrance — détail par site */}
            {alerts.sitesWithAlerts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sites concernés</p>
                {alerts.sitesWithAlerts.slice(0, 5).map(({ siteId, site, blocked, urgent, overdue, broken, warrantyExpired, warrantyCritical, warrantyWarning, total }) => (
                  <Link
                    key={siteId}
                    href={`/dashboard/sites/${siteId}`}
                    className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {site?.healthStatus === 'CRITICAL' && (
                          <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                        )}
                        {site?.healthStatus === 'WARNING' && (
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                        )}
                        {(!site?.healthStatus || site.healthStatus === 'HEALTHY' || site.healthStatus === 'UNKNOWN') && (
                          <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{site?.name || 'Site inconnu'}</p>
                        <p className="text-xs text-muted-foreground">{site?.code} — {site?.city || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {blocked.length > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {blocked.length} bloquée{blocked.length > 1 ? 's' : ''}
                        </Badge>
                      )}
                      {urgent.length > 0 && (
                        <Badge className="text-xs bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-200">
                          {urgent.length} urgente{urgent.length > 1 ? 's' : ''}
                        </Badge>
                      )}
                      {overdue.length > 0 && (
                        <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900 dark:text-amber-200">
                          {overdue.length} retard
                        </Badge>
                      )}
                      {broken.length > 0 && (
                        <Badge className="text-xs bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-200">
                          {broken.length} HS
                        </Badge>
                      )}
                      {(warrantyExpired.length + warrantyCritical.length + warrantyWarning.length) > 0 && (
                        <Badge className="text-xs bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200">
                          <ShieldAlert className="h-3 w-3 mr-1" />
                          {warrantyExpired.length + warrantyCritical.length + warrantyWarning.length} garantie{(warrantyExpired.length + warrantyCritical.length + warrantyWarning.length) > 1 ? 's' : ''}
                        </Badge>
                      )}
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                ))}
                {alerts.sitesWithAlerts.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    + {alerts.sitesWithAlerts.length - 5} autre{alerts.sitesWithAlerts.length - 5 > 1 ? 's' : ''} site{alerts.sitesWithAlerts.length - 5 > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Carte + Sites récents côte à côte */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Sites Map — 2/3 */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapIcon className="h-5 w-5" />
              Carte des sites
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sitesWithCoords.length > 0 ? (
              <SitesMap
                sites={sites}
                onSiteClick={handleSiteClick}
                height="400px"
              />
            ) : (
              <div className="h-[400px] flex items-center justify-center rounded-md border bg-gray-50 text-sm text-muted-foreground">
                Aucun site avec coordonnées GPS disponible
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sites récents — 1/3 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Sites récents</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/sites">Voir tous</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {sites.length > 0 ? (
              <div className="space-y-3">
                {sites.slice(0, 8).map((site) => (
                  <Link
                    key={site.id}
                    href={`/dashboard/sites/${site.id}`}
                    className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-muted/30 -mx-2 px-2 rounded transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{site.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {site.city || 'N/A'} · {site.code}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          site.status === 'ACTIVE'
                            ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                            : site.status === 'PREPARATION'
                            ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                            : 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        }`}
                      >
                        {site.status === 'ACTIVE' ? 'Actif' : site.status === 'PREPARATION' ? 'Prépa' : site.status}
                      </span>
                      {site.healthStatus === 'CRITICAL' && (
                        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" title="Critique" />
                      )}
                      {site.healthStatus === 'WARNING' && (
                        <span className="h-2 w-2 rounded-full bg-amber-500" title="Attention" />
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun site disponible</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
