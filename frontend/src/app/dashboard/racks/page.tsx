'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { racksApi } from '@/lib/api/racks';
import { sitesApi } from '@/lib/api/sites';
import { Plus, Search, Server, MapPin } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import Link from 'next/link';
import type { Rack, RackStatus, Site } from '@/types';
import { ExportMenu } from '@/components/ui/export-menu';
import { exportToPDF, exportToExcel, exportToCSV } from '@/lib/export-utils';

const rackStatusColors = {
  IN_SERVICE: 'success',
  OUT_OF_SERVICE: 'secondary',
  PREPARATION: 'warning',
} as const;

const rackStatusLabels: Record<RackStatus, string> = {
  IN_SERVICE: 'En service',
  OUT_OF_SERVICE: 'Hors service',
  PREPARATION: 'Préparation',
};

export default function RacksPage() {
  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const { canCreate } = usePermissions();
  const router = useRouter();

  const { data: racks, isLoading } = useQuery<Rack[]>({
    queryKey: ['racks', siteFilter],
    queryFn: () => racksApi.getAll(siteFilter !== 'all' ? siteFilter : undefined),
  });

  const { data: sites } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: sitesApi.getAll,
  });

  const filteredRacks = racks?.filter((rack) => {
    const searchLower = search.toLowerCase();
    return (
      rack.name.toLowerCase().includes(searchLower) ||
      rack.location?.toLowerCase().includes(searchLower) ||
      rack.site?.name.toLowerCase().includes(searchLower)
    );
  });

  const handleExport = (format: 'excel' | 'pdf' | 'csv') => {
    if (!filteredRacks) return;

    const exportData = filteredRacks.map((rack) => {
      const occupiedUnits = rack.assets?.reduce(
        (sum, asset) => sum + (asset.rackHeightU || 0),
        0
      ) || 0;
      const usagePercent = Math.round((occupiedUnits / rack.heightU) * 100);

      return {
        name: rack.name,
        heightU: rack.heightU,
        status: rackStatusLabels[rack.status],
        site: rack.site?.name || '-',
        location: rack.location || '-',
        occupiedU: occupiedUnits,
        availableU: rack.heightU - occupiedUnits,
        usage: `${usagePercent}%`,
        assetsCount: rack.assets?.length || 0,
      };
    });

    const options = {
      filename: `xch-racks-${new Date().toISOString().split('T')[0]}`,
      title: 'Liste des Baies',
      subtitle: `${exportData.length} baie(s)`,
      columns: [
        { header: 'Nom', key: 'name', width: 20 },
        { header: 'Taille', key: 'heightU', width: 10 },
        { header: 'Statut', key: 'status', width: 15 },
        { header: 'Site', key: 'site', width: 25 },
        { header: 'Emplacement', key: 'location', width: 20 },
        { header: 'Occupé (U)', key: 'occupiedU', width: 12 },
        { header: 'Dispo (U)', key: 'availableU', width: 12 },
        { header: 'Usage', key: 'usage', width: 10 },
        { header: 'Équipements', key: 'assetsCount', width: 12 },
      ],
      data: exportData,
    };

    switch (format) {
      case 'pdf':
        exportToPDF(options);
        break;
      case 'csv':
        exportToCSV(options);
        break;
      case 'excel':
      default:
        exportToExcel(options);
        break;
    }
  };

  if (isLoading) {
    return <div className="text-center">Chargement des baies...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Baies</h1>
          <p className="text-muted-foreground">Gérez vos baies et équipements montés</p>
        </div>
        <div className="flex items-center gap-4">
          <ExportMenu
            onExport={handleExport}
            disabled={!filteredRacks?.length}
            label="Exporter"
          />
          {canCreate('racks') && (
            <Button asChild data-testid="create-rack-btn">
              <Link href="/dashboard/racks/new">
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle baie
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={siteFilter} onValueChange={setSiteFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Tous les sites" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les sites</SelectItem>
            {sites?.map((site) => (
              <SelectItem key={site.id} value={site.id}>
                {site.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Racks Grid */}
      <div data-testid="racks-list" className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredRacks?.map((rack) => {
          const occupiedUnits = rack.assets?.reduce(
            (sum, asset) => sum + (asset.rackHeightU || 0),
            0
          ) || 0;
          const availableUnits = rack.heightU - occupiedUnits;
          const usagePercent = Math.round((occupiedUnits / rack.heightU) * 100);

          return (
            <Card
              key={rack.id}
              data-testid="rack-card"
              className="hover:shadow-lg transition-shadow cursor-pointer"
            >
              <Link href={`/dashboard/racks/${rack.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Server className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <CardTitle className="text-lg">{rack.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {rack.heightU}U
                        </p>
                      </div>
                    </div>
                    <Badge variant={rackStatusColors[rack.status]}>
                      {rackStatusLabels[rack.status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {rack.site && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <MapPin className="mr-2 h-4 w-4" />
                        {rack.site.name}
                      </div>
                    )}

                    {rack.location && (
                      <div className="text-sm text-muted-foreground">
                        Emplacement: {rack.location}
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Utilisation</span>
                        <span className="font-medium">{usagePercent}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            usagePercent >= 90
                              ? 'bg-red-500'
                              : usagePercent >= 70
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                          }`}
                          style={{ width: `${usagePercent}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {occupiedUnits}U occupé / {availableUnits}U disponible
                      </p>
                    </div>

                    <div className="text-sm">
                      <span className="text-muted-foreground">Équipements: </span>
                      <span className="font-medium">{rack.assets?.length || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Link>
            </Card>
          );
        })}
      </div>

      {filteredRacks?.length === 0 && (
        <div className="text-center py-12">
          <Server className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Aucune baie trouvée</p>
        </div>
      )}
    </div>
  );
}
