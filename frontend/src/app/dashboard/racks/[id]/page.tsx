'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { racksApi } from '@/lib/api/racks';
import { assetsApi } from '@/lib/api/assets';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Plus,
  MapPin,
  Package,
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { Rack, RackStatus, Asset } from '@/types';

// Dynamically import RackVisualization (client-side only for Konva)
const RackVisualization = dynamic(
  () => import('@/components/racks/RackVisualization'),
  {
    ssr: false,
    loading: () => <div className="h-[600px] flex items-center justify-center">Chargement...</div>,
  }
);

const rackStatusColors = {
  IN_SERVICE: 'success',
  OUT_OF_SERVICE: 'secondary',
  PREPARATION: 'warning',
} as const;

const rackStatusLabels: Record<RackStatus, string> = {
  IN_SERVICE: 'En service',
  OUT_OF_SERVICE: 'Hors service',
  PREPARATION: 'Préparation',
};

export default function RackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMountDialog, setShowMountDialog] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<number | undefined>();
  const [mountAssetId, setMountAssetId] = useState('');
  const [mountHeightU, setMountHeightU] = useState('1');

  const { data: rack, isLoading } = useQuery<Rack>({
    queryKey: ['rack', id],
    queryFn: () => racksApi.getById(id),
  });

  const { data: availableAssets } = useQuery<Asset[]>({
    queryKey: ['assets', { siteId: rack?.siteId, status: 'IN_STOCK' }],
    queryFn: () =>
      assetsApi.getAll({
        siteId: rack?.siteId,
        status: 'IN_STOCK',
      }),
    enabled: !!rack?.siteId,
  });

  const deleteMutation = useMutation({
    mutationFn: () => racksApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['racks'] });
      router.push('/dashboard/racks');
    },
  });

  const mountMutation = useMutation({
    mutationFn: (data: { assetId: string; positionU: number; heightU: number }) =>
      racksApi.mountEquipment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rack', id] });
      setShowMountDialog(false);
      setMountAssetId('');
      setMountHeightU('1');
      setSelectedUnit(undefined);
    },
  });

  const unmountMutation = useMutation({
    mutationFn: (assetId: string) => racksApi.unmountEquipment(id, assetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rack', id] });
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate();
    setShowDeleteDialog(false);
  };

  const handleUnitClick = (unitNumber: number) => {
    setSelectedUnit(unitNumber);
    setShowMountDialog(true);
  };

  const handleMount = () => {
    if (!selectedUnit || !mountAssetId) return;

    mountMutation.mutate({
      assetId: mountAssetId,
      positionU: selectedUnit,
      heightU: parseInt(mountHeightU),
    });
  };

  if (isLoading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  if (!rack) {
    return <div className="text-center py-12">Baie non trouvée</div>;
  }

  const occupiedUnits =
    rack.assets?.reduce((sum, asset) => sum + (asset.rackHeightU || 0), 0) || 0;
  const availableUnits = rack.heightU - occupiedUnits;
  const usagePercent = Math.round((occupiedUnits / rack.heightU) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/racks">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{rack.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={rackStatusColors[rack.status]}>
                {rackStatusLabels[rack.status]}
              </Badge>
              <span className="text-sm text-muted-foreground">{rack.heightU}U</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/dashboard/racks/${id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Modifier
            </Link>
          </Button>
          <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Supprimer
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Visualization */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Visualisation 2D</CardTitle>
              <p className="text-sm text-muted-foreground">
                Cliquez sur une unité pour monter un équipement
              </p>
            </CardHeader>
            <CardContent>
              <RackVisualization
                rack={rack}
                onUnitClick={handleUnitClick}
                selectedUnit={selectedUnit}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Info */}
          <Card>
            <CardHeader>
              <CardTitle>Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {rack.site && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Site</p>
                    <Link
                      href={`/dashboard/sites/${rack.site.id}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {rack.site.name}
                    </Link>
                  </div>
                </div>
              )}

              {rack.location && (
                <div>
                  <p className="text-sm font-medium">Emplacement</p>
                  <p className="text-sm text-muted-foreground">{rack.location}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium mb-2">Utilisation</p>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      usagePercent >= 90
                        ? 'bg-red-500'
                        : usagePercent >= 70
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {occupiedUnits}U / {rack.heightU}U ({usagePercent}%)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Mounted Equipment */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Équipements montés</CardTitle>
                <span className="text-sm text-muted-foreground">
                  {rack.assets?.length || 0}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {rack.assets && rack.assets.length > 0 ? (
                rack.assets.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex items-start justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-start gap-2">
                      <Package className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <Link
                          href={`/dashboard/assets/${asset.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {asset.brand} {asset.model}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          U{asset.rackPositionU} ({asset.rackHeightU}U)
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => unmountMutation.mutate(asset.id)}
                      disabled={unmountMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun équipement monté
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mount Equipment Dialog */}
      <Dialog open={showMountDialog} onOpenChange={setShowMountDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Monter un équipement</DialogTitle>
            <DialogDescription>
              Position sélectionnée: U{selectedUnit}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Équipement</Label>
              <Select value={mountAssetId} onValueChange={setMountAssetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un équipement" />
                </SelectTrigger>
                <SelectContent>
                  {availableAssets?.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.brand} {asset.model} - {asset.serialNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Hauteur (U)</Label>
              <Input
                type="number"
                min="1"
                max="42"
                value={mountHeightU}
                onChange={(e) => setMountHeightU(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMountDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleMount}
              disabled={!mountAssetId || mountMutation.isPending}
            >
              {mountMutation.isPending ? 'Montage...' : 'Monter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer la baie &quot;{rack.name}&quot; ?
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
