// @ts-nocheck - Temporary fix for Radix UI + React 19 type incompatibility
'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { assetsApi } from '@/lib/api/assets';
import { sitesApi } from '@/lib/api/sites';
import { useEnumLabels } from '@/hooks/useEnumLabels';
import { ArrowLeft, Info, Wifi } from 'lucide-react';
import Link from 'next/link';
import type { Asset, AssetType, AssetStatus, Site, UpdateAssetDto } from '@/types';

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

const assetStatusLabels: Record<AssetStatus, string> = {
  IN_SERVICE: 'En service',
  OUT_OF_SERVICE: 'Hors service',
  IN_TRANSIT: 'En transit',
  STOCK: 'En stock',
  RETIRED: 'Retiré',
};

const assetSchema = z.object({
  type: z.enum([
    'PRINTER',
    'IPAD',
    'TABLET',
    'SWITCH',
    'FIREWALL',
    'ROUTER',
    'WIFI_AP',
    'ACCESS_POINT',
    'TEAMS_ROOM',
    'WEBCAM',
    'DISPLAY',
    'CAMERA',
    'SERVER',
    'CABLE',
    'PATCH_PANEL',
    'PDU',
    'BOX_5G',
    'OTHER',
  ]),
  status: z.enum(['IN_SERVICE', 'OUT_OF_SERVICE', 'IN_TRANSIT', 'STOCK', 'RETIRED']),
  siteId: z.string().optional(),
  name: z.string().optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  inventoryTag: z.string().optional(),
  locationText: z.string().optional(),
  networkInfo: z.object({
    ip: z.string().optional(),
    mac: z.string().optional(),
    hostname: z.string().optional(),
    vlan: z.string().optional(),
    port: z.string().optional(),
  }).optional(),
  purchaseDate: z.string().optional(),
  warrantyEnd: z.string().optional(),
  weight: z.union([z.number(), z.nan(), z.string()])
    .optional()
    .transform((val) => {
      if (val === '' || val === undefined || val === null) return undefined;
      if (typeof val === 'string') return parseFloat(val) || undefined;
      if (typeof val === 'number' && !isNaN(val)) return val;
      return undefined;
    }),
  powerConsumption: z.union([z.number(), z.nan(), z.string()])
    .optional()
    .transform((val) => {
      if (val === '' || val === undefined || val === null) return undefined;
      if (typeof val === 'string') return parseFloat(val) || undefined;
      if (typeof val === 'number' && !isNaN(val)) return val;
      return undefined;
    }),
  notes: z.string().optional(),
});

type AssetFormData = z.infer<typeof assetSchema>;

export default function EditAssetPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const assetId = params.id as string;

  const { getLabelsForType } = useEnumLabels();

  const { data: asset, isLoading } = useQuery<Asset>({
    queryKey: ['asset', assetId],
    queryFn: () => assetsApi.getById(assetId),
  });

  const { data: sites } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: sitesApi.getAll,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<AssetFormData>({
    resolver: zodResolver(assetSchema),
    values: asset
      ? {
          type: asset.type,
          status: asset.status,
          siteId: asset.siteId || '',
          name: asset.name || '',
          manufacturer: asset.manufacturer || '',
          model: asset.model || '',
          serialNumber: asset.serialNumber || '',
          inventoryTag: asset.inventoryTag || '',
          locationText: asset.locationText || '',
          networkInfo: {
            ip: (asset.networkInfo as any)?.ip || '',
            mac: (asset.networkInfo as any)?.mac || '',
            hostname: (asset.networkInfo as any)?.hostname || '',
            vlan: (asset.networkInfo as any)?.vlan || '',
            port: (asset.networkInfo as any)?.port || '',
          },
          purchaseDate: asset.purchaseDate ? asset.purchaseDate.split('T')[0] : '',
          warrantyEnd: asset.warrantyEnd ? asset.warrantyEnd.split('T')[0] : '',
          weight: asset.weight ?? undefined,
          powerConsumption: asset.powerConsumption ?? undefined,
          notes: asset.notes || '',
        }
      : undefined,
  });


  const updateMutation = useMutation({
    mutationFn: (data: UpdateAssetDto) => assetsApi.update(assetId, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['asset', assetId] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      if (result.siteId) {
        queryClient.invalidateQueries({ queryKey: ['sites', result.siteId] });
      }
      router.push(`/dashboard/assets/${assetId}`);
    },
  });

  const onSubmit = (data: AssetFormData) => {
    // Clean empty strings to undefined to avoid backend validation errors
    const cleaned: any = { ...data };
    if (!cleaned.purchaseDate) delete cleaned.purchaseDate;
    if (!cleaned.warrantyEnd) delete cleaned.warrantyEnd;
    if (!cleaned.name) delete cleaned.name;
    if (!cleaned.manufacturer) delete cleaned.manufacturer;
    if (!cleaned.model) delete cleaned.model;
    if (!cleaned.serialNumber) delete cleaned.serialNumber;
    if (!cleaned.inventoryTag) delete cleaned.inventoryTag;
    if (!cleaned.locationText) delete cleaned.locationText;
    if (!cleaned.notes) delete cleaned.notes;
    if (cleaned.weight === undefined || cleaned.weight === null) delete cleaned.weight;
    if (cleaned.powerConsumption === undefined || cleaned.powerConsumption === null) delete cleaned.powerConsumption;
    if (cleaned.siteId === 'none' || !cleaned.siteId) cleaned.siteId = null;

    // Clean networkInfo: remove empty subfields, remove entire object if all empty
    if (cleaned.networkInfo) {
      if (!cleaned.networkInfo.ip) delete cleaned.networkInfo.ip;
      if (!cleaned.networkInfo.mac) delete cleaned.networkInfo.mac;
      if (!cleaned.networkInfo.hostname) delete cleaned.networkInfo.hostname;
      if (!cleaned.networkInfo.vlan) delete cleaned.networkInfo.vlan;
      if (!cleaned.networkInfo.port) delete cleaned.networkInfo.port;
      if (Object.keys(cleaned.networkInfo).length === 0) delete cleaned.networkInfo;
    }

    updateMutation.mutate(cleaned);
  };

  const type = watch('type');
  const status = watch('status');
  const siteId = watch('siteId');

  // Auto-clear site when status changes to RETIRED or STOCK
  useEffect(() => {
    if (status === 'RETIRED' || status === 'STOCK') {
      setValue('siteId', 'none');
    }
  }, [status, setValue]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/assets/${assetId}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Modifier l'équipement</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Section 1: Classification (required) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Classification
              <span className="text-xs font-normal text-red-500 bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded">Obligatoire</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Type <span className="text-red-500">*</span></Label>
                <Select
                  value={type}
                  onValueChange={(value) => setValue('type', value as AssetType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(getLabelsForType('AssetType').length > 0
                      ? getLabelsForType('AssetType').filter(t => !t.isHidden).sort((a, b) => a.sortOrder - b.sortOrder)
                      : Object.entries(assetTypeLabels).map(([v, l]) => ({ enumValue: v, label: l }))
                    ).map((item) => (
                      <SelectItem key={item.enumValue} value={item.enumValue}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Statut <span className="text-red-500">*</span></Label>
                <Select
                  value={status}
                  onValueChange={(value) => setValue('status', value as AssetStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(getLabelsForType('AssetStatus').length > 0
                      ? getLabelsForType('AssetStatus').filter(t => !t.isHidden).sort((a, b) => a.sortOrder - b.sortOrder)
                      : Object.entries(assetStatusLabels).map(([v, l]) => ({ enumValue: v, label: l }))
                    ).map((item) => (
                      <SelectItem key={item.enumValue} value={item.enumValue}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Identification (optional) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Identification
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">Optionnel</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom personnalisé</Label>
                <Input
                  id="name"
                  {...register('name')}
                  placeholder="Ex: Switch Salle Serveur"
                />
                <p className="text-xs text-muted-foreground">Nom libre pour identifier facilement l'équipement</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="serialNumber">Numéro de série</Label>
                <Input
                  id="serialNumber"
                  {...register('serialNumber')}
                  placeholder="Ex: SN123456789"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="manufacturer">Fabricant</Label>
                <Input
                  id="manufacturer"
                  {...register('manufacturer')}
                  placeholder="Ex: HP, Cisco, Ubiquiti..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Modèle</Label>
                <Input
                  id="model"
                  {...register('model')}
                  placeholder="Ex: ProCurve 2530-48G"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inventoryTag">Tag inventaire</Label>
                <Input
                  id="inventoryTag"
                  {...register('inventoryTag')}
                  placeholder="Ex: INV-2024-0042"
                />
                <p className="text-xs text-muted-foreground">Numéro d'inventaire interne</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Localisation (optional) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Localisation
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">Optionnel</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="siteId">Site d'affectation</Label>
                <Select value={siteId} onValueChange={(value) => setValue('siteId', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un site" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {sites?.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="locationText">Emplacement (texte libre)</Label>
                <Input
                  id="locationText"
                  {...register('locationText')}
                  placeholder="Ex: Salle serveur, Étage 2, Bureau 204..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Network (optional) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              Réseau
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">Optionnel</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="networkInfo.ip">Adresse IP</Label>
                <Input
                  id="networkInfo.ip"
                  {...register('networkInfo.ip')}
                  placeholder="Ex: 192.168.1.100"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="networkInfo.hostname">Hostname</Label>
                <Input
                  id="networkInfo.hostname"
                  {...register('networkInfo.hostname')}
                  placeholder="Ex: sw-salle-serveur-01"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="networkInfo.mac">Adresse MAC</Label>
                <Input
                  id="networkInfo.mac"
                  {...register('networkInfo.mac')}
                  placeholder="Ex: AA:BB:CC:DD:EE:FF"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="networkInfo.vlan">VLAN</Label>
                <Input
                  id="networkInfo.vlan"
                  {...register('networkInfo.vlan')}
                  placeholder="Ex: VLAN 100"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="networkInfo.port">Port réseau</Label>
                <Input
                  id="networkInfo.port"
                  {...register('networkInfo.port')}
                  placeholder="Ex: Gi0/1, eth0"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 5: Caractéristiques (optional) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Caractéristiques
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">Optionnel</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weight">Poids (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  {...register('weight', { valueAsNumber: true })}
                  placeholder="Ex: 3.5"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="powerConsumption">Consommation (Watts)</Label>
                <Input
                  id="powerConsumption"
                  type="number"
                  step="1"
                  {...register('powerConsumption', { valueAsNumber: true })}
                  placeholder="Ex: 150"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="purchaseDate">Date d'achat</Label>
                <Input id="purchaseDate" type="date" {...register('purchaseDate')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="warrantyEnd">Fin de garantie</Label>
                <Input id="warrantyEnd" type="date" {...register('warrantyEnd')} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 6: Notes (optional) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Notes
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">Optionnel</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes générales</Label>
              <Textarea
                id="notes"
                {...register('notes')}
                placeholder="Notes libres sur l'équipement..."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Info className="h-4 w-4" />
            Les champs marqués <span className="text-red-500">*</span> sont obligatoires
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/dashboard/assets/${assetId}`)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
