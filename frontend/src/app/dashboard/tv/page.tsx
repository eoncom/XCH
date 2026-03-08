'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Maximize,
  Minimize,
  RefreshCw,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Clock,
  MapPin,
} from 'lucide-react';
import { sitesApi } from '@/lib/api/sites';
import { useLiveMonitors } from '@/hooks/useLiveMonitors';
import dynamic from 'next/dynamic';
import type { Site } from '@/types';

// Dynamically import map component (client-side only)
const SitesMap = dynamic(() => import('@/components/maps/SitesMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-muted/50 rounded-lg">
      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ),
});

const healthConfig = {
  HEALTHY: {
    label: 'Sain',
    icon: CheckCircle2,
    color: 'text-green-600',
    bg: 'bg-green-100 dark:bg-green-900/30',
    border: 'border-l-green-500',
    dot: 'bg-green-500',
  },
  WARNING: {
    label: 'Attention',
    icon: AlertTriangle,
    color: 'text-amber-600',
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    border: 'border-l-amber-500',
    dot: 'bg-amber-500',
  },
  CRITICAL: {
    label: 'Critique',
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-100 dark:bg-red-900/30',
    border: 'border-l-red-500',
    dot: 'bg-red-500 animate-pulse',
  },
  UNKNOWN: {
    label: 'Inconnu',
    icon: HelpCircle,
    color: 'text-gray-500',
    bg: 'bg-gray-100 dark:bg-gray-800',
    border: 'border-l-gray-400',
    dot: 'bg-gray-400',
  },
} as const;

export default function DashboardTVPage() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fetch sites with auto-refresh every 30 seconds
  const { data: sites = [], isLoading, dataUpdatedAt } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: sitesApi.getAll,
    refetchInterval: 30_000,
  });

  // Fetch live monitor statuses
  const { statusMap: monitorStatusMap, providerStatus } = useLiveMonitors();

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  }, []);

  // Listen for fullscreen changes (e.g., pressing Escape)
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Computed stats
  const stats = useMemo(() => {
    const healthy = sites.filter(s => s.healthStatus === 'HEALTHY').length;
    const warning = sites.filter(s => s.healthStatus === 'WARNING').length;
    const critical = sites.filter(s => s.healthStatus === 'CRITICAL').length;
    const unknown = sites.filter(s => s.healthStatus === 'UNKNOWN').length;
    return { healthy, warning, critical, unknown, total: sites.length };
  }, [sites]);

  // Sites sorted by severity (critical first, then warning, unknown, healthy)
  const sortedSites = useMemo(() => {
    const order: Record<string, number> = { CRITICAL: 0, WARNING: 1, UNKNOWN: 2, HEALTHY: 3 };
    return [...sites].sort((a, b) => (order[a.healthStatus] ?? 2) - (order[b.healthStatus] ?? 2));
  }, [sites]);

  // Recent health changes (from metadata)
  const recentAlerts = useMemo(() => {
    const alerts: Array<{
      siteName: string;
      siteCode: string;
      healthStatus: string;
      timestamp: string;
      components: Array<{ name: string; status: string; type: string }>;
    }> = [];

    for (const site of sites) {
      const breakdown = (site.metadata as any)?.healthBreakdown;
      if (breakdown?.components?.length > 0) {
        const downComponents = breakdown.components.filter((c: any) => c.status === 'down' || c.status === 'degraded');
        if (downComponents.length > 0) {
          alerts.push({
            siteName: site.name,
            siteCode: site.code,
            healthStatus: site.healthStatus,
            timestamp: breakdown.timestamp || site.lastHealthCheck?.toString() || '',
            components: downComponents.slice(0, 3),
          });
        }
      }
    }

    return alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);
  }, [sites]);

  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  // Count monitored components across all sites
  const componentStats = useMemo(() => {
    let totalUp = 0;
    let totalDown = 0;
    for (const site of sites) {
      const breakdown = (site.metadata as any)?.healthBreakdown;
      if (breakdown?.components) {
        for (const comp of breakdown.components) {
          if (comp.status === 'up') totalUp++;
          else if (comp.status === 'down') totalDown++;
        }
      }
    }
    return { totalUp, totalDown, total: totalUp + totalDown };
  }, [sites]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <Activity className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Chargement du dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${isFullscreen ? 'p-6 bg-background min-h-screen' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Dashboard Monitoring</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {lastUpdate && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {lastUpdate}
                </span>
              )}
              <span>Auto-refresh 30s</span>
              {providerStatus === 'connected' && (
                <Badge variant="outline" className="text-green-600 border-green-300 text-[10px] h-5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1" />
                  Monitoring actif
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleFullscreen}>
            {isFullscreen ? (
              <><Minimize className="mr-2 h-4 w-4" /> Quitter</>
            ) : (
              <><Maximize className="mr-2 h-4 w-4" /> Plein écran</>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xl font-bold">{stats.total}</p>
                <p className="text-[10px] text-muted-foreground">Sites</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xl font-bold text-green-600">{stats.healthy}</p>
                <p className="text-[10px] text-muted-foreground">Sains</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <div>
                <p className="text-xl font-bold text-amber-600">{stats.warning}</p>
                <p className="text-[10px] text-muted-foreground">Attention</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-xl font-bold text-red-600">{stats.critical}</p>
                <p className="text-[10px] text-muted-foreground">Critiques</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xl font-bold">{componentStats.total}</p>
                <p className="text-[10px] text-muted-foreground">Composants</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${componentStats.totalDown > 0 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
              <div>
                <p className="text-xl font-bold">
                  {componentStats.totalDown > 0 ? (
                    <span className="text-red-600">{componentStats.totalDown} DOWN</span>
                  ) : (
                    <span className="text-green-600">OK</span>
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {componentStats.totalUp} UP / {componentStats.total}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main content: Map + Sites list */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Map */}
        <Card className="lg:row-span-2">
          <CardContent className="p-2">
            <div className={isFullscreen ? 'h-[calc(100vh-380px)]' : 'h-[500px]'}>
              <SitesMap
                sites={sites}
                height="100%"
              />
            </div>
          </CardContent>
        </Card>

        {/* Sites list */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sites ({sortedSites.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className={`overflow-y-auto ${isFullscreen ? 'max-h-[calc(50vh-200px)]' : 'max-h-[280px]'}`}>
              {sortedSites.map((site) => {
                const config = healthConfig[site.healthStatus as keyof typeof healthConfig] || healthConfig.UNKNOWN;
                const breakdown = (site.metadata as any)?.healthBreakdown;
                const componentCount = breakdown?.components?.length || 0;
                const upCount = breakdown?.components?.filter((c: any) => c.status === 'up').length || 0;

                return (
                  <div
                    key={site.id}
                    className={`flex items-center justify-between px-4 py-2.5 border-b last:border-b-0 border-l-4 ${config.border} hover:bg-muted/30 transition-colors`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full ${config.dot} flex-shrink-0`} />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{site.name}</p>
                        <p className="text-[10px] text-muted-foreground">{site.code} {site.city ? `- ${site.city}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {componentCount > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {upCount}/{componentCount} UP
                        </span>
                      )}
                      <Badge
                        variant={config === healthConfig.CRITICAL ? 'destructive' : config === healthConfig.HEALTHY ? 'default' : 'secondary'}
                        className={`text-[10px] h-5 ${config === healthConfig.HEALTHY ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : ''}`}
                      >
                        {config.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
              {sortedSites.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Aucun site configuré
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Alerts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Alertes actives ({recentAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className={`overflow-y-auto ${isFullscreen ? 'max-h-[calc(50vh-200px)]' : 'max-h-[180px]'}`}>
              {recentAlerts.map((alert, idx) => {
                const config = healthConfig[alert.healthStatus as keyof typeof healthConfig] || healthConfig.UNKNOWN;
                const time = alert.timestamp
                  ? new Date(alert.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                  : '';

                return (
                  <div key={idx} className="flex items-start gap-3 px-4 py-2 border-b last:border-b-0 text-sm">
                    <span className={`mt-1 w-2 h-2 rounded-full ${config.dot} flex-shrink-0`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-xs">{alert.siteCode}</span>
                        {time && <span className="text-[10px] text-muted-foreground">{time}</span>}
                      </div>
                      {alert.components.map((comp, cidx) => (
                        <p key={cidx} className="text-[11px] text-muted-foreground">
                          <span className={comp.status === 'down' ? 'text-red-600 font-medium' : 'text-amber-600'}>
                            {comp.status === 'down' ? 'DOWN' : 'DEGRADED'}
                          </span>
                          {' '}{comp.name}
                          <span className="text-muted-foreground/60"> ({comp.type})</span>
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })}
              {recentAlerts.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-green-500" />
                  Aucune alerte active
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
