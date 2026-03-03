'use client';

import { use, useState, useCallback, useMemo } from 'react';
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
import { usePermissions } from '@/hooks/usePermissions';
import { useEnumLabels } from '@/hooks/useEnumLabels';
import { assetsApi } from '@/lib/api/assets';
import { racksApi } from '@/lib/api/racks';
import { showToast } from '@/lib/toast';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Plus,
  MapPin as MapPinIcon,
  Download,
  Info,
  Server,
  Wifi,
  Copy,
  History,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { FloorPlan, Pin, PinType, Asset, AssetType, Rack, HeatmapConfig, HeatmapAccessPoint } from '@/types';
import { findWifiProfile } from '@/lib/wifi-profiles';

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

// Dynamically import heatmap components
const HeatmapControls = dynamic(
  () => import('@/components/floor-plans/HeatmapControls'),
  { ssr: false }
);
const ScaleCalibration = dynamic(
  () => import('@/components/floor-plans/ScaleCalibration'),
  { ssr: false }
);

const pinTypeLabels: Record<PinType, string> = {
  SWITCH: 'Switch',
  FIREWALL: 'Firewall',
  ACCESS_POINT: 'AP WiFi',
  PRINTER: 'Imprimante',
  RACK: 'Baie',
  CAMERA: 'Caméra',
  PATCH_PANEL: 'Panneau de brassage',
  RJ45: 'Prise RJ-45',
  NRO: 'Arrivée Fibre NRO',
  ROUTER: 'Routeur',
  TEAMS_ROOM: 'Teams Room',
  WEBCAM: 'Webcam',
  DISPLAY: 'Écran',
  SERVER: 'Serveur',
  PDU: 'PDU',
  BOX_5G: 'Box 5G',
  OTHER: 'Autre',
};

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

/**
 * Build a readable label for an asset.
 * Priority: "Type - Manufacturer Model (SN)" with fallbacks
 */
function getAssetLabel(asset: Asset): string {
  const typeName = assetTypeLabels[asset.type] || asset.type;
  const parts: string[] = [];

  if (asset.manufacturer) parts.push(asset.manufacturer);
  if (asset.model) parts.push(asset.model);

  let label = typeName;
  if (parts.length > 0) {
    label += ' - ' + parts.join(' ');
  }
  if (asset.serialNumber) {
    label += ` (${asset.serialNumber})`;
  }

  return label;
}

export default function FloorPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { canUpdate, canDelete } = usePermissions();
  const { getLabelsForType, getLabel } = useEnumLabels();

  // Merge DB enum labels with ALL static pin types so nothing is missing
  const pinTypeOptions = useMemo(() => {
    const dbLabels = getLabelsForType('PinType');
    return Object.entries(pinTypeLabels).map(([enumValue, label], index) => {
      const dbLabel = dbLabels.find(l => l.enumValue === enumValue);
      return {
        enumValue,
        label: dbLabel?.label || label,
        sortOrder: dbLabel?.sortOrder ?? index,
        isHidden: dbLabel?.isHidden ?? false,
      };
    }).filter(t => !t.isHidden).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [getLabelsForType]);

  const [showAddPinDialog, setShowAddPinDialog] = useState(false);
  const [showPinInfoDialog, setShowPinInfoDialog] = useState(false);
  const [showEditPinDialog, setShowEditPinDialog] = useState(false);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [editPinData, setEditPinData] = useState<Partial<Pin>>({});
  const [newPinPosition, setNewPinPosition] = useState<{ x: number; y: number } | null>(
    null
  );
  const [newPinLabel, setNewPinLabel] = useState('');
  const [newPinType, setNewPinType] = useState<PinType>('OTHER');
  const [exportFunction, setExportFunction] = useState<(() => void) | null>(null);
  const [newPinDescription, setNewPinDescription] = useState('');
  const [newPinAssetId, setNewPinAssetId] = useState<string>('');
  const [newPinRackId, setNewPinRackId] = useState<string>('');
  const [showNewVersionDialog, setShowNewVersionDialog] = useState(false);
  const [newVersionNotes, setNewVersionNotes] = useState('');
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);

  // Heatmap state
  const [heatmapConfig, setHeatmapConfig] = useState<HeatmapConfig>({
    enabled: false,
    frequency: '5',
    minSignal: -80,
    opacity: 0.5,
    hideOtherPins: false,
  });
  const [showScaleCalibration, setShowScaleCalibration] = useState(false);
  const [scalePickPoints, setScalePickPoints] = useState<{ x: number; y: number }[]>([]);

  const { data: floorPlan, isLoading } = useQuery<FloorPlan>({
    queryKey: ['floor-plan', id],
    queryFn: () => floorPlansApi.getById(id),
  });

  // Load assets from the site for pin association
  const { data: assets } = useQuery<Asset[]>({
    queryKey: ['assets', floorPlan?.site?.id],
    queryFn: () => assetsApi.getAll({ siteId: floorPlan?.site?.id }),
    enabled: !!floorPlan?.site?.id,
  });

  // Load racks from the site for RACK pin association
  const { data: racks } = useQuery<Rack[]>({
    queryKey: ['racks', floorPlan?.site?.id],
    queryFn: () => racksApi.getAll(floorPlan?.site?.id),
    enabled: !!floorPlan?.site?.id,
  });

  // Version history
  const { data: versionHistory } = useQuery<FloorPlan[]>({
    queryKey: ['floor-plan-versions', id],
    queryFn: () => floorPlansApi.getVersionHistory(id),
    enabled: !!id,
  });

  const createVersionMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      if (newVersionNotes) formData.append('notes', newVersionNotes);
      if (newVersionFile) formData.append('file', newVersionFile);
      return floorPlansApi.createNewVersion(id, formData);
    },
    onSuccess: (newPlan: FloorPlan) => {
      showToast.success(`Version ${newPlan.version} créée avec succès`);
      queryClient.invalidateQueries({ queryKey: ['floor-plans'] });
      queryClient.invalidateQueries({ queryKey: ['floor-plan-versions', id] });
      setShowNewVersionDialog(false);
      setNewVersionNotes('');
      setNewVersionFile(null);
      // Navigate to the new version
      router.push(`/dashboard/floor-plans/${newPlan.id}`);
    },
    onError: () => {
      showToast.error('Erreur lors de la création de la nouvelle version');
    },
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

  const deleteVersionMutation = useMutation({
    mutationFn: (versionId: string) => floorPlansApi.delete(versionId),
    onSuccess: (_, deletedId) => {
      showToast.success('Version supprimée');
      queryClient.invalidateQueries({ queryKey: ['floor-plans'] });
      queryClient.invalidateQueries({ queryKey: ['floor-plan-versions', id] });
      // If we deleted the currently viewed version, redirect to another version
      if (deletedId === id) {
        const remaining = versionHistory?.filter(v => v.id !== deletedId);
        if (remaining && remaining.length > 0) {
          router.push(`/dashboard/floor-plans/${remaining[0].id}`);
        } else {
          router.push('/dashboard/floor-plans');
        }
      }
    },
    onError: () => {
      showToast.error('Erreur lors de la suppression de la version');
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
      setNewPinAssetId('');
      setNewPinRackId('');
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

  const updatePinMutation = useMutation({
    mutationFn: ({ pinId, data }: { pinId: string; data: Partial<Pin> }) =>
      floorPlansApi.updatePin(id, pinId, data),
    onSuccess: () => {
      showToast.success('Repère mis à jour avec succès');
      queryClient.invalidateQueries({ queryKey: ['floor-plan', id] });
      setShowEditPinDialog(false);
    },
    onError: () => {
      showToast.error('Erreur lors de la mise à jour du repère');
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

    const pinData: any = {
      pinType: newPinType,
      x: newPinPosition.x,
      y: newPinPosition.y,
      label: newPinLabel,
      description: newPinDescription,
    };

    // RACK type → associate rackId, not assetId
    if (newPinType === 'RACK') {
      if (newPinRackId) pinData.rackId = newPinRackId;
    } else {
      if (newPinAssetId) pinData.assetId = newPinAssetId;
    }

    // NRO type → auto-fill description with provider info if empty
    if (newPinType === 'NRO' && !newPinDescription && floorPlan?.site?.connectivity?.primary?.provider) {
      pinData.description = `Fournisseur: ${floorPlan.site.connectivity.primary.provider}`;
    }

    createPinMutation.mutate(pinData);
  };

  const handlePinClick = (pin: Pin) => {
    setSelectedPin(pin);
    setShowPinInfoDialog(true);
  };

  const handleEditPin = (pin: Pin) => {
    setSelectedPin(pin);
    setEditPinData({
      pinType: pin.pinType,
      label: pin.label,
      description: pin.description,
      assetId: pin.assetId,
      rackId: pin.rackId,
    });
    setShowPinInfoDialog(false);
    setShowEditPinDialog(true);
  };

  const handleUpdatePin = () => {
    if (!selectedPin) return;
    updatePinMutation.mutate({
      pinId: selectedPin.id,
      data: editPinData,
    });
  };

  const handlePinDragEnd = (pinId: string, x: number, y: number) => {
    updatePinMutation.mutate({
      pinId,
      data: { x, y },
    });
  };

  const handleDownload = () => {
    if (exportFunction) {
      // Export canvas with pins
      exportFunction();
    } else if (floorPlan?.fileUrl) {
      // Fallback: download original image
      window.open(floorPlan.fileUrl, '_blank');
    }
  };

  const handleExportReady = useCallback((exportFn: () => void) => {
    setExportFunction(() => exportFn);
  }, []);

  // ==================== HEATMAP ====================

  // Build heatmap access points from floor plan pins + assets
  const heatmapAccessPoints: HeatmapAccessPoint[] = useMemo(() => {
    if (!floorPlan?.pins) return [];
    return floorPlan.pins
      .filter(pin => pin.pinType === 'ACCESS_POINT')
      .map(pin => ({
        pinId: pin.id,
        x: pin.x,
        y: pin.y,
        label: pin.label || undefined,
        asset: pin.asset ? {
          id: pin.asset.id,
          name: pin.asset.name || undefined,
          manufacturer: pin.asset.manufacturer || undefined,
          model: pin.asset.model || undefined,
          type: pin.asset.type,
          status: pin.asset.status,
          wifiProfile: (pin.asset as any).metadata?.wifiProfile || undefined,
          networkInfo: pin.asset.networkInfo,
        } : null,
      }));
  }, [floorPlan?.pins]);

  const apCount = heatmapAccessPoints.length;

  // Save scale mutation
  const scaleMutation = useMutation({
    mutationFn: ({ scaleVal, refLine }: { scaleVal: number; refLine?: any }) =>
      floorPlansApi.updateScale(id, scaleVal, refLine),
    onSuccess: () => {
      showToast.success('Échelle du plan enregistrée');
      queryClient.invalidateQueries({ queryKey: ['floor-plan', id] });
    },
    onError: () => {
      showToast.error('Erreur lors de l\'enregistrement de l\'échelle');
    },
  });

  const handleSaveScale = (scaleVal: number, refLine?: any) => {
    scaleMutation.mutate({ scaleVal, refLine });
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
          {canUpdate('floor-plans', floorPlan?.siteId) && (
            <Button variant="outline" onClick={() => setShowNewVersionDialog(true)}>
              <Copy className="mr-2 h-4 w-4" />
              Nouvelle version
            </Button>
          )}
          <Button variant="outline" onClick={handleDownload} data-testid="download-plan-btn">
            <Download className="mr-2 h-4 w-4" />
            Télécharger PDF
          </Button>
          {canUpdate('floor-plans', floorPlan?.siteId) && (
            <Button variant="outline" asChild data-testid="edit-floor-plan-btn">
              <Link href={`/dashboard/floor-plans/${id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Modifier
              </Link>
            </Button>
          )}
          {canDelete('floor-plans', floorPlan?.siteId) && (
            <Button variant="destructive" onClick={() => setShowDeleteDialog(true)} data-testid="delete-floor-plan-btn">
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </Button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Viewer */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Plan interactif</CardTitle>
                {canUpdate('floor-plans', floorPlan?.siteId) && (
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="add-pin-btn"
                    onClick={() => setShowAddPinDialog(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Ajouter un repère
                  </Button>
                )}
              </div>
              {canUpdate('floor-plans', floorPlan?.siteId) && (
                <p className="text-sm text-muted-foreground">
                  Cliquez sur le plan pour ajouter un repère
                </p>
              )}
            </CardHeader>
            <CardContent>
              <FloorPlanViewer
                floorPlan={floorPlan}
                pins={floorPlan.pins || []}
                onPinClick={handlePinClick}
                onStageClick={canUpdate('floor-plans', floorPlan?.siteId) ? handleStageClick : undefined}
                onPinDragEnd={canUpdate('floor-plans', floorPlan?.siteId) ? handlePinDragEnd : undefined}
                editable={canUpdate('floor-plans', floorPlan?.siteId)}
                onExportReady={handleExportReady}
                heatmapConfig={heatmapConfig}
                heatmapAccessPoints={heatmapAccessPoints}
                scaleMetersPerPixel={floorPlan.scaleMetersPerPixel}
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

          {/* Wi-Fi Heatmap Controls */}
          {apCount > 0 && (
            <HeatmapControls
              config={heatmapConfig}
              onChange={setHeatmapConfig}
              apCount={apCount}
              hasScale={!!floorPlan.scaleMetersPerPixel}
              onCalibrateScale={() => setShowScaleCalibration(true)}
            />
          )}

          {/* Version History */}
          {versionHistory && versionHistory.length > 1 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Versions
                  </CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {versionHistory.length}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {versionHistory.map((version) => (
                  <div
                    key={version.id}
                    className={`relative p-2 border rounded-lg hover:bg-muted/50 transition-colors ${
                      version.id === id ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <Link
                      href={`/dashboard/floor-plans/${version.id}`}
                      className="block"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant={version.id === id ? 'default' : 'secondary'} className="text-xs">
                            v{version.version}
                          </Badge>
                          {version.id === id && (
                            <span className="text-xs text-primary font-medium">actuelle</span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground mr-6">
                          {version._count?.pins ?? version.pins?.length ?? 0} repères
                        </span>
                      </div>
                      {version.notes && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {version.notes}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {version.uploadedAt
                          ? new Date(version.uploadedAt).toLocaleDateString('fr-FR')
                          : '—'}
                      </p>
                    </Link>
                    {/* Delete version button (only if more than 1 version) */}
                    {versionHistory.length > 1 && canDelete('floor-plans', floorPlan?.siteId) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-1 right-1 h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (confirm(`Supprimer la version ${version.version} ? Cette action est irréversible.`)) {
                            deleteVersionMutation.mutate(version.id);
                          }
                        }}
                        disabled={deleteVersionMutation.isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

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
                floorPlan.pins.map((pin) => {
                  const linkedAsset = pin.assetId ? assets?.find(a => a.id === pin.assetId) : null;
                  const linkedRack = pin.rackId ? racks?.find(r => r.id === pin.rackId) : null;
                  return (
                    <div
                      key={pin.id}
                      className="flex items-start justify-between p-2 border rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => handlePinClick(pin)}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">{pin.label || 'Sans nom'}</p>
                        <p className="text-xs text-muted-foreground">
                          {getLabel('PinType', pin.pinType)}
                        </p>
                        {linkedRack && (
                          <p className="text-xs text-purple-600 mt-0.5">
                            <Server className="inline h-3 w-3 mr-1" />
                            {linkedRack.name} ({linkedRack.heightU}U)
                          </p>
                        )}
                        {linkedAsset && (
                          <p className="text-xs text-blue-600 mt-0.5">
                            {getAssetLabel(linkedAsset)}
                          </p>
                        )}
                        {pin.pinType === 'NRO' && floorPlan?.site?.connectivity?.primary?.provider && (
                          <p className="text-xs text-purple-600 mt-0.5">
                            <Wifi className="inline h-3 w-3 mr-1" />
                            {floorPlan.site.connectivity.primary.provider}
                          </p>
                        )}
                        {pin.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {pin.description}
                          </p>
                        )}
                      </div>
                      {canUpdate('floor-plans', floorPlan?.siteId) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); deletePinMutation.mutate(pin.id); }}
                          disabled={deletePinMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })
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
                ? `Position: ${(newPinPosition.x * 100).toFixed(0)}%, ${(newPinPosition.y * 100).toFixed(0)}%`
                : 'Cliquez sur le plan pour choisir la position'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={newPinType} onValueChange={(value) => {
                setNewPinType(value as PinType);
                if (!newPinLabel) {
                  setNewPinLabel(getLabel('PinType', value) || pinTypeLabels[value as PinType] || value);
                }
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pinTypeOptions.map((item) => (
                    <SelectItem key={item.enumValue} value={item.enumValue}>
                      {item.label}
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

            {/* Conditional association based on pin type */}
            {newPinType === 'RACK' ? (
              <div className="space-y-2">
                <Label>Baie associée (optionnel)</Label>
                <Select value={newPinRackId || 'none'} onValueChange={(value) => {
                  const rackId = value === 'none' ? '' : value;
                  setNewPinRackId(rackId);
                  if (rackId && racks) {
                    const rack = racks.find(r => r.id === rackId);
                    if (rack && !newPinLabel) {
                      setNewPinLabel(rack.name);
                    }
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Aucune baie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune baie</SelectItem>
                    {racks?.map((rack) => (
                      <SelectItem key={rack.id} value={rack.id}>
                        <span className="flex items-center gap-2">
                          <Server className="h-3 w-3" />
                          {rack.name} ({rack.heightU}U)
                          {rack.location ? ` — ${rack.location}` : ''}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {newPinRackId && (
                  <p className="text-xs text-muted-foreground">
                    Lien vers la fiche baie dans les détails du repère
                  </p>
                )}
              </div>
            ) : newPinType === 'NRO' ? (
              <div className="space-y-2">
                {floorPlan?.site?.connectivity?.primary?.provider && (
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Wifi className="h-4 w-4 text-purple-500" />
                      <p className="text-sm font-medium">Connectivité du site</p>
                    </div>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Fournisseur : </span>
                      <span className="font-medium">{floorPlan.site.connectivity.primary.provider}</span>
                    </p>
                    {floorPlan.site.connectivity.primary.type && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Type : </span>
                        {floorPlan.site.connectivity.primary.type}
                      </p>
                    )}
                    {floorPlan.site.connectivity.primary.ref && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Réf : </span>
                        {floorPlan.site.connectivity.primary.ref}
                      </p>
                    )}
                  </div>
                )}
                {floorPlan?.site?.connectivity?.backup?.provider && (
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Wifi className="h-4 w-4 text-orange-500" />
                      <p className="text-sm font-medium">Connectivité backup</p>
                    </div>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Fournisseur : </span>
                      <span className="font-medium">{floorPlan.site.connectivity.backup.provider}</span>
                    </p>
                    {floorPlan.site.connectivity.backup.type && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Type : </span>
                        {floorPlan.site.connectivity.backup.type}
                      </p>
                    )}
                  </div>
                )}
                {!floorPlan?.site?.connectivity?.primary?.provider && (
                  <p className="text-xs text-muted-foreground">
                    Aucune info de connectivité sur ce site. Renseignez-la dans la fiche site.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Équipement associé (optionnel)</Label>
                <Select value={newPinAssetId || 'none'} onValueChange={(value) => {
                  const assetId = value === 'none' ? '' : value;
                  setNewPinAssetId(assetId);
                  if (assetId && assets) {
                    const asset = assets.find(a => a.id === assetId);
                    if (asset && !newPinLabel) {
                      setNewPinLabel(asset.name || getAssetLabel(asset));
                    }
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Aucun équipement" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun équipement</SelectItem>
                    {assets?.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {getAssetLabel(asset)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {newPinAssetId && assets && (
                  <p className="text-xs text-muted-foreground">
                    Lien vers la fiche équipement dans les détails du repère
                  </p>
                )}
              </div>
            )}
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
                <Badge variant="secondary">
                  {getLabel('PinType', selectedPin.pinType)}
                </Badge>
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

              {/* Rack association for RACK pins */}
              {selectedPin.rackId && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Baie associée</p>
                  {(() => {
                    const linkedRack = racks?.find(r => r.id === selectedPin.rackId);
                    return (
                      <div className="flex flex-col gap-1">
                        {linkedRack && (
                          <p className="text-sm font-medium">
                            <Server className="inline h-3 w-3 mr-1" />
                            {linkedRack.name} ({linkedRack.heightU}U)
                            {linkedRack.location ? ` — ${linkedRack.location}` : ''}
                          </p>
                        )}
                        <Link
                          href={`/dashboard/racks/${selectedPin.rackId}`}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          Voir la fiche baie
                        </Link>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Asset association for non-RACK pins */}
              {selectedPin.assetId && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Équipement associé</p>
                  {(() => {
                    const linkedAsset = assets?.find(a => a.id === selectedPin.assetId);
                    return (
                      <div className="flex flex-col gap-1">
                        {linkedAsset && (
                          <p className="text-sm font-medium">{getAssetLabel(linkedAsset)}</p>
                        )}
                        <Link
                          href={`/dashboard/assets/${selectedPin.assetId}`}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          Voir la fiche équipement
                        </Link>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* NRO connectivity info */}
              {selectedPin.pinType === 'NRO' && floorPlan?.site?.connectivity?.primary?.provider && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Connectivité</p>
                  <div className="p-2 bg-muted rounded-lg mt-1">
                    <p className="text-sm">
                      <Wifi className="inline h-3 w-3 mr-1 text-purple-500" />
                      <span className="font-medium">{floorPlan.site.connectivity.primary.provider}</span>
                      {floorPlan.site.connectivity.primary.type && (
                        <span className="text-muted-foreground"> ({floorPlan.site.connectivity.primary.type})</span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                Position: ({selectedPin.x.toFixed(3)}, {selectedPin.y.toFixed(3)})
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPinInfoDialog(false)}>
              Fermer
            </Button>
            {selectedPin && canUpdate('floor-plans', floorPlan?.siteId) && (
              <Button onClick={() => handleEditPin(selectedPin)}>
                <Edit className="h-4 w-4 mr-2" />
                Éditer
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Pin Dialog */}
      <Dialog open={showEditPinDialog} onOpenChange={setShowEditPinDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Éditer le repère</DialogTitle>
            <DialogDescription>
              Modifier les informations du repère
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={editPinData.pinType || 'OTHER'}
                onValueChange={(value) => setEditPinData({ ...editPinData, pinType: value as PinType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pinTypeOptions.map((item) => (
                    <SelectItem key={item.enumValue} value={item.enumValue}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Libellé</Label>
              <Input
                value={editPinData.label || ''}
                onChange={(e) => setEditPinData({ ...editPinData, label: e.target.value })}
                placeholder="Nom du repère"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={editPinData.description || ''}
                onChange={(e) => setEditPinData({ ...editPinData, description: e.target.value })}
                placeholder="Description optionnelle"
              />
            </div>

            {/* Conditional association based on pin type */}
            {editPinData.pinType === 'RACK' ? (
              <div className="space-y-2">
                <Label>Baie associée</Label>
                <Select
                  value={editPinData.rackId || 'none'}
                  onValueChange={(value) => setEditPinData({ ...editPinData, rackId: value === 'none' ? undefined : value, assetId: undefined })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Aucune baie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune baie</SelectItem>
                    {racks?.map((rack) => (
                      <SelectItem key={rack.id} value={rack.id}>
                        <span className="flex items-center gap-2">
                          <Server className="h-3 w-3" />
                          {rack.name} ({rack.heightU}U)
                          {rack.location ? ` — ${rack.location}` : ''}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : editPinData.pinType === 'NRO' ? (
              <div className="space-y-2">
                <Label>Connectivité du site</Label>
                {floorPlan?.site?.connectivity?.primary?.provider ? (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm">
                      <Wifi className="inline h-3 w-3 mr-1 text-purple-500" />
                      <span className="font-medium">{floorPlan.site.connectivity.primary.provider}</span>
                      {floorPlan.site.connectivity.primary.type && (
                        <span className="text-muted-foreground"> ({floorPlan.site.connectivity.primary.type})</span>
                      )}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Aucune info de connectivité. Renseignez-la dans la fiche site.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Équipement associé</Label>
                <Select
                  value={editPinData.assetId || 'none'}
                  onValueChange={(value) => setEditPinData({ ...editPinData, assetId: value === 'none' ? undefined : value, rackId: undefined })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Aucun équipement" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun équipement</SelectItem>
                    {assets?.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {getAssetLabel(asset)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditPinDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleUpdatePin}
              disabled={!editPinData.label || updatePinMutation.isPending}
            >
              {updatePinMutation.isPending ? 'Mise à jour...' : 'Mettre à jour'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Version Dialog */}
      <Dialog open={showNewVersionDialog} onOpenChange={setShowNewVersionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              Créer une nouvelle version
            </DialogTitle>
            <DialogDescription>
              Crée la version {(floorPlan.version || 1) + 1} à partir de la v{floorPlan.version}.
              Les {floorPlan.pins?.length || 0} repères seront copiés.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nouveau plan (optionnel)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/png,image/jpeg,application/pdf"
                  onChange={(e) => setNewVersionFile(e.target.files?.[0] || null)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Si non fourni, le plan actuel sera conservé pour la nouvelle version.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={newVersionNotes}
                onChange={(e) => setNewVersionNotes(e.target.value)}
                placeholder="Ex: Mise à jour après travaux bâtiment B..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewVersionDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => createVersionMutation.mutate()}
              disabled={createVersionMutation.isPending}
            >
              {createVersionMutation.isPending ? 'Création...' : 'Créer la version'}
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

      {/* Scale Calibration Dialog */}
      <ScaleCalibration
        open={showScaleCalibration}
        onClose={() => setShowScaleCalibration(false)}
        onSave={handleSaveScale}
        currentScale={floorPlan?.scaleMetersPerPixel}
        currentRefLine={floorPlan?.scaleRefLine}
        pickedPoints={scalePickPoints}
        onStartPickingPoints={() => {
          setScalePickPoints([]);
          // User will click on the plan - handled via a special mode
        }}
      />
    </div>
  );
}
