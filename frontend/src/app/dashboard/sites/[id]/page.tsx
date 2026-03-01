'use client';

import { use, useState, useMemo } from 'react';
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
import { sitesApi, type AuditLogEntry } from '@/lib/api/sites';
import { assetsApi } from '@/lib/api/assets';
import { racksApi } from '@/lib/api/racks';
import { tasksApi } from '@/lib/api/tasks';
import { floorPlansApi } from '@/lib/api/floor-plans';
import { siteAccessApi, type UserSiteAccess, type ResourcePermissions, type ResourcePermissionLevel } from '@/lib/api/site-access';
import { usersApi } from '@/lib/api/users';
import { useAuthStore } from '@/stores/auth-store';
import { usePermissions } from '@/hooks/usePermissions';
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
import { ArrowLeft, MapPin, Edit, Trash2, Package, Phone, Mail, User, Users, Wifi, Globe, Shield, Clock, AlertTriangle, FileText, Download, Loader2, Map, Server, ExternalLink, HardDrive, FolderOpen, Search, Plus, Info, Lock, Unlock, UserPlus, X, Copy, Check, ChevronDown, ChevronRight, Settings, History, ShieldAlert, Activity, Network } from 'lucide-react';
import Link from 'next/link';
import type { Site, Asset, Rack, Task, FloorPlan, User as UserType } from '@/types';
import { WarrantyBadge } from '@/components/ui/warranty-badge';
import { getWarrantyStatus, useWarrantyThresholds } from '@/lib/warranty';
import { useLiveMonitors } from '@/hooks/useLiveMonitors';

const healthStatusColors = {
  HEALTHY: 'success' as const,
  WARNING: 'warning' as const,
  CRITICAL: 'error' as const,
  UNKNOWN: 'secondary' as const,
};

const assetStatusColors: Record<string, 'success' | 'secondary' | 'warning' | 'error'> = {
  IN_SERVICE: 'success',
  OUT_OF_SERVICE: 'secondary',
  IN_TRANSIT: 'warning',
  STOCK: 'secondary',
  RETIRED: 'error',
};

const assetStatusLabels: Record<string, string> = {
  IN_SERVICE: 'En service',
  OUT_OF_SERVICE: 'Hors service',
  IN_TRANSIT: 'En transit',
  STOCK: 'En stock',
  RETIRED: 'Retiré',
};

const assetTypeLabels: Record<string, string> = {
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
          Tous les documents du site ({docs.length})
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

const RESOURCE_LABELS: Record<string, string> = {
  sites: 'Site',
  assets: 'Équipements',
  racks: 'Baies',
  tasks: 'Tâches',
  floorPlans: 'Plans',
  contacts: 'Contacts',
};

const RESOURCE_KEYS = ['sites', 'assets', 'racks', 'tasks', 'floorPlans', 'contacts'] as const;

function SiteAccessManager({ siteId }: { siteId: string }) {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<'READ' | 'WRITE'>('READ');
  const [expandedAccessId, setExpandedAccessId] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER';

  const { data: accessList = [], isLoading } = useQuery<UserSiteAccess[]>({
    queryKey: ['site-access', siteId],
    queryFn: () => siteAccessApi.listBySite(siteId),
    enabled: isAdmin,
  });

  const { data: allUsers = [] } = useQuery<UserType[]>({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll(),
    enabled: isAdmin,
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
    mutationFn: ({ id, accessLevel, resourcePermissions }: { id: string; accessLevel?: 'READ' | 'WRITE'; resourcePermissions?: ResourcePermissions }) =>
      siteAccessApi.update(id, { ...(accessLevel && { accessLevel }), ...(resourcePermissions !== undefined && { resourcePermissions }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-access', siteId] });
      showToast.success('Permissions mises à jour');
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

  const bulkGrantMutation = useMutation({
    mutationFn: (data: { userIds: string[]; siteId: string; accessLevel: 'READ' | 'WRITE' }) =>
      siteAccessApi.bulkGrant(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['site-access', siteId] });
      showToast.success(`Accès accordé à ${result.granted} utilisateur(s)`);
    },
    onError: () => {
      showToast.error("Erreur lors de l'attribution en masse");
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

  const handleGrantByRole = (role: string, accessLevel: 'READ' | 'WRITE') => {
    const usersOfRole = allUsers.filter((u) => u.role === role && !accessList.some((a) => a.userId === u.id));
    if (usersOfRole.length === 0) {
      showToast.error(`Tous les ${role === 'TECHNICIEN' ? 'techniciens' : 'observateurs'} ont déjà accès`);
      return;
    }
    bulkGrantMutation.mutate({
      userIds: usersOfRole.map((u) => u.id),
      siteId,
      accessLevel,
    });
  };

  if (!isAdmin) {
    return null;
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
              Droits d&apos;accès ({accessList.length})
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Les administrateurs et managers ont accès à tous les sites. Les techniciens et observateurs nécessitent un accès explicite.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleGrantByRole('TECHNICIEN', 'WRITE')}
              disabled={bulkGrantMutation.isPending}
            >
              {bulkGrantMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
              Tous les techniciens
            </Button>
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Ajouter
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {accessList.length > 0 ? (
            <div className="space-y-3">
              {accessList.map((access) => {
                const isExpanded = expandedAccessId === access.id;
                const resPerms = (access.resourcePermissions || {}) as ResourcePermissions;
                const hasCustomPerms = Object.keys(resPerms).length > 0;

                return (
                  <div key={access.id} className="border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
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
                        {hasCustomPerms && (
                          <Badge variant="secondary" className="text-xs">
                            <Settings className="h-3 w-3 mr-1" />
                            Personnalisé
                          </Badge>
                        )}
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
                          className="h-8 w-8"
                          onClick={() => setExpandedAccessId(isExpanded ? null : access.id)}
                          title="Permissions par ressource"
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
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

                    {/* Per-resource permissions panel */}
                    {isExpanded && (
                      <div className="border-t bg-muted/30 p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          Permissions par ressource (vide = hérite du niveau global)
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {RESOURCE_KEYS.map((resource) => {
                            const currentLevel = resPerms[resource] || '';
                            return (
                              <div key={resource} className="flex items-center gap-2">
                                <span className="text-xs font-medium w-20">{RESOURCE_LABELS[resource]}</span>
                                <Select
                                  value={currentLevel || 'inherit'}
                                  onValueChange={(value: string) => {
                                    const newPerms = { ...resPerms };
                                    if (value === 'inherit') {
                                      delete newPerms[resource];
                                    } else {
                                      newPerms[resource] = value as ResourcePermissionLevel;
                                    }
                                    updateMutation.mutate({
                                      id: access.id,
                                      resourcePermissions: newPerms,
                                    });
                                  }}
                                >
                                  <SelectTrigger className="h-7 text-xs flex-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="inherit">
                                      <span className="text-muted-foreground">— Hérité</span>
                                    </SelectItem>
                                    <SelectItem value="NONE">Aucun</SelectItem>
                                    <SelectItem value="READ">Lecture</SelectItem>
                                    <SelectItem value="WRITE">Écriture</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          })}
                        </div>
                        {hasCustomPerms && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 text-xs"
                            onClick={() => {
                              updateMutation.mutate({
                                id: access.id,
                                resourcePermissions: {},
                              });
                            }}
                          >
                            Réinitialiser les permissions
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Shield className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">Aucun accès spécifique configuré</p>
              <p className="text-xs text-muted-foreground">
                Les administrateurs et managers ont accès à tous les sites par défaut.
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
            <DialogTitle>Ajouter un accès au site</DialogTitle>
            <DialogDescription>
              Sélectionnez un utilisateur et le niveau d&apos;accès à accorder.
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
              <label className="text-sm font-medium">Niveau d&apos;accès</label>
              <Select value={selectedAccessLevel} onValueChange={(v: 'READ' | 'WRITE') => setSelectedAccessLevel(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="READ">
                    <span className="flex items-center gap-2">
                      <Lock className="h-3 w-3" /> Lecture seule — peut consulter le site
                    </span>
                  </SelectItem>
                  <SelectItem value="WRITE">
                    <span className="flex items-center gap-2">
                      <Unlock className="h-3 w-3" /> Lecture/Écriture — peut modifier le site
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
              Accorder l&apos;accès
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CopyableField({ icon, label, value, isUrl }: { icon: React.ReactNode; label: string; value: string; isUrl?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg group">
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {isUrl ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline break-all block"
          >
            {value}
            <ExternalLink className="inline h-3 w-3 ml-1" />
          </a>
        ) : (
          <p className="text-sm text-muted-foreground font-mono break-all select-all cursor-text">{value}</p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        onClick={handleCopy}
        title="Copier dans le presse-papier"
      >
        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

// === Contacts en grille de 3 ===
function SiteContactsGrid({ contacts, siteId }: { contacts: any[]; siteId: string }) {
  const [contactSearch, setContactSearch] = useState('');

  if (!contacts || contacts.length === 0) return null;

  const filteredContacts = contactSearch.trim()
    ? contacts.filter((c) => {
        const q = contactSearch.toLowerCase();
        return (
          c.name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          c.role?.toLowerCase().includes(q) ||
          c.company?.toLowerCase().includes(q)
        );
      })
    : contacts;

  // Séparer contacts internes et externes via le champ category (si dispo) ou fallback par rôle
  const internalCategories = ['INTERNAL', 'EMERGENCY'];
  const externalCategories = ['PROVIDER', 'PARTNER', 'TECHNICAL'];

  const isInternal = (c: any) => {
    // 1) Si category est défini, l'utiliser
    if (c.category) return internalCategories.includes(c.category);
    // 2) Fallback : deviner par le rôle/company
    const role = (c.role || '').toLowerCase();
    const hasExternalMarkers = c.company || role.includes('fournisseur') || role.includes('sous-traitant') || role.includes('prestataire') || role.includes('opérateur');
    return !hasExternalMarkers;
  };

  const internalContacts = filteredContacts.filter(isInternal);
  const externalContacts = filteredContacts.filter(c => !isInternal(c));

  const ContactCard = ({ contact }: { contact: any }) => (
    <div className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-2">
        {contact.role && (
          <Badge variant={contact.isPrimary ? 'default' : 'outline'} className="text-xs">
            {contact.role}
          </Badge>
        )}
        {contact.isPrimary && !contact.role && (
          <Badge variant="default" className="text-xs">Principal</Badge>
        )}
      </div>
      <p className="font-semibold mt-1">{contact.name}</p>
      {contact.company && (
        <p className="text-sm text-muted-foreground">{contact.company}</p>
      )}
      <div className="mt-3 space-y-1">
        {contact.phone && (
          <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
            <Phone className="h-3.5 w-3.5" />
            {contact.phone}
          </a>
        )}
        {contact.email && (
          <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
            <Mail className="h-3.5 w-3.5" />
            {contact.email}
          </a>
        )}
      </div>
    </div>
  );

  const editLink = `/dashboard/sites/${siteId}/edit?step=3`;

  return (
    <div className="space-y-6">
      {/* Barre de recherche si beaucoup de contacts */}
      {contacts.length > 4 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un contact (nom, email, rôle...)"
            value={contactSearch}
            onChange={(e) => setContactSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      )}

      {filteredContacts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Aucun contact ne correspond à &laquo; {contactSearch} &raquo;
        </p>
      ) : (
        <>
          {/* Contacts internes */}
          {internalContacts.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-5 w-5" />
                    Contacts internes du site
                  </CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={editLink}><Edit className="h-3.5 w-3.5" /></Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  {internalContacts.map((contact, index) => (
                    <ContactCard key={index} contact={contact} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contacts externes */}
          {externalContacts.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Globe className="h-5 w-5" />
                    Contacts externes / IT Partenaires
                  </CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={editLink}><Edit className="h-3.5 w-3.5" /></Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  {externalContacts.map((contact, index) => (
                    <ContactCard key={index} contact={contact} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Si tous les contacts n'ont pas de catégorie et pas de company → afficher en grille simple */}
          {internalContacts.length === 0 && externalContacts.length === 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <User className="h-5 w-5" />
                    Contacts ({filteredContacts.length})
                  </CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={editLink}><Edit className="h-3.5 w-3.5" /></Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  {filteredContacts.map((contact, index) => (
                    <ContactCard key={index} contact={contact} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// === Connectivité côte à côte ===
function SiteConnectivitySection({ connectivity, siteId, assets }: { connectivity: Site['connectivity']; siteId: string; assets?: Asset[] }) {
  // Support both V1 and V2 formats
  const hasV2Links = connectivity && Array.isArray(connectivity.links) && connectivity.links.length > 0;
  const hasV1 = connectivity && (connectivity.primary || connectivity.backup);

  if (!connectivity || (!hasV2Links && !hasV1)) return null;

  // Normalize to links array for display
  const links = hasV2Links
    ? connectivity.links!
    : [
        ...(connectivity.primary ? [{ id: 'v1-primary', role: 'primary' as const, ...connectivity.primary }] : []),
        ...(connectivity.backup ? [{ id: 'v1-backup', role: 'backup' as const, ...connectivity.backup }] : []),
      ];

  const sdwan = connectivity.sdwan;

  const getAssetName = (assetId?: string) => {
    if (!assetId || !assets) return null;
    const asset = assets.find(a => a.id === assetId);
    return asset ? (asset.name || `${asset.type} ${asset.model || ''}`.trim()) : null;
  };

  const statusColor = (status?: string) => {
    if (status === 'up') return 'bg-green-500';
    if (status === 'down') return 'bg-red-500';
    return 'bg-gray-400';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wifi className="h-5 w-5" />
            Connectivité
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/sites/${siteId}/edit?step=2`}><Edit className="h-3.5 w-3.5" /></Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          {links.map((link) => (
            <div key={link.id} className={`border rounded-lg p-4 ${link.role === 'backup' ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                      Lien {link.role === 'primary' ? 'primaire' : 'backup'}
                    </p>
                    {(link as any).status && (
                      <span className={`inline-block w-2 h-2 rounded-full ${statusColor((link as any).status)}`} title={(link as any).status} />
                    )}
                  </div>
                  {link.provider && <p className="text-lg font-bold mt-0.5">{link.provider}</p>}
                  {link.type && <p className="text-sm text-muted-foreground">{link.type}</p>}
                </div>
                <Badge variant={link.role === 'primary' ? 'success' : 'warning'}>
                  {link.role === 'primary' ? 'Actif' : 'Veille'}
                </Badge>
              </div>
              <div className="space-y-2">
                {link.ref && (
                  <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-xs text-muted-foreground font-medium">Référence</p>
                    <p className="text-sm font-mono mt-0.5">{link.ref}</p>
                  </div>
                )}
                {(link as any).bandwidth && (
                  <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-xs text-muted-foreground font-medium">Bande passante</p>
                    <p className="text-sm mt-0.5">{(link as any).bandwidth}</p>
                  </div>
                )}
                {(link as any).assetId && getAssetName((link as any).assetId) && (
                  <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-xs text-muted-foreground font-medium">Équipement</p>
                    <Link href={`/dashboard/assets/${(link as any).assetId}`} className="text-sm text-blue-600 hover:underline mt-0.5 inline-block">
                      {getAssetName((link as any).assetId)}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* SD-WAN section */}
        {sdwan?.enabled && (
          <div className="border rounded-lg p-4 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4" />
                <p className="text-sm font-semibold">SD-WAN</p>
                {sdwan.status && (
                  <span className={`inline-block w-2 h-2 rounded-full ${statusColor(sdwan.status)}`} title={sdwan.status} />
                )}
              </div>
              {sdwan.firewallIds?.length === 2 && (
                <Badge variant="outline" className="text-xs">HA</Badge>
              )}
            </div>
            {sdwan.provider && <p className="text-sm text-muted-foreground">{sdwan.provider}</p>}
            {sdwan.firewallIds && sdwan.firewallIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {sdwan.firewallIds.map(fwId => {
                  const name = getAssetName(fwId);
                  return name ? (
                    <Link key={fwId} href={`/dashboard/assets/${fwId}`}>
                      <Badge variant="secondary" className="text-xs hover:bg-secondary/80 cursor-pointer">{name}</Badge>
                    </Link>
                  ) : null;
                })}
              </div>
            )}
          </div>
        )}

        {connectivity.cutProcedure && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm font-medium flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
              <AlertTriangle className="h-4 w-4" />
              Procédure en cas de coupure
            </p>
            <p className="text-sm mt-1 text-yellow-700 dark:text-yellow-300">{connectivity.cutProcedure}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// === Ressources & Partages (bien visible en haut) ===
function SiteResourcesSection({ serverInfo, siteId }: { serverInfo: any; siteId: string }) {
  if (!serverInfo) return null;

  const hasAny = serverInfo.smbPath || serverInfo.sharepointUrl || serverInfo.gedUrl || serverInfo.accessRightsUrl;
  if (!hasAny) return null;

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDrive className="h-5 w-5" />
            Ressources &amp; Partages
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/sites/${siteId}/edit?step=3`}><Edit className="h-3.5 w-3.5" /></Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-3">
          {serverInfo.smbPath && (
            <CopyableField
              icon={<FolderOpen className="h-5 w-5 text-blue-500 flex-shrink-0" />}
              label="Partage réseau (SMB)"
              value={serverInfo.smbPath}
            />
          )}
          {serverInfo.sharepointUrl && (
            <CopyableField
              icon={<Globe className="h-5 w-5 text-blue-600 flex-shrink-0" />}
              label="SharePoint"
              value={serverInfo.sharepointUrl}
              isUrl
            />
          )}
          {serverInfo.gedUrl && (
            <CopyableField
              icon={<FileText className="h-5 w-5 text-green-600 flex-shrink-0" />}
              label="GED"
              value={serverInfo.gedUrl}
              isUrl
            />
          )}
          {serverInfo.accessRightsUrl && (
            <CopyableField
              icon={<Shield className="h-5 w-5 text-orange-500 flex-shrink-0" />}
              label="Droits d'accès serveur"
              value={serverInfo.accessRightsUrl}
              isUrl
            />
          )}
        </div>
        {serverInfo.notes && (
          <div className="mt-3 p-3 bg-muted/30 rounded-lg">
            <p className="text-sm text-muted-foreground">{serverInfo.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// === Infos accès site (compact, collapsible) ===
function SiteAccessInfoSection({ accessNotes, securityReminders, siteId }: { accessNotes: Site['accessNotes']; securityReminders: { id: string; text: string }[]; siteId: string }) {
  const [expanded, setExpanded] = useState(false);

  if (!accessNotes || (!accessNotes.schedules && !accessNotes.badges && !accessNotes.procedures && !accessNotes.safety)) return null;

  // Résumé compact : horaires + badges en une ligne
  const summaryParts: string[] = [];
  if (accessNotes.schedules) summaryParts.push(`🕐 ${accessNotes.schedules}`);
  if (accessNotes.badges) summaryParts.push(`🪪 ${accessNotes.badges}`);

  return (
    <div className="border rounded-lg bg-muted/20">
      {/* Header compact cliquable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors rounded-lg text-left"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Shield className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-medium">Accès au site</span>
          {!expanded && summaryParts.length > 0 && (
            <span className="text-xs text-muted-foreground truncate">
              — {summaryParts.join(' · ')}
            </span>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-amber-500 cursor-help flex-shrink-0" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="font-medium mb-1">Rappel sécurité site</p>
                <ul className="text-xs space-y-1">
                  {securityReminders.map((reminder) => (
                    <li key={reminder.id}>• {reminder.text}</li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" size="sm" asChild onClick={(e) => e.stopPropagation()}>
            <Link href={`/dashboard/sites/${siteId}/edit?step=3`}><Edit className="h-3.5 w-3.5" /></Link>
          </Button>
          <svg
            className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Contenu déplié */}
      {expanded && (
        <div className="px-4 pb-4 pt-1">
          <div className="grid md:grid-cols-2 gap-3">
            {accessNotes.schedules && (
              <div className="flex items-start gap-2 bg-background rounded-lg p-2.5 border">
                <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium">Horaires</p>
                  <p className="text-xs text-muted-foreground">{accessNotes.schedules}</p>
                </div>
              </div>
            )}
            {accessNotes.badges && (
              <div className="flex items-start gap-2 bg-background rounded-lg p-2.5 border">
                <Shield className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium">Badges</p>
                  <p className="text-xs text-muted-foreground">{accessNotes.badges}</p>
                </div>
              </div>
            )}
            {accessNotes.procedures && (
              <div className="flex items-start gap-2 bg-background rounded-lg p-2.5 border">
                <Globe className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium">Procédures</p>
                  <p className="text-xs text-muted-foreground">{accessNotes.procedures}</p>
                </div>
              </div>
            )}
            {accessNotes.safety && (
              <div className="flex items-start gap-2 bg-background rounded-lg p-2.5 border">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium">Sécurité</p>
                  <p className="text-xs text-muted-foreground">{accessNotes.safety}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  const [activeTab, setActiveTab] = useState('info');
  const [taskSearch, setTaskSearch] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('all');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<string>('all');
  const [assetWarrantyFilter, setAssetWarrantyFilter] = useState<string>('all');
  const warrantyThresholds = useWarrantyThresholds();
  const { canUpdate, canDelete } = usePermissions();
  const { statusMap: monitorStatusMap } = useLiveMonitors();

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress('Démarrage...');
    try {
      await exportSiteZip(id, (progress) => {
        setExportProgress(progress.step);
      });
      showToast.success('Export téléchargé avec succès');
    } catch (error) {
      showToast.error("Erreur lors de l'export du site");
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

  // Enrich health breakdown components with live monitor data
  const liveHealthComponents = useMemo(() => {
    const hb = site?.metadata?.healthBreakdown;
    if (!hb?.components?.length) return [];
    return hb.components.map((comp: any) => {
      if (comp.monitorName && monitorStatusMap[comp.monitorName] !== undefined) {
        return { ...comp, status: monitorStatusMap[comp.monitorName] };
      }
      return comp;
    });
  }, [site?.metadata?.healthBreakdown, monitorStatusMap]);

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

  // Compute latest version per plan group (for display in Plans tab)
  const latestFloorPlans = useMemo(() => {
    const grouped: Record<string, any> = {};
    floorPlans.forEach((plan: any) => {
      const groupKey = plan.planGroupId || plan.id;
      const existing = grouped[groupKey];
      if (!existing || (plan.version || 1) > (existing.version || 1)) {
        grouped[groupKey] = plan;
      }
    });
    return Object.values(grouped);
  }, [floorPlans]);

  // Load site attachments count
  const { data: siteAttachments = [] } = useQuery<any[]>({
    queryKey: ['sites', id, 'attachments'],
    queryFn: () => sitesApi.listAttachments(id),
    enabled: !!id,
  });

  // Audit history (lazy-loaded when tab is active)
  const { data: auditHistory = [] } = useQuery<AuditLogEntry[]>({
    queryKey: ['sites', id, 'history'],
    queryFn: () => sitesApi.getHistory(id),
    enabled: !!id && activeTab === 'history',
  });

  // Load tenant config for dynamic security reminders
  const { data: tenantConfig } = useQuery<{ config?: { securityReminders?: { id: string; text: string }[] } }>({
    queryKey: ['tenant-config'],
    queryFn: () => apiClient.get('/api/tenants/current'),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const securityReminders = tenantConfig?.config?.securityReminders ?? [
    { id: '1', text: "Badge d'accès obligatoire sur tous les sites" },
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
    return <div className="text-center py-12">Site non trouvé</div>;
  }

  // Déterminer si on a du contenu pour l'onglet Infos pratiques
  const hasServerInfo = site.metadata?.serverInfo && (site.metadata.serverInfo.smbPath || site.metadata.serverInfo.sharepointUrl || site.metadata.serverInfo.gedUrl || site.metadata.serverInfo.accessRightsUrl);
  const hasContacts = site.contacts && site.contacts.length > 0;
  const hasConnectivity = site.connectivity && (site.connectivity.primary || site.connectivity.backup);
  const hasAccessNotes = site.accessNotes && (site.accessNotes.schedules || site.accessNotes.badges || site.accessNotes.procedures || site.accessNotes.safety);
  const hasInfosPratiques = hasServerInfo || hasContacts || hasConnectivity || hasAccessNotes;

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
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{site.name}</h1>
              <Badge variant={healthStatusColors[site.healthStatus]}>
                {site.healthStatus}
              </Badge>
            </div>
            <p className="text-muted-foreground">{site.code}</p>
            {site.address && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3.5 w-3.5" />
                {site.address}{site.postalCode ? `, ${site.postalCode}` : ''}{site.city ? ` ${site.city}` : ''}
              </p>
            )}
            {/* Badges référents */}
            {site.metadata?.referents && (
              <div className="flex gap-3 mt-2 flex-wrap">
                {site.metadata.referents.it && (
                  <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/30 px-3 py-1.5 rounded-lg">
                    <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white">
                      {site.metadata.referents.it.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground leading-none">Référent IT</p>
                      <p className="text-sm font-semibold leading-tight">{site.metadata.referents.it}</p>
                    </div>
                  </div>
                )}
                {site.metadata.referents.pm && (
                  <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 rounded-lg">
                    <div className="h-7 w-7 rounded-full bg-amber-600 flex items-center justify-center text-xs font-bold text-white">
                      {site.metadata.referents.pm.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground leading-none">Chef de Projet</p>
                      <p className="text-sm font-semibold leading-tight">{site.metadata.referents.pm}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
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
          {canUpdate('sites', id) && (
            <Button variant="outline" asChild data-testid="edit-site-btn">
              <Link href={`/dashboard/sites/${id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Modifier
              </Link>
            </Button>
          )}
          {canDelete('sites', id) && (
            <Button variant="destructive" onClick={() => setShowDeleteDialog(true)} data-testid="delete-site-btn">
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="info">Vue générale</TabsTrigger>
          {hasInfosPratiques && (
            <TabsTrigger value="infos-pratiques">
              <Info className="mr-1 h-3 w-3" />
              Infos pratiques
            </TabsTrigger>
          )}
          <TabsTrigger value="assets">Équipements ({assets.length})</TabsTrigger>
          <TabsTrigger value="racks">Baies ({racks.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tâches ({tasks.length})</TabsTrigger>
          <TabsTrigger value="plans">Plans ({latestFloorPlans.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({siteAttachments.length})</TabsTrigger>
          <TabsTrigger value="access">
            <Lock className="mr-1 h-3 w-3" />
            Accès
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-1 h-3 w-3" />
            Historique
          </TabsTrigger>
        </TabsList>

        {/* ============================== */}
        {/* TAB: VUE GENERALE              */}
        {/* ============================== */}
        <TabsContent value="info" className="space-y-6">
          {/* Alertes critiques */}
          {(() => {
            const blockedTasks = tasks.filter(t => t.status === 'BLOCKED');
            const urgentTasks = tasks.filter(t => t.priority === 'URGENT' && t.status !== 'DONE' && t.status !== 'CANCELLED');
            const overdueTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE' && t.status !== 'CANCELLED');
            const brokenAssets = assets.filter(a => a.status === 'OUT_OF_SERVICE');
            const totalAlerts = blockedTasks.length + urgentTasks.length + overdueTasks.length + brokenAssets.length;

            if (totalAlerts === 0) return null;

            return (
              <div className="space-y-2">
                {blockedTasks.length > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-red-800 dark:text-red-200">
                        {blockedTasks.length} tâche{blockedTasks.length > 1 ? 's' : ''} bloquée{blockedTasks.length > 1 ? 's' : ''}
                      </span>
                      <span className="text-xs text-red-600 dark:text-red-300 ml-2">
                        {blockedTasks.slice(0, 2).map(t => t.title).join(', ')}{blockedTasks.length > 2 ? '…' : ''}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" className="text-red-700 hover:text-red-800 flex-shrink-0" onClick={() => setActiveTab('tasks')}>
                        Voir
                    </Button>
                  </div>
                )}
                {urgentTasks.length > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-orange-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
                        {urgentTasks.length} tâche{urgentTasks.length > 1 ? 's' : ''} urgente{urgentTasks.length > 1 ? 's' : ''}
                      </span>
                      <span className="text-xs text-orange-600 dark:text-orange-300 ml-2">
                        {urgentTasks.slice(0, 2).map(t => t.title).join(', ')}{urgentTasks.length > 2 ? '…' : ''}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" className="text-orange-700 hover:text-orange-800 flex-shrink-0" onClick={() => setActiveTab('tasks')}>
                        Voir
                    </Button>
                  </div>
                )}
                {overdueTasks.length > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <Clock className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        {overdueTasks.length} tâche{overdueTasks.length > 1 ? 's' : ''} en retard
                      </span>
                      <span className="text-xs text-amber-600 dark:text-amber-300 ml-2">
                        {overdueTasks.slice(0, 2).map(t => t.title).join(', ')}{overdueTasks.length > 2 ? '…' : ''}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" className="text-amber-700 hover:text-amber-800 flex-shrink-0" onClick={() => setActiveTab('tasks')}>
                        Voir
                    </Button>
                  </div>
                )}
                {brokenAssets.length > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg">
                    <Package className="h-4 w-4 text-purple-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-purple-800 dark:text-purple-200">
                        {brokenAssets.length} équipement{brokenAssets.length > 1 ? 's' : ''} hors service
                      </span>
                      <span className="text-xs text-purple-600 dark:text-purple-300 ml-2">
                        {brokenAssets.slice(0, 2).map(a => `${a.manufacturer} ${a.model}`).join(', ')}{brokenAssets.length > 2 ? '…' : ''}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" className="text-purple-700 hover:text-purple-800 flex-shrink-0" onClick={() => setActiveTab('assets')}>
                        Voir
                    </Button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* État de santé du site */}
          {(() => {
            const hb = site.metadata?.healthBreakdown;
            const hs = site.healthStatus as string;
            // Warranty alerts for this site's assets
            const warrantyAlerts = assets.filter(a => {
              const ws = getWarrantyStatus(a.warrantyEnd, warrantyThresholds);
              return ws === 'expired' || ws === 'expiring_critical' || ws === 'expiring_warning';
            });
            // Monitoring info from assets (live status)
            const monitoredAssets = assets.filter(a => (a.networkInfo as any)?.monitorName);
            const liveDownAssets = monitoredAssets.filter(a => {
              const mn = (a.networkInfo as any)?.monitorName;
              const liveStatus = mn && monitorStatusMap[mn] !== undefined ? monitorStatusMap[mn] : (a.networkInfo as any)?.monitorStatus;
              return liveStatus === 'down';
            });
            const liveUpAssets = monitoredAssets.length - liveDownAssets.length;

            const hasHealthData = liveHealthComponents.length > 0 || warrantyAlerts.length > 0 || monitoredAssets.length > 0;
            if (!hasHealthData && hs === 'UNKNOWN') return null;

            const borderColor = hs === 'CRITICAL' ? 'border-l-red-500' :
                                hs === 'WARNING' ? 'border-l-amber-500' :
                                hs === 'HEALTHY' ? 'border-l-green-500' : 'border-l-gray-400';
            const statusLabel = hs === 'CRITICAL' ? 'Critique' :
                                hs === 'WARNING' ? 'Attention' :
                                hs === 'HEALTHY' ? 'Sain' : 'Inconnu';
            const statusBadgeVariant = healthStatusColors[site.healthStatus] || 'secondary';

            return (
              <Card className={`border-l-4 ${borderColor}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      État de santé
                      <Badge variant={statusBadgeVariant}>{statusLabel}</Badge>
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setActiveTab('infos-pratiques')} className="text-xs text-muted-foreground">
                      Détails
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Health breakdown components (live enriched) */}
                  {liveHealthComponents.length > 0 && (
                    <div className="space-y-1.5">
                      {liveHealthComponents.slice(0, 5).map((comp: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className={`inline-block w-2 h-2 rounded-full ${
                              comp.status === 'up' ? 'bg-green-500' :
                              comp.status === 'down' ? 'bg-red-500 animate-pulse' : 'bg-gray-400'
                            }`} />
                            <span className="text-foreground">{comp.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {comp.type === 'link' ? (comp.role === 'primary' ? 'Lien pri.' : 'Backup') :
                               comp.type === 'sdwan' ? 'SD-WAN' : 'Équip.'}
                            </span>
                          </div>
                          {comp.impact !== 'none' && (
                            <span className={`text-xs font-medium ${
                              comp.impact === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
                            }`}>
                              {comp.impact === 'critical' ? 'Critique' : 'Attention'}
                            </span>
                          )}
                        </div>
                      ))}
                      {liveHealthComponents.length > 5 && (
                        <p className="text-xs text-muted-foreground">+{liveHealthComponents.length - 5} autre{liveHealthComponents.length - 5 > 1 ? 's' : ''}</p>
                      )}
                    </div>
                  )}

                  {/* Monitoring summary (live) */}
                  {monitoredAssets.length > 0 && (
                    <div className="flex items-center gap-3 text-sm">
                      <Network className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Monitoring :</span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
                        {liveUpAssets} UP
                      </span>
                      {liveDownAssets.length > 0 && (
                        <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          {liveDownAssets.length} DOWN
                        </span>
                      )}
                    </div>
                  )}

                  {/* Warranty alerts */}
                  {warrantyAlerts.length > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-amber-500" />
                        <span className="text-muted-foreground">
                          {warrantyAlerts.length} équipement{warrantyAlerts.length > 1 ? 's' : ''} avec alerte garantie
                        </span>
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setActiveTab('assets')}>
                        Voir
                      </Button>
                    </div>
                  )}

                  {/* Last check timestamp */}
                  {hb?.timestamp && (
                    <p className="text-xs text-muted-foreground pt-1 border-t">
                      Dernière vérification : {new Date(hb.timestamp).toLocaleString('fr-FR')}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {/* Synthèse rapide : contact principal + horaires */}
          {(() => {
            const primaryContact = (site.contacts || []).find((c: any) => c.isPrimary) || (site.contacts || [])[0];
            const schedules = site.accessNotes?.schedules;
            if (!primaryContact && !schedules) return null;

            return (
              <div className="grid md:grid-cols-2 gap-4">
                {primaryContact && (
                  <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Contact principal</p>
                      <p className="text-sm font-semibold truncate">{primaryContact.name}</p>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        {primaryContact.phone && (
                          <a href={`tel:${primaryContact.phone}`} className="hover:text-primary">{primaryContact.phone}</a>
                        )}
                        {primaryContact.email && (
                          <a href={`mailto:${primaryContact.email}`} className="hover:text-primary truncate">{primaryContact.email}</a>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {schedules && (
                  <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border">
                    <div className="h-9 w-9 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                      <Clock className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Horaires site</p>
                      <p className="text-sm font-semibold">{schedules}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Informations générales (compact) */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Informations générales</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/dashboard/sites/${id}/edit?step=1`}><Edit className="h-3.5 w-3.5" /></Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Code</label>
                  <p className="text-sm font-semibold">{site.code}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Statut</label>
                  <p className="text-sm font-semibold">{site.status}</p>
                </div>
                {site.city && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Ville</label>
                    <p className="text-sm font-semibold">{site.city}{site.postalCode ? ` (${site.postalCode})` : ''}</p>
                  </div>
                )}
                {(site.latitude && site.longitude) && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">GPS</label>
                    <p className="text-sm font-mono">{site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Statistiques */}
          <div className="grid md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{assets.length}</p>
                    <p className="text-xs text-muted-foreground">Équipements</p>
                  </div>
                  <Package className="h-8 w-8 text-muted-foreground/20" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{racks.length}</p>
                    <p className="text-xs text-muted-foreground">Baies</p>
                  </div>
                  <Server className="h-8 w-8 text-muted-foreground/20" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{activeTasks.length}</p>
                    <p className="text-xs text-muted-foreground">Tâches en cours</p>
                  </div>
                  <FileText className="h-8 w-8 text-muted-foreground/20" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{latestFloorPlans.length}</p>
                    <p className="text-xs text-muted-foreground">Plans</p>
                  </div>
                  <Map className="h-8 w-8 text-muted-foreground/20" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============================== */}
        {/* TAB: INFOS PRATIQUES           */}
        {/* ============================== */}
        {hasInfosPratiques && (
          <TabsContent value="infos-pratiques" className="space-y-6">
            {/* Ressources & Partages (bien visible en haut) */}
            <SiteResourcesSection serverInfo={site.metadata?.serverInfo} siteId={id} />

            {/* Contacts en grille de 3 */}
            <SiteContactsGrid contacts={site.contacts || []} siteId={id} />

            {/* Connectivité primary + backup côte à côte */}
            <SiteConnectivitySection connectivity={site.connectivity} siteId={id} assets={assets} />

            {/* Health Breakdown (live enriched) */}
            {liveHealthComponents.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-5 w-5" />
                    Détail santé du site
                    <Badge variant={healthStatusColors[site.healthStatus]} className="ml-2">
                      {site.healthStatus}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {liveHealthComponents.map((comp: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2">
                          <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                            comp.status === 'up' ? 'bg-green-500' : comp.status === 'down' ? 'bg-red-500 animate-pulse' : 'bg-gray-400'
                          }`} />
                          <span className="text-sm font-medium">{comp.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {comp.type === 'link' ? (comp.role === 'primary' ? 'Lien primaire' : 'Lien backup') :
                             comp.type === 'sdwan' ? 'SD-WAN' : 'Équipement'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {comp.impact !== 'none' && (
                            <Badge variant={comp.impact === 'critical' ? 'error' : 'warning'} className="text-xs">
                              {comp.impact === 'critical' ? 'Critique' : 'Attention'}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground uppercase">
                            {comp.status === 'up' ? 'OK' : comp.status === 'down' ? 'HS' : '?'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {site.metadata?.healthBreakdown?.timestamp && (
                    <p className="text-xs text-muted-foreground mt-3">
                      Dernière vérification : {new Date(site.metadata.healthBreakdown.timestamp).toLocaleString('fr-FR')}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Accès au site */}
            <SiteAccessInfoSection accessNotes={site.accessNotes} securityReminders={securityReminders} siteId={id} />
          </TabsContent>
        )}

        {/* ============================== */}
        {/* TAB: ÉQUIPEMENTS               */}
        {/* ============================== */}
        <TabsContent value="assets">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Équipements ({assets.length})</CardTitle>
              <Button asChild size="sm">
                <Link href={`/dashboard/assets/new?siteId=${id}`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nouvel équipement
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {assets.length > 0 ? (
                <div className="space-y-4">
                  {/* Filtre garantie */}
                  <div className="flex items-center gap-2">
                    <Select value={assetWarrantyFilter} onValueChange={setAssetWarrantyFilter}>
                      <SelectTrigger className="w-[220px]">
                        <ShieldAlert className="h-4 w-4 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="Garantie" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toutes garanties</SelectItem>
                        <SelectItem value="alert">⚠️ Alertes garantie</SelectItem>
                        <SelectItem value="expired">🔴 Expirée</SelectItem>
                        <SelectItem value="expiring_critical">🟠 Critique (&lt;30j)</SelectItem>
                        <SelectItem value="expiring_warning">🟡 Attention (&lt;90j)</SelectItem>
                        <SelectItem value="ok">✅ Valide</SelectItem>
                        <SelectItem value="none">— Sans garantie</SelectItem>
                      </SelectContent>
                    </Select>
                    {assetWarrantyFilter !== 'all' && (
                      <Button variant="ghost" size="sm" onClick={() => setAssetWarrantyFilter('all')}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="space-y-3">
                  {assets.filter((asset) => {
                    if (assetWarrantyFilter === 'all') return true;
                    const status = getWarrantyStatus(asset.warrantyEnd, warrantyThresholds);
                    if (assetWarrantyFilter === 'alert') return status === 'expired' || status === 'expiring_critical' || status === 'expiring_warning';
                    return status === assetWarrantyFilter;
                  }).map((asset) => (
                    <Link
                      key={asset.id}
                      href={`/dashboard/assets/${asset.id}`}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Package className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {asset.name || `${asset.manufacturer || ''} ${asset.model || ''}`.trim() || 'Équipement'}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {assetTypeLabels[asset.type] || asset.type}
                            {asset.serialNumber && ` • ${asset.serialNumber}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <WarrantyBadge warrantyEnd={asset.warrantyEnd} />
                        <Badge variant={assetStatusColors[asset.status] || 'secondary'}>
                          {assetStatusLabels[asset.status] || asset.status}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Aucun équipement sur ce site
                  </p>
                  <Button asChild variant="outline">
                    <Link href={`/dashboard/assets/new?siteId=${id}`}>
                      <Plus className="mr-2 h-4 w-4" />
                      Ajouter un équipement
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================== */}
        {/* TAB: TÂCHES                    */}
        {/* ============================== */}
        <TabsContent value="tasks">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Tâches ({tasks.length})</CardTitle>
              <Button asChild size="sm">
                <Link href={`/dashboard/tasks/new?siteId=${id}`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nouvelle tâche
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filtres */}
              {tasks.length > 0 && (
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher..."
                      value={taskSearch}
                      onChange={(e) => setTaskSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={taskStatusFilter} onValueChange={setTaskStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tous les statuts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les statuts</SelectItem>
                      <SelectItem value="TODO">À faire</SelectItem>
                      <SelectItem value="IN_PROGRESS">En cours</SelectItem>
                      <SelectItem value="BLOCKED">Bloqué</SelectItem>
                      <SelectItem value="DONE">Terminé</SelectItem>
                      <SelectItem value="CANCELLED">Annulé</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={taskPriorityFilter} onValueChange={setTaskPriorityFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Toutes les priorités" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les priorités</SelectItem>
                      <SelectItem value="LOW">Faible</SelectItem>
                      <SelectItem value="MEDIUM">Moyenne</SelectItem>
                      <SelectItem value="HIGH">Haute</SelectItem>
                      <SelectItem value="URGENT">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                  {(taskSearch || taskStatusFilter !== 'all' || taskPriorityFilter !== 'all') && (
                    <Button variant="ghost" onClick={() => { setTaskSearch(''); setTaskStatusFilter('all'); setTaskPriorityFilter('all'); }} className="flex items-center gap-2">
                      <X className="h-4 w-4" />
                      Effacer
                    </Button>
                  )}
                </div>
              )}

              {/* Liste filtrée */}
              {(() => {
                const filteredTasks = tasks.filter((task) => {
                  if (taskSearch) {
                    const s = taskSearch.toLowerCase();
                    if (!task.title.toLowerCase().includes(s) && !task.description?.toLowerCase().includes(s) && !task.assignedUser?.name?.toLowerCase().includes(s)) return false;
                  }
                  if (taskStatusFilter !== 'all' && task.status !== taskStatusFilter) return false;
                  if (taskPriorityFilter !== 'all' && task.priority !== taskPriorityFilter) return false;
                  return true;
                });

                const statusConfig: Record<string, { label: string; variant: 'secondary' | 'default' | 'error' | 'success' | 'warning' }> = {
                  TODO: { label: 'À faire', variant: 'secondary' },
                  IN_PROGRESS: { label: 'En cours', variant: 'default' },
                  BLOCKED: { label: 'Bloqué', variant: 'error' },
                  DONE: { label: 'Terminé', variant: 'success' },
                  CANCELLED: { label: 'Annulé', variant: 'secondary' },
                };
                const priorityConfig: Record<string, { label: string; variant: 'secondary' | 'default' | 'warning' | 'error' }> = {
                  LOW: { label: 'Faible', variant: 'secondary' },
                  MEDIUM: { label: 'Moyenne', variant: 'default' },
                  HIGH: { label: 'Haute', variant: 'warning' },
                  URGENT: { label: 'Urgente', variant: 'error' },
                };

                if (filteredTasks.length > 0) {
                  return (
                    <div className="space-y-3">
                      {(taskSearch || taskStatusFilter !== 'all' || taskPriorityFilter !== 'all') && (
                        <p className="text-xs text-muted-foreground">{filteredTasks.length} résultat{filteredTasks.length > 1 ? 's' : ''} sur {tasks.length}</p>
                      )}
                      {filteredTasks.map((task) => {
                        const sc = statusConfig[task.status] || { label: task.status, variant: 'secondary' as const };
                        const pc = priorityConfig[task.priority] || { label: task.priority, variant: 'secondary' as const };
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
                              <Badge variant={pc.variant}>{pc.label}</Badge>
                              <Badge variant={sc.variant}>{sc.label}</Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                } else if (tasks.length > 0) {
                  return (
                    <p className="text-center py-8 text-muted-foreground">
                      Aucune tâche ne correspond aux filtres
                    </p>
                  );
                } else {
                  return (
                    <p className="text-center py-12 text-muted-foreground">
                      Aucune tâche pour ce site
                    </p>
                  );
                }
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================== */}
        {/* TAB: DOCUMENTS                 */}
        {/* ============================== */}
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

        {/* ============================== */}
        {/* TAB: BAIES                     */}
        {/* ============================== */}
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
                  <p className="text-muted-foreground mb-4">Aucune baie sur ce site</p>
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

        {/* ============================== */}
        {/* TAB: ACCÈS                     */}
        {/* ============================== */}
        <TabsContent value="access">
          <SiteAccessManager siteId={id} />
        </TabsContent>

        {/* ============================== */}
        {/* TAB: PLANS                     */}
        {/* ============================== */}
        <TabsContent value="plans">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Map className="h-5 w-5" />
                Plans d&apos;étage ({latestFloorPlans.length})
              </CardTitle>
              <Button asChild size="sm">
                <Link href={`/dashboard/floor-plans/new?siteId=${id}`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nouveau plan
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {latestFloorPlans.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-4">
                  {latestFloorPlans.map((plan: any) => {
                    const groupKey = plan.planGroupId || plan.id;
                    const versionCount = floorPlans.filter((p: any) => (p.planGroupId || p.id) === groupKey).length;
                    return (
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
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="text-xs">v{plan.version}</Badge>
                              {versionCount > 1 && (
                                <Badge variant="secondary" className="text-xs">{versionCount} versions</Badge>
                              )}
                            </div>
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
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Map className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">Aucun plan d&apos;étage pour ce site</p>
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

        {/* ============================== */}
        {/* TAB: HISTORIQUE                 */}
        {/* ============================== */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Historique des modifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              {auditHistory.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">Aucune modification enregistrée</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {auditHistory.map((entry) => {
                    const actionLabels: Record<string, { label: string; color: string }> = {
                      CREATE: { label: 'Création', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
                      UPDATE: { label: 'Modification', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
                      DELETE: { label: 'Suppression', color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' },
                    };
                    const actionInfo = actionLabels[entry.action] || { label: entry.action, color: 'bg-gray-100 text-gray-800' };

                    const fieldLabels: Record<string, string> = {
                      name: 'Nom',
                      code: 'Code',
                      status: 'Statut',
                      address: 'Adresse',
                      city: 'Ville',
                      postalCode: 'Code postal',
                      country: 'Pays',
                      contacts: 'Contacts',
                      accessNotes: "Notes d'accès",
                      connectivity: 'Connectivité',
                      emplacements: 'Emplacements',
                      notes: 'Notes',
                      healthStatus: 'État de santé',
                      latitude: 'Latitude',
                      longitude: 'Longitude',
                      governanceDocsRef: 'Réf. documents',
                      metadata: 'Métadonnées',
                    };

                    const changedFields = entry.changes?.after ? Object.keys(entry.changes.after) : [];

                    return (
                      <div key={entry.id} className="flex gap-4 border-l-2 border-muted pl-4 pb-4 relative">
                        <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-muted-foreground" />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={actionInfo.color}>{actionInfo.label}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {new Date(entry.timestamp).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {entry.user && (
                              <span className="text-sm text-muted-foreground">
                                par <strong>{entry.user.name}</strong>
                              </span>
                            )}
                          </div>

                          {entry.action === 'UPDATE' && changedFields.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {changedFields.map((field) => {
                                const before = entry.changes?.before?.[field];
                                const after = entry.changes?.after?.[field];
                                const label = fieldLabels[field] || field;

                                // Skip complex objects (just show the field name)
                                if (typeof after === 'object' && after !== null) {
                                  return (
                                    <div key={field} className="text-xs text-muted-foreground">
                                      <span className="font-medium">{label}</span> modifié
                                    </div>
                                  );
                                }

                                return (
                                  <div key={field} className="text-xs text-muted-foreground">
                                    <span className="font-medium">{label}</span> :{' '}
                                    {before !== undefined && (
                                      <>
                                        <span className="line-through text-red-500/70">{String(before || '—')}</span>
                                        {' → '}
                                      </>
                                    )}
                                    <span className="text-foreground">{String(after || '—')}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {entry.action === 'CREATE' && (
                            <p className="text-xs text-muted-foreground">Site créé</p>
                          )}

                          {entry.action === 'DELETE' && (
                            <p className="text-xs text-muted-foreground">Site supprimé</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
              Êtes-vous sûr de vouloir supprimer le site &quot;{site.name}&quot; ?
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
