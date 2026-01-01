'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { MapPin, Package, Server, CheckSquare } from 'lucide-react';

interface DashboardStats {
  sites: { total: number; active: number; critical: number };
  assets: { total: number; inStock: number; active: number };
  racks: { total: number; activeU: number; totalU: number };
  tasks: { total: number; todo: number; inProgress: number; done: number };
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      // Fetch stats from API (mock data for now)
      return {
        sites: { total: 42, active: 38, critical: 2 },
        assets: { total: 156, inStock: 24, active: 132 },
        racks: { total: 18, activeU: 524, totalU: 756 },
        tasks: { total: 89, todo: 23, inProgress: 12, done: 54 },
      };
    },
  });

  if (isLoading) {
    return <div className="text-center">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Vue d'ensemble de vos chantiers</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chantiers</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.sites.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.sites.active} actifs • {stats?.sites.critical} critiques
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Équipements</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.assets.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.assets.active} actifs • {stats?.assets.inStock} en stock
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Baies</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.racks.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.racks.activeU}U / {stats?.racks.totalU}U utilisés
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tâches</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.tasks.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.tasks.inProgress} en cours • {stats?.tasks.todo} à faire
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Activité récente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            <p>Les activités récentes s'afficheront ici.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
