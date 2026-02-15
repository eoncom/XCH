// @ts-nocheck - Temporary fix for Radix UI + React 19 type incompatibility
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { assetsApi } from '@/lib/api/assets';
import { sitesApi } from '@/lib/api/sites';
import { ArrowLeft, Info } from 'lucide-react';
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
  purchaseDate: z.string().optional(),
  warrantyEnd: z.string().optional(),
});

type AssetFormData = z.infer<typeof assetSchema>;

export default function EditAssetPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const assetId = params.id as string;

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
          purchaseDate: asset.purchaseDate ? asset.purchaseDate.split('T')[0] : '',
          warrantyEnd: asset.warrantyEnd ? asset.warrantyEnd.split('T')[0] : '',
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
    if (cleaned.siteId === 'none' || !cleaned.siteId) cleaned.siteId = null;
    updateMutation.mutate(cleaned);
  };

  const type = watch('type');
  const status = watch('status');
  const siteId = watch('siteId');

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
                    {Object.entries(assetTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
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
                    {Object.entries(assetStatusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
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
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Affectation & Dates (optional) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Affectation & Dates
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
                    <SelectItem value="none">Aucun (en stock)</SelectItem>
                    {sites?.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div></div>

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
