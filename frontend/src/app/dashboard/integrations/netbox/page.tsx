'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { integrationsApi } from '@/lib/api/integrations';
import { sitesApi } from '@/lib/api/sites';
import { contactTypesApi } from '@/lib/api/contacts';
import { EntityMappingPanel } from './components/EntityMappingPanel';
import { SyncPanel } from './components/SyncPanel';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Building2,
  Server,
  SquareStack,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Site, ContactType } from '@/types';

// NetBox site statuses (hardcoded - standard NetBox values)
const NETBOX_SITE_STATUSES = [
  { id: 'planned', label: 'Planned' },
  { id: 'staging', label: 'Staging' },
  { id: 'active', label: 'Active' },
  { id: 'decommissioning', label: 'Decommissioning' },
  { id: 'retired', label: 'Retired' },
];

// XCH site statuses
const XCH_SITE_STATUSES = [
  { id: 'PREPARATION', label: 'Preparation', color: '#f59e0b' },
  { id: 'ACTIVE', label: 'Actif', color: '#22c55e' },
  { id: 'CLOSED', label: 'Ferme', color: '#6b7280' },
];

// NetBox device roles (common roles)
const NETBOX_DEVICE_ROLES = [
  { id: 'switch', label: 'Switch' },
  { id: 'router', label: 'Router' },
  { id: 'firewall', label: 'Firewall' },
  { id: 'server', label: 'Server' },
  { id: 'wifi-ap', label: 'WiFi AP' },
  { id: 'patch-panel', label: 'Patch Panel' },
];

// XCH asset types
const XCH_ASSET_TYPES = [
  { id: 'SWITCH', label: 'Switch', color: '#3b82f6' },
  { id: 'FIREWALL', label: 'Firewall', color: '#ef4444' },
  { id: 'ROUTER', label: 'Routeur', color: '#8b5cf6' },
  { id: 'WIFI_AP', label: 'Point d\'acces WiFi', color: '#06b6d4' },
  { id: 'SERVER', label: 'Serveur', color: '#10b981' },
  { id: 'OTHER', label: 'Autre', color: '#6b7280' },
];

// NetBox rack types
const NETBOX_RACK_TYPES = [
  { id: '2-post-frame', label: '2-Post Frame' },
  { id: '4-post-frame', label: '4-Post Frame' },
  { id: '4-post-cabinet', label: '4-Post Cabinet' },
  { id: 'wall-frame', label: 'Wall Frame' },
  { id: 'wall-cabinet', label: 'Wall Cabinet' },
];

// XCH rack types
const XCH_RACK_TYPES = [
  { id: 'WALL_MOUNTED', label: 'Mural', color: '#f59e0b' },
  { id: 'FLOOR_STANDING', label: 'Sur pied', color: '#3b82f6' },
  { id: 'ENCLOSED_CABINET', label: 'Armoire fermee', color: '#10b981' },
];

function ConnectionStatus({ status }: { status: 'connected' | 'disconnected' | 'error' }) {
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
      return <Badge variant="outline">Inconnu</Badge>;
  }
}

export default function NetBoxConfigPage() {
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');

  // Get connection status
  const { data: statusData, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['integrations', 'status'],
    queryFn: () => integrationsApi.getStatus(),
  });

  // Get XCH sites for device sync dropdown
  const { data: xchSites } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: () => sitesApi.getAll(),
  });

  // Get XCH contact types for contacts mapping
  const { data: xchContactTypes } = useQuery<ContactType[]>({
    queryKey: ['contact-types'],
    queryFn: () => contactTypesApi.getAll(),
  });

  // Get NetBox contact groups for contacts mapping
  const { data: netboxContactGroups, isLoading: isLoadingContactGroups } = useQuery({
    queryKey: ['integrations', 'netbox', 'contact-groups'],
    queryFn: () => integrationsApi.netbox.getContactGroups({ limit: 100 }),
    enabled: statusData?.netbox?.status === 'connected',
  });

  // Test connection mutation
  const testMutation = useMutation({
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

  const netboxStatus = statusData?.netbox?.status || 'disconnected';

  // Transform contact groups for mapping panel
  const contactGroupsSource = netboxContactGroups?.results?.map((group) => ({
    id: String(group.id),
    label: group.name,
    count: group.contact_count,
  })) || [];

  // Transform contact types for mapping panel
  const contactTypesTarget = xchContactTypes?.map((type) => ({
    id: type.id,
    label: type.name,
    color: type.color,
  })) || [];

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
            <h1 className="text-3xl font-bold">Configuration NetBox</h1>
            <p className="text-muted-foreground">
              Mappez et synchronisez vos donnees depuis NetBox
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isLoadingStatus ? (
            <Skeleton className="h-6 w-24" />
          ) : (
            <ConnectionStatus status={netboxStatus} />
          )}
          <Button
            variant="outline"
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending}
          >
            {testMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Test...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Tester connexion
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Connection Warning */}
      {netboxStatus !== 'connected' && (
        <Card className="border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">
                  NetBox non connecte
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Configurez l'URL et le token API dans les parametres pour activer l'integration.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="sites" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sites" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Sites</span>
          </TabsTrigger>
          <TabsTrigger value="devices" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            <span className="hidden sm:inline">Equipements</span>
          </TabsTrigger>
          <TabsTrigger value="racks" className="flex items-center gap-2">
            <SquareStack className="h-4 w-4" />
            <span className="hidden sm:inline">Baies</span>
          </TabsTrigger>
          <TabsTrigger value="contacts" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Contacts</span>
          </TabsTrigger>
        </TabsList>

        {/* Sites Tab */}
        <TabsContent value="sites" className="space-y-6">
          <EntityMappingPanel
            provider="netbox"
            entityType="site_status"
            title="Mapping des statuts de sites"
            sourceLabel="Statuts NetBox"
            targetLabel="Statuts XCH"
            sourceItems={NETBOX_SITE_STATUSES}
            targetItems={XCH_SITE_STATUSES}
          />

          <SyncPanel
            title="Synchroniser les sites"
            entityLabel="sites"
            description="Importe les sites depuis NetBox et les cree ou met a jour dans XCH selon le mapping des statuts."
            onSync={() =>
              integrationsApi.netbox.syncSites({
                autoCreate: true,
                updateExisting: true,
              })
            }
            disabled={netboxStatus !== 'connected'}
            disabledReason={netboxStatus !== 'connected' ? 'NetBox non connecte' : undefined}
          />
        </TabsContent>

        {/* Devices Tab */}
        <TabsContent value="devices" className="space-y-6">
          <EntityMappingPanel
            provider="netbox"
            entityType="device_role"
            title="Mapping des roles d'equipements"
            sourceLabel="Roles NetBox"
            targetLabel="Types d'assets XCH"
            sourceItems={NETBOX_DEVICE_ROLES}
            targetItems={XCH_ASSET_TYPES}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Synchroniser les equipements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Selectionnez un site XCH cible pour importer les equipements NetBox correspondants.
              </p>

              <div className="flex items-center gap-4">
                <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                  <SelectTrigger className="w-[300px]">
                    <SelectValue placeholder="Selectionner un site cible..." />
                  </SelectTrigger>
                  <SelectContent>
                    {xchSites?.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.code} - {site.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <SyncPanel
                title="Lancer la synchronisation"
                entityLabel="equipements"
                description={
                  selectedSiteId
                    ? `Les equipements seront importes dans le site selectionne.`
                    : undefined
                }
                onSync={() =>
                  integrationsApi.netbox.syncDevices({
                    siteId: selectedSiteId,
                    autoCreate: true,
                  })
                }
                disabled={netboxStatus !== 'connected' || !selectedSiteId}
                disabledReason={
                  netboxStatus !== 'connected'
                    ? 'NetBox non connecte'
                    : !selectedSiteId
                    ? 'Selectionnez un site cible'
                    : undefined
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Racks Tab */}
        <TabsContent value="racks" className="space-y-6">
          <EntityMappingPanel
            provider="netbox"
            entityType="rack_type"
            title="Mapping des types de baies"
            sourceLabel="Types NetBox"
            targetLabel="Types XCH"
            sourceItems={NETBOX_RACK_TYPES}
            targetItems={XCH_RACK_TYPES}
          />

          <SyncPanel
            title="Synchroniser les baies"
            entityLabel="baies"
            description="Importe les baies (racks) depuis NetBox. Les baies sont associees automatiquement aux sites deja synchronises."
            onSync={async () => {
              // Racks sync not implemented in API yet - return mock result
              return {
                fetched: 0,
                created: 0,
                updated: 0,
                skipped: 0,
                errors: ['Synchronisation des baies bientot disponible'],
              };
            }}
            disabled={netboxStatus !== 'connected'}
            disabledReason={netboxStatus !== 'connected' ? 'NetBox non connecte' : undefined}
          />
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="space-y-6">
          <EntityMappingPanel
            provider="netbox"
            entityType="contact_group"
            title="Mapping des groupes de contacts"
            sourceLabel="Groupes NetBox"
            targetLabel="Types de contacts XCH"
            sourceItems={contactGroupsSource}
            targetItems={contactTypesTarget}
            isLoading={isLoadingContactGroups}
          />

          <SyncPanel
            title="Synchroniser les contacts"
            entityLabel="contacts"
            description="Importe les contacts depuis NetBox et les associe aux types selon le mapping des groupes."
            onSync={() => integrationsApi.netbox.syncContacts()}
            disabled={netboxStatus !== 'connected'}
            disabledReason={netboxStatus !== 'connected' ? 'NetBox non connecte' : undefined}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
