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
import { ExportMenu } from '@/components/ui/export-menu';
import { CardSkeleton } from '@/components/ui/skeleton';
import { assetsApi } from '@/lib/api/assets';
import { sitesApi } from '@/lib/api/sites';
import { exportAssets } from '@/lib/export-utils';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Plus, Search, QrCode, Package, ShieldAlert, MapPin, Activity, LayoutGrid, List } from 'lucide-react';
import { WarrantyBadge } from '@/components/ui/warranty-badge';
import { getWarrantyStatus, useWarrantyThresholds, type WarrantyStatus } from '@/lib/warranty';
import { EmptyState } from '@/components/ui/empty-state';
import { usePermissions } from '@/hooks/usePermissions';
import { useLiveMonitors } from '@/hooks/useLiveMonitors';
import Link from 'next/link';
import type { Asset, AssetType, AssetStatus, Site } from '@/types';

const assetTypeLabels: Record<AssetType, string> = {
  PRINTER: 'Imprimante',
  IPAD: 'iPad',
  TABLET: 'Tablette',
  SWITCH: 'Switch',
  FIREWALL: 'Firewall',
  ROUTER: 'Routeur',
  WIFI_AP: 'Point d\'accès WiFi',
  ACCESS_POINT: 'Point d\'accès',
  TEAMS_ROOM: 'Teams Room',
  WEBCAM: 'Webcam',
  DISPLAY: 'Écran',
  CAMERA: 'Caméra',
  SERVER: 'Serveur',
  CABLE: 'Câble',
  PATCH_PANEL: 'Panneau de brassage',
  PDU: 'PDU',
  BOX_5G: 'Box 5G',
  OTHER: 'Autre',
};

const assetStatusColors = {
  IN_SERVICE: 'success',
  OUT_OF_SERVICE: 'secondary',
  IN_TRANSIT: 'warning',
  STOCK: 'secondary',
  RETIRED: 'error',
} as const;

const assetStatusLabels: Record<AssetStatus, string> = {
  IN_SERVICE: 'En service',
  OUT_OF_SERVICE: 'Hors service',
  IN_TRANSIT: 'En transit',
  STOCK: 'En stock',
  RETIRED: 'Retiré',
};

export default function AssetsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [warrantyFilter, setWarrantyFilter] = useState<string>('all');
  const [monitorFilter, setMonitorFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const warrantyThresholds = useWarrantyThresholds();
  const { statusMap } = useLiveMonitors();
  const { canCreate } = usePermissions();
  const router = useRouter();

  const { data: sites } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: () => sitesApi.getAll(),
  });

  const { data: assets, isLoading } = useQuery<Asset[]>({
    queryKey: ['assets', { status: statusFilter, type: typeFilter, siteId: siteFilter, search }],
    queryFn: () =>
      assetsApi.getAll({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        siteId: siteFilter !== 'all' ? siteFilter : undefined,
        search: search || undefined,
      }),
  });

  // Resolve live monitoring status: live data takes priority over cached DB value
  const getLiveStatus = (asset: Asset): 'up' | 'down' | 'unknown' | undefined => {
    const mn = (asset.networkInfo as any)?.monitorName;
    if (!mn) return undefined;
    if (statusMap[mn] !== undefined) return statusMap[mn];
    return (asset.networkInfo as any)?.monitorStatus;
  };

  const filteredAssets = assets?.filter((asset) => {
    const searchLower = search.toLowerCase();
    const matchesSearch = (
      asset.model?.toLowerCase().includes(searchLower) ||
      asset.manufacturer?.toLowerCase().includes(searchLower) ||
      asset.serialNumber?.toLowerCase().includes(searchLower) ||
      asset.name?.toLowerCase().includes(searchLower) ||
      assetTypeLabels[asset.type].toLowerCase().includes(searchLower)
    );
    // Warranty filter
    if (warrantyFilter !== 'all') {
      const status = getWarrantyStatus(asset.warrantyEnd, warrantyThresholds);
      if (warrantyFilter === 'alert') {
        // All warranty alerts (expired + critical + warning)
        if (status !== 'expired' && status !== 'expiring_critical' && status !== 'expiring_warning') return false;
      } else if (warrantyFilter === 'expired') {
        if (status !== 'expired') return false;
      } else if (warrantyFilter === 'expiring_critical') {
        if (status !== 'expiring_critical') return false;
      } else if (warrantyFilter === 'expiring_warning') {
        if (status !== 'expiring_warning') return false;
      } else if (warrantyFilter === 'ok') {
        if (status !== 'ok') return false;
      } else if (warrantyFilter === 'none') {
        if (status !== 'none') return false;
      }
    }
    // Monitoring filter (uses live status)
    if (monitorFilter !== 'all') {
      const net = asset.networkInfo as any;
      const liveStatus = getLiveStatus(asset);
      if (monitorFilter === 'up' && liveStatus !== 'up') return false;
      if (monitorFilter === 'down' && liveStatus !== 'down') return false;
      if (monitorFilter === 'monitored' && !net?.monitorName) return false;
      if (monitorFilter === 'not_monitored' && net?.monitorName) return false;
    }
    return matchesSearch;
  });

  // Handle export
  const handleExport = (format: 'excel' | 'pdf' | 'csv' | 'json') => {
    if (!filteredAssets) return;

    const formatWarranty = (warrantyEnd?: string) => {
      if (!warrantyEnd) return '';
      const end = new Date(warrantyEnd);
      if (end < new Date()) return `Expirée (${end.toLocaleDateString('fr-FR')})`;
      return `Valide → ${end.toLocaleDateString('fr-FR')}`;
    };

    const exportData = filteredAssets.map((asset) => ({
      type: assetTypeLabels[asset.type],
      name: asset.name || '',
      brand: asset.manufacturer || '',
      model: asset.model || '',
      serialNumber: asset.serialNumber || '',
      status: assetStatusLabels[asset.status],
      siteName: asset.site?.name || '',
      ip: (asset.networkInfo as any)?.ip || '',
      hostname: (asset.networkInfo as any)?.hostname || '',
      warranty: formatWarranty(asset.warrantyEnd),
      inventoryTag: asset.inventoryTag || '',
      purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString('fr-FR') : '',
      rack: asset.rack?.name || '',
    }));

    exportAssets(exportData, format);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-64 animate-pulse rounded bg-muted mt-2" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Équipements</h1>
          <p className="text-muted-foreground">
            Gérez votre inventaire d'équipements ({filteredAssets?.length || 0})
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 border rounded-lg p-1">
            <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('grid')}>
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')}>
              <List className="h-4 w-4" />
            </Button>
          </div>
          <ExportMenu onExport={handleExport} disabled={!filteredAssets?.length} />
          <Button variant="outline" asChild data-testid="scan-qr-btn">
            <Link href="/dashboard/assets/scanner">
              <QrCode className="mr-2 h-4 w-4" />
              Scanner QR
            </Link>
          </Button>
          {canCreate('assets') && (
            <Button asChild className="press-effect" data-testid="create-asset-btn">
              <Link href="/dashboard/assets/new">
                <Plus className="mr-2 h-4 w-4" />
                Nouvel équipement
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Tous les types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {Object.entries(assetTypeLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(assetStatusLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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

        <Select value={warrantyFilter} onValueChange={setWarrantyFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Garantie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes garanties</SelectItem>
            <SelectItem value="alert">⚠️ Alertes garantie</SelectItem>
            <SelectItem value="expired">🔴 Expirée</SelectItem>
            <SelectItem value="expiring_critical">🟠 Critique (&lt;30j)</SelectItem>
            <SelectItem value="expiring_warning">🟡 Attention (&lt;90j)</SelectItem>
            <SelectItem value="ok">✅ Valide</SelectItem>
            <SelectItem value="none">— Sans garantie</SelectItem>
          </SelectContent>
        </Select>

        <Select value={monitorFilter} onValueChange={setMonitorFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Monitoring" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tout monitoring</SelectItem>
            <SelectItem value="up">🟢 En ligne (UP)</SelectItem>
            <SelectItem value="down">🔴 Hors ligne (DOWN)</SelectItem>
            <SelectItem value="monitored">📡 Supervisé</SelectItem>
            <SelectItem value="not_monitored">— Non supervisé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Assets List/Grid */}
      {viewMode === 'list' ? (
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead className="hidden md:table-cell">S/N</TableHead>
                  <TableHead className="hidden md:table-cell">Site</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="hidden lg:table-cell">Garantie</TableHead>
                  <TableHead>Monitoring</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssets?.map((asset) => {
                  const liveStatus = getLiveStatus(asset);
                  return (
                    <TableRow key={asset.id}>
                      <TableCell className="font-medium text-xs">
                        {assetTypeLabels[asset.type] || asset.type}
                      </TableCell>
                      <TableCell>
                        <Link href={`/dashboard/assets/${asset.id}`} className="hover:underline font-medium">
                          {asset.name || `${asset.manufacturer || ''} ${asset.model || ''}`.trim() || 'Équipement'}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground font-mono text-xs">
                        {asset.serialNumber || '—'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {asset.site ? (
                          <Link href={`/dashboard/sites/${asset.siteId}`} className="text-primary hover:underline text-sm">
                            {asset.site.name}
                          </Link>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={assetStatusColors[asset.status]}>
                          {assetStatusLabels[asset.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <WarrantyBadge warrantyEnd={asset.warrantyEnd} />
                      </TableCell>
                      <TableCell>
                        {(asset.networkInfo as any)?.monitorName ? (
                          <span className="inline-flex items-center gap-1 text-xs" title={(asset.networkInfo as any)?.monitorName}>
                            <span className={`inline-block w-2 h-2 rounded-full ${
                              liveStatus === 'up' ? 'bg-green-500' :
                              liveStatus === 'down' ? 'bg-red-500 animate-pulse' : 'bg-gray-400'
                            }`} />
                            {liveStatus === 'up' ? 'UP' : liveStatus === 'down' ? 'DOWN' : '?'}
                          </span>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/assets/${asset.id}`}>Voir</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div data-testid="assets-list" className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredAssets?.map((asset) => {
            const liveStatus = getLiveStatus(asset);
            return (
              <Card
                key={asset.id}
                data-testid="asset-card"
                className="hover-lift cursor-pointer border-border"
              >
                <Link href={`/dashboard/assets/${asset.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <CardTitle className="text-lg text-foreground">
                            {asset.name || `${asset.manufacturer || ''} ${asset.model || ''}`.trim() || 'Équipement'}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {assetTypeLabels[asset.type]}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant={assetStatusColors[asset.status]}>
                          {assetStatusLabels[asset.status]}
                        </Badge>
                        <WarrantyBadge warrantyEnd={asset.warrantyEnd} />
                        {(asset.networkInfo as any)?.monitorName && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                              liveStatus === 'up'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : liveStatus === 'down'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                            }`}
                            title={`Monitoring: ${(asset.networkInfo as any)?.monitorName}`}
                          >
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                              liveStatus === 'up' ? 'bg-green-500' :
                              liveStatus === 'down' ? 'bg-red-500 animate-pulse' : 'bg-gray-400'
                            }`} />
                            {liveStatus === 'up' ? 'UP' : liveStatus === 'down' ? 'DOWN' : '?'}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {asset.serialNumber && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">S/N:</span>
                          <span className="font-mono text-foreground">{asset.serialNumber}</span>
                        </div>
                      )}
                      {asset.site && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Site:</span>
                          <span className="text-foreground">{asset.site.name}</span>
                        </div>
                      )}
                      {asset.qrCodeUrl && (
                        <div className="flex items-center text-muted-foreground">
                          <QrCode className="mr-2 h-4 w-4" />
                          QR Code généré
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Link>
              </Card>
            );
          })}
        </div>
      )}

      {filteredAssets?.length === 0 && (
        <EmptyState
          icon={Package}
          title="Aucun équipement trouvé"
          description={search || statusFilter !== 'all' || typeFilter !== 'all' || siteFilter !== 'all' || warrantyFilter !== 'all' || monitorFilter !== 'all'
            ? 'Essayez de modifier vos filtres de recherche'
            : undefined}
        />
      )}
    </div>
  );
}
