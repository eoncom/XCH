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
import { usePermissions } from '@/hooks/usePermissions';
import { assetsApi } from '@/lib/api/assets';
import { Attachments } from '@/components/Attachments';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Plus,
  MapPin,
  Package,
  MoveVertical,
  MessageSquare,
  Check,
  X,
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
  const { canUpdate, canDelete } = usePermissions();
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<number | undefined>();
  const [mountAssetId, setMountAssetId] = useState('');
  const [mountHeightU, setMountHeightU] = useState('1');
  const [moveAsset, setMoveAsset] = useState<Asset | null>(null);
  const [movePositionU, setMovePositionU] = useState('');
  const [editingNoteAssetId, setEditingNoteAssetId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  const { data: rack, isLoading, error, isError } = useQuery<Rack>({
    queryKey: ['rack', id],
    queryFn: () => racksApi.getById(id),
  });

  const { data: availableAssets } = useQuery<Asset[]>({
    queryKey: ['assets', { siteId: rack?.siteId, available: true }],
    queryFn: async () => {
      if (!rack?.siteId) return [];
      // Récupérer tous les assets du site
      const allAssets = await assetsApi.getAll({ siteId: rack.siteId });
      // Filtrer ceux qui ne sont pas déjà montés dans une baie
      return allAssets.filter(asset => !asset.rackId);
    },
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

  const updateRackNotesMutation = useMutation({
    mutationFn: ({ assetId, rackNotes }: { assetId: string; rackNotes: string }) =>
      assetsApi.update(assetId, { rackNotes: rackNotes || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rack', id] });
      setEditingNoteAssetId(null);
      setEditingNoteText('');
    },
  });

  const startEditingNote = (asset: Asset) => {
    setEditingNoteAssetId(asset.id);
    setEditingNoteText(asset.rackNotes || '');
  };

  const saveNote = (assetId: string) => {
    updateRackNotesMutation.mutate({ assetId, rackNotes: editingNoteText });
  };

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

  const handleMove = () => {
    if (!moveAsset || !movePositionU) return;

    mountMutation.mutate({
      assetId: moveAsset.id,
      positionU: parseInt(movePositionU),
      heightU: moveAsset.rackHeightU || 1,
    });
    setShowMoveDialog(false);
    setMoveAsset(null);
    setMovePositionU('');
  };

  const openMoveDialog = (asset: Asset) => {
    setMoveAsset(asset);
    setMovePositionU(String(asset.rackPositionU || ''));
    setShowMoveDialog(true);
  };

  if (isLoading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  if (isError) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur lors du chargement de la baie';
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-destructive">{errorMessage}</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/racks">Retour aux baies</Link>
        </Button>
      </div>
    );
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
          {canUpdate('racks', rack?.siteId) && (
            <Button variant="outline" asChild data-testid="edit-rack-btn">
              <Link href={`/dashboard/racks/${id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Modifier
              </Link>
            </Button>
          )}
          {canDelete('racks', rack?.siteId) && (
            <Button variant="destructive" onClick={() => setShowDeleteDialog(true)} data-testid="delete-rack-btn">
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </Button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Visualization */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Visualisation 2D</CardTitle>
              {canUpdate('racks', rack?.siteId) && (
                <p className="text-sm text-muted-foreground">
                  Cliquez sur une unité pour monter un équipement
                </p>
              )}
            </CardHeader>
            <CardContent>
              <RackVisualization
                rack={rack}
                onUnitClick={canUpdate('racks', rack?.siteId) ? handleUnitClick : undefined}
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
                    className={`h-2 rounded-full transition-all ${usagePercent >= 90
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
              <TooltipProvider>
              {rack.assets && rack.assets.length > 0 ? (
                rack.assets.map((asset) => (
                  <div
                    key={asset.id}
                    className="p-3 border rounded-lg space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2">
                        <Package className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <Link
                            href={`/dashboard/assets/${asset.id}`}
                            className="text-sm font-medium hover:underline text-blue-600"
                          >
                            {asset.name || `${asset.manufacturer || ''} ${asset.model || ''}`.trim() || 'Équipement'}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            U{asset.rackPositionU} ({asset.rackHeightU}U)
                          </p>
                        </div>
                      </div>
                      {canUpdate('racks', rack?.siteId) && (
                      <div className="flex gap-1">
                        {asset.rackNotes && editingNoteAssetId !== asset.id ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startEditingNote(asset)}
                              >
                                <MessageSquare className="h-4 w-4 text-blue-500" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-[200px]">
                              <p className="text-xs">{asset.rackNotes}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : editingNoteAssetId !== asset.id ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Ajouter une note"
                            onClick={() => startEditingNote(asset)}
                          >
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Déplacer"
                          onClick={() => openMoveDialog(asset)}
                        >
                          <MoveVertical className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Démonter"
                          onClick={() => unmountMutation.mutate(asset.id)}
                          disabled={unmountMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      )}
                    </div>
                    {/* Inline note editing */}
                    {editingNoteAssetId === asset.id && (
                      <div className="flex gap-2 items-end">
                        <Textarea
                          value={editingNoteText}
                          onChange={(e) => setEditingNoteText(e.target.value)}
                          placeholder="Note sur cet équipement..."
                          rows={2}
                          className="text-xs flex-1"
                        />
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => saveNote(asset.id)}
                            disabled={updateRackNotesMutation.isPending}
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => { setEditingNoteAssetId(null); setEditingNoteText(''); }}
                          >
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun équipement monté
                </p>
              )}
              </TooltipProvider>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Documents */}
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <Attachments
            entityId={id}
            entityType="racks"
            apiModule={racksApi}
          />
        </CardContent>
      </Card>

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
                      {asset.name || `${asset.manufacturer || ''} ${asset.model || ''}`.trim() || 'Équipement'}{asset.serialNumber ? ` - ${asset.serialNumber}` : ''}
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

      {/* Move Equipment Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Déplacer l'équipement</DialogTitle>
            <DialogDescription>
              {moveAsset && (
                <>Déplacer <strong>{moveAsset.name || `${moveAsset.manufacturer || ''} ${moveAsset.model || ''}`.trim()}</strong> ({moveAsset.rackHeightU}U) vers une nouvelle position</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nouvelle position (U)</Label>
              <Input
                type="number"
                min="1"
                max={rack.heightU}
                value={movePositionU}
                onChange={(e) => setMovePositionU(e.target.value)}
                placeholder={`1 - ${rack.heightU}`}
              />
              <p className="text-xs text-muted-foreground">
                Position actuelle : U{moveAsset?.rackPositionU}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleMove}
              disabled={!movePositionU || mountMutation.isPending}
            >
              {mountMutation.isPending ? 'Déplacement...' : 'Déplacer'}
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
