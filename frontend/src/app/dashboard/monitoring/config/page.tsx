'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { integrationsApi } from '@/lib/api/integrations';
import { sitesApi } from '@/lib/api/sites';
import { showToast } from '@/lib/toast';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Plug,
  RefreshCw,
  Save,
  CheckCircle2,
  XCircle,
  Activity,
  Clock,
  Copy,
  MapPin,
} from 'lucide-react';
import type { Site } from '@/types';

export default function MonitoringConfigPage() {
  const queryClient = useQueryClient();
  const { isAdmin } = usePermissions();

  // Provider config state
  const [monitoringType, setMonitoringType] = useState('');
  const [monitoringUrl, setMonitoringUrl] = useState('');
  const [monitoringToken, setMonitoringToken] = useState('');
  const [healthSyncEnabled, setHealthSyncEnabled] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load existing config
  const { data: config } = useQuery({
    queryKey: ['integration-config'],
    queryFn: integrationsApi.getConfig,
  });

  // Load sites for bulk monitoring toggle
  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: sitesApi.getAll,
  });

  useEffect(() => {
    if (config) {
      const monitoring = config.monitoring || config.uptimeKuma;
      if (config.monitoring?.type) {
        setMonitoringType(config.monitoring.type);
        setMonitoringUrl(config.monitoring.url || '');
        setMonitoringToken(config.monitoring.apiKey || config.monitoring.password || '');
        setHealthSyncEnabled(config.monitoring.healthSyncEnabled !== false);
      } else if (config.uptimeKuma?.url) {
        setMonitoringType('uptime_kuma');
        setMonitoringUrl(config.uptimeKuma.url || '');
        setMonitoringToken(config.uptimeKuma.password || '');
        setHealthSyncEnabled(true);
      }
    }
  }, [config]);

  // Test connection
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await integrationsApi.testConnection(monitoringType as any);
      setTestResult({
        success: result.status === 'connected' || result.success,
        message: result.message || (result.status === 'connected' ? 'Connexion réussie' : 'Échec de la connexion'),
      });
    } catch (error: unknown) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de connexion',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Save config
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await integrationsApi.saveConfig({
        monitoring: {
          type: monitoringType,
          url: monitoringUrl,
          apiKey: monitoringToken,
          password: monitoringToken,
          healthSyncEnabled,
        },
      });
      queryClient.invalidateQueries({ queryKey: ['integration-config'] });
      showToast.success('Configuration monitoring enregistrée');
    } catch (error: unknown) {
      showToast.error(error instanceof Error ? error.message : 'Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle monitoring per site
  const toggleSiteMonitoring = useMutation({
    mutationFn: ({ siteId, enabled }: { siteId: string; enabled: boolean }) =>
      sitesApi.update(siteId, { monitoringEnabled: enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
    onError: (error: Error) => {
      showToast.error(`Erreur: ${error.message}`);
    },
  });

  // Webhook URL for display
  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/integrations/monitoring/webhook?provider=${monitoringType === 'gatus' ? 'gatus' : 'kuma'}`
    : '';

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    showToast.success('URL copiée dans le presse-papier');
  };

  return (
    <div className="space-y-6">
      {/* Provider Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            Provider de monitoring
          </CardTitle>
          <CardDescription>
            Connectez XCH à votre outil de monitoring pour synchroniser l'état de santé des sites.
            La connexion est en lecture seule.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="monitoringType">Provider</Label>
              <Select value={monitoringType} onValueChange={setMonitoringType} disabled={!isAdmin}>
                <SelectTrigger id="monitoringType">
                  <SelectValue placeholder="Choisir un provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uptime_kuma">Uptime Kuma</SelectItem>
                  <SelectItem value="gatus">Gatus</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="monitoringUrl">
                URL {monitoringType === 'gatus' ? 'Gatus' : 'Uptime Kuma'}
              </Label>
              <Input
                id="monitoringUrl"
                placeholder={monitoringType === 'gatus' ? 'https://gatus.example.com' : 'https://uptime.example.com'}
                value={monitoringUrl}
                onChange={(e) => setMonitoringUrl(e.target.value)}
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monitoringToken">
                {monitoringType === 'gatus' ? 'Bearer Token' : 'Clé API'}
              </Label>
              <Input
                id="monitoringToken"
                type="password"
                placeholder={monitoringType === 'gatus' ? 'bearer-token...' : 'uk2_...'}
                value={monitoringToken}
                onChange={(e) => setMonitoringToken(e.target.value)}
                disabled={!isAdmin}
              />
            </div>
          </div>

          {isAdmin && (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={isTesting || !monitoringUrl || !monitoringType}
              >
                {isTesting && <RefreshCw className="mr-2 h-3 w-3 animate-spin" />}
                Tester la connexion
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving || !monitoringUrl || !monitoringType}
              >
                {isSaving ? (
                  <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                ) : (
                  <Save className="mr-2 h-3 w-3" />
                )}
                Enregistrer
              </Button>
            </div>
          )}

          {testResult && (
            <div className={`flex items-center gap-2 text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
              {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {testResult.message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Health Sync Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Synchronisation automatique
          </CardTitle>
          <CardDescription>
            Le scheduler interroge le provider toutes les 5 minutes pour mettre à jour l'état de santé des sites.
            Les webhooks permettent des mises à jour en temps réel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="healthSync" className="text-base font-medium">
                Synchronisation périodique
              </Label>
              <p className="text-sm text-muted-foreground">
                <Clock className="inline h-3 w-3 mr-1" />
                Toutes les 5 minutes (safety net en complément des webhooks)
              </p>
            </div>
            <Switch
              id="healthSync"
              checked={healthSyncEnabled}
              onCheckedChange={(checked) => {
                setHealthSyncEnabled(checked);
                // Auto-save — only send healthSyncEnabled, don't resend credentials
                integrationsApi.saveConfig({
                  monitoring: {
                    healthSyncEnabled: checked,
                  },
                }).then(() => {
                  queryClient.invalidateQueries({ queryKey: ['integration-config'] });
                  showToast.success(checked ? 'Synchronisation activée' : 'Synchronisation désactivée');
                }).catch((err: unknown) => {
                  setHealthSyncEnabled(!checked); // rollback
                  showToast.error(err instanceof Error ? err.message : 'Erreur');
                });
              }}
              disabled={!isAdmin || !monitoringUrl}
            />
          </div>

          {/* Webhook URL */}
          {monitoringType && (
            <div className="border rounded-lg p-4 space-y-2 bg-muted/30">
              <Label className="text-sm font-medium">URL Webhook</Label>
              <p className="text-xs text-muted-foreground">
                Configurez cette URL dans votre outil de monitoring pour recevoir les alertes en temps réel.
              </p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={webhookUrl}
                  className="text-xs font-mono bg-background"
                />
                <Button variant="outline" size="sm" onClick={copyWebhookUrl}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Manual sync */}
          {isAdmin && monitoringUrl && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const result = await integrationsApi.monitoring.syncAllHealth();
                    showToast.success(`Sync terminé : ${result.updated} sites mis à jour`);
                    queryClient.invalidateQueries({ queryKey: ['sites'] });
                  } catch (error: unknown) {
                    showToast.error(error instanceof Error ? error.message : 'Erreur sync');
                  }
                }}
              >
                <RefreshCw className="mr-2 h-3 w-3" />
                Synchroniser maintenant
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-Site Monitoring Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Monitoring par site
          </CardTitle>
          <CardDescription>
            Activez ou désactivez le monitoring individuellement pour chaque site.
            Les sites désactivés ne seront pas synchronisés.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {sites.map((site) => {
              const isEnabled = site.monitoringEnabled !== false;
              return (
                <div key={site.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <div>
                      <p className="text-sm font-medium">{site.name}</p>
                      <p className="text-xs text-muted-foreground">{site.code} — {site.city}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={site.healthStatus === 'HEALTHY' ? 'default' : site.healthStatus === 'CRITICAL' ? 'destructive' : 'secondary'} className="text-[10px] h-5">
                      {site.healthStatus}
                    </Badge>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(checked) =>
                        toggleSiteMonitoring.mutate({ siteId: site.id, enabled: checked })
                      }
                      disabled={!isAdmin || toggleSiteMonitoring.isPending}
                    />
                  </div>
                </div>
              );
            })}
            {sites.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Aucun site configuré
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
