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
import {
  ArrowLeft,
  Edit,
  Trash2,
  QrCode,
  Download,
  Package,
  MapPin,
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
  TEAMS_ROOM: 'Teams Room',
  SERVER: 'Serveur',
  CABLE: 'Câble',
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

  const { data: asset, isLoading } = useQuery<Asset>({
    queryKey: ['asset', id],
    queryFn: () => assetsApi.getById(id),
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
  });

  const handleDelete = () => {
    deleteMutation.mutate();
    setShowDeleteDialog(false);
  };

  const handleDownloadQR = () => {
    if (!qrCodeData) return;

    const link = document.createElement('a');
    link.href = qrCodeData.qrCodeDataUrl;
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
                {asset.manufacturer} {asset.model}
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
            onClick={() => generateQRMutation.mutate()}
            disabled={generateQRMutation.isPending}
          >
            <QrCode className="mr-2 h-4 w-4" />
            {generateQRMutation.isPending ? 'Génération...' : 'Générer QR Code'}
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/dashboard/assets/${id}/edit`}>
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

      {/* Tabs */}
      <Tabs defaultValue="info" className="w-full">
        <TabsList>
          <TabsTrigger value="info">Informations</TabsTrigger>
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

                {asset.manufacturer && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Marque
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
                    <p className="text-lg">{asset.rack.name}</p>
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
                    <Button onClick={handleDownloadQR}>
                      <Download className="mr-2 h-4 w-4" />
                      Télécharger
                    </Button>
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
