'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { sitesApi } from '@/lib/api/sites';
import { assetsApi } from '@/lib/api/assets';
import { racksApi } from '@/lib/api/racks';
import { tasksApi } from '@/lib/api/tasks';
import { MapPin, Package, Server, CheckSquare, MapIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
  sites: { total: number; active: number; critical: number };
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

  // Calculate stats from real data
  const stats: DashboardStats = useMemo(() => {
    // Sites stats
    const activeSites = sites.filter((s) => s.status === 'ACTIVE').length;
    const criticalSites = sites.filter(
      (s) => s.healthStatus === 'CRITICAL' || s.healthStatus === 'WARNING'
    ).length;

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
        <p className="text-muted-foreground">Vue d'ensemble de vos chantiers</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/dashboard/sites">
          <Card data-testid="stats-card-sites" className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Chantiers</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.sites.total}</div>
              <p className="text-xs text-muted-foreground">
                {stats.sites.active} actifs • {stats.sites.critical} alertes
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

      {/* Sites Map */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapIcon className="h-5 w-5" />
            Carte des chantiers
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
              Aucun chantier avec coordonnées GPS disponible
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Sites récents</CardTitle>
        </CardHeader>
        <CardContent>
          {sites.length > 0 ? (
            <div className="space-y-3">
              {sites.slice(0, 5).map((site) => (
                <div
                  key={site.id}
                  className="flex items-center justify-between border-b pb-2 last:border-0"
                >
                  <div>
                    <p className="font-medium">{site.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {site.city} • {site.code}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        site.status === 'ACTIVE'
                          ? 'bg-green-50 text-green-700'
                          : site.status === 'PREPARATION'
                          ? 'bg-yellow-50 text-yellow-700'
                          : 'bg-gray-50 text-gray-700'
                      }`}
                    >
                      {site.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun site disponible</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
