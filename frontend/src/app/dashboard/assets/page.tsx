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
import { exportAssets } from '@/lib/export-utils';
import { Plus, Search, QrCode, Package } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import Link from 'next/link';
import type { Asset, AssetType, AssetStatus } from '@/types';

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
  const { canCreate } = usePermissions();
  const router = useRouter();

  const { data: assets, isLoading } = useQuery<Asset[]>({
    queryKey: ['assets', { status: statusFilter, type: typeFilter, search }],
    queryFn: () =>
      assetsApi.getAll({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        search: search || undefined,
      }),
  });

  const filteredAssets = assets?.filter((asset) => {
    const searchLower = search.toLowerCase();
    return (
      asset.model?.toLowerCase().includes(searchLower) ||
      asset.manufacturer?.toLowerCase().includes(searchLower) ||
      asset.serialNumber?.toLowerCase().includes(searchLower) ||
      assetTypeLabels[asset.type].toLowerCase().includes(searchLower)
    );
  });

  // Handle export
  const handleExport = (format: 'excel' | 'pdf' | 'csv') => {
    if (!filteredAssets) return;

    const exportData = filteredAssets.map((asset) => ({
      type: assetTypeLabels[asset.type],
      brand: asset.manufacturer || '',
      model: asset.model || '',
      serialNumber: asset.serialNumber || '',
      status: assetStatusLabels[asset.status],
      siteName: asset.site?.name || '',
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
        <div className="flex flex-wrap gap-2">
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
      </div>

      {/* Assets Grid */}
      <div data-testid="assets-list" className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredAssets?.map((asset) => (
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
                  <Badge variant={assetStatusColors[asset.status]}>
                    {assetStatusLabels[asset.status]}
                  </Badge>
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
        ))}
      </div>

      {filteredAssets?.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Aucun équipement trouvé</p>
        </div>
      )}
    </div>
  );
}
