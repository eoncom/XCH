'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Settings2,
  Eye,
  EyeOff,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { sitesApi } from '@/lib/api/sites';
import { useLiveMonitors } from '@/hooks/useLiveMonitors';
import { healthStatusLabels, healthStatusColors, monitorStatusLabels } from '@/lib/status-labels';
import dynamic from 'next/dynamic';
import type { Site } from '@/types';

const SitesMap = dynamic(() => import('@/components/maps/SitesMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-muted/50 rounded-lg">
      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ),
});

const healthIcons = {
  HEALTHY: CheckCircle2,
  WARNING: AlertTriangle,
  CRITICAL: XCircle,
  UNKNOWN: HelpCircle,
};

const REFRESH_OPTIONS = [
  { value: '15', label: '15s' },
  { value: '30', label: '30s' },
  { value: '60', label: '1 min' },
  { value: '120', label: '2 min' },
  { value: '300', label: '5 min' },
];

export default function TVDashboardPage() {
  const searchParams = useSearchParams();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMap, setShowMap] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tv-show-map') !== 'false';
    }
    return true;
  });
  const [showAlerts, setShowAlerts] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tv-show-alerts') !== 'false';
    }
    return true;
  });
  const [refreshInterval, setRefreshInterval] = useState(() => {
    const urlRefresh = searchParams.get('refresh');
    if (urlRefresh) return Number(urlRefresh);
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('tv-refresh');
      if (stored) return Number(stored);
    }
    return 30;
  });

  // Persist settings
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('tv-refresh', String(refreshInterval));
      localStorage.setItem('tv-show-map', String(showMap));
      localStorage.setItem('tv-show-alerts', String(showAlerts));
    }
  }, [refreshInterval, showMap, showAlerts]);

  // Fetch sites with configurable auto-refresh
  const { data: sites = [], isLoading, dataUpdatedAt } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: sitesApi.getAll,
    refetchInterval: refreshInterval * 1000,
  });

  const { providerStatus } = useLiveMonitors();

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  }, []);

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

  // Sites sorted by severity
  const sortedSites = useMemo(() => {
    const order: Record<string, number> = { CRITICAL: 0, WARNING: 1, UNKNOWN: 2, HEALTHY: 3 };
    return [...sites].sort((a, b) => (order[a.healthStatus] ?? 2) - (order[b.healthStatus] ?? 2));
  }, [sites]);

  // Active alerts from breakdown
  const recentAlerts = useMemo(() => {
    const alerts: Array<{
      siteName: string;
      siteCode: string;
      healthStatus: string;
      timestamp: string;
      components: Array<{ name: string; status: string; type: string }>;
    }> = [];

    for (const site of sites) {
      const breakdown = (site.metadata as Record<string, any>)?.healthBreakdown;
      if (breakdown?.components?.length > 0) {
        const downComponents = breakdown.components.filter(
          (c: { status: string }) => c.status === 'down' || c.status === 'degraded'
        );
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

  // Component stats
  const componentStats = useMemo(() => {
    let totalUp = 0;
    let totalDown = 0;
    for (const site of sites) {
      const breakdown = (site.metadata as Record<string, any>)?.healthBreakdown;
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
    <div className="p-4 space-y-4 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/sites" title="Retour aux sites">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
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
              <span>Rafraîchissement {REFRESH_OPTIONS.find(o => o.value === String(refreshInterval))?.label || `${refreshInterval}s`}</span>
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={toggleFullscreen}>
            {isFullscreen ? (
              <><Minimize className="mr-2 h-4 w-4" /> Quitter</>
            ) : (
              <><Maximize className="mr-2 h-4 w-4" /> Plein écran</>
            )}
          </Button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Rafraîchissement :</span>
                <Select
                  value={String(refreshInterval)}
                  onValueChange={(v) => setRefreshInterval(Number(v))}
                >
                  <SelectTrigger className="w-[100px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REFRESH_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMap(!showMap)}
                className={!showMap ? 'opacity-60' : ''}
              >
                {showMap ? <Eye className="mr-1 h-3 w-3" /> : <EyeOff className="mr-1 h-3 w-3" />}
                Carte
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAlerts(!showAlerts)}
                className={!showAlerts ? 'opacity-60' : ''}
              >
                {showAlerts ? <Eye className="mr-1 h-3 w-3" /> : <EyeOff className="mr-1 h-3 w-3" />}
                Alertes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
        {(['HEALTHY', 'WARNING', 'CRITICAL', 'UNKNOWN'] as const).map(status => {
          const Icon = healthIcons[status];
          const colors = healthStatusColors[status];
          const count = status === 'HEALTHY' ? stats.healthy
            : status === 'WARNING' ? stats.warning
            : status === 'CRITICAL' ? stats.critical
            : stats.unknown;
          return (
            <Card key={status}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${colors?.text || 'text-gray-500'}`} />
                  <div>
                    <p className={`text-xl font-bold ${colors?.text || ''}`}>{count}</p>
                    <p className="text-[10px] text-muted-foreground">{healthStatusLabels[status]}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${componentStats.totalDown > 0 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
              <div>
                <p className="text-xl font-bold">
                  {componentStats.totalDown > 0 ? (
                    <span className="text-red-600">{componentStats.totalDown} {monitorStatusLabels.down}</span>
                  ) : (
                    <span className="text-green-600">{monitorStatusLabels.up}</span>
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {componentStats.totalUp} / {componentStats.total} composants
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main content */}
      <div className={`grid ${showMap && showAlerts ? 'lg:grid-cols-2' : ''} gap-4`}>
        {/* Map */}
        {showMap && (
          <Card className={showAlerts ? 'lg:row-span-2' : ''}>
            <CardContent className="p-2">
              <div className="h-[calc(100vh-380px)] min-h-[400px]">
                <SitesMap sites={sites} height="100%" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sites list */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sites ({sortedSites.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-y-auto max-h-[calc(50vh-120px)]">
              {sortedSites.map((site) => {
                const status = site.healthStatus as keyof typeof healthStatusLabels;
                const colors = healthStatusColors[status] || healthStatusColors.UNKNOWN;
                const label = healthStatusLabels[status] || healthStatusLabels.UNKNOWN;
                const breakdown = (site.metadata as Record<string, any>)?.healthBreakdown;
                const componentCount = breakdown?.components?.length || 0;
                const upCount = breakdown?.components?.filter((c: { status: string }) => c.status === 'up').length || 0;

                return (
                  <div
                    key={site.id}
                    className={`flex items-center justify-between px-4 py-2.5 border-b last:border-b-0 border-l-4 ${colors.border} hover:bg-muted/30 transition-colors`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full ${colors.dot} flex-shrink-0`} />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{site.name}</p>
                        <p className="text-[10px] text-muted-foreground">{site.code} {site.city ? `- ${site.city}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {componentCount > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {upCount}/{componentCount}
                        </span>
                      )}
                      <Badge
                        variant={status === 'CRITICAL' ? 'destructive' : status === 'HEALTHY' ? 'default' : 'secondary'}
                        className={`text-[10px] h-5 ${status === 'HEALTHY' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : ''}`}
                      >
                        {label}
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

        {/* Alerts */}
        {showAlerts && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Alertes monitoring ({recentAlerts.length})
              </CardTitle>
              <p className="text-xs text-muted-foreground pt-0.5">
                Vue NOC : composants monitorés down/degraded uniquement.
                Le compteur du dashboard principal (et la page <Link href="/dashboard/alerts" className="underline">Alertes</Link>) agrège
                en plus les tâches, santé sites, équipements HS et garanties.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-y-auto max-h-[calc(50vh-200px)]">
                {recentAlerts.map((alert, idx) => {
                  const colors = healthStatusColors[alert.healthStatus] || healthStatusColors.UNKNOWN;
                  const time = alert.timestamp
                    ? new Date(alert.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                    : '';

                  return (
                    <div key={idx} className="flex items-start gap-3 px-4 py-2 border-b last:border-b-0 text-sm">
                      <span className={`mt-1 w-2 h-2 rounded-full ${colors.dot} flex-shrink-0`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-xs">{alert.siteCode}</span>
                          {time && <span className="text-[10px] text-muted-foreground">{time}</span>}
                        </div>
                        {alert.components.map((comp, cidx) => (
                          <p key={cidx} className="text-[11px] text-muted-foreground">
                            <span className={comp.status === 'down' ? 'text-red-600 font-medium' : 'text-amber-600'}>
                              {monitorStatusLabels[comp.status] || comp.status.toUpperCase()}
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
        )}
      </div>
    </div>
  );
}
