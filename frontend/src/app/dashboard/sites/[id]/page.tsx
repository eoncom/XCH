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
import { sitesApi } from '@/lib/api/sites';
import { assetsApi } from '@/lib/api/assets';
import { racksApi } from '@/lib/api/racks';
import { tasksApi } from '@/lib/api/tasks';
import { ArrowLeft, MapPin, Edit, Trash2, Package, Phone, Mail, User, Wifi, Globe, Shield, Clock, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import type { Site, Asset, Rack, Task } from '@/types';

const healthStatusColors = {
  HEALTHY: 'success' as const,
  WARNING: 'warning' as const,
  CRITICAL: 'error' as const,
  UNKNOWN: 'secondary' as const,
};

export default function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: site, isLoading } = useQuery<Site>({
    queryKey: ['site', id],
    queryFn: () => sitesApi.getById(id),
  });

  // Load site assets (filter by siteId)
  const {data: allAssets = []} = useQuery<Asset[]>({
    queryKey: ['assets'],
    queryFn: () => assetsApi.getAll(),
  });
  const assets = allAssets.filter(a => a.siteId === id);

  // Load site racks
  const { data: racks = [] } = useQuery<Rack[]>({
    queryKey: ['racks', { siteId: id }],
    queryFn: () => racksApi.getAll(id),
    enabled: !!id,
  });

  // Load site tasks (filter by siteId)
  const {data: allTasks = []} = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.getAll(),
  });
  const tasks = allTasks.filter(t => t.siteId === id);

  const activeTasks = tasks.filter(t => t.status !== 'DONE');

  const deleteMutation = useMutation({
    mutationFn: () => sitesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      router.push('/dashboard/sites');
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate();
    setShowDeleteDialog(false);
  };

  if (isLoading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  if (!site) {
    return <div className="text-center py-12">Chantier non trouvé</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/sites">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{site.name}</h1>
            <p className="text-muted-foreground">{site.code}</p>
          </div>
          <Badge variant={healthStatusColors[site.healthStatus]}>
            {site.healthStatus}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/dashboard/sites/${id}/edit`}>
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
          <TabsTrigger value="assets">Équipements</TabsTrigger>
          <TabsTrigger value="tasks">Tâches</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-6">
          {/* Informations générales */}
          <Card>
            <CardHeader>
              <CardTitle>Informations générales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Code</label>
                  <p className="text-lg">{site.code}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Statut</label>
                  <p className="text-lg">{site.status}</p>
                </div>
                {site.city && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Ville</label>
                    <p className="text-lg">{site.city}</p>
                  </div>
                )}
                {site.postalCode && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Code postal
                    </label>
                    <p className="text-lg">{site.postalCode}</p>
                  </div>
                )}
              </div>

              {site.address && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Adresse</label>
                  <p className="text-lg">{site.address}</p>
                </div>
              )}

              {(site.latitude && site.longitude) && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Coordonnées GPS
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <p className="text-lg">
                      {site.latitude.toFixed(6)}, {site.longitude.toFixed(6)}
                    </p>
                  </div>
                </div>
              )}

              {site.notes && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Notes</label>
                  <p className="text-sm mt-1">{site.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contacts */}
          {site.contacts && site.contacts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Contacts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {site.contacts.map((contact, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{contact.name}</p>
                          {contact.isPrimary && (
                            <Badge variant="outline" className="text-xs">Principal</Badge>
                          )}
                        </div>
                        {contact.role && (
                          <p className="text-sm text-muted-foreground">{contact.role}</p>
                        )}
                        <div className="flex flex-wrap gap-4 mt-2">
                          {contact.phone && (
                            <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
                              <Phone className="h-3 w-3" />
                              {contact.phone}
                            </a>
                          )}
                          {contact.email && (
                            <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
                              <Mail className="h-3 w-3" />
                              {contact.email}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Connectivity */}
          {site.connectivity && (site.connectivity.primary || site.connectivity.backup) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wifi className="h-5 w-5" />
                  Connectivité
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {site.connectivity.primary && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm font-medium text-muted-foreground mb-1">Connexion principale</p>
                      <div className="space-y-1">
                        {site.connectivity.primary.type && (
                          <p className="text-sm"><strong>Type:</strong> {site.connectivity.primary.type}</p>
                        )}
                        {site.connectivity.primary.provider && (
                          <p className="text-sm"><strong>Opérateur:</strong> {site.connectivity.primary.provider}</p>
                        )}
                        {site.connectivity.primary.ref && (
                          <p className="text-sm"><strong>Réf:</strong> {site.connectivity.primary.ref}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {site.connectivity.backup && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm font-medium text-muted-foreground mb-1">Connexion de secours</p>
                      <div className="space-y-1">
                        {site.connectivity.backup.type && (
                          <p className="text-sm"><strong>Type:</strong> {site.connectivity.backup.type}</p>
                        )}
                        {site.connectivity.backup.provider && (
                          <p className="text-sm"><strong>Opérateur:</strong> {site.connectivity.backup.provider}</p>
                        )}
                        {site.connectivity.backup.ref && (
                          <p className="text-sm"><strong>Réf:</strong> {site.connectivity.backup.ref}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {site.connectivity.cutProcedure && (
                  <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-sm font-medium flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                      <AlertTriangle className="h-4 w-4" />
                      Procédure en cas de coupure
                    </p>
                    <p className="text-sm mt-1 text-yellow-700 dark:text-yellow-300">{site.connectivity.cutProcedure}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Access Notes */}
          {site.accessNotes && (site.accessNotes.schedules || site.accessNotes.badges || site.accessNotes.procedures || site.accessNotes.safety) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Informations d'accès
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {site.accessNotes.schedules && (
                    <div className="flex items-start gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <p className="text-sm font-medium">Horaires</p>
                        <p className="text-sm text-muted-foreground">{site.accessNotes.schedules}</p>
                      </div>
                    </div>
                  )}
                  {site.accessNotes.badges && (
                    <div className="flex items-start gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <p className="text-sm font-medium">Badges</p>
                        <p className="text-sm text-muted-foreground">{site.accessNotes.badges}</p>
                      </div>
                    </div>
                  )}
                  {site.accessNotes.procedures && (
                    <div className="flex items-start gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <p className="text-sm font-medium">Procédures</p>
                        <p className="text-sm text-muted-foreground">{site.accessNotes.procedures}</p>
                      </div>
                    </div>
                  )}
                  {site.accessNotes.safety && (
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <p className="text-sm font-medium">Sécurité</p>
                        <p className="text-sm text-muted-foreground">{site.accessNotes.safety}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Statistiques */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Équipements</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{assets.length}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Baies</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{racks.length}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Tâches</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{activeTasks.length}</p>
                <p className="text-sm text-muted-foreground">En cours</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="assets">
          <Card>
            <CardHeader>
              <CardTitle>Équipements ({assets.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {assets.length > 0 ? (
                <div className="space-y-3">
                  {assets.map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <Link
                            href={`/dashboard/assets/${asset.id}`}
                            className="font-medium hover:underline"
                          >
                            {asset.manufacturer} {asset.model}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            {asset.type} • {asset.serialNumber}
                          </p>
                        </div>
                      </div>
                      <Badge>{asset.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-12 text-muted-foreground">
                  Aucun équipement sur ce site
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>Tâches ({tasks.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {tasks.length > 0 ? (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <Link
                          href={`/dashboard/tasks/${task.id}`}
                          className="font-medium hover:underline"
                        >
                          {task.title}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {task.description}
                        </p>
                      </div>
                      <Badge>{task.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-12 text-muted-foreground">
                  Aucune tâche pour ce site
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans">
          <Card>
            <CardHeader>
              <CardTitle>Plans d'étage</CardTitle>
            </CardHeader>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Fonctionnalité à venir - Upload et visualisation de plans
              </p>
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
              Êtes-vous sûr de vouloir supprimer le chantier &quot;{site.name}&quot; ?
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
