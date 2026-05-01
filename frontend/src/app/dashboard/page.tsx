'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { sitesApi } from '@/lib/api/sites';
import { assetsApi } from '@/lib/api/assets';
import { racksApi } from '@/lib/api/racks';
import { tasksApi } from '@/lib/api/tasks';
import { monitorsApi } from '@/lib/api/monitors';
// useLiveMonitors removed in ADR-016 — Site.healthStatus is now updated
// in real-time by HealthAggregationService and surfaced via the existing
// criticalHealthSites / warningHealthSites buckets.
import { Badge } from '@/components/ui/badge';
import { MapPin, Package, Server, CheckSquare, MapIcon, AlertTriangle, Clock, Ban, ArrowRight, ShieldAlert, Activity, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Task, Asset, Site } from '@/types';
import { computeAlerts } from '@/lib/alerts';
import { getWarrantyStatus, getWarrantyDaysLeft, useWarrantyThresholds, type WarrantyStatus } from '@/lib/warranty';

// Dynamically import map component (client-side only)
const SitesMap = dynamic(() => import('@/components/maps/SitesMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] flex items-center justify-center bg-muted rounded-md text-muted-foreground">
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
  const { data: sites = [], isLoading: sitesLoading, isError: sitesIsError, error: sitesError, refetch: sitesRefetch } = useQuery({
    queryKey: ['sites'],
    queryFn: sitesApi.getAll,
  });

  const { data: assets = [], isLoading: assetsLoading, isError: assetsIsError, error: assetsError, refetch: assetsRefetch } = useQuery({
    queryKey: ['assets'],
    queryFn: () => assetsApi.getAll(),
  });

  const { data: racks = [], isLoading: racksLoading, isError: racksIsError, error: racksError, refetch: racksRefetch } = useQuery({
    queryKey: ['racks'],
    queryFn: () => racksApi.getAll(),
  });

  const { data: tasks = [], isLoading: tasksLoading, isError: tasksIsError, error: tasksError, refetch: tasksRefetch } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.getAll(),
  });

  const { data: nativeMonitors = [] } = useQuery({
    queryKey: ['monitors', 'all'],
    queryFn: () => monitorsApi.getAll(),
    refetchInterval: 30_000,
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

    // Monitoring/health alerts — Site.healthStatus is updated in real-time
    // by HealthAggregationService (ADR-016). The downMonitorCount per-site
    // metric was removed with the legacy useLiveMonitors hook; the
    // healthIssue flag below already covers the same signal end-to-end.
    const criticalHealthSites = sites.filter((s: Site) => s.healthStatus === 'CRITICAL');
    const warningHealthSites = sites.filter((s: Site) => s.healthStatus === 'WARNING');

    // Group alerts by site for "sites en souffrance"
    const siteAlertMap = new Map<string, { blocked: Task[]; urgent: Task[]; overdue: Task[]; broken: Asset[]; warrantyExpired: Asset[]; warrantyCritical: Asset[]; warrantyWarning: Asset[]; downMonitorCount: number; healthIssue: boolean }>();

    const ensureSite = (siteId: string | undefined) => {
      if (!siteId) return;
      if (!siteAlertMap.has(siteId)) {
        siteAlertMap.set(siteId, { blocked: [], urgent: [], overdue: [], broken: [], warrantyExpired: [], warrantyCritical: [], warrantyWarning: [], downMonitorCount: 0, healthIssue: false });
      }
    };

    blockedTasks.forEach((t: Task) => { ensureSite(t.siteId); if (t.siteId) siteAlertMap.get(t.siteId)!.blocked.push(t); });
    urgentTasks.forEach((t: Task) => { ensureSite(t.siteId); if (t.siteId) siteAlertMap.get(t.siteId)!.urgent.push(t); });
    overdueTasks.forEach((t: Task) => { ensureSite(t.siteId); if (t.siteId) siteAlertMap.get(t.siteId)!.overdue.push(t); });
    outOfServiceAssets.forEach((a: Asset) => { ensureSite(a.siteId); if (a.siteId) siteAlertMap.get(a.siteId)!.broken.push(a); });
    warrantyExpired.forEach((a: Asset) => { ensureSite(a.siteId); if (a.siteId) siteAlertMap.get(a.siteId)!.warrantyExpired.push(a); });
    warrantyCritical.forEach((a: Asset) => { ensureSite(a.siteId); if (a.siteId) siteAlertMap.get(a.siteId)!.warrantyCritical.push(a); });
    warrantyWarning.forEach((a: Asset) => { ensureSite(a.siteId); if (a.siteId) siteAlertMap.get(a.siteId)!.warrantyWarning.push(a); });

    // Include sites with CRITICAL/WARNING health status
    criticalHealthSites.forEach((s: Site) => { ensureSite(s.id); siteAlertMap.get(s.id)!.healthIssue = true; });
    warningHealthSites.forEach((s: Site) => { ensureSite(s.id); siteAlertMap.get(s.id)!.healthIssue = true; });

    // Sort sites by severity (health issue first, then total alert count)
    const sitesWithAlerts = Array.from(siteAlertMap.entries())
      .map(([siteId, a]) => ({
        siteId,
        site: sites.find((s: Site) => s.id === siteId),
        total: a.blocked.length + a.urgent.length + a.overdue.length + a.broken.length + a.warrantyExpired.length + a.warrantyCritical.length + a.warrantyWarning.length + a.downMonitorCount + (a.healthIssue ? 1 : 0),
        ...a,
      }))
      .filter(s => s.total > 0)
      .sort((a, b) => b.total - a.total);

    // ADR-016: native monitors flattened to NativeDownMonitor for computeAlerts.
    const downMonitors = nativeMonitors
      .filter((m) => m.enabled && m.lastStatus === 'DOWN')
      .map((m) => ({
        id: m.id,
        displayName:
          m.asset?.name ??
          (m.link ? `Lien ${m.link.role.toLowerCase()} ${m.link.provider}` : null) ??
          m.site?.name ??
          m.target,
        target: m.target,
        siteId: m.siteId ?? m.asset?.siteId ?? m.link?.siteId ?? null,
        siteName: m.site?.name ?? m.asset?.site?.name ?? m.link?.site?.name ?? null,
        assetName: m.asset?.name ?? null,
        linkProvider: m.link?.provider ?? null,
      }));
    const summary = computeAlerts({ sites, assets, tasks, downMonitors, warrantyThresholds });

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
      totalAlerts: summary.total,
      sitesWithAlerts,
    };
  }, [tasks, assets, sites, nativeMonitors, warrantyThresholds]);

  const isLoading = sitesLoading || assetsLoading || racksLoading || tasksLoading;
  const isError = sitesIsError || assetsIsError || racksIsError || tasksIsError;
  const error = sitesError ?? assetsError ?? racksError ?? tasksError;
  const refetchAll = () => {
    sitesRefetch();
    assetsRefetch();
    racksRefetch();
    tasksRefetch();
  };
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

  if (isError) {
    return (
      <ErrorState
        title="Impossible de charger le tableau de bord"
        error={error}
        onRetry={refetchAll}
      />
    );
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

      {/* Alertes — résumé compact */}
      {sites.length > 0 && (
        <Card className={alerts.totalAlerts > 0 ? 'border-red-200 dark:border-red-800' : ''}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">{alerts.totalAlerts > 0 ? 'Alertes' : 'Santé'}</span>
                {alerts.totalAlerts > 0 && (
                  <Badge variant="destructive" className="text-xs">{alerts.totalAlerts}</Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                  <Link href="/dashboard/monitoring">Monitoring</Link>
                </Button>
                {alerts.totalAlerts > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                    <Link href="/dashboard/alerts">Détails →</Link>
                  </Button>
                )}
              </div>
            </div>

            {alerts.totalAlerts === 0 ? (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Tous les sites sont opérationnels
              </div>
            ) : (
              <div className="space-y-2">
                {/* Inline counters */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  {alerts.downMonitors.length > 0 && (
                    <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                      <WifiOff className="h-3 w-3" />{alerts.downMonitors.length} DOWN
                    </span>
                  )}
                  {alerts.criticalHealthSites.length > 0 && (
                    <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                      <Activity className="h-3 w-3" />{alerts.criticalHealthSites.length} critique{alerts.criticalHealthSites.length > 1 ? 's' : ''}
                    </span>
                  )}
                  {alerts.blockedTasks.length > 0 && (
                    <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                      <Ban className="h-3 w-3" />{alerts.blockedTasks.length} bloquée{alerts.blockedTasks.length > 1 ? 's' : ''}
                    </span>
                  )}
                  {alerts.urgentTasks.length > 0 && (
                    <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                      <AlertTriangle className="h-3 w-3" />{alerts.urgentTasks.length} urgente{alerts.urgentTasks.length > 1 ? 's' : ''}
                    </span>
                  )}
                  {alerts.overdueTasks.length > 0 && (
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <Clock className="h-3 w-3" />{alerts.overdueTasks.length} en retard
                    </span>
                  )}
                  {alerts.outOfServiceAssets.length > 0 && (
                    <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                      <Package className="h-3 w-3" />{alerts.outOfServiceAssets.length} HS
                    </span>
                  )}
                  {alerts.warrantyTotal > 0 && (
                    <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                      <ShieldAlert className="h-3 w-3" />{alerts.warrantyTotal} garantie{alerts.warrantyTotal > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Sites with issues — compact */}
                {alerts.sitesWithAlerts.length > 0 && (
                  <div className="space-y-1">
                    {alerts.sitesWithAlerts.slice(0, 4).map(({ siteId, site, blocked, urgent, overdue, broken, warrantyExpired, warrantyCritical, warrantyWarning, downMonitorCount, healthIssue }) => (
                      <Link
                        key={siteId}
                        href={`/dashboard/sites/${siteId}`}
                        className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`h-2 w-2 rounded-full flex-shrink-0 ${
                            site?.healthStatus === 'CRITICAL' ? 'bg-red-500 animate-pulse' :
                            site?.healthStatus === 'WARNING' ? 'bg-amber-500' : 'bg-gray-300'
                          }`} />
                          <span className="text-sm font-medium truncate">{site?.name || 'Site inconnu'}</span>
                          <span className="text-xs text-muted-foreground hidden sm:inline">{site?.code}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          {downMonitorCount > 0 && (
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-red-200 text-red-700 dark:border-red-800 dark:text-red-300">
                              <WifiOff className="h-2.5 w-2.5 mr-0.5" />{downMonitorCount} DOWN
                            </Badge>
                          )}
                          {healthIssue && downMonitorCount === 0 && (
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-red-200 text-red-700 dark:border-red-800 dark:text-red-300">
                              {site?.healthStatus === 'CRITICAL' ? 'Critique' : 'Attention'}
                            </Badge>
                          )}
                          {blocked.length > 0 && (
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-red-200 text-red-700 dark:text-red-300">
                              {blocked.length} bloq.
                            </Badge>
                          )}
                          {urgent.length > 0 && (
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-orange-200 text-orange-700 dark:text-orange-300">
                              {urgent.length} urg.
                            </Badge>
                          )}
                          {(broken.length + overdue.length + warrantyExpired.length + warrantyCritical.length + warrantyWarning.length) > 0 && (
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-muted-foreground">
                              +{broken.length + overdue.length + warrantyExpired.length + warrantyCritical.length + warrantyWarning.length}
                            </Badge>
                          )}
                          <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                        </div>
                      </Link>
                    ))}
                    {alerts.sitesWithAlerts.length > 4 && (
                      <Link href="/dashboard/alerts" className="block text-xs text-center text-primary hover:underline pt-1">
                        + {alerts.sitesWithAlerts.length - 4} autre{alerts.sitesWithAlerts.length - 4 > 1 ? 's' : ''} →
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Surveillance micro-bar (ADR-016 — native monitors) */}
            {nativeMonitors.length > 0 && (
              <div className="flex items-center gap-3 mt-3 pt-2 border-t text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  {nativeMonitors.filter((m) => m.enabled && m.lastStatus === 'UP').length} disponibles
                </span>
                {nativeMonitors.filter((m) => m.enabled && m.lastStatus === 'DOWN').length > 0 && (
                  <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    {nativeMonitors.filter((m) => m.enabled && m.lastStatus === 'DOWN').length} indisponibles
                  </span>
                )}
                {nativeMonitors.filter((m) => m.enabled && m.lastStatus === 'UNKNOWN').length > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    {nativeMonitors.filter((m) => m.enabled && m.lastStatus === 'UNKNOWN').length} en attente
                  </span>
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
              <div className="h-[400px] flex items-center justify-center rounded-md border bg-muted text-sm text-muted-foreground">
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
