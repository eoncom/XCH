'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
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
import { SiteFilterSelect } from '@/components/ui/grouped-site-selector';
import { exportAssets } from '@/lib/export-utils';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Search, QrCode, Package, ShieldAlert, MapPin, Activity, LayoutGrid, List, ArrowUpDown, ArrowUp, ArrowDown, Upload, X } from 'lucide-react';
import { WarrantyBadge } from '@/components/ui/warranty-badge';
import { getWarrantyStatus, useWarrantyThresholds, type WarrantyStatus } from '@/lib/warranty';
import { Pagination, type PaginationMeta } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { usePermissions } from '@/hooks/usePermissions';
import { useLiveMonitors } from '@/hooks/useLiveMonitors';
import Link from 'next/link';
import { assetTypeLabels, assetStatusLabels, assetStatusColors } from '@/lib/asset-labels';
import type { Asset, AssetType, AssetStatus } from '@/types';

export default function AssetsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [warrantyFilter, setWarrantyFilter] = useState<string>('all');
  const [monitorFilter, setMonitorFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortField, setSortField] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const warrantyThresholds = useWarrantyThresholds();
  const { statusMap } = useLiveMonitors();
  const { canCreate, canUpdate } = usePermissions();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Batch selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchStatus, setBatchStatus] = useState<string>('');
  const [batchSiteId, setBatchSiteId] = useState<string>('');

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setBatchStatus('');
    setBatchSiteId('');
  }, []);

  const { data: response, isLoading } = useQuery<{ data: Asset[]; meta: PaginationMeta }>({
    queryKey: ['assets', { status: statusFilter, type: typeFilter, siteId: siteFilter, search, page, pageSize }],
    queryFn: () =>
      assetsApi.getAllPaginated({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        siteId: siteFilter !== 'all' ? siteFilter : undefined,
        search: search || undefined,
        page,
        pageSize,
      }),
    // Keep previous rows visible while refetching (e.g. while typing in the search box).
    // Prevents the whole page (and thus the search input) from unmounting on each keystroke.
    placeholderData: keepPreviousData,
  });
  const assets = response?.data ?? [];
  const meta = response?.meta;

  // Reset page and selection when filters change
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [search, statusFilter, typeFilter, siteFilter, warrantyFilter, monitorFilter]);

  // Resolve live monitoring status: live data takes priority over cached DB value
  const getLiveStatus = (asset: Asset): 'up' | 'down' | 'unknown' | undefined => {
    const mn = (asset.networkInfo as any)?.monitorName;
    if (!mn) return undefined;
    if (statusMap[mn] !== undefined) return statusMap[mn];
    return (asset.networkInfo as any)?.monitorStatus;
  };

  const filteredAssets = assets.filter((asset) => {
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

  // Batch selection helpers (after filteredAssets is defined)
  const allSelected = filteredAssets.length > 0 && selectedIds.size === filteredAssets.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < filteredAssets.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAssets.map(a => a.id)));
    }
  };

  const batchMutation = useMutation({
    mutationFn: () => {
      const update: { status?: string; siteId?: string } = {};
      if (batchStatus) update.status = batchStatus;
      if (batchSiteId) update.siteId = batchSiteId;
      return assetsApi.batchUpdate(Array.from(selectedIds), update);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      clearSelection();
    },
  });

  // Sort assets for table view
  const sortedAssets = useMemo(() => {
    if (!filteredAssets || !sortField) return filteredAssets;
    return [...filteredAssets].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';
      switch (sortField) {
        case 'type':
          valA = assetTypeLabels[a.type] || a.type;
          valB = assetTypeLabels[b.type] || b.type;
          break;
        case 'name':
          valA = a.name || `${a.manufacturer || ''} ${a.model || ''}`.trim();
          valB = b.name || `${b.manufacturer || ''} ${b.model || ''}`.trim();
          break;
        case 'serial':
          valA = a.serialNumber || '';
          valB = b.serialNumber || '';
          break;
        case 'site':
          valA = a.site?.name || '';
          valB = b.site?.name || '';
          break;
        case 'status':
          valA = assetStatusLabels[a.status];
          valB = assetStatusLabels[b.status];
          break;
        case 'warranty':
          valA = a.warrantyEnd || '';
          valB = b.warrantyEnd || '';
          break;
        case 'monitoring':
          valA = getLiveStatus(a) || 'zzz';
          valB = getLiveStatus(b) || 'zzz';
          break;
      }
      const cmp = String(valA).localeCompare(String(valB), 'fr', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredAssets, sortField, sortDir]);

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50" />;
    return sortDir === 'asc'
      ? <ArrowUp className="ml-1 h-3 w-3" />
      : <ArrowDown className="ml-1 h-3 w-3" />;
  };

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
            <>
              <Button variant="outline" asChild>
                <Link href="/dashboard/assets/import">
                  <Upload className="mr-2 h-4 w-4" />
                  Import CSV
                </Link>
              </Button>
              <Button asChild className="press-effect" data-testid="create-asset-btn">
                <Link href="/dashboard/assets/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Nouvel équipement
                </Link>
              </Button>
            </>
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

        <SiteFilterSelect value={siteFilter} onValueChange={setSiteFilter} />

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
                  {canUpdate('assets') && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        ref={undefined}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Tout sélectionner"
                        {...(someSelected ? { 'data-state': 'indeterminate' } : {})}
                      />
                    </TableHead>
                  )}
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('type')}>
                    <span className="inline-flex items-center">Type<SortIcon field="type" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('name')}>
                    <span className="inline-flex items-center">Nom<SortIcon field="name" /></span>
                  </TableHead>
                  <TableHead className="hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort('serial')}>
                    <span className="inline-flex items-center">S/N<SortIcon field="serial" /></span>
                  </TableHead>
                  <TableHead className="hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort('site')}>
                    <span className="inline-flex items-center">Site<SortIcon field="site" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('status')}>
                    <span className="inline-flex items-center">Statut<SortIcon field="status" /></span>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell cursor-pointer select-none" onClick={() => toggleSort('warranty')}>
                    <span className="inline-flex items-center">Garantie<SortIcon field="warranty" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('monitoring')}>
                    <span className="inline-flex items-center">Monitoring<SortIcon field="monitoring" /></span>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAssets?.map((asset) => {
                  const liveStatus = getLiveStatus(asset);
                  return (
                    <TableRow key={asset.id} className={selectedIds.has(asset.id) ? 'bg-muted/50' : ''}>
                      {canUpdate('assets') && (
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(asset.id)}
                            onCheckedChange={() => toggleSelect(asset.id)}
                            aria-label={`Sélectionner ${asset.name || asset.serialNumber || 'équipement'}`}
                          />
                        </TableCell>
                      )}
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
                        <Badge variant={(assetStatusColors[asset.status] as any) || 'secondary'}>
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
                className={`hover-lift cursor-pointer border-border ${selectedIds.has(asset.id) ? 'ring-2 ring-primary' : ''}`}
              >
                <Link href={`/dashboard/assets/${asset.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {canUpdate('assets') && (
                          <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSelect(asset.id); }}>
                            <Checkbox
                              checked={selectedIds.has(asset.id)}
                              onCheckedChange={() => {}}
                              aria-label={`Sélectionner ${asset.name || asset.serialNumber || 'équipement'}`}
                            />
                          </div>
                        )}
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
                        <Badge variant={(assetStatusColors[asset.status] as any) || 'secondary'}>
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

      {meta && <Pagination meta={meta} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}

      {filteredAssets?.length === 0 && (
        <EmptyState
          icon={Package}
          title="Aucun équipement trouvé"
          description={search || statusFilter !== 'all' || typeFilter !== 'all' || siteFilter !== 'all' || warrantyFilter !== 'all' || monitorFilter !== 'all'
            ? 'Essayez de modifier vos filtres de recherche'
            : undefined}
        />
      )}

      {/* Batch action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg">
          <div className="container mx-auto flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="text-sm font-medium whitespace-nowrap">
              {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
            </span>

            <Select value={batchStatus} onValueChange={setBatchStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Changer le statut" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(assetStatusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <SiteFilterSelect
              value={batchSiteId || 'all'}
              onValueChange={(v) => setBatchSiteId(v === 'all' ? '' : v)}
            />

            <Button
              size="sm"
              disabled={(!batchStatus && !batchSiteId) || batchMutation.isPending}
              onClick={() => batchMutation.mutate()}
            >
              {batchMutation.isPending ? 'Application...' : 'Appliquer'}
            </Button>

            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <X className="mr-1 h-4 w-4" />
              Désélectionner
            </Button>

            {batchMutation.isError && (
              <span className="text-sm text-destructive">
                Erreur lors de la mise à jour
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
