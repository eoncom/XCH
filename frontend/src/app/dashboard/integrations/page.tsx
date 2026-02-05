'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { integrationsApi } from '@/lib/api/integrations';
import { Database, Activity, Settings, RefreshCw, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { IntegrationStatus } from '@/types';

function StatusBadge({ status }: { status: IntegrationStatus['status'] }) {
  switch (status) {
    case 'connected':
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Connecte
        </Badge>
      );
    case 'disconnected':
      return (
        <Badge variant="secondary">
          <XCircle className="mr-1 h-3 w-3" />
          Non configure
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="destructive">
          <AlertCircle className="mr-1 h-3 w-3" />
          Erreur
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          Inconnu
        </Badge>
      );
  }
}

export default function IntegrationsPage() {
  const { data: status, isLoading, error } = useQuery({
    queryKey: ['integrations', 'status'],
    queryFn: () => integrationsApi.getStatus(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const testNetboxMutation = useMutation({
    mutationFn: () => integrationsApi.testConnection('netbox'),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Connexion NetBox reussie', {
          description: result.details?.version
            ? `Version: ${result.details.version}`
            : result.message,
        });
      } else {
        toast.error('Echec connexion NetBox', {
          description: result.message,
        });
      }
    },
    onError: (error: Error) => {
      toast.error('Erreur lors du test', {
        description: error.message,
      });
    },
  });

  const testMonitoringMutation = useMutation({
    mutationFn: () => integrationsApi.testConnection('uptime_kuma'),
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Connexion Monitoring reussie', {
          description: result.message,
        });
      } else {
        toast.error('Echec connexion Monitoring', {
          description: result.message,
        });
      }
    },
    onError: (error: Error) => {
      toast.error('Erreur lors du test', {
        description: error.message,
      });
    },
  });

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Integrations</h1>
          <p className="text-muted-foreground">
            Connectez XCH a vos outils externes
          </p>
        </div>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>Erreur lors du chargement du statut des integrations</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="text-muted-foreground">
          Connectez XCH a vos outils externes pour synchroniser vos donnees
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* NetBox Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
                  <Database className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle>NetBox</CardTitle>
                  <CardDescription>IPAM & DCIM - Gestion des equipements reseau</CardDescription>
                </div>
              </div>
              {isLoading ? (
                <Skeleton className="h-6 w-24" />
              ) : (
                <StatusBadge status={status?.netbox?.status || 'disconnected'} />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Synchronisez vos sites, equipements, baies et contacts depuis NetBox.
                Configuration lecture seule pour eviter les conflits.
              </p>
              {status?.netbox?.status === 'connected' && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Derniere synchronisation reussie</span>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-between border-t pt-6">
            <Button
              variant="outline"
              onClick={() => testNetboxMutation.mutate()}
              disabled={testNetboxMutation.isPending}
            >
              {testNetboxMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Test en cours...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Tester connexion
                </>
              )}
            </Button>
            <Button asChild>
              <Link href="/dashboard/integrations/netbox">
                <Settings className="mr-2 h-4 w-4" />
                Configurer
              </Link>
            </Button>
          </CardFooter>
        </Card>

        {/* Monitoring Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900">
                  <Activity className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <CardTitle>Monitoring</CardTitle>
                  <CardDescription>Surveillance des liens Internet et SDWAN</CardDescription>
                </div>
              </div>
              {isLoading ? (
                <Skeleton className="h-6 w-24" />
              ) : (
                <StatusBadge status={status?.uptimeKuma?.status || 'disconnected'} />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Surveillez l'etat de vos liens Internet et SDWAN par chantier.
                Compatible avec plusieurs solutions de monitoring.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Uptime Kuma</Badge>
                <Badge variant="outline">CheckMK</Badge>
                <Badge variant="outline">Webhooks</Badge>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between border-t pt-6">
            <Button
              variant="outline"
              onClick={() => testMonitoringMutation.mutate()}
              disabled={testMonitoringMutation.isPending}
            >
              {testMonitoringMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Test en cours...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Tester connexion
                </>
              )}
            </Button>
            <Button asChild>
              <Link href="/dashboard/integrations/monitoring">
                <Settings className="mr-2 h-4 w-4" />
                Configurer
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Info Section */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-primary/10 p-2">
              <AlertCircle className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <h4 className="font-medium">Mode lecture seule</h4>
              <p className="text-sm text-muted-foreground">
                Les integrations XCH fonctionnent en mode lecture seule. Les donnees sont
                importees depuis vos outils externes mais ne sont jamais modifiees a la source.
                Cela garantit la coherence de vos systemes existants.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
