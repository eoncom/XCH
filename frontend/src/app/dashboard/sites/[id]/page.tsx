'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { sitesApi } from '@/lib/api/sites';
import { assetsApi } from '@/lib/api/assets';
import { racksApi } from '@/lib/api/racks';
import { tasksApi } from '@/lib/api/tasks';
import { floorPlansApi } from '@/lib/api/floor-plans';
import { siteAccessApi, type UserSiteAccess } from '@/lib/api/site-access';
import { usersApi } from '@/lib/api/users';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import { Attachments } from '@/components/Attachments';
import { showToast } from '@/lib/toast';
import { exportSiteZip } from '@/lib/export-site';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, MapPin, Edit, Trash2, Package, Phone, Mail, User, Users, Wifi, Globe, Shield, Clock, AlertTriangle, FileText, Download, Loader2, Map, Server, ExternalLink, HardDrive, FolderOpen, Search, Plus, Info, Lock, Unlock, UserPlus, X } from 'lucide-react';
import Link from 'next/link';
import type { Site, Asset, Rack, Task, FloorPlan, User as UserType } from '@/types';

const healthStatusColors = {
  HEALTHY: 'success' as const,
  WARNING: 'warning' as const,
  CRITICAL: 'error' as const,
  UNKNOWN: 'secondary' as const,
};

const sourceLabels: Record<string, string> = {
  site: 'Site',
  asset: 'Équipement',
  rack: 'Baie',
  task: 'Tâche',
};

const sourceColors: Record<string, string> = {
  site: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  asset: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  rack: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  task: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

interface AggregatedDoc {
  id: string;
  originalFilename: string;
  size: number;
  category?: string;
  description?: string;
  uploadedAt: string;
  url: string;
  source: string;
  sourceName: string;
}

function AggregatedDocuments({ siteId }: { siteId: string }) {
  const { data: docs = [], isLoading } = useQuery<AggregatedDoc[]>({
    queryKey: ['site-documents', siteId],
    queryFn: () => sitesApi.listAllDocuments(siteId),
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (docs.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Tous les documents du chantier ({docs.length})
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Agrège les documents du site, des équipements, des baies et des tâches
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileText className="h-6 w-6 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-sm">{doc.originalFilename}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${sourceColors[doc.source] || ''}`}>
                      {sourceLabels[doc.source] || doc.source}: {doc.sourceName}
                    </span>
                    <span>{formatFileSize(doc.size)}</span>
                    <span>•</span>
                    <span>{formatDate(doc.uploadedAt)}</span>
                    {doc.category && (
                      <>
                        <span>•</span>
                        <span className="capitalize">{doc.category}</span>
                      </>
                    )}
                  </div>
                  {doc.description && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">{doc.description}</p>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(doc.url, '_blank')}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SiteAccessManager({ siteId }: { siteId: string }) {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<'READ' | 'WRITE'>('READ');

  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER';

  const { data: accessList = [], isLoading } = useQuery<UserSiteAccess[]>({
    queryKey: ['site-access', siteId],
    queryFn: () => siteAccessApi.listBySite(siteId),
    enabled: isAdmin,
  });

  const { data: allUsers = [] } = useQuery<UserType[]>({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll(),
    enabled: isAdmin && showAddDialog,
  });

  // Filter out users that already have access
  const availableUsers = allUsers.filter(
    (u) => !accessList.some((a) => a.userId === u.id)
  );

  const grantMutation = useMutation({
    mutationFn: (data: { userId: string; siteId: string; accessLevel: 'READ' | 'WRITE' }) =>
      siteAccessApi.grant(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-access', siteId] });
      showToast.success('Accès accordé avec succès');
      setShowAddDialog(false);
      setSelectedUserId('');
      setSelectedAccessLevel('READ');
    },
    onError: () => {
      showToast.error("Erreur lors de l'attribution de l'accès");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, accessLevel }: { id: string; accessLevel: 'READ' | 'WRITE' }) =>
      siteAccessApi.update(id, { accessLevel }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-access', siteId] });
      showToast.success('Niveau d\'accès mis à jour');
    },
    onError: () => {
      showToast.error('Erreur lors de la mise à jour');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (accessId: string) => siteAccessApi.revoke(accessId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-access', siteId] });
      showToast.success('Accès révoqué');
    },
    onError: () => {
      showToast.error("Erreur lors de la révocation de l'accès");
    },
  });

  const handleGrant = () => {
    if (!selectedUserId) return;
    grantMutation.mutate({
      userId: selectedUserId,
      siteId,
      accessLevel: selectedAccessLevel,
    });
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Lock className="h-8 w-8 mx-auto mb-2" />
          Seuls les administrateurs et managers peuvent gérer les accès.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Droits d'accès ({accessList.length})
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Les administrateurs et managers ont accès à tous les chantiers. Les techniciens et observateurs nécessitent un accès explicite.
            </p>
          </div>
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Ajouter un accès
          </Button>
        </CardHeader>
        <CardContent>
          {accessList.length > 0 ? (
            <div className="space-y-3">
              {accessList.map((access) => (
                <div
                  key={access.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{access.user?.name}</p>
                      <p className="text-xs text-muted-foreground">{access.user?.email}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {access.user?.role}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={access.accessLevel}
                      onValueChange={(value: 'READ' | 'WRITE') =>
                        updateMutation.mutate({ id: access.id, accessLevel: value })
                      }
                    >
                      <SelectTrigger className="w-[120px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="READ">
                          <span className="flex items-center gap-1">
                            <Lock className="h-3 w-3" /> Lecture
                          </span>
                        </SelectItem>
                        <SelectItem value="WRITE">
                          <span className="flex items-center gap-1">
                            <Unlock className="h-3 w-3" /> Écriture
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => revokeMutation.mutate(access.id)}
                      disabled={revokeMutation.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Shield className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">Aucun accès spécifique configuré</p>
              <p className="text-xs text-muted-foreground">
                Les administrateurs et managers ont accès à tous les chantiers par défaut.
                Ajoutez des accès pour les techniciens et observateurs.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Access Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un accès au chantier</DialogTitle>
            <DialogDescription>
              Sélectionnez un utilisateur et le niveau d'accès à accorder.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Utilisateur</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un utilisateur..." />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      <span className="flex items-center gap-2">
                        {u.name} <span className="text-muted-foreground text-xs">({u.email})</span>
                      </span>
                    </SelectItem>
                  ))}
                  {availableUsers.length === 0 && (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      Tous les utilisateurs ont déjà accès
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Niveau d'accès</label>
              <Select value={selectedAccessLevel} onValueChange={(v: 'READ' | 'WRITE') => setSelectedAccessLevel(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="READ">
                    <span className="flex items-center gap-2">
                      <Lock className="h-3 w-3" /> Lecture seule — peut consulter le chantier
                    </span>
                  </SelectItem>
                  <SelectItem value="WRITE">
                    <span className="flex items-center gap-2">
                      <Unlock className="h-3 w-3" /> Lecture/Écriture — peut modifier le chantier
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleGrant}
              disabled={!selectedUserId || grantMutation.isPending}
            >
              {grantMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Accorder l'accès
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress('D\u00e9marrage...');
    try {
      await exportSiteZip(id, (progress) => {
        setExportProgress(progress.step);
      });
      showToast.success('Export t\u00e9l\u00e9charg\u00e9 avec succ\u00e8s');
    } catch (error) {
      showToast.error("Erreur lors de l'export du chantier");
    } finally {
      setIsExporting(false);
      setExportProgress('');
    }
  };

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

  // Load site floor plans
  const { data: floorPlans = [] } = useQuery<FloorPlan[]>({
    queryKey: ['floor-plans', { siteId: id }],
    queryFn: () => floorPlansApi.getAll(id),
    enabled: !!id,
  });

  // Load tenant config for dynamic security reminders
  const { data: tenantConfig } = useQuery<{ config?: { securityReminders?: { id: string; text: string }[] } }>({
    queryKey: ['tenant-config'],
    queryFn: () => apiClient.get('/api/tenants/current'),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const securityReminders = tenantConfig?.config?.securityReminders ?? [
    { id: '1', text: "Badge d'accès obligatoire sur tous les chantiers" },
    { id: '2', text: 'Carte BTP à jour requise' },
    { id: '3', text: 'EPI obligatoires (casque, gilet, chaussures)' },
    { id: '4', text: 'Respecter les consignes affichées sur site' },
  ];

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
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isExporting}
            data-testid="export-site-btn"
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {exportProgress || 'Export...'}
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Exporter
              </>
            )}
          </Button>
          <Button variant="outline" asChild data-testid="edit-site-btn">
            <Link href={`/dashboard/sites/${id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Modifier
            </Link>
          </Button>
          <Button variant="destructive" onClick={() => setShowDeleteDialog(true)} data-testid="delete-site-btn">
            <Trash2 className="mr-2 h-4 w-4" />
            Supprimer
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info" className="w-full">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="info">Informations</TabsTrigger>
          <TabsTrigger value="assets">Équipements ({assets.length})</TabsTrigger>
          <TabsTrigger value="racks">Baies ({racks.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tâches ({tasks.length})</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="access">
            <Lock className="mr-1 h-3 w-3" />
            Accès
          </TabsTrigger>
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
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-amber-500 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="font-medium mb-1">Rappel sécurité chantier</p>
                        <ul className="text-xs space-y-1">
                          {securityReminders.map((reminder) => (
                            <li key={reminder.id}>• {reminder.text}</li>
                          ))}
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
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

          {/* Server / Production Info */}
          {site.metadata?.serverInfo && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5" />
                  Serveurs &amp; Données de production
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {site.metadata.serverInfo.smbPath && (
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <FolderOpen className="h-5 w-5 text-blue-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Partage SMB</p>
                        <p className="text-sm text-muted-foreground font-mono truncate">{site.metadata.serverInfo.smbPath}</p>
                      </div>
                    </div>
                  )}
                  {site.metadata.serverInfo.sharepointUrl && (
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <Globe className="h-5 w-5 text-blue-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">SharePoint</p>
                        <a
                          href={site.metadata.serverInfo.sharepointUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline truncate block"
                        >
                          {site.metadata.serverInfo.sharepointUrl}
                          <ExternalLink className="inline h-3 w-3 ml-1" />
                        </a>
                      </div>
                    </div>
                  )}
                  {site.metadata.serverInfo.gedUrl && (
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <FileText className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">GED</p>
                        <a
                          href={site.metadata.serverInfo.gedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline truncate block"
                        >
                          {site.metadata.serverInfo.gedUrl}
                          <ExternalLink className="inline h-3 w-3 ml-1" />
                        </a>
                      </div>
                    </div>
                  )}
                  {site.metadata.serverInfo.accessRightsUrl && (
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <Shield className="h-5 w-5 text-orange-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Droits d'accès serveur</p>
                        <a
                          href={site.metadata.serverInfo.accessRightsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline truncate block"
                        >
                          {site.metadata.serverInfo.accessRightsUrl}
                          <ExternalLink className="inline h-3 w-3 ml-1" />
                        </a>
                      </div>
                    </div>
                  )}
                  {site.metadata.serverInfo.notes && (
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <p className="text-sm text-muted-foreground">{site.metadata.serverInfo.notes}</p>
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

        <TabsContent value="documents" className="space-y-6">
          {/* Upload documents directly to site */}
          <Attachments
            entityId={id}
            entityType="sites"
            apiModule={sitesApi}
          />

          {/* Aggregated documents from all sources */}
          <AggregatedDocuments siteId={id} />
        </TabsContent>

        {/* Racks Tab */}
        <TabsContent value="racks">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Baies ({racks.length})
              </CardTitle>
              <Button asChild size="sm">
                <Link href={`/dashboard/racks/new?siteId=${id}`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nouvelle baie
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {racks.length > 0 ? (
                <div className="space-y-3">
                  {racks.map((rack) => (
                    <div
                      key={rack.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Server className="h-5 w-5 text-purple-500" />
                        <div>
                          <Link
                            href={`/dashboard/racks/${rack.id}`}
                            className="font-medium hover:underline"
                          >
                            {rack.name}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            {rack.heightU}U • {rack.assets?.length || 0} équipement(s)
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {rack.location && (
                          <Badge variant="outline" className="text-xs">{rack.location}</Badge>
                        )}
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/racks/${rack.id}`}>
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Server className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">Aucune baie sur ce chantier</p>
                  <Button asChild variant="outline">
                    <Link href={`/dashboard/racks/new?siteId=${id}`}>
                      <Plus className="mr-2 h-4 w-4" />
                      Ajouter une baie
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Access Tab */}
        <TabsContent value="access">
          <SiteAccessManager siteId={id} />
        </TabsContent>

        {/* Plans Tab */}
        <TabsContent value="plans">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Map className="h-5 w-5" />
                Plans d'étage ({floorPlans.length})
              </CardTitle>
              <Button asChild size="sm">
                <Link href={`/dashboard/floor-plans/new?siteId=${id}`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nouveau plan
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {floorPlans.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-4">
                  {floorPlans.map((plan) => (
                    <Link
                      key={plan.id}
                      href={`/dashboard/floor-plans/${plan.id}`}
                      className="block"
                    >
                      <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors hover:shadow-sm">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-medium">{plan.title}</h4>
                            <p className="text-sm text-muted-foreground">
                              {plan.building && `Bât. ${plan.building}`}
                              {plan.building && plan.floor && ' — '}
                              {plan.floor && `Étage ${plan.floor}`}
                              {!plan.building && !plan.floor && 'Plan principal'}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">v{plan.version}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {plan.pins?.length || 0} repères
                          </span>
                          {plan.fileSize && (
                            <span>{(plan.fileSize / 1024).toFixed(0)} KB</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Map className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">Aucun plan d'étage pour ce chantier</p>
                  <Button asChild variant="outline">
                    <Link href={`/dashboard/floor-plans/new?siteId=${id}`}>
                      <Plus className="mr-2 h-4 w-4" />
                      Ajouter un plan
                    </Link>
                  </Button>
                </div>
              )}
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
