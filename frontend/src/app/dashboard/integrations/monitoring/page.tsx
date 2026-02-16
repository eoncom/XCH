'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RefreshCw,
  Search,
  Loader2,
  Wifi,
  WifiOff,
  Clock,
  Shield,
  Zap,
  ExternalLink,
} from 'lucide-react';
import { integrationsApi } from '@/lib/api/integrations';
import { showToast } from '@/lib/toast';

interface Monitor {
  id: number;
  name: string;
  type: string;
  status: 'up' | 'down' | 'unknown';
  responseTime: number;
  certExpiry?: number;
}

const statusConfig = {
  up: {
    label: 'UP',
    icon: CheckCircle2,
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-900/30',
    badge: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  down: {
    label: 'DOWN',
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/30',
    badge: 'destructive',
  },
  unknown: {
    label: 'INCONNU',
    icon: HelpCircle,
    color: 'text-gray-500 dark:text-gray-400',
    bg: 'bg-gray-100 dark:bg-gray-800',
    badge: 'secondary',
  },
} as const;

export default function MonitoringPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: monitors = [], isLoading, isError, error, dataUpdatedAt } = useQuery<Monitor[]>({
    queryKey: ['uptime-kuma-monitors'],
    queryFn: () => integrationsApi.uptimeKuma.getMonitors(),
    refetchInterval: 60_000, // Refresh every 60s
    retry: 1,
  });

  const syncAllMutation = useMutation({
    mutationFn: () => integrationsApi.uptimeKuma.syncAllHealth(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uptime-kuma-monitors'] });
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      showToast.success('Synchronisation terminée');
    },
    onError: () => {
      showToast.error('Erreur lors de la synchronisation');
    },
  });

  const filteredMonitors = monitors.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  const upCount = monitors.filter((m) => m.status === 'up').length;
  const downCount = monitors.filter((m) => m.status === 'down').length;
  const unknownCount = monitors.filter((m) => m.status === 'unknown').length;
  const avgResponseTime = monitors.length > 0
    ? Math.round(monitors.reduce((sum, m) => sum + m.responseTime, 0) / monitors.length)
    : 0;
  const certWarnings = monitors.filter((m) => m.certExpiry !== undefined && m.certExpiry < 30).length;

  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/integrations">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Activity className="h-7 w-7" />
              Monitoring
            </h1>
            <p className="text-muted-foreground">
              Uptime Kuma — Surveillance des services en temps réel
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {lastUpdate}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['uptime-kuma-monitors'] })}
            disabled={isLoading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Rafraîchir
          </Button>
          <Button
            size="sm"
            onClick={() => syncAllMutation.mutate()}
            disabled={syncAllMutation.isPending}
          >
            {syncAllMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Zap className="mr-2 h-4 w-4" />
            )}
            Sync. chantiers
          </Button>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <WifiOff className="h-5 w-5 text-red-500" />
              <div>
                <p className="font-medium text-red-800 dark:text-red-200">Connexion impossible</p>
                <p className="text-sm text-red-600 dark:text-red-400">
                  Vérifiez que Uptime Kuma est configuré dans les paramètres d&apos;intégration et que le serveur est accessible.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Dashboard - only show when we have data */}
      {!isLoading && !isError && (
        <>
          {/* Stats cards */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-2">
                    <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{monitors.length}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">{upCount}</p>
                    <p className="text-xs text-muted-foreground">UP</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-red-100 dark:bg-red-900/30 p-2">
                    <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">{downCount}</p>
                    <p className="text-xs text-muted-foreground">DOWN</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-purple-100 dark:bg-purple-900/30 p-2">
                    <Zap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{avgResponseTime}<span className="text-sm font-normal">ms</span></p>
                    <p className="text-xs text-muted-foreground">Latence moy.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${certWarnings > 0 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                    <Shield className={`h-5 w-5 ${certWarnings > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{certWarnings}</p>
                    <p className="text-xs text-muted-foreground">Cert. &lt;30j</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un moniteur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Monitors list */}
          {monitors.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Activity className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">Aucun moniteur détecté</p>
                <p className="text-xs text-muted-foreground">
                  Vérifiez que votre instance Uptime Kuma est configurée et contient des moniteurs.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Moniteurs ({filteredMonitors.length}{search ? ` / ${monitors.length}` : ''})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="border-t">
                  {/* Table header */}
                  <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                    <span className="col-span-1">Statut</span>
                    <span className="col-span-5">Nom</span>
                    <span className="col-span-2">Type</span>
                    <span className="col-span-2">Latence</span>
                    <span className="col-span-2">Certificat SSL</span>
                  </div>

                  {/* DOWN monitors first, then UP */}
                  {[...filteredMonitors]
                    .sort((a, b) => {
                      const order = { down: 0, unknown: 1, up: 2 };
                      return order[a.status] - order[b.status];
                    })
                    .map((monitor) => {
                      const config = statusConfig[monitor.status];
                      const StatusIcon = config.icon;
                      const certDanger = monitor.certExpiry !== undefined && monitor.certExpiry < 14;
                      const certWarning = monitor.certExpiry !== undefined && monitor.certExpiry < 30 && !certDanger;

                      return (
                        <div
                          key={monitor.id}
                          className={`grid grid-cols-12 gap-4 px-4 py-3 border-b last:border-b-0 items-center text-sm hover:bg-muted/30 transition-colors ${
                            monitor.status === 'down' ? 'bg-red-50/50 dark:bg-red-950/10' : ''
                          }`}
                        >
                          <div className="col-span-1">
                            <Badge
                              variant={monitor.status === 'down' ? 'destructive' : monitor.status === 'up' ? 'default' : 'secondary'}
                              className={monitor.status === 'up' ? config.badge : ''}
                            >
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {config.label}
                            </Badge>
                          </div>
                          <div className="col-span-5">
                            <p className="font-medium truncate">{monitor.name}</p>
                          </div>
                          <div className="col-span-2">
                            <span className="text-xs text-muted-foreground uppercase">{monitor.type}</span>
                          </div>
                          <div className="col-span-2">
                            <span className={`font-mono text-sm ${
                              monitor.responseTime > 1000 ? 'text-red-600' :
                              monitor.responseTime > 500 ? 'text-amber-600' :
                              'text-green-600 dark:text-green-400'
                            }`}>
                              {monitor.responseTime > 0 ? `${monitor.responseTime}ms` : '—'}
                            </span>
                          </div>
                          <div className="col-span-2">
                            {monitor.certExpiry !== undefined ? (
                              <span className={`text-sm ${
                                certDanger ? 'text-red-600 font-medium' :
                                certWarning ? 'text-amber-600' :
                                'text-muted-foreground'
                              }`}>
                                {monitor.certExpiry}j
                                {certDanger && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
