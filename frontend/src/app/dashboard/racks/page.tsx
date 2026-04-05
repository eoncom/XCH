'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { racksApi } from '@/lib/api/racks';
import { SiteFilterSelect } from '@/components/ui/grouped-site-selector';
import { Pagination, type PaginationMeta } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Server, MapPin } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { usePermissions } from '@/hooks/usePermissions';
import Link from 'next/link';
import type { Rack, RackStatus } from '@/types';
import { ExportMenu } from '@/components/ui/export-menu';
import { exportToPDF, exportToExcel, exportToCSV, sanitizeForExcel } from '@/lib/export-utils';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

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
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { canCreate } = usePermissions();
  const router = useRouter();

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [siteFilter, search, statusFilter]);

  const { data: response, isLoading } = useQuery({
    queryKey: ['racks', siteFilter, page, pageSize],
    queryFn: () => racksApi.getAll({
      siteId: siteFilter !== 'all' ? siteFilter : undefined,
      page,
      pageSize,
    }),
  });
  const racks = response?.data ?? [];
  const meta = response?.meta;

  const filteredRacks = racks.filter((rack) => {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      rack.name.toLowerCase().includes(searchLower) ||
      rack.location?.toLowerCase().includes(searchLower) ||
      rack.site?.name.toLowerCase().includes(searchLower);
    const matchesStatus = statusFilter === 'all' || rack.status === statusFilter;
    return matchesSearch && matchesStatus;
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
        heightU: `${rack.heightU}U`,
        status: rackStatusLabels[rack.status],
        site: rack.site?.name || '-',
        location: rack.location || '-',
        occupiedU: occupiedUnits,
        availableU: rack.heightU - occupiedUnits,
        usage: `${usagePercent}%`,
        assetsCount: rack.assets?.length || 0,
        // Equipment names for PDF/CSV
        equipmentList: rack.assets?.map(a => a.name || `${a.manufacturer || ''} ${a.model || ''}`.trim() || a.type).join(', ') || '-',
      };
    });

    const filename = `xch-racks-${new Date().toISOString().split('T')[0]}`;

    if (format === 'excel') {
      // Custom Excel with 2 sheets: Summary + Equipment details
      const wb = XLSX.utils.book_new();

      // Sheet 1: Summary
      const summaryData: any[][] = [
        ['Liste des Baies', '', '', '', '', '', '', '', ''],
        [`Export\u00e9 le ${new Date().toLocaleDateString('fr-FR')} - ${exportData.length} baie(s)`],
        [],
        ['Nom', 'Taille', 'Statut', 'Site', 'Emplacement', 'Occup\u00e9 (U)', 'Dispo (U)', 'Usage', '\u00c9quipements'],
      ];
      for (const r of exportData) {
        summaryData.push([sanitizeForExcel(r.name), r.heightU, sanitizeForExcel(r.status), sanitizeForExcel(r.site), sanitizeForExcel(r.location), r.occupiedU, r.availableU, r.usage, r.assetsCount]);
      }
      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
      summaryWs['!cols'] = [
        { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
      ];
      XLSX.utils.book_append_sheet(wb, summaryWs, 'R\u00e9sum\u00e9');

      // Sheet 2: Equipment per rack
      const detailData: any[][] = [
        ['\u00c9quipements Mont\u00e9s par Baie', '', '', '', '', '', '', ''],
        [],
        ['Baie', 'Site', 'Position', 'Hauteur', 'Type', 'Nom', 'Fabricant / Mod\u00e8le', 'N\u00b0 S\u00e9rie'],
      ];
      for (const rack of filteredRacks) {
        if (rack.assets && rack.assets.length > 0) {
          const sortedAssets = [...rack.assets].sort((a, b) => (b.rackPositionU || 0) - (a.rackPositionU || 0));
          for (const asset of sortedAssets) {
            detailData.push([
              sanitizeForExcel(rack.name),
              sanitizeForExcel(rack.site?.name || '-'),
              asset.rackPositionU ? `U${asset.rackPositionU}` : '-',
              asset.rackHeightU ? `${asset.rackHeightU}U` : '-',
              sanitizeForExcel(asset.type),
              sanitizeForExcel(asset.name || '-'),
              sanitizeForExcel([asset.manufacturer, asset.model].filter(Boolean).join(' ') || '-'),
              sanitizeForExcel(asset.serialNumber || '-'),
            ]);
          }
        } else {
          detailData.push([rack.name, rack.site?.name || '-', '-', '-', '(Vide)', '-', '-', '-']);
        }
      }
      const detailWs = XLSX.utils.aoa_to_sheet(detailData);
      detailWs['!cols'] = [
        { wch: 20 }, { wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 22 }, { wch: 25 }, { wch: 20 },
      ];
      XLSX.utils.book_append_sheet(wb, detailWs, '\u00c9quipements');

      const xlsxData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([xlsxData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `${filename}.xlsx`);
      return;
    }

    // PDF and CSV: include equipment list column
    const options = {
      filename,
      title: 'Liste des Baies',
      subtitle: `${exportData.length} baie(s)`,
      columns: [
        { header: 'Nom', key: 'name', width: 18 },
        { header: 'Taille', key: 'heightU', width: 8 },
        { header: 'Statut', key: 'status', width: 13 },
        { header: 'Site', key: 'site', width: 22 },
        { header: 'Emplacement', key: 'location', width: 18 },
        { header: 'Occup\u00e9', key: 'occupiedU', width: 8 },
        { header: 'Dispo', key: 'availableU', width: 8 },
        { header: 'Usage', key: 'usage', width: 8 },
        { header: '\u00c9quipements', key: 'equipmentList', width: 35 },
      ],
      data: exportData,
    };

    if (format === 'pdf') {
      exportToPDF(options);
    } else {
      exportToCSV(options);
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
            disabled={!filteredRacks.length}
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
      <div className="grid gap-4 md:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <SiteFilterSelect value={siteFilter} onValueChange={setSiteFilter} />

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(rackStatusLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Racks Grid */}
      <div data-testid="racks-list" className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredRacks.map((rack) => {
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

      {filteredRacks.length === 0 && (
        <EmptyState
          icon={Server}
          title="Aucune baie trouvée"
          description={search || siteFilter !== 'all' || statusFilter !== 'all'
            ? 'Essayez de modifier vos filtres de recherche'
            : undefined}
        />
      )}

      {meta && <Pagination meta={meta} onPageChange={setPage} onPageSizeChange={setPageSize} />}
    </div>
  );
}
