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
import { ArrowLeft, MapPin, Edit, Trash2, Package, Phone, Mail, User, Users, Wifi, Globe, Shield, Clock, AlertTriangle, FileText, Download, Loader2, Map, Server, ExternalLink, HardDrive, FolderOpen, Search, Plus, Info, Lock, Unlock, UserPlus, X, Copy, Check } from 'lucide-react';
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
              Droits d&apos;accès ({accessList.length})
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Les administrateurs et managers ont accès à tous les chantiers. Les techniciens et observateurs nécessitent un accès explicite.
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
function SiteContactsGrid({ contacts }: { contacts: any[] }) {
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

  // Séparer contacts internes et externes
  const internalRoles = ['responsable', 'assistante', 'accueil', 'sécurité', 'chef de chantier', 'directeur', 'conducteur'];
  const isInternal = (c: any) => {
    const role = (c.role || '').toLowerCase();
    return internalRoles.some(r => role.includes(r)) || (!c.company && !role.includes('fournisseur') && !role.includes('sous-traitant') && !role.includes('prestataire') && !role.includes('opérateur'));
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
                    Contacts internes du chantier
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">Source : module Contacts</span>
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
                  <span className="text-xs text-muted-foreground">Source : module Contacts</span>
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

          {/* Si pas de séparation possible (tous dans un groupe), afficher en grille simple */}
          {internalContacts.length === 0 && externalContacts.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-5 w-5" />
                  Contacts ({filteredContacts.length})
                </CardTitle>
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
function SiteConnectivitySection({ connectivity }: { connectivity: Site['connectivity'] }) {
  if (!connectivity || (!connectivity.primary && !connectivity.backup)) return null;

  const ConnBlock = ({ conn, label, variant }: { conn: { type?: string; provider?: string; ref?: string }; label: string; variant: 'primary' | 'backup' }) => (
    <div className={`border rounded-lg p-4 ${variant === 'backup' ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
          {conn.provider && <p className="text-lg font-bold mt-0.5">{conn.provider}</p>}
          {conn.type && <p className="text-sm text-muted-foreground">{conn.type}</p>}
        </div>
        <Badge variant={variant === 'primary' ? 'success' : 'warning'}>
          {variant === 'primary' ? 'Actif' : 'Veille'}
        </Badge>
      </div>
      {conn.ref && (
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground font-medium">Référence ligne</p>
          <p className="text-sm font-mono mt-0.5">{conn.ref}</p>
        </div>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wifi className="h-5 w-5" />
          Connectivité
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          {connectivity.primary && (
            <ConnBlock conn={connectivity.primary} label="Lien primaire" variant="primary" />
          )}
          {connectivity.backup && (
            <ConnBlock conn={connectivity.backup} label="Lien backup" variant="backup" />
          )}
        </div>
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
function SiteResourcesSection({ serverInfo }: { serverInfo: any }) {
  if (!serverInfo) return null;

  const hasAny = serverInfo.smbPath || serverInfo.sharepointUrl || serverInfo.gedUrl || serverInfo.accessRightsUrl;
  if (!hasAny) return null;

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HardDrive className="h-5 w-5" />
          Ressources &amp; Partages
        </CardTitle>
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

// === Infos accès site ===
function SiteAccessInfoSection({ accessNotes, securityReminders }: { accessNotes: Site['accessNotes']; securityReminders: { id: string; text: string }[] }) {
  if (!accessNotes || (!accessNotes.schedules && !accessNotes.badges && !accessNotes.procedures && !accessNotes.safety)) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-5 w-5" />
          Accès au site
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
          {accessNotes.schedules && (
            <div className="flex items-start gap-2 bg-muted/50 rounded-lg p-3">
              <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Horaires</p>
                <p className="text-sm text-muted-foreground">{accessNotes.schedules}</p>
              </div>
            </div>
          )}
          {accessNotes.badges && (
            <div className="flex items-start gap-2 bg-muted/50 rounded-lg p-3">
              <Shield className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Badges</p>
                <p className="text-sm text-muted-foreground">{accessNotes.badges}</p>
              </div>
            </div>
          )}
          {accessNotes.procedures && (
            <div className="flex items-start gap-2 bg-muted/50 rounded-lg p-3">
              <Globe className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Procédures</p>
                <p className="text-sm text-muted-foreground">{accessNotes.procedures}</p>
              </div>
            </div>
          )}
          {accessNotes.safety && (
            <div className="flex items-start gap-2 bg-muted/50 rounded-lg p-3">
              <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Sécurité</p>
                <p className="text-sm text-muted-foreground">{accessNotes.safety}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
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
    { id: '1', text: "Badge d'acc\u00e8s obligatoire sur tous les chantiers" },
    { id: '2', text: 'Carte BTP \u00e0 jour requise' },
    { id: '3', text: 'EPI obligatoires (casque, gilet, chaussures)' },
    { id: '4', text: 'Respecter les consignes affich\u00e9es sur site' },
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
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="access">
            <Lock className="mr-1 h-3 w-3" />
            Accès
          </TabsTrigger>
        </TabsList>

        {/* ============================== */}
        {/* TAB: VUE GENERALE              */}
        {/* ============================== */}
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

        {/* ============================== */}
        {/* TAB: INFOS PRATIQUES           */}
        {/* ============================== */}
        {hasInfosPratiques && (
          <TabsContent value="infos-pratiques" className="space-y-6">
            {/* Ressources & Partages (bien visible en haut) */}
            <SiteResourcesSection serverInfo={site.metadata?.serverInfo} />

            {/* Contacts en grille de 3 */}
            <SiteContactsGrid contacts={site.contacts || []} />

            {/* Connectivité primary + backup côte à côte */}
            <SiteConnectivitySection connectivity={site.connectivity} />

            {/* Accès au site */}
            <SiteAccessInfoSection accessNotes={site.accessNotes} securityReminders={securityReminders} />
          </TabsContent>
        )}

        {/* ============================== */}
        {/* TAB: ÉQUIPEMENTS               */}
        {/* ============================== */}
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

        {/* ============================== */}
        {/* TAB: TÂCHES                    */}
        {/* ============================== */}
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
                Plans d&apos;étage ({floorPlans.length})
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
                  <p className="text-muted-foreground mb-4">Aucun plan d&apos;étage pour ce chantier</p>
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
