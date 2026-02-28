'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { sitesApi } from '@/lib/api/sites';
import { Plus, MapPin, Search, List, Map } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { usePermissions } from '@/hooks/usePermissions';
import Link from 'next/link';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { Site } from '@/types';
import { ExportMenu } from '@/components/ui/export-menu';
import { exportSites } from '@/lib/export-utils';

// Dynamically import map component (client-side only)
const SitesMap = dynamic(() => import('@/components/maps/SitesMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[500px] flex items-center justify-center">
      Chargement de la carte...
    </div>
  ),
});

const healthStatusColors = {
  HEALTHY: 'bg-green-100 text-green-800',
  WARNING: 'bg-yellow-100 text-yellow-800',
  CRITICAL: 'bg-red-100 text-red-800',
  UNKNOWN: 'bg-gray-100 text-gray-800',
};

export default function SitesPage() {
  const [search, setSearch] = useState('');
  const router = useRouter();
  const { canCreate } = usePermissions();

  const { data: sites, isLoading } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: sitesApi.getAll,
  });

  const filteredSites = sites?.filter(
    (site) =>
      site.name.toLowerCase().includes(search.toLowerCase()) ||
      site.code.toLowerCase().includes(search.toLowerCase()) ||
      site.city?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSiteClick = (site: Site) => {
    router.push(`/dashboard/sites/${site.id}`);
  };

  const handleExport = (format: 'excel' | 'pdf' | 'csv') => {
    if (!filteredSites) return;
    const exportData = filteredSites.map((site) => ({
      name: site.name,
      code: site.code,
      status: site.status,
      address: site.address || '',
      healthStatus: site.healthStatus,
    }));
    exportSites(exportData, format);
  };

  if (isLoading) {
    return <div className="text-center">Chargement des sites...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sites</h1>
          <p className="text-muted-foreground">Gérez vos sites de déploiement</p>
        </div>
        <div className="flex items-center gap-4">
          <ExportMenu
            onExport={handleExport}
            disabled={!filteredSites?.length}
            label="Exporter"
          />
          {canCreate('sites') && (
            <Button asChild data-testid="create-site-btn">
              <Link href="/dashboard/sites/new">
                <Plus className="mr-2 h-4 w-4" />
                Nouveau site
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un site..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs: List / Map */}
      <Tabs defaultValue="list" className="w-full">
        <TabsList>
          <TabsTrigger value="list">
            <List className="mr-2 h-4 w-4" />
            Liste
          </TabsTrigger>
          <TabsTrigger value="map">
            <Map className="mr-2 h-4 w-4" />
            Carte
          </TabsTrigger>
        </TabsList>

        {/* List View */}
        <TabsContent value="list" className="mt-6">
          <div data-testid="sites-list" className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredSites?.map((site) => (
              <Card
                key={site.id}
                data-testid="site-card"
                className="hover:shadow-lg transition-shadow cursor-pointer"
              >
                <Link href={`/dashboard/sites/${site.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{site.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{site.code}</p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          healthStatusColors[site.healthStatus]
                        }`}
                      >
                        {site.healthStatus}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {site.city && (
                        <div className="flex items-center text-muted-foreground">
                          <MapPin className="mr-2 h-4 w-4" />
                          {site.city}
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Statut:</span>
                        <span className="font-medium">{site.status}</span>
                      </div>
                    </div>
                  </CardContent>
                </Link>
              </Card>
            ))}
          </div>

          {filteredSites?.length === 0 && (
            <EmptyState
              icon={MapPin}
              title="Aucun site trouvé"
              description={search ? 'Essayez de modifier votre recherche' : undefined}
            />
          )}
        </TabsContent>

        {/* Map View */}
        <TabsContent value="map" className="mt-6">
          <Card>
            <CardContent className="p-4">
              <SitesMap
                sites={filteredSites || []}
                onSiteClick={handleSiteClick}
                height="600px"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
