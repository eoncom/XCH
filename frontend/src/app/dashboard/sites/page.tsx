'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { siteStatusLabel } from '@/lib/labels';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { sitesApi } from '@/lib/api/sites';
import { organizationApi } from '@/lib/api/organization';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, MapPin, Search, List, Map, LayoutGrid, ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react';
import { Pagination, type PaginationMeta } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { usePermissions } from '@/hooks/usePermissions';
import Link from 'next/link';
import { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { Site } from '@/types';
import { ExportMenu } from '@/components/ui/export-menu';
import { exportSites } from '@/lib/export-utils';
import { siteStatusLabels } from '@/lib/status-labels';

// Dynamically import map component (client-side only)
const SitesMap = dynamic(() => import('@/components/maps/SitesMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[500px] flex items-center justify-center">
      Chargement de la carte...
    </div>
  ),
});

const healthStatusColors: Record<string, 'success' | 'warning' | 'error' | 'secondary'> = {
  HEALTHY: 'success',
  WARNING: 'warning',
  CRITICAL: 'error',
  UNKNOWN: 'secondary',
};

const healthStatusLabelsMap: Record<string, string> = {
  HEALTHY: 'Sain',
  WARNING: 'Attention',
  CRITICAL: 'Critique',
  UNKNOWN: 'Inconnu',
};

const healthStatusCss: Record<string, string> = {
  HEALTHY: 'bg-green-100 text-green-800',
  WARNING: 'bg-yellow-100 text-yellow-800',
  CRITICAL: 'bg-red-100 text-red-800',
  UNKNOWN: 'bg-gray-100 text-gray-800',
};

const siteStatusColors: Record<string, 'success' | 'warning' | 'secondary'> = {
  ACTIVE: 'success',
  PREPARATION: 'warning',
  CLOSED: 'secondary',
};

export default function SitesPage() {
  const [search, setSearch] = useState('');
  const [siteViewMode, setSiteViewMode] = useState<'grid' | 'list'>('grid');
  const [sortField, setSortField] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filterDelegationId, setFilterDelegationId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [activeTab, setActiveTab] = useState<string>('list');
  const router = useRouter();
  const { canCreate } = usePermissions();

  // Use large pageSize for map view so all sites are loaded
  const effectivePageSize = activeTab === 'map' ? 200 : pageSize;
  const effectivePage = activeTab === 'map' ? 1 : page;

  const { data: response, isLoading } = useQuery<{ data: Site[]; meta: PaginationMeta }>({
    queryKey: ['sites', { search, filterDelegationId, filterStatus, page: effectivePage, pageSize: effectivePageSize }],
    queryFn: () => sitesApi.getAllPaginated({
      search: search || undefined,
      delegationId: filterDelegationId || undefined,
      status: filterStatus || undefined,
      page: effectivePage,
      pageSize: effectivePageSize,
    }),
    placeholderData: keepPreviousData,
  });
  const sites = response?.data ?? [];
  const meta = response?.meta;

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, filterDelegationId, filterStatus]);

  const { data: delegations } = useQuery({
    queryKey: ['delegations'],
    queryFn: () => organizationApi.getDelegations(),
  });

  const filteredSites = sites.filter((site) => {
    const matchesSearch = !search ||
      site.name.toLowerCase().includes(search.toLowerCase()) ||
      site.code.toLowerCase().includes(search.toLowerCase()) ||
      site.city?.toLowerCase().includes(search.toLowerCase());

    const matchesDelegation = !filterDelegationId || site.delegationId === filterDelegationId;

    return matchesSearch && matchesDelegation;
  });

  // Sort sites for table view
  const sortedSites = useMemo(() => {
    if (!filteredSites || !sortField) return filteredSites;
    return [...filteredSites].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';
      switch (sortField) {
        case 'name': valA = a.name; valB = b.name; break;
        case 'code': valA = a.code; valB = b.code; break;
        case 'city': valA = a.city || ''; valB = b.city || ''; break;
        case 'status': valA = a.status; valB = b.status; break;
        case 'health':
          const order: Record<string, number> = { CRITICAL: 0, WARNING: 1, UNKNOWN: 2, HEALTHY: 3 };
          valA = order[a.healthStatus] ?? 2;
          valB = order[b.healthStatus] ?? 2;
          return sortDir === 'asc' ? valA - valB : valB - valA;
      }
      const cmp = String(valA).localeCompare(String(valB), 'fr', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredSites, sortField, sortDir]);

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

  const handleSiteClick = (site: Site) => {
    router.push(`/dashboard/sites/${site.id}`);
  };

  const handleExport = (format: 'excel' | 'pdf' | 'csv' | 'json') => {
    if (!filteredSites) return;

    const summarizeConnectivity = (conn: any): string => {
      if (!conn) return '';
      if (Array.isArray(conn.links)) {
        return conn.links
          .map((l: any) => `${l.type || ''} ${l.provider || ''}`.trim())
          .filter(Boolean)
          .join(' + ');
      }
      return '';
    };

    const exportData = filteredSites.map((site) => ({
      name: site.name,
      code: site.code,
      status: site.status,
      city: (site as any).city || '',
      postalCode: (site as any).postalCode || '',
      address: site.address || '',
      healthStatus: site.healthStatus,
      assetsCount: '',
      tasksCount: '',
      connectivity: summarizeConnectivity(site.connectivity),
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
        <div className="flex items-center gap-2 flex-wrap">
          {activeTab === 'list' && (
            <div className="flex items-center gap-1 border rounded-lg p-1">
              <Button variant={siteViewMode === 'grid' ? 'default' : 'ghost'} size="sm" onClick={() => setSiteViewMode('grid')}>
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button variant={siteViewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setSiteViewMode('list')}>
                <List className="h-4 w-4" />
              </Button>
            </div>
          )}
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

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un site..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterDelegationId} onValueChange={(v) => setFilterDelegationId(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Délégation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les délégations</SelectItem>
            {delegations?.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                <span className="flex items-center gap-2">
                  {d.groupColor && <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: d.groupColor }} />}
                  {d.groupLabel ? `${d.groupLabel} > ${d.name}` : d.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(siteStatusLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs: List / Map */}
      <Tabs defaultValue="list" value={activeTab} onValueChange={setActiveTab} className="w-full">
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
        <TabsContent value="list" className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">{filteredSites?.length || 0} site(s)</p>

          {siteViewMode === 'list' ? (
            <Card>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('name')}>
                        <span className="inline-flex items-center">Nom<SortIcon field="name" /></span>
                      </TableHead>
                      <TableHead className="hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort('code')}>
                        <span className="inline-flex items-center">Code<SortIcon field="code" /></span>
                      </TableHead>
                      <TableHead className="hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort('city')}>
                        <span className="inline-flex items-center">Ville<SortIcon field="city" /></span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('status')}>
                        <span className="inline-flex items-center">Statut<SortIcon field="status" /></span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('health')}>
                        <span className="inline-flex items-center">Santé<SortIcon field="health" /></span>
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedSites?.map((site) => (
                      <TableRow key={site.id}>
                        <TableCell className="font-medium">
                          <Link href={`/dashboard/sites/${site.id}`} className="hover:underline">
                            {site.name}
                          </Link>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {site.code}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {site.city || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={siteStatusColors[site.status] || 'secondary'}>
                            {siteStatusLabel(site.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={healthStatusColors[site.healthStatus] || 'secondary'}>
                            {healthStatusLabelsMap[site.healthStatus] || site.healthStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/dashboard/sites/${site.id}`}>Voir</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
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
                            healthStatusCss[site.healthStatus]
                          }`}
                        >
                          {healthStatusLabelsMap[site.healthStatus] || site.healthStatus}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        {site.delegation && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {site.delegation.groupColor && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: site.delegation.groupColor }} />}
                            {site.delegation.groupLabel && <span>{site.delegation.groupLabel} &gt; </span>}
                            <span>{site.delegation.name}</span>
                          </div>
                        )}
                        {site.city && (
                          <div className="flex items-center text-muted-foreground">
                            <MapPin className="mr-2 h-4 w-4" />
                            {site.city}
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Statut:</span>
                          <span className="font-medium">{siteStatusLabel(site.status)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Link>
                </Card>
              ))}
            </div>
          )}

          {filteredSites?.length === 0 && (
            <EmptyState
              icon={MapPin}
              title="Aucun site trouvé"
              description={search ? 'Essayez de modifier votre recherche' : undefined}
            />
          )}

          {meta && <Pagination meta={meta} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}
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
