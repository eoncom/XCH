'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
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
import { ArrowLeft } from 'lucide-react';
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
  TEAMS_ROOM: 'Teams Room',
  SERVER: 'Serveur',
  CABLE: 'Câble',
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
    'TEAMS_ROOM',
    'SERVER',
    'CABLE',
    'OTHER',
  ]),
  status: z.enum(['IN_SERVICE', 'OUT_OF_SERVICE', 'IN_TRANSIT', 'STOCK', 'RETIRED']),
  siteId: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  purchaseDate: z.string().optional(),
  warrantyEnd: z.string().optional(),
});

type AssetFormData = z.infer<typeof assetSchema>;

export default function EditAssetPage() {
  const params = useParams();
  const router = useRouter();
  const assetId = params.id as string;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<AssetFormData>({
    resolver: zodResolver(assetSchema),
  });

  const { data: asset, isLoading } = useQuery<Asset>({
    queryKey: ['asset', assetId],
    queryFn: () => assetsApi.getById(assetId),
  });

  const { data: sites } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: sitesApi.getAll,
  });

  useEffect(() => {
    if (asset) {
      setValue('type', asset.type);
      setValue('status', asset.status);
      setValue('siteId', asset.siteId || '');
      setValue('brand', asset.manufacturer || '');
      setValue('model', asset.model || '');
      setValue('serialNumber', asset.serialNumber || '');
      setValue('purchaseDate', asset.purchaseDate ? asset.purchaseDate.split('T')[0] : '');
      setValue('warrantyEnd', asset.warrantyEnd ? asset.warrantyEnd.split('T')[0] : '');
    }
  }, [asset, setValue]);

  const updateMutation = useMutation({
    mutationFn: (data: UpdateAssetDto) => assetsApi.update(assetId, data),
    onSuccess: () => {
      router.push(`/dashboard/assets/${assetId}`);
    },
  });

  const onSubmit = (data: AssetFormData) => {
    updateMutation.mutate(data);
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

      <Card>
        <CardHeader>
          <CardTitle>Informations de l'équipement</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
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
                <Label htmlFor="status">Statut *</Label>
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

              <div className="space-y-2">
                <Label htmlFor="brand">Marque</Label>
                <Input
                  id="brand"
                  {...register('brand')}
                  placeholder="HP, Cisco, etc."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Modèle</Label>
                <Input
                  id="model"
                  {...register('model')}
                  placeholder="Model XYZ"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="serialNumber">Numéro de série</Label>
                <Input
                  id="serialNumber"
                  {...register('serialNumber')}
                  placeholder="SN123456789"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="siteId">Site</Label>
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
                <Label htmlFor="purchaseDate">Date d'achat</Label>
                <Input id="purchaseDate" type="date" {...register('purchaseDate')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="warrantyEnd">Fin de garantie</Label>
                <Input id="warrantyEnd" type="date" {...register('warrantyEnd')} />
              </div>
            </div>

            <div className="flex justify-end gap-2">
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
