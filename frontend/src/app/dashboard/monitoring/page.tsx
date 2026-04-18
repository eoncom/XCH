'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sitesApi } from '@/lib/api/sites';
import { assetsApi } from '@/lib/api/assets';
import { useLiveMonitors } from '@/hooks/useLiveMonitors';
import {
  Activity, WifiOff, Search, Clock, CheckCircle2, XCircle, HelpCircle,
  ChevronDown, ChevronRight, MapPin, Globe, Layers, Shield, Server,
  Wifi, MonitorSmartphone, ArrowLeft, RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import type { Site, Asset } from '@/types';

// Map asset types to icons for visual grouping
const typeIcons: Record<string, any> = {
  ROUTER: Globe,
  SWITCH: Layers,
  FIREWALL: Shield,
  SERVER: Server,
  WIFI_AP: Wifi,
  BOX_5G: Globe,
  OTHER: MonitorSmartphone,
};

const typeLabels: Record<string, string> = {
  ROUTER: 'Routeur',
  SWITCH: 'Switch',
  FIREWALL: 'Firewall',
  SERVER: 'Serveur',
  WIFI_AP: 'Point d\'accès WiFi',
  BOX_5G: 'Box 5G',
  LINK: 'Lien / Connectivité',
  SDWAN: 'SD-WAN',
  OTHER: 'Autre',
};

interface MonitorWithContext {
  id: number;
  name: string;
  type: string;
  status: 'up' | 'down' | 'unknown';
  responseTime: number;
  certExpiry?: number;
  siteName?: string;
  siteId?: string;
  siteCode?: string;
  assetName?: string;
  assetType?: string;
  assetId?: string;
  source: 'asset' | 'link' | 'sdwan' | 'unmapped';
}

export default function MonitoringOverviewPage() {
  const { can, hasAnySiteAccess } = usePermissions();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'by-site' | 'by-type' | 'all'>('by-site');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const canViewMonitoring = can('monitoring', 'read') && hasAnySiteAccess();

  const { monitors, isLoading, refetch, dataUpdatedAt } = useLiveMonitors();

  const { data: sites = [] } = useQuery({
    queryKey: ['sites'],
    queryFn: sitesApi.getAll,
  });

  const { data: assets = [] } = useQuery({
    queryKey: ['assets'],
    queryFn: () => assetsApi.getAll(),
  });

  // Enrich monitors with site/asset context
  const enrichedMonitors: MonitorWithContext[] = useMemo(() => {
    const monitorToAsset = new Map<string, Asset>();
    assets.forEach((a: Asset) => {
      const mn = (a.networkInfo as any)?.monitorName;
      if (mn) monitorToAsset.set(mn, a);
    });

    const monitorToSiteLink = new Map<string, { site: Site; source: 'link' | 'sdwan' }>();
    sites.forEach((s: Site) => {
      const connectivity = s.connectivity as any;
      const links = connectivity?.links || connectivity?.v2?.links || [];
      links.forEach((link: any) => {
        if (link.monitorName) monitorToSiteLink.set(link.monitorName, { site: s, source: 'link' });
      });
      const sdwan = connectivity?.sdwan || connectivity?.v2?.sdwan;
      if (sdwan?.monitorName) monitorToSiteLink.set(sdwan.monitorName, { site: s, source: 'sdwan' });
    });

    const siteMap = new Map<string, Site>();
    sites.forEach((s: Site) => siteMap.set(s.id, s));

    return monitors.map(m => {
      const asset = monitorToAsset.get(m.name);
      const linkMatch = monitorToSiteLink.get(m.name);

      let siteName: string | undefined;
      let siteId: string | undefined;
      let siteCode: string | undefined;
      let source: MonitorWithContext['source'] = 'unmapped';

      if (asset) {
        source = 'asset';
        if (asset.siteId) {
          const site = siteMap.get(asset.siteId);
          siteName = site?.name;
          siteId = site?.id;
          siteCode = site?.code;
        }
      } else if (linkMatch) {
        source = linkMatch.source;
        siteName = linkMatch.site.name;
        siteId = linkMatch.site.id;
        siteCode = linkMatch.site.code;
      }

      return {
        ...m,
        siteName,
        siteId,
        siteCode,
        assetName: asset ? (asset.name || `${asset.manufacturer || ''} ${asset.model || ''}`.trim()) : undefined,
        assetType: asset?.type,
        assetId: asset?.id,
        source,
      };
    });
  }, [monitors, sites, assets]);

  // Stats
  const upCount = monitors.filter(m => m.status === 'up').length;
  const downCount = monitors.filter(m => m.status === 'down').length;
  const unknownCount = monitors.filter(m => m.status === 'unknown').length;
  const avgResponseTime = monitors.length > 0
    ? Math.round(monitors.reduce((acc, m) => acc + (m.responseTime || 0), 0) / monitors.length)
    : 0;

  // Search filter
  const filtered = useMemo(() => {
    if (!search) return enrichedMonitors;
    const q = search.toLowerCase();
    return enrichedMonitors.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.siteName?.toLowerCase().includes(q) ||
      m.siteCode?.toLowerCase().includes(q) ||
      m.assetName?.toLowerCase().includes(q)
    );
  }, [enrichedMonitors, search]);

  // Group by site
  const bySite = useMemo(() => {
    const groups = new Map<string, { site: Site | null; siteId: string; monitors: MonitorWithContext[] }>();
    filtered.forEach(m => {
      const key = m.siteId || '__unmapped__';
      if (!groups.has(key)) {
        const site = m.siteId ? sites.find((s: Site) => s.id === m.siteId) || null : null;
        groups.set(key, { site, siteId: key, monitors: [] });
      }
      groups.get(key)!.monitors.push(m);
    });

    return Array.from(groups.values()).sort((a, b) => {
      const aDown = a.monitors.filter(m => m.status === 'down').length;
      const bDown = b.monitors.filter(m => m.status === 'down').length;
      if (aDown !== bDown) return bDown - aDown;
      if (!a.site) return 1;
      if (!b.site) return -1;
      return (a.site?.name || '').localeCompare(b.site?.name || '', 'fr');
    });
  }, [filtered, sites]);

  // Group by type
  const byType = useMemo(() => {
    const groups = new Map<string, { type: string; label: string; monitors: MonitorWithContext[] }>();
    filtered.forEach(m => {
      let type: string;
      if (m.source === 'link') type = 'LINK';
      else if (m.source === 'sdwan') type = 'SDWAN';
      else if (m.assetType) type = m.assetType;
      else type = 'OTHER';

      if (!groups.has(type)) {
        groups.set(type, { type, label: typeLabels[type] || type, monitors: [] });
      }
      groups.get(type)!.monitors.push(m);
    });

    return Array.from(groups.values()).sort((a, b) => {
      const aDown = a.monitors.filter(m => m.status === 'down').length;
      const bDown = b.monitors.filter(m => m.status === 'down').length;
      if (aDown !== bDown) return bDown - aDown;
      return a.label.localeCompare(b.label, 'fr');
    });
  }, [filtered]);

  // Auto-expand sections with DOWN monitors
  const effectiveExpanded = useMemo(() => {
    const expanded = new Set(expandedSections);
    if (viewMode === 'by-site') {
      bySite.forEach(g => {
        if (g.monitors.some(m => m.status === 'down')) expanded.add(g.siteId);
      });
    } else if (viewMode === 'by-type') {
      byType.forEach(g => {
        if (g.monitors.some(m => m.status === 'down')) expanded.add(g.type);
      });
    }
    return expanded;
  }, [expandedSections, bySite, byType, viewMode]);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const sortByStatus = (a: MonitorWithContext, b: MonitorWithContext) => {
    const order: Record<string, number> = { down: 0, unknown: 1, up: 2 };
    return (order[a.status] ?? 1) - (order[b.status] ?? 1);
  };

  // Permission gate: deny access if user cannot view monitoring
  if (!canViewMonitoring) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link href="/dashboard"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="text-2xl font-bold">Monitoring</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="font-medium">Accès refusé</p>
            <p className="text-sm mt-1">
              Vous n&apos;avez pas les permissions nécessaires pour accéder au monitoring.
              Contactez votre administrateur pour obtenir l&apos;accès à un ou plusieurs sites.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link href="/dashboard"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="text-2xl font-bold">Monitoring</h1>
        </div>
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href="/dashboard"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <h1 className="text-2xl font-bold">Monitoring</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-10">Vue globale de l&apos;état de vos moniteurs</p>
        </div>
        <div className="flex items-center gap-2">
          {dataUpdatedAt > 0 && (
            <span className="text-xs text-muted-foreground hidden md:inline">
              Mis à jour {new Date(dataUpdatedAt).toLocaleTimeString('fr-FR')}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />Actualiser
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30">
              <Activity className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{monitors.length}</p>
              <p className="text-xs text-muted-foreground">Moniteurs</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/30">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{upCount}</p>
              <p className="text-xs text-muted-foreground">UP</p>
            </div>
          </CardContent>
        </Card>
        <Card className={downCount > 0 ? 'border-red-200 dark:border-red-800' : ''}>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className={`text-2xl font-bold ${downCount > 0 ? 'text-red-600' : ''}`}>{downCount}</p>
              <p className="text-xs text-muted-foreground">DOWN</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/30">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{avgResponseTime}<span className="text-sm font-normal text-muted-foreground">ms</span></p>
              <p className="text-xs text-muted-foreground">Temps moyen</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + View toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher moniteur, site, équipement..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex rounded-lg border overflow-hidden">
          {(['by-site', 'by-type', 'all'] as const).map(mode => (
            <Button
              key={mode}
              variant={viewMode === mode ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none h-9 text-xs"
              onClick={() => setViewMode(mode)}
            >
              {mode === 'by-site' ? 'Par site' : mode === 'by-type' ? 'Par type' : 'Tous'}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      {monitors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <WifiOff className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Aucun moniteur configuré</p>
            <p className="text-xs mt-1">
              Configurez Uptime Kuma depuis{' '}
              <a href="/dashboard/netbox" className="underline hover:no-underline">la page des intégrations</a>.
            </p>
          </CardContent>
        </Card>
      ) : viewMode === 'all' ? (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filtered.sort(sortByStatus).map(m => (
                <MonitorRow key={m.id} monitor={m} showSite showType />
              ))}
              {filtered.length === 0 && (
                <div className="py-8 text-center text-muted-foreground text-sm">Aucun résultat pour &quot;{search}&quot;</div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : viewMode === 'by-site' ? (
        <div className="space-y-3">
          {bySite.map(group => {
            const key = group.siteId;
            const isExpanded = effectiveExpanded.has(key);
            const downInGroup = group.monitors.filter(m => m.status === 'down').length;
            const upInGroup = group.monitors.filter(m => m.status === 'up').length;

            return (
              <Card key={key} className={downInGroup > 0 ? 'border-red-200 dark:border-red-800' : ''}>
                <button
                  onClick={() => toggleSection(key)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="font-semibold">{group.site?.name || 'Non rattaché'}</span>
                      {group.site?.code && <span className="text-xs text-muted-foreground ml-2">{group.site.code}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {downInGroup > 0 && <Badge variant="destructive" className="text-xs">{downInGroup} DOWN</Badge>}
                    {upInGroup > 0 && <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-800">{upInGroup} UP</Badge>}
                    <span className="text-xs text-muted-foreground">{group.monitors.length}</span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t divide-y">
                    {group.monitors.sort(sortByStatus).map(m => (
                      <MonitorRow key={m.id} monitor={m} showType />
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
          {bySite.length === 0 && (
            <div className="py-8 text-center text-muted-foreground text-sm">Aucun résultat</div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {byType.map(group => {
            const key = group.type;
            const isExpanded = effectiveExpanded.has(key);
            const downInGroup = group.monitors.filter(m => m.status === 'down').length;
            const upInGroup = group.monitors.filter(m => m.status === 'up').length;
            const TypeIcon = typeIcons[group.type] || Globe;

            return (
              <Card key={key} className={downInGroup > 0 ? 'border-red-200 dark:border-red-800' : ''}>
                <button
                  onClick={() => toggleSection(key)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <TypeIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{group.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {downInGroup > 0 && <Badge variant="destructive" className="text-xs">{downInGroup} DOWN</Badge>}
                    {upInGroup > 0 && <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-800">{upInGroup} UP</Badge>}
                    <span className="text-xs text-muted-foreground">{group.monitors.length}</span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t divide-y">
                    {group.monitors.sort(sortByStatus).map(m => (
                      <MonitorRow key={m.id} monitor={m} showSite />
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
          {byType.length === 0 && (
            <div className="py-8 text-center text-muted-foreground text-sm">Aucun résultat</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Monitor row component ───────────────────────────────────────────────────

function MonitorRow({ monitor, showSite, showType }: { monitor: MonitorWithContext; showSite?: boolean; showType?: boolean }) {
  const rtColor = monitor.responseTime < 500
    ? 'text-green-600 dark:text-green-400'
    : monitor.responseTime < 1000
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400';

  const sourceLabel = monitor.source === 'link' ? 'Lien' : monitor.source === 'sdwan' ? 'SD-WAN' : undefined;

  return (
    <div className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        {monitor.status === 'up' && <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />}
        {monitor.status === 'down' && <XCircle className="h-4 w-4 text-red-500 animate-pulse flex-shrink-0" />}
        {monitor.status === 'unknown' && <HelpCircle className="h-4 w-4 text-gray-400 flex-shrink-0" />}
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{monitor.name}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {showSite && monitor.siteName && (
              <Link href={`/dashboard/sites/${monitor.siteId}`} className="hover:underline hover:text-primary">
                {monitor.siteName}
              </Link>
            )}
            {showType && monitor.assetName && (
              <Link href={`/dashboard/assets/${monitor.assetId}`} className="hover:underline hover:text-primary">
                {monitor.assetName}
              </Link>
            )}
            {showType && sourceLabel && <span>{sourceLabel}</span>}
            {!monitor.siteName && !monitor.assetName && !sourceLabel && (
              <span className="italic">Non rattaché</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0 ml-2">
        {monitor.certExpiry !== undefined && monitor.certExpiry < 30 && (
          <span className="text-xs text-amber-600 dark:text-amber-400 hidden md:inline" title="Expiration certificat SSL">
            SSL {monitor.certExpiry}j
          </span>
        )}
        <span className={`text-xs font-mono ${rtColor} hidden sm:inline`}>
          {monitor.responseTime}ms
        </span>
        <Badge
          variant={monitor.status === 'up' ? 'outline' : monitor.status === 'down' ? 'destructive' : 'secondary'}
          className="text-xs min-w-[50px] justify-center"
        >
          {monitor.status.toUpperCase()}
        </Badge>
      </div>
    </div>
  );
}
