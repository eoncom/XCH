'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { floorPlansApi } from '@/lib/api/floor-plans';
import { assetsApi } from '@/lib/api/assets';
import { showToast } from '@/lib/toast';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Plus,
  MapPin as MapPinIcon,
  Download,
  Info,
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { FloorPlan, Pin, PinType, Asset } from '@/types';

// Dynamically import FloorPlanViewer (client-side only for Konva)
const FloorPlanViewer = dynamic(
  () => import('@/components/floor-plans/FloorPlanViewer'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[600px] flex items-center justify-center">
        Chargement du viewer...
      </div>
    ),
  }
);

const pinTypeLabels: Record<PinType, string> = {
  SWITCH: 'Switch',
  FIREWALL: 'Firewall',
  ACCESS_POINT: 'Point d\'accès',
  PRINTER: 'Imprimante',
  RACK: 'Baie',
  CAMERA: 'Caméra',
  PATCH_PANEL: 'Panneau de brassage',
  RJ45: 'Prise RJ45',
  NRO: 'NRO (Arrivée fibre)',
  OTHER: 'Autre',
};

export default function FloorPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAddPinDialog, setShowAddPinDialog] = useState(false);
  const [showPinInfoDialog, setShowPinInfoDialog] = useState(false);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [newPinPosition, setNewPinPosition] = useState<{ x: number; y: number } | null>(
    null
  );
  const [newPinLabel, setNewPinLabel] = useState('');
  const [newPinType, setNewPinType] = useState<PinType>('OTHER');
  const [newPinDescription, setNewPinDescription] = useState('');
  const [newPinAssetId, setNewPinAssetId] = useState<string>('');

  const { data: floorPlan, isLoading } = useQuery<FloorPlan>({
    queryKey: ['floor-plan', id],
    queryFn: () => floorPlansApi.getById(id),
  });

  // Load assets from the site for pin association
  const { data: assets } = useQuery<Asset[]>({
    queryKey: ['assets', floorPlan?.site?.id],
    queryFn: () => assetsApi.getAll(floorPlan?.site?.id),
    enabled: !!floorPlan?.site?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => floorPlansApi.delete(id),
    onSuccess: () => {
      showToast.success('Plan supprimé avec succès');
      queryClient.invalidateQueries({ queryKey: ['floor-plans'] });
      router.push('/dashboard/floor-plans');
    },
    onError: () => {
      showToast.error('Erreur lors de la suppression du plan');
    },
  });

  const createPinMutation = useMutation({
    mutationFn: (data: Omit<Pin, 'id' | 'createdAt' | 'updatedAt' | 'tenantId' | 'floorPlanId'>) =>
      floorPlansApi.createPin(id, data),
    onSuccess: () => {
      showToast.success('Repère ajouté avec succès');
      queryClient.invalidateQueries({ queryKey: ['floor-plan', id] });
      setShowAddPinDialog(false);
      setNewPinLabel('');
      setNewPinDescription('');
      setNewPinPosition(null);
    },
    onError: () => {
      showToast.error('Erreur lors de l\'ajout du repère');
    },
  });

  const deletePinMutation = useMutation({
    mutationFn: (pinId: string) => floorPlansApi.deletePin(id, pinId),
    onSuccess: () => {
      showToast.success('Repère supprimé avec succès');
      queryClient.invalidateQueries({ queryKey: ['floor-plan', id] });
    },
    onError: () => {
      showToast.error('Erreur lors de la suppression du repère');
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate();
    setShowDeleteDialog(false);
  };

  const handleStageClick = (x: number, y: number) => {
    setNewPinPosition({ x, y });
    setShowAddPinDialog(true);
  };

  const handleAddPin = () => {
    if (!newPinPosition) return;

    createPinMutation.mutate({
      pinType: newPinType,
      x: newPinPosition.x,
      y: newPinPosition.y,
      label: newPinLabel,
      description: newPinDescription,
      assetId: newPinAssetId || undefined,
    });
  };

  const handlePinClick = (pin: Pin) => {
    setSelectedPin(pin);
    setShowPinInfoDialog(true);
  };

  const handleDownload = () => {
    if (floorPlan?.fileUrl) {
      window.open(floorPlan.fileUrl, '_blank');
    }
  };

  if (isLoading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  if (!floorPlan) {
    return <div className="text-center py-12">Plan non trouvé</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/floor-plans">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{floorPlan.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">v{floorPlan.version}</Badge>
              {floorPlan.floor && (
                <span className="text-sm text-muted-foreground">
                  Étage {floorPlan.floor}
                </span>
              )}
              {floorPlan.building && (
                <span className="text-sm text-muted-foreground">
                  Bâtiment {floorPlan.building}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownload} data-testid="download-plan-btn">
            <Download className="mr-2 h-4 w-4" />
            Télécharger
          </Button>
          <Button variant="outline" asChild data-testid="edit-floor-plan-btn">
            <Link href={`/dashboard/floor-plans/${id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Modifier
            </Link>
          </Button>
          <Button variant="destructive" onClick={() => setShowDeleteDialog(true)} data-testid="delete-floor-plan-btn">
            <Trash2 className="mr-2 h-4 w-4" />
            Supprimer
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Viewer */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Plan interactif</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="add-pin-btn"
                  onClick={() => setShowAddPinDialog(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter un repère
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Cliquez sur le plan pour ajouter un repère
              </p>
            </CardHeader>
            <CardContent>
              <FloorPlanViewer
                floorPlan={floorPlan}
                pins={floorPlan.pins || []}
                onPinClick={handlePinClick}
                onStageClick={handleStageClick}
                editable={true}
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
              {floorPlan.site && (
                <div className="flex items-start gap-2">
                  <MapPinIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Site</p>
                    <Link
                      href={`/dashboard/sites/${floorPlan.site.id}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {floorPlan.site.name}
                    </Link>
                  </div>
                </div>
              )}

              {floorPlan.fileSize && (
                <div>
                  <p className="text-sm font-medium">Taille du fichier</p>
                  <p className="text-sm text-muted-foreground">
                    {(floorPlan.fileSize / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              )}

              {floorPlan.uploadedAt && (
                <div>
                  <p className="text-sm font-medium">Date d'upload</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(floorPlan.uploadedAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              )}

              {floorPlan.notes && (
                <div>
                  <p className="text-sm font-medium">Notes</p>
                  <p className="text-sm text-muted-foreground">{floorPlan.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pins List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Repères</CardTitle>
                <span className="text-sm text-muted-foreground">
                  {floorPlan.pins?.length || 0}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {floorPlan.pins && floorPlan.pins.length > 0 ? (
                floorPlan.pins.map((pin) => (
                  <div
                    key={pin.id}
                    className="flex items-start justify-between p-2 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{pin.label || 'Sans nom'}</p>
                      <p className="text-xs text-muted-foreground">
                        {pinTypeLabels[pin.type]}
                      </p>
                      {pin.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {pin.description}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deletePinMutation.mutate(pin.id)}
                      disabled={deletePinMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun repère
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Pin Dialog */}
      <Dialog open={showAddPinDialog} onOpenChange={setShowAddPinDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un repère</DialogTitle>
            <DialogDescription>
              {newPinPosition
                ? `Position: (${Math.round(newPinPosition.x)}, ${Math.round(newPinPosition.y)})`
                : 'Cliquez sur le plan pour choisir la position'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={newPinType} onValueChange={(value) => setNewPinType(value as PinType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(pinTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Libellé</Label>
              <Input
                value={newPinLabel}
                onChange={(e) => setNewPinLabel(e.target.value)}
                placeholder="Nom du repère"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={newPinDescription}
                onChange={(e) => setNewPinDescription(e.target.value)}
                placeholder="Description optionnelle"
              />
            </div>

            <div className="space-y-2">
              <Label>Équipement associé (optionnel)</Label>
              <Select value={newPinAssetId || 'none'} onValueChange={(value) => setNewPinAssetId(value === 'none' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Aucun équipement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun équipement</SelectItem>
                  {assets?.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.name} - {asset.serialNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPinDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleAddPin}
              disabled={!newPinPosition || !newPinLabel || createPinMutation.isPending}
            >
              {createPinMutation.isPending ? 'Ajout...' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pin Info Dialog */}
      <Dialog open={showPinInfoDialog} onOpenChange={setShowPinInfoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Informations du repère
            </DialogTitle>
            <DialogDescription>
              Détails du repère sélectionné sur le plan
            </DialogDescription>
          </DialogHeader>
          {selectedPin && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Type</p>
                <Badge variant="secondary">{pinTypeLabels[selectedPin.type]}</Badge>
              </div>

              {selectedPin.label && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Libellé</p>
                  <p className="text-sm">{selectedPin.label}</p>
                </div>
              )}

              {selectedPin.description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Description</p>
                  <p className="text-sm">{selectedPin.description}</p>
                </div>
              )}

              {selectedPin.assetId && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Équipement associé</p>
                  <Link
                    href={`/dashboard/assets/${selectedPin.assetId}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Voir l'équipement
                  </Link>
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                Position: ({selectedPin.x.toFixed(3)}, {selectedPin.y.toFixed(3)})
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowPinInfoDialog(false)}>
              Fermer
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
              Êtes-vous sûr de vouloir supprimer le plan &quot;{floorPlan.title}&quot; ?
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
