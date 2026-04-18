'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { parseDecimalInput } from '@/lib/decimal-input';
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
import { GroupedSiteSelector } from '@/components/ui/grouped-site-selector';
import { organizationApi } from '@/lib/api/organization';
import { useEnumLabels } from '@/hooks/useEnumLabels';
import { ArrowLeft, Info, Wifi, ExternalLink, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { assetTypeLabels, assetStatusLabels } from '@/lib/asset-labels';
import { AssetModelSelect } from '@/components/forms/AssetModelSelect';
import type { AssetModel } from '@/lib/api/asset-models';
import type { AssetType, AssetStatus, CreateAssetDto } from '@/types';

const assetSchema = z.object({
  type: z.string().min(1, 'Le type est obligatoire'),
  status: z.string().min(1, 'Le statut est obligatoire'),
  locationScope: z.enum(['SITE', 'DELEGATION', 'UNASSIGNED']).default('SITE'),
  siteId: z.string().optional(),
  delegationId: z.string().optional(),
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
    adminLinks: z.array(z.object({
      label: z.string(),
      url: z.string(),
    })).optional(),
  }).optional(),
  purchaseDate: z.string().optional(),
  warrantyEnd: z.string().optional(),
  // Note: widened to allow comma/text input processed by parseDecimalInput in setValueAs.
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
  dutyCyclePercent: z.union([z.number(), z.nan(), z.string()])
    .optional()
    .transform((val) => {
      if (val === '' || val === undefined || val === null) return 100;
      if (typeof val === 'string') {
        const n = parseInt(val, 10);
        return isNaN(n) ? 100 : Math.max(0, Math.min(100, n));
      }
      if (typeof val === 'number' && !isNaN(val)) return Math.max(0, Math.min(100, val));
      return 100;
    }),
  notes: z.string().optional(),
  assetModelId: z.string().optional(),
  acquisitionPrice: z.union([z.number(), z.nan(), z.string()])
    .optional()
    .transform((val) => {
      if (val === '' || val === undefined || val === null) return undefined;
      if (typeof val === 'string') return parseFloat(val) || undefined;
      if (typeof val === 'number' && !isNaN(val)) return val;
      return undefined;
    }),
  monthlyPrice: z.union([z.number(), z.nan(), z.string()])
    .optional()
    .transform((val) => {
      if (val === '' || val === undefined || val === null) return undefined;
      if (typeof val === 'string') return parseFloat(val) || undefined;
      if (typeof val === 'number' && !isNaN(val)) return val;
      return undefined;
    }),
  priceCurrency: z.string().optional(),
  // WiFi AP coverage
  wifiCoverageRadius: z.union([z.number(), z.nan(), z.string()])
    .optional()
    .transform((val) => {
      if (val === '' || val === undefined || val === null) return undefined;
      if (typeof val === 'string') return parseFloat(val) || undefined;
      if (typeof val === 'number' && !isNaN(val)) return val;
      return undefined;
    }),
  wifiFrequency: z.string().optional(),
  wifiAntennaType: z.string().optional(),
  wifiTxPowerDbm: z.union([z.number(), z.nan(), z.string()])
    .optional()
    .transform((val) => {
      if (val === '' || val === undefined || val === null) return undefined;
      if (typeof val === 'string') return parseInt(val, 10) || undefined;
      if (typeof val === 'number' && !isNaN(val)) return val;
      return undefined;
    }),
});

type AssetFormData = z.infer<typeof assetSchema>;

export default function NewAssetPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const defaultSiteId = searchParams.get('siteId') || undefined;
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<AssetFormData>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      type: 'OTHER',
      status: 'STOCK',
      locationScope: 'SITE',
      siteId: defaultSiteId,
    },
  });

  const { getLabelsForType } = useEnumLabels();

  const { data: delegations = [] } = useQuery({
    queryKey: ['delegations-list'],
    queryFn: () => organizationApi.getDelegations(false),
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateAssetDto) => assetsApi.create(data),
    onSuccess: (asset) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      if (asset.siteId) {
        queryClient.invalidateQueries({ queryKey: ['sites', asset.siteId] });
      }
      router.push(`/dashboard/assets/${asset.id}`);
    },
  });

  const onSubmit = (data: AssetFormData) => {
    // Clean empty strings to undefined to avoid backend validation errors
    const cleaned: any = { ...data };
    // Convert date-only strings to ISO 8601 format (backend expects DateTime)
    cleaned.purchaseDate = data.purchaseDate ? new Date(data.purchaseDate).toISOString() : undefined;
    cleaned.warrantyEnd = data.warrantyEnd ? new Date(data.warrantyEnd).toISOString() : undefined;
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
    if (cleaned.acquisitionPrice === undefined || cleaned.acquisitionPrice === null) delete cleaned.acquisitionPrice;
    if (cleaned.monthlyPrice === undefined || cleaned.monthlyPrice === null) delete cleaned.monthlyPrice;
    if (!cleaned.priceCurrency) delete cleaned.priceCurrency;
    if (!cleaned.assetModelId) delete cleaned.assetModelId;

    // Apply location scope semantics:
    //   SITE → siteId present, delegationId derived server-side
    //   DELEGATION → delegationId present, siteId cleared
    //   UNASSIGNED → both cleared (stored/removed)
    const scope = cleaned.locationScope || 'SITE';
    if (scope === 'SITE') {
      if (!cleaned.siteId) {
        // still allow unassigned if user never picked a site — fall through to unassigned
        delete cleaned.siteId;
        delete cleaned.delegationId;
      } else {
        delete cleaned.delegationId;
      }
    } else if (scope === 'DELEGATION') {
      delete cleaned.siteId;
      if (!cleaned.delegationId) delete cleaned.delegationId;
    } else {
      delete cleaned.siteId;
      delete cleaned.delegationId;
    }
    delete cleaned.locationScope;

    // Clean networkInfo: remove empty subfields, remove entire object if all empty
    if (cleaned.networkInfo) {
      if (!cleaned.networkInfo.ip) delete cleaned.networkInfo.ip;
      if (!cleaned.networkInfo.mac) delete cleaned.networkInfo.mac;
      if (!cleaned.networkInfo.hostname) delete cleaned.networkInfo.hostname;
      if (!cleaned.networkInfo.vlan) delete cleaned.networkInfo.vlan;
      if (!cleaned.networkInfo.port) delete cleaned.networkInfo.port;
      // Clean adminLinks: remove entries with empty label or url
      if (cleaned.networkInfo.adminLinks) {
        cleaned.networkInfo.adminLinks = cleaned.networkInfo.adminLinks.filter(
          (l: any) => l.label && l.url
        );
        if (cleaned.networkInfo.adminLinks.length === 0) {
          delete cleaned.networkInfo.adminLinks;
        }
      }
      if (Object.keys(cleaned.networkInfo).length === 0) delete cleaned.networkInfo;
    }

    createMutation.mutate(cleaned);
  };

  const type = watch('type');
  const status = watch('status');
  const siteId = watch('siteId');
  const locationScope = watch('locationScope');
  const delegationId = watch('delegationId');


  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/assets">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Nouvel équipement</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Section 0: Model template */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Modèle d'équipement
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">Optionnel</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Sélectionner un modèle pour pré-remplir les champs</Label>
              <AssetModelSelect
                value={watch('assetModelId') || null}
                onChange={(_id: string | null, model: AssetModel | null) => {
                  setValue('assetModelId', _id || undefined);
                  if (model) {
                    if (model.type) setValue('type', model.type);
                    if (model.manufacturer) setValue('manufacturer', model.manufacturer);
                    if (model.name) setValue('model', model.name);
                    if (model.powerConsumption) setValue('powerConsumption', model.powerConsumption);
                    if (model.weight) setValue('weight', model.weight);
                    if (model.acquisitionPrice) setValue('acquisitionPrice', model.acquisitionPrice);
                    if (model.monthlyPrice) setValue('monthlyPrice', model.monthlyPrice);
                    setValue('priceCurrency', model.currency || 'EUR');
                    // v1.4.x — WiFi AP defaults from the catalog model
                    const m = model as any;
                    if (m.wifiCoverageRadius != null) setValue('wifiCoverageRadius', m.wifiCoverageRadius);
                    if (m.wifiFrequency) setValue('wifiFrequency', m.wifiFrequency);
                    if (m.wifiAntennaType) setValue('wifiAntennaType', m.wifiAntennaType);
                    if (m.wifiTxPowerDbm != null) setValue('wifiTxPowerDbm', m.wifiTxPowerDbm);
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">Les champs seront pré-remplis à partir du catalogue. Vous pouvez les modifier ensuite.</p>
            </div>
          </CardContent>
        </Card>

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

        {/* Section 3: Localisation */}
        <Card>
          <CardHeader>
            <CardTitle>Localisation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Type d'affectation</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {[
                  { v: 'SITE', label: 'Site spécifique', desc: 'Rattaché à un site unique' },
                  { v: 'DELEGATION', label: 'Délégation (multi-site)', desc: 'S\'applique à tous les sites' },
                  { v: 'UNASSIGNED', label: 'Non affecté', desc: 'Stocké / hors service' },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setValue('locationScope', opt.v as any)}
                    className={`text-left border rounded-md px-3 py-2 transition ${
                      locationScope === opt.v
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'hover:bg-accent'
                    }`}
                  >
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-xs text-muted-foreground">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {locationScope === 'SITE' && (
                <div className="space-y-2">
                  <Label htmlFor="siteId">Site d'affectation</Label>
                  <GroupedSiteSelector
                    value={siteId || ''}
                    onValueChange={(value) => setValue('siteId', value)}
                    placeholder="Sélectionner un site..."
                  />
                  {errors.siteId && (
                    <p className="text-sm text-destructive">{errors.siteId.message}</p>
                  )}
                </div>
              )}

              {locationScope === 'DELEGATION' && (
                <div className="space-y-2">
                  <Label htmlFor="delegationId">Délégation</Label>
                  <Select
                    value={delegationId || ''}
                    onValueChange={(v) => setValue('delegationId', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une délégation..." />
                    </SelectTrigger>
                    <SelectContent>
                      {delegations.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.code} — {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    L'équipement s'appliquera à l'ensemble des sites de cette délégation.
                  </p>
                </div>
              )}

              {locationScope === 'UNASSIGNED' && (
                <div className="text-sm text-muted-foreground border rounded-md p-3 bg-muted/30">
                  L'équipement ne sera rattaché à aucun site ni délégation (stock / hors service).
                  Vous pourrez l'affecter plus tard.
                </div>
              )}

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

        {/* Section 4.5: Liens d'administration (optional) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Liens d'administration
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">Optionnel</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(watch('networkInfo.adminLinks') || []).map((link: any, index: number) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="Label (ex: Console, WebUI...)"
                    value={link?.label || ''}
                    onChange={(e) => {
                      const links = [...(watch('networkInfo.adminLinks') || [])];
                      links[index] = { ...links[index], label: e.target.value };
                      setValue('networkInfo.adminLinks', links);
                    }}
                    className="flex-1"
                  />
                  <Input
                    placeholder="URL (ex: https://192.168.1.1)"
                    value={link?.url || ''}
                    onChange={(e) => {
                      const links = [...(watch('networkInfo.adminLinks') || [])];
                      links[index] = { ...links[index], url: e.target.value };
                      setValue('networkInfo.adminLinks', links);
                    }}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                    onClick={() => {
                      const links = [...(watch('networkInfo.adminLinks') || [])];
                      links.splice(index, 1);
                      setValue('networkInfo.adminLinks', links);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const links = [...(watch('networkInfo.adminLinks') || [])];
                  links.push({ label: '', url: '' });
                  setValue('networkInfo.adminLinks', links);
                }}
                className="mt-2"
              >
                <Plus className="h-4 w-4 mr-1" />
                Ajouter un lien
              </Button>
              <p className="text-xs text-muted-foreground">
                Liens rapides vers les interfaces d'administration de l'équipement (console web, SSH, etc.)
              </p>
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
                  type="text"
                  inputMode="decimal"
                  {...register('weight', { setValueAs: parseDecimalInput })}
                  placeholder="Ex: 3,5 ou 3.5"
                />
                <p className="text-xs text-muted-foreground">Virgule ou point accepté. Jusqu&apos;à 3 décimales.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="powerConsumption">Consommation (Watts)</Label>
                <Input
                  id="powerConsumption"
                  type="text"
                  inputMode="decimal"
                  {...register('powerConsumption', { setValueAs: parseDecimalInput })}
                  placeholder="Ex: 24,5 ou 24.5"
                />
                <p className="text-xs text-muted-foreground">Virgule ou point accepté.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dutyCyclePercent">Duty cycle (%)</Label>
                <Input
                  id="dutyCyclePercent"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  {...register('dutyCyclePercent', { valueAsNumber: true })}
                  placeholder="100"
                />
                <p className="text-xs text-muted-foreground">% d'usage effectif pour estimation de consommation</p>
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

        {/* Section 5.2: WiFi AP coverage (conditional) */}
        {(type === 'WIFI_AP' || type === 'ACCESS_POINT') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Couverture WiFi
                <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">Optionnel</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Ces informations sont utilisées pour afficher la zone de couverture sur les plans de sol.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="wifiCoverageRadius">Rayon de couverture (m)</Label>
                  <Input
                    id="wifiCoverageRadius"
                    type="number"
                    step="0.5"
                    {...register('wifiCoverageRadius', { valueAsNumber: true })}
                    placeholder="Ex: 15"
                  />
                  <p className="text-xs text-muted-foreground">Rayon en mètres de la zone couverte par l'AP</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wifiFrequency">Bande de fréquence</Label>
                  <select
                    id="wifiFrequency"
                    {...register('wifiFrequency')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">—</option>
                    <option value="2.4GHz">2.4 GHz</option>
                    <option value="5GHz">5 GHz</option>
                    <option value="6GHz">6 GHz</option>
                    <option value="DUAL">Dual-band (2.4 + 5)</option>
                    <option value="TRI">Tri-band (2.4 + 5 + 6)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wifiAntennaType">Type d'antenne</Label>
                  <select
                    id="wifiAntennaType"
                    {...register('wifiAntennaType')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">—</option>
                    <option value="OMNI">Omnidirectionnelle</option>
                    <option value="DIRECTIONAL">Directionnelle</option>
                    <option value="SECTOR">Sectorielle</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wifiTxPowerDbm">Puissance d'émission (dBm)</Label>
                  <Input
                    id="wifiTxPowerDbm"
                    type="number"
                    step="1"
                    {...register('wifiTxPowerDbm', { valueAsNumber: true })}
                    placeholder="Ex: 20"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 5.5: Pricing (optional) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Coût
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">Optionnel</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="acquisitionPrice">Prix d'achat</Label>
                <Input
                  id="acquisitionPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('acquisitionPrice', { valueAsNumber: true })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="monthlyPrice">Prix mensuel</Label>
                <Input
                  id="monthlyPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('monthlyPrice', { valueAsNumber: true })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priceCurrency">Devise</Label>
                <Input
                  id="priceCurrency"
                  {...register('priceCurrency')}
                  placeholder="EUR"
                  defaultValue="EUR"
                />
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
              onClick={() => router.push('/dashboard/assets')}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Création...' : 'Créer l\'équipement'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
