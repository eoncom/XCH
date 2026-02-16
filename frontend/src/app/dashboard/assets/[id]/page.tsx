// @ts-nocheck - Temporary fix for Radix UI + React 19 type incompatibility
'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { assetsApi } from '@/lib/api/assets';
import { usePermissions } from '@/hooks/usePermissions';
import { Attachments } from '@/components/Attachments';
import {
  ArrowLeft,
  Edit,
  Trash2,
  QrCode,
  Download,
  Package,
  MapPin,
  ClipboardList,
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import type { Asset, AssetType, AssetStatus } from '@/types';

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

const assetStatusColors = {
  IN_SERVICE: 'success',
  OUT_OF_SERVICE: 'secondary',
  IN_TRANSIT: 'warning',
  STOCK: 'secondary',
  RETIRED: 'error',
} as const;

const assetStatusLabels: Record<AssetStatus, string> = {
  IN_SERVICE: 'En service',
  OUT_OF_SERVICE: 'Hors service',
  IN_TRANSIT: 'En transit',
  STOCK: 'En stock',
  RETIRED: 'Retiré',
};

const taskStatusConfig: Record<string, { label: string; variant: 'secondary' | 'default' | 'error' | 'success' | 'warning'; icon: typeof Circle }> = {
  TODO: { label: 'À faire', variant: 'secondary', icon: Circle },
  IN_PROGRESS: { label: 'En cours', variant: 'default', icon: Clock },
  BLOCKED: { label: 'Bloquée', variant: 'error', icon: AlertTriangle },
  DONE: { label: 'Terminée', variant: 'success', icon: CheckCircle2 },
  CANCELLED: { label: 'Annulée', variant: 'secondary', icon: XCircle },
};

export default function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<{
    qrCodeDataUrl: string;
    qrUrl: string;
  } | null>(null);
  const { canUpdate, canDelete } = usePermissions();

  const { data: asset, isLoading } = useQuery<Asset>({
    queryKey: ['asset', id],
    queryFn: () => assetsApi.getById(id),
  });

  // Load asset attachments count
  const { data: assetAttachments = [] } = useQuery<any[]>({
    queryKey: ['assets', id, 'attachments'],
    queryFn: () => assetsApi.listAttachments(id),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => assetsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      router.push('/dashboard/assets');
    },
  });

  const generateQRMutation = useMutation({
    mutationFn: () => assetsApi.generateQRCode(id),
    onSuccess: (data) => {
      setQrCodeData({
        qrCodeDataUrl: data.qrCodeDataUrl,
        qrUrl: data.qrUrl,
      });
      queryClient.invalidateQueries({ queryKey: ['asset', id] });
    },
    onError: (error) => {
      console.error('Erreur génération QR Code:', error);
      alert(`Erreur lors de la génération du QR Code: ${error.message}`);
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate();
    setShowDeleteDialog(false);
  };

  const handleDownloadQR = () => {
    const dataUrl = qrCodeData?.qrCodeDataUrl || asset?.qrCodeUrl;
    if (!dataUrl) return;

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `qr-${asset?.serialNumber || id}.png`;
    link.click();
  };

  if (isLoading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  if (!asset) {
    return <div className="text-center py-12">Équipement non trouvé</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/assets">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <Package className="h-8 w-8 text-muted-foreground" />
            <div>
              <h1 className="text-3xl font-bold">
                {asset.name || `${asset.manufacturer || ''} ${asset.model || ''}`.trim() || 'Équipement'}
              </h1>
              <p className="text-muted-foreground">
                {assetTypeLabels[asset.type]}
              </p>
            </div>
          </div>
          <Badge variant={assetStatusColors[asset.status]}>
            {assetStatusLabels[asset.status]}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            data-testid="generate-qr-btn"
            onClick={() => generateQRMutation.mutate()}
            disabled={generateQRMutation.isPending}
          >
            <QrCode className="mr-2 h-4 w-4" />
            {generateQRMutation.isPending ? 'Génération...' : 'Générer QR Code'}
          </Button>
          {canUpdate('assets', asset?.siteId) && (
            <Button variant="outline" asChild data-testid="edit-asset-btn">
              <Link href={`/dashboard/assets/${id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Modifier
              </Link>
            </Button>
          )}
          {canDelete('assets', asset?.siteId) && (
            <Button variant="destructive" onClick={() => setShowDeleteDialog(true)} data-testid="delete-asset-btn">
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info" className="w-full">
        <TabsList>
          <TabsTrigger value="info">Informations</TabsTrigger>
          <TabsTrigger value="tasks">
            Tâches{(asset as any).tasks?.length > 0 && ` (${(asset as any).tasks.length})`}
          </TabsTrigger>
          <TabsTrigger value="documents">Documents ({assetAttachments.length})</TabsTrigger>
          <TabsTrigger value="qr">QR Code</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-6">
          {/* General Information */}
          <Card>
            <CardHeader>
              <CardTitle>Informations générales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Type
                  </label>
                  <p className="text-lg">{assetTypeLabels[asset.type]}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Statut
                  </label>
                  <p className="text-lg">{assetStatusLabels[asset.status]}</p>
                </div>

                {asset.name && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Nom
                    </label>
                    <p className="text-lg">{asset.name}</p>
                  </div>
                )}

                {asset.manufacturer && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Fabricant
                    </label>
                    <p className="text-lg">{asset.manufacturer}</p>
                  </div>
                )}

                {asset.model && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Modèle
                    </label>
                    <p className="text-lg">{asset.model}</p>
                  </div>
                )}

                {asset.serialNumber && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Numéro de série
                    </label>
                    <p className="text-lg font-mono">{asset.serialNumber}</p>
                  </div>
                )}
              </div>

              {asset.site && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Site
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <Link
                      href={`/dashboard/sites/${asset.site.id}`}
                      className="text-lg text-blue-600 hover:underline"
                    >
                      {asset.site.name}
                    </Link>
                  </div>
                </div>
              )}

              {asset.purchaseDate && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Date d'achat
                  </label>
                  <p className="text-lg">
                    {new Date(asset.purchaseDate).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              )}

              {asset.warrantyEnd && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Fin de garantie
                  </label>
                  <p className="text-lg">
                    {new Date(asset.warrantyEnd).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rack Information */}
          {asset.rack && (
            <Card>
              <CardHeader>
                <CardTitle>Montage en baie</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Baie
                    </label>
                    <p className="text-lg">
                      <Link
                        href={`/dashboard/racks/${asset.rack.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {asset.rack.name}
                      </Link>
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Position (U)
                    </label>
                    <p className="text-lg">{asset.rackPositionU}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Hauteur (U)
                    </label>
                    <p className="text-lg">{asset.rackHeightU}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Tâches ({(asset as any).tasks?.length || 0})</CardTitle>
              <Button asChild size="sm">
                <Link href={`/dashboard/tasks/new?assetId=${id}${asset.siteId ? `&siteId=${asset.siteId}` : ''}`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nouvelle tâche
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {(asset as any).tasks?.length > 0 ? (
                <div className="space-y-3">
                  {(asset as any).tasks.map((task: { id: string; title: string; status: string; priority?: string; description?: string; dueDate?: string; assignedUser?: { id: string; name: string } }) => {
                    const statusCfg: Record<string, { label: string; variant: 'secondary' | 'default' | 'error' | 'success' | 'warning' }> = {
                      TODO: { label: 'À faire', variant: 'secondary' },
                      IN_PROGRESS: { label: 'En cours', variant: 'default' },
                      BLOCKED: { label: 'Bloqué', variant: 'error' },
                      DONE: { label: 'Terminé', variant: 'success' },
                      CANCELLED: { label: 'Annulé', variant: 'secondary' },
                    };
                    const priorityCfg: Record<string, { label: string; variant: 'secondary' | 'default' | 'warning' | 'error' }> = {
                      LOW: { label: 'Faible', variant: 'secondary' },
                      MEDIUM: { label: 'Moyenne', variant: 'default' },
                      HIGH: { label: 'Haute', variant: 'warning' },
                      URGENT: { label: 'Urgente', variant: 'error' },
                    };
                    const sc = statusCfg[task.status] || { label: task.status, variant: 'secondary' as const };
                    const pc = task.priority ? (priorityCfg[task.priority] || { label: task.priority, variant: 'secondary' as const }) : null;
                    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE' && task.status !== 'CANCELLED';

                    return (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/dashboard/tasks/${task.id}`}
                              className="font-medium hover:underline truncate"
                            >
                              {task.title}
                            </Link>
                            {isOverdue && (
                              <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 flex-shrink-0">
                                <Clock className="h-3 w-3" />
                                En retard
                              </span>
                            )}
                          </div>
                          {task.description && (
                            <p className="text-sm text-muted-foreground truncate mt-0.5">
                              {task.description}
                            </p>
                          )}
                          {task.assignedUser && (
                            <p className="text-xs text-muted-foreground mt-1">
                              → {task.assignedUser.name}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                          {pc && <Badge variant={pc.variant}>{pc.label}</Badge>}
                          <Badge variant={sc.variant}>{sc.label}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Aucune tâche liée à cet équipement
                  </p>
                  <Button asChild variant="outline">
                    <Link href={`/dashboard/tasks/new?assetId=${id}${asset.siteId ? `&siteId=${asset.siteId}` : ''}`}>
                      <Plus className="mr-2 h-4 w-4" />
                      Créer une tâche
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Attachments
            entityId={id}
            entityType="assets"
            apiModule={assetsApi}
          />
        </TabsContent>

        <TabsContent value="qr">
          <Card>
            <CardHeader>
              <CardTitle>QR Code de l'équipement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {qrCodeData || asset.qrCodeUrl ? (
                <div className="flex flex-col items-center space-y-4">
                  <div className="bg-white p-4 rounded-lg border">
                    {qrCodeData ? (
                      <Image
                        src={qrCodeData.qrCodeDataUrl}
                        alt="QR Code"
                        width={256}
                        height={256}
                      />
                    ) : asset.qrCodeUrl ? (
                      <Image
                        src={asset.qrCodeUrl}
                        alt="QR Code"
                        width={256}
                        height={256}
                      />
                    ) : null}
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Scannez ce QR code pour accéder aux informations de
                      l'équipement
                    </p>
                    <div className="flex items-center gap-2 justify-center">
                      <Button onClick={handleDownloadQR}>
                        <Download className="mr-2 h-4 w-4" />
                        Télécharger
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => generateQRMutation.mutate()}
                        disabled={generateQRMutation.isPending}
                      >
                        <QrCode className="mr-2 h-4 w-4" />
                        {generateQRMutation.isPending ? 'Régénération...' : 'Régénérer'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <QrCode className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Aucun QR code généré pour cet équipement
                  </p>
                  <Button onClick={() => generateQRMutation.mutate()}>
                    <QrCode className="mr-2 h-4 w-4" />
                    Générer un QR Code
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Historique à venir</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer l'équipement &quot;{asset.manufacturer}{' '}
              {asset.model}&quot; ? Cette action est irréversible.
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
