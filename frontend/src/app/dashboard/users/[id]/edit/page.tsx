// @ts-nocheck - Temporary fix for Radix UI + React 19 type incompatibility
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { usersApi } from '@/lib/api/users';
import {
  userScopesApi,
  accessGrantsApi,
  type UserScope,
  type AccessGrant,
  type ScopeType,
  type AccessScope,
  type ResourcePermissionLevel,
  type ResourcePermissions,
} from '@/lib/api/site-access';
import { organizationApi } from '@/lib/api/organization';
import { sitesApi } from '@/lib/api/sites';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, MapPin, Lock, Unlock, Info, X, Plus, Globe, Building2, Network, Pin, Shield, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import type { User, UserRole } from '@/types';

const userRoleLabels: Record<UserRole, string> = {
  ADMIN: 'Administrateur',
  MANAGER: 'Manager',
  TECHNICIEN: 'Technicien',
  VIEWER: 'Observateur',
};

const userSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères').optional().or(z.literal('')),
  role: z.enum(['ADMIN', 'MANAGER', 'TECHNICIEN', 'VIEWER']),
  phone: z.string().optional(),
  active: z.boolean().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

const SCOPE_TYPE_LABELS: Record<ScopeType, string> = {
  TENANT: 'Tout le tenant',
  DIVISION: 'Division',
  DELEGATION: 'Délégation',
  SITE: 'Site',
};

const SCOPE_TYPE_ICONS: Record<ScopeType, typeof Globe> = {
  TENANT: Globe,
  DIVISION: Building2,
  DELEGATION: Network,
  SITE: Pin,
};

const ACCESS_SCOPE_LABELS: Record<AccessScope, string> = {
  ALL_SITES: 'Tous les sites',
  DIVISION: 'Division',
  DELEGATION: 'Délégation',
  SITE: 'Site',
};

const RESOURCE_LABELS: Record<string, string> = {
  sites: 'Sites',
  assets: 'Assets',
  racks: 'Baies',
  tasks: 'Tâches',
  floorPlans: 'Plans',
  contacts: 'Contacts',
  monitoring: 'Monitoring',
  netbox: 'NetBox',
};

const PERM_LEVELS: ResourcePermissionLevel[] = ['NONE', 'READ', 'WRITE'];
const PERM_LEVEL_LABELS: Record<string, string> = {
  NONE: 'Aucun',
  READ: 'Lecture',
  WRITE: 'Écriture',
};

export default function EditUserPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = params.id as string;

  const [showDisable2FADialog, setShowDisable2FADialog] = useState(false);

  // State for adding scope/grant
  const [showAddScope, setShowAddScope] = useState(false);
  const [newScopeType, setNewScopeType] = useState<ScopeType>('SITE');
  const [newScopeTargetId, setNewScopeTargetId] = useState('');
  const [showAddGrant, setShowAddGrant] = useState(false);
  const [newGrantScope, setNewGrantScope] = useState<AccessScope>('ALL_SITES');
  const [newGrantScopeId, setNewGrantScopeId] = useState('');
  const [newGrantLabel, setNewGrantLabel] = useState('');
  const [newGrantExpiry, setNewGrantExpiry] = useState('');
  const [newGrantPerms, setNewGrantPerms] = useState<ResourcePermissions>({});

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ['user', userId],
    queryFn: () => usersApi.getById(userId),
  });

  // UserScopes
  const { data: userScopes = [] } = useQuery<UserScope[]>({
    queryKey: ['user-scopes', userId],
    queryFn: () => userScopesApi.getByUser(userId),
    enabled: !!userId,
  });

  // AccessGrants
  const { data: userGrants = [] } = useQuery<AccessGrant[]>({
    queryKey: ['access-grants', userId],
    queryFn: () => accessGrantsApi.getByUser(userId),
    enabled: !!userId,
  });

  // Org data for selectors
  const { data: orgTree } = useQuery({
    queryKey: ['organization-tree'],
    queryFn: () => organizationApi.getTree(),
  });

  const { data: allSites } = useQuery({
    queryKey: ['sites'],
    queryFn: () => sitesApi.getAll(),
  });

  // Mutations for scopes
  const addScopeMutation = useMutation({
    mutationFn: (data: { userId: string; scopeType: ScopeType; scopeId?: string }) =>
      userScopesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-scopes', userId] });
      setShowAddScope(false);
      setNewScopeTargetId('');
    },
  });

  const removeScopeMutation = useMutation({
    mutationFn: (scopeId: string) => userScopesApi.remove(scopeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-scopes', userId] }),
  });

  // Mutations for grants
  const addGrantMutation = useMutation({
    mutationFn: (data: {
      userId: string;
      scope: AccessScope;
      scopeId?: string;
      resourcePermissions: ResourcePermissions;
      label?: string;
      expiresAt?: string;
    }) => accessGrantsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-grants', userId] });
      setShowAddGrant(false);
      setNewGrantPerms({});
      setNewGrantLabel('');
      setNewGrantExpiry('');
      setNewGrantScopeId('');
    },
  });

  const removeGrantMutation = useMutation({
    mutationFn: (grantId: string) => accessGrantsApi.remove(grantId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['access-grants', userId] }),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    values: user
      ? {
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone || '',
          password: '',
          active: user.active !== false,
        }
      : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<UserFormData>) => usersApi.update(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      router.push('/dashboard/users');
    },
  });

  const onSubmit = (data: UserFormData) => {
    const updateData: Partial<UserFormData> = { ...data };
    if (!updateData.password) {
      delete updateData.password;
    }
    updateMutation.mutate(updateData);
  };

  const role = watch('role');

  // Force sync role when user data loads (fixes Select not showing current value)
  useEffect(() => {
    if (user?.role) {
      setValue('role', user.role);
    }
  }, [user, setValue]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/users">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Modifier l'utilisateur</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Section 1: Compte (obligatoire) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Compte
              <span className="text-xs font-normal text-red-500 bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded">Obligatoire</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom complet <span className="text-red-500">*</span></Label>
                <Input id="name" {...register('name')} placeholder="Jean Dupont" />
                {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
                <Input id="email" type="email" {...register('email')} placeholder="jean.dupont@example.com" />
                {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Nouveau mot de passe</Label>
                <Input id="password" type="password" {...register('password')} placeholder="Laisser vide pour ne pas changer" />
                {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
                <p className="text-xs text-muted-foreground">Laisser vide pour conserver le mot de passe actuel</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Rôle <span className="text-red-500">*</span></Label>
                <Select value={role || ''} onValueChange={(value) => setValue('role', value as UserRole, { shouldDirty: true })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un rôle" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(userRoleLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Contact (optionnel) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Contact
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">Optionnel</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input id="phone" type="tel" {...register('phone')} placeholder="+33 6 12 34 56 78" />
              </div>
              <div className="space-y-2">
                <Label>Compte actif</Label>
                <div className="flex items-center gap-3 pt-1">
                  <Switch
                    checked={watch('active') !== false}
                    onCheckedChange={(checked) => setValue('active', checked)}
                  />
                  <span className="text-sm text-muted-foreground">
                    {watch('active') !== false ? 'Actif' : 'Désactivé'}
                  </span>
                </div>
              </div>
            </div>
            {user?.lastLoginAt && (
              <p className="text-xs text-muted-foreground mt-4">
                Dernière connexion : {new Date(user.lastLoginAt).toLocaleString('fr-FR')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Section: 2FA Status (Admin) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Double authentification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant={(user as any)?.totpEnabled ? 'default' : 'secondary'} className={(user as any)?.totpEnabled ? 'bg-green-600' : ''}>
                  {(user as any)?.totpEnabled ? '2FA Actif' : '2FA Inactif'}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  {(user as any)?.totpEnabled
                    ? 'La double authentification est activée pour cet utilisateur'
                    : 'La double authentification n\'est pas activée'}
                </p>
              </div>
              {(user as any)?.totpEnabled && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDisable2FADialog(true)}
                >
                  Réinitialiser 2FA
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Info className="h-4 w-4" />
            Les champs marqués <span className="text-red-500">*</span> sont obligatoires
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => router.push('/dashboard/users')}>Annuler</Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </form>

      {/* Section: Portées (UserScope) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Portées d'accès
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Définit où le rôle <Badge variant="outline">{userRoleLabels[user?.role || 'VIEWER']}</Badge> s'applique.
            Un utilisateur peut avoir plusieurs portées.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Existing scopes */}
          {userScopes.length > 0 ? (
            <div className="space-y-2">
              {userScopes.map((scope) => {
                const Icon = SCOPE_TYPE_ICONS[scope.scopeType] || Globe;
                return (
                  <div key={scope.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {SCOPE_TYPE_LABELS[scope.scopeType]}
                      </span>
                      {scope.scopeLabel && (
                        <span className="text-sm text-muted-foreground">
                          — {scope.scopeLabel}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeScopeMutation.mutate(scope.id)}
                      disabled={removeScopeMutation.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucune portée. L'utilisateur n'a accès à aucun site via son rôle.
            </p>
          )}

          {/* Add scope form */}
          {showAddScope ? (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Type de portée</Label>
                  <Select value={newScopeType} onValueChange={(v) => { setNewScopeType(v as ScopeType); setNewScopeTargetId(''); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TENANT">Tout le tenant</SelectItem>
                      <SelectItem value="DIVISION">Division</SelectItem>
                      <SelectItem value="DELEGATION">Délégation</SelectItem>
                      <SelectItem value="SITE">Site</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newScopeType !== 'TENANT' && (
                  <div className="space-y-1">
                    <Label className="text-xs">
                      {newScopeType === 'DIVISION' ? 'Division' : newScopeType === 'DELEGATION' ? 'Délégation' : 'Site'}
                    </Label>
                    <Select value={newScopeTargetId} onValueChange={setNewScopeTargetId}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                      <SelectContent>
                        {newScopeType === 'DIVISION' && orgTree?.map((div) => (
                          <SelectItem key={div.id} value={div.id}>{div.name}</SelectItem>
                        ))}
                        {newScopeType === 'DELEGATION' && orgTree?.flatMap((div) =>
                          div.delegations.map((del) => (
                            <SelectItem key={del.id} value={del.id}>
                              {div.name} &gt; {del.name}
                            </SelectItem>
                          ))
                        )}
                        {newScopeType === 'SITE' && allSites?.map((site) => (
                          <SelectItem key={site.id} value={site.id}>
                            {site.code} - {site.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowAddScope(false)}>Annuler</Button>
                <Button
                  size="sm"
                  disabled={addScopeMutation.isPending || (newScopeType !== 'TENANT' && !newScopeTargetId)}
                  onClick={() => {
                    addScopeMutation.mutate({
                      userId,
                      scopeType: newScopeType,
                      scopeId: newScopeType === 'TENANT' ? undefined : newScopeTargetId,
                    });
                  }}
                >
                  Ajouter
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowAddScope(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Ajouter une portée
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Section: Accès par exception (AccessGrant) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Accès par exception
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Accès complémentaires (partiels, temporaires). Purement additifs — ne remplacent pas les portées.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Existing grants */}
          {userGrants.length > 0 ? (
            <div className="space-y-2">
              {userGrants.map((grant) => {
                const perms = grant.resourcePermissions as ResourcePermissions;
                const permSummary = Object.entries(perms || {})
                  .filter(([, v]) => v && v !== 'NONE')
                  .map(([k, v]) => `${RESOURCE_LABELS[k] || k}: ${PERM_LEVEL_LABELS[v] || v}`)
                  .join(', ');

                return (
                  <div key={grant.id} className="p-3 border rounded-lg space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {ACCESS_SCOPE_LABELS[grant.scope]}
                        </Badge>
                        {grant.label && (
                          <span className="text-sm font-medium">{grant.label}</span>
                        )}
                        {grant.expiresAt && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Expire: {new Date(grant.expiresAt).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeGrantMutation.mutate(grant.id)}
                        disabled={removeGrantMutation.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {permSummary && (
                      <p className="text-xs text-muted-foreground">{permSummary}</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucun accès complémentaire. Les portées ci-dessus suffisent pour la plupart des cas.
            </p>
          )}

          {/* Add grant form */}
          {showAddGrant ? (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Portée du grant</Label>
                  <Select value={newGrantScope} onValueChange={(v) => { setNewGrantScope(v as AccessScope); setNewGrantScopeId(''); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL_SITES">Tous les sites</SelectItem>
                      <SelectItem value="DIVISION">Division</SelectItem>
                      <SelectItem value="DELEGATION">Délégation</SelectItem>
                      <SelectItem value="SITE">Site</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newGrantScope !== 'ALL_SITES' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Cible</Label>
                    <Select value={newGrantScopeId} onValueChange={setNewGrantScopeId}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                      <SelectContent>
                        {newGrantScope === 'DIVISION' && orgTree?.map((div) => (
                          <SelectItem key={div.id} value={div.id}>{div.name}</SelectItem>
                        ))}
                        {newGrantScope === 'DELEGATION' && orgTree?.flatMap((div) =>
                          div.delegations.map((del) => (
                            <SelectItem key={del.id} value={del.id}>
                              {div.name} &gt; {del.name}
                            </SelectItem>
                          ))
                        )}
                        {newGrantScope === 'SITE' && allSites?.map((site) => (
                          <SelectItem key={site.id} value={site.id}>
                            {site.code} - {site.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Label (optionnel)</Label>
                  <Input
                    value={newGrantLabel}
                    onChange={(e) => setNewGrantLabel(e.target.value)}
                    placeholder="ex: Partenaire plans"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Expiration (optionnel)</Label>
                  <Input
                    type="date"
                    value={newGrantExpiry}
                    onChange={(e) => setNewGrantExpiry(e.target.value)}
                  />
                </div>
              </div>

              {/* Permission grid */}
              <div className="space-y-2">
                <Label className="text-xs">Permissions par module</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(RESOURCE_LABELS).map(([key, label]) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{label}</Label>
                      <Select
                        value={(newGrantPerms as any)[key] || 'NONE'}
                        onValueChange={(v) => setNewGrantPerms(prev => ({ ...prev, [key]: v }))}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PERM_LEVELS.map((level) => (
                            <SelectItem key={level} value={level}>
                              {PERM_LEVEL_LABELS[level]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowAddGrant(false)}>Annuler</Button>
                <Button
                  size="sm"
                  disabled={
                    addGrantMutation.isPending ||
                    (newGrantScope !== 'ALL_SITES' && !newGrantScopeId) ||
                    Object.values(newGrantPerms).every(v => !v || v === 'NONE')
                  }
                  onClick={() => {
                    // Filter out NONE values
                    const cleanPerms: ResourcePermissions = {};
                    for (const [k, v] of Object.entries(newGrantPerms)) {
                      if (v && v !== 'NONE') {
                        (cleanPerms as any)[k] = v;
                      }
                    }
                    addGrantMutation.mutate({
                      userId,
                      scope: newGrantScope,
                      scopeId: newGrantScope === 'ALL_SITES' ? undefined : newGrantScopeId,
                      resourcePermissions: cleanPerms,
                      label: newGrantLabel || undefined,
                      expiresAt: newGrantExpiry || undefined,
                    });
                  }}
                >
                  Ajouter
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowAddGrant(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Ajouter un accès complémentaire
            </Button>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showDisable2FADialog} onOpenChange={setShowDisable2FADialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Désactiver la double authentification</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir désactiver la 2FA pour cet utilisateur ? Il devra la reconfigurer manuellement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                try {
                  const { authApi } = await import('@/lib/api/auth');
                  await authApi.adminDisable2FA(userId);
                  queryClient.invalidateQueries({ queryKey: ['user', userId] });
                  toast.success('2FA désactivée pour cet utilisateur');
                } catch (err: any) {
                  toast.error(err.message || 'Erreur');
                }
                setShowDisable2FADialog(false);
              }}
            >
              Désactiver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
