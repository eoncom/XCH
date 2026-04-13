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
  userDelegationsApi,
  accessOverridesApi,
  type UserDelegation,
  type AccessOverride,
  type OverrideEffect,
  type ResourcePermissionLevel,
} from '@/lib/api/site-access';
import { organizationApi, type Delegation } from '@/lib/api/organization';
import { sitesApi } from '@/lib/api/sites';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, MapPin, Lock, Unlock, Info, X, Plus, Network, Shield, Calendar, Trash2, Loader2, Crown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { usePermissions } from '@/hooks/usePermissions';
import type { User } from '@/types';

const userSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères').optional().or(z.literal('')),
  phone: z.string().optional(),
  active: z.boolean().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

const DELEGATION_RIGHT_LABELS: Record<string, string> = {
  MANAGE: 'Administrateur',
  WRITE: 'Écriture',
  READ: 'Lecture',
};

// All delegation rights are available — assignment controlled by authorization

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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSuperAdminDialog, setShowSuperAdminDialog] = useState(false);
  const { isSuperAdmin: currentUserIsSuperAdmin } = usePermissions();

  // State for adding delegation/grant
  const [showAddDelegation, setShowAddDelegation] = useState(false);
  const [newDelegationId, setNewDelegationId] = useState('');
  const [newDelegationRight, setNewDelegationRight] = useState('READ');
  const [showAddOverride, setShowAddOverride] = useState(false);
  const [newOverrideSiteId, setNewOverrideSiteId] = useState('');
  const [newOverrideResource, setNewOverrideResource] = useState('*');
  const [newOverrideEffect, setNewOverrideEffect] = useState<OverrideEffect>('ALLOW');
  const [newOverridePermission, setNewOverridePermission] = useState<ResourcePermissionLevel>('READ');
  const [newOverrideLabel, setNewOverrideLabel] = useState('');
  const [newOverrideExpiry, setNewOverrideExpiry] = useState('');

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ['user', userId],
    queryFn: () => usersApi.getById(userId),
  });

  // UserDelegations
  const { data: userDelegations = [] } = useQuery<UserDelegation[]>({
    queryKey: ['user-delegations', userId],
    queryFn: () => userDelegationsApi.getByUser(userId),
    enabled: !!userId,
  });

  // AccessOverrides
  const { data: userOverrides = [] } = useQuery<AccessOverride[]>({
    queryKey: ['access-overrides', userId],
    queryFn: () => accessOverridesApi.getByUser(userId),
    enabled: !!userId,
  });

  // Org data for selectors
  const { data: allDelegations } = useQuery<Delegation[]>({
    queryKey: ['delegations'],
    queryFn: () => organizationApi.getDelegations(),
  });

  const { data: allSites } = useQuery({
    queryKey: ['sites'],
    queryFn: () => sitesApi.getAll(),
  });

  // Mutations for delegations
  const addDelegationMutation = useMutation({
    mutationFn: (data: { userId: string; delegationId: string; right: string }) =>
      userDelegationsApi.create(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-delegations', userId] });
      setShowAddDelegation(false);
      setNewDelegationId('');
      setNewDelegationRight('READ');
    },
  });

  const removeDelegationMutation = useMutation({
    mutationFn: (delegationId: string) => userDelegationsApi.remove(userId, delegationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-delegations', userId] }),
  });

  // Mutations for overrides
  const addOverrideMutation = useMutation({
    mutationFn: (data: {
      userId: string;
      siteId: string;
      resource: string;
      effect: OverrideEffect;
      permission?: ResourcePermissionLevel;
      label?: string;
      expiresAt?: string;
    }) => accessOverridesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-overrides', userId] });
      setShowAddOverride(false);
      setNewOverrideSiteId('');
      setNewOverrideResource('*');
      setNewOverrideEffect('ALLOW');
      setNewOverridePermission('READ');
      setNewOverrideLabel('');
      setNewOverrideExpiry('');
    },
  });

  const removeOverrideMutation = useMutation({
    mutationFn: (overrideId: string) => accessOverridesApi.remove(overrideId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['access-overrides', userId] }),
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

  const deleteMutation = useMutation({
    mutationFn: () => usersApi.delete(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Utilisateur supprimé');
      router.push('/dashboard/users');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erreur lors de la suppression');
    },
  });

  const toggleSuperAdminMutation = useMutation({
    mutationFn: (promote: boolean) => usersApi.toggleSuperAdmin(userId, promote),
    onSuccess: (_, promote) => {
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      queryClient.invalidateQueries({ queryKey: ['user-delegations', userId] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(promote ? 'Utilisateur promu super administrateur' : 'Statut super administrateur retiré');
      setShowSuperAdminDialog(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erreur');
    },
  });

  const onSubmit = (data: UserFormData) => {
    const updateData: Partial<UserFormData> = { ...data };
    if (!updateData.password) {
      delete updateData.password;
    }
    updateMutation.mutate(updateData);
  };

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

        {/* Section: Super Admin (visible uniquement aux super admins) */}
        {currentUserIsSuperAdmin && (
          <Card className={(user as any)?.isSuperAdmin ? 'border-amber-500/50 bg-amber-50/30 dark:bg-amber-950/20' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-500" />
                Super Administrateur
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Un super administrateur a automatiquement le rôle ADMIN sur toutes les délégations et accès à la configuration globale.
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge
                    variant={(user as any)?.isSuperAdmin ? 'default' : 'secondary'}
                    className={(user as any)?.isSuperAdmin ? 'bg-amber-600' : ''}
                  >
                    {(user as any)?.isSuperAdmin ? 'Super Admin actif' : 'Utilisateur standard'}
                  </Badge>
                  {(user as any)?.isSuperAdmin && (
                    <span className="text-sm text-amber-600 dark:text-amber-400">
                      ADMIN sur toutes les délégations (automatique)
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  variant={(user as any)?.isSuperAdmin ? 'destructive' : 'default'}
                  size="sm"
                  onClick={() => setShowSuperAdminDialog(true)}
                >
                  {(user as any)?.isSuperAdmin ? 'Retirer le statut' : 'Promouvoir Super Admin'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          {!(user as any)?.isSuperAdmin ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Suppression...</>
              ) : (
                <><Trash2 className="mr-2 h-4 w-4" />Supprimer l'utilisateur</>
              )}
            </Button>
          ) : (
            <div className="flex items-center gap-2 text-amber-500 text-sm">
              <Shield className="h-4 w-4" />
              Super administrateur — protégé contre la suppression
            </div>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => router.push('/dashboard/users')}>Annuler</Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </form>

      {/* Section: Délégations (UserDelegation) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Délégations d'accès
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Définit les délégations auxquelles l'utilisateur a accès et son droit dans chacune.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Super admin delegation notice */}
          {(user as any)?.isSuperAdmin && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm">
              <Crown className="h-4 w-4 flex-shrink-0" />
              Super administrateur : rôle ADMIN forcé sur toutes les délégations (non modifiable).
            </div>
          )}

          {/* Existing delegations */}
          {userDelegations.length > 0 ? (
            <div className="space-y-2">
              {userDelegations.map((ud) => (
                <div key={ud.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Network className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {ud.delegation?.groupLabel ? `${ud.delegation.groupLabel} > ` : ''}
                      {ud.delegation?.name || ud.delegationId}
                    </span>
                    {ud.delegation?.groupColor && (
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ud.delegation.groupColor }} />
                    )}
                    <Badge variant="outline" className="text-xs">
                      {DELEGATION_RIGHT_LABELS[ud.right] || ud.right}
                    </Badge>
                  </div>
                  {!(user as any)?.isSuperAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeDelegationMutation.mutate(ud.delegationId)}
                      disabled={removeDelegationMutation.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucune délégation. L'utilisateur n'a accès à aucun site.
            </p>
          )}

          {/* Add delegation form */}
          {/* Add delegation — hidden for super admins (auto-managed) */}
          {!(user as any)?.isSuperAdmin && (
            <>
              {showAddDelegation ? (
                <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Délégation</Label>
                      <Select value={newDelegationId} onValueChange={setNewDelegationId}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                        <SelectContent>
                          {allDelegations?.map((del) => (
                            <SelectItem key={del.id} value={del.id}>
                              {del.groupLabel ? `${del.groupLabel} > ${del.name}` : del.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Droit</Label>
                      <Select value={newDelegationRight} onValueChange={setNewDelegationRight}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(DELEGATION_RIGHT_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setShowAddDelegation(false)}>Annuler</Button>
                    <Button
                      size="sm"
                      disabled={addDelegationMutation.isPending || !newDelegationId}
                      onClick={() => {
                        addDelegationMutation.mutate({
                          userId,
                          delegationId: newDelegationId,
                          right: newDelegationRight,
                        });
                      }}
                    >
                      Ajouter
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setShowAddDelegation(true)}>
                  <Plus className="mr-1 h-4 w-4" />
                  Ajouter une délégation
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Section: Accès par exception (AccessOverride) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Accès par exception
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Exceptions d'accès par site (ALLOW/DENY). Permettent d'accorder ou retirer l'accès à des ressources spécifiques.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Existing overrides */}
          {userOverrides.length > 0 ? (
            <div className="space-y-2">
              {userOverrides.map((override) => (
                <div key={override.id} className="p-3 border rounded-lg space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={override.effect === 'ALLOW' ? 'default' : 'destructive'} className="text-xs">
                        {override.effect}
                      </Badge>
                      <span className="text-sm font-medium">
                        {override.site?.name || override.siteId}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {override.resource === '*' ? 'Tout le site' : RESOURCE_LABELS[override.resource] || override.resource}
                      </Badge>
                      {override.permission && (
                        <Badge variant="secondary" className="text-xs">
                          {PERM_LEVEL_LABELS[override.permission] || override.permission}
                        </Badge>
                      )}
                      {override.label && (
                        <span className="text-sm text-muted-foreground">{override.label}</span>
                      )}
                      {override.expiresAt && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Expire: {new Date(override.expiresAt).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeOverrideMutation.mutate(override.id)}
                      disabled={removeOverrideMutation.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucune exception d'accès. Les délégations ci-dessus suffisent pour la plupart des cas.
            </p>
          )}

          {/* Add override form */}
          {showAddOverride ? (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Site</Label>
                  <Select value={newOverrideSiteId} onValueChange={setNewOverrideSiteId}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner un site..." /></SelectTrigger>
                    <SelectContent>
                      {allSites?.map((site: any) => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.code} - {site.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ressource</Label>
                  <Select value={newOverrideResource} onValueChange={setNewOverrideResource}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="*">Tout le site</SelectItem>
                      {Object.entries(RESOURCE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Effet</Label>
                  <Select value={newOverrideEffect} onValueChange={(v) => setNewOverrideEffect(v as OverrideEffect)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALLOW">ALLOW (accorder)</SelectItem>
                      <SelectItem value="DENY">DENY (retirer)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newOverrideEffect === 'ALLOW' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Permission</Label>
                    <Select value={newOverridePermission} onValueChange={(v) => setNewOverridePermission(v as ResourcePermissionLevel)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="READ">Lecture</SelectItem>
                        <SelectItem value="WRITE">Écriture</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Label (optionnel)</Label>
                  <Input
                    value={newOverrideLabel}
                    onChange={(e) => setNewOverrideLabel(e.target.value)}
                    placeholder="ex: Accès temporaire plans"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Expiration (optionnel)</Label>
                  <Input
                    type="date"
                    value={newOverrideExpiry}
                    onChange={(e) => setNewOverrideExpiry(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowAddOverride(false)}>Annuler</Button>
                <Button
                  size="sm"
                  disabled={addOverrideMutation.isPending || !newOverrideSiteId}
                  onClick={() => {
                    addOverrideMutation.mutate({
                      userId,
                      siteId: newOverrideSiteId,
                      resource: newOverrideResource,
                      effect: newOverrideEffect,
                      permission: newOverrideEffect === 'ALLOW' ? newOverridePermission : undefined,
                      label: newOverrideLabel || undefined,
                      expiresAt: newOverrideExpiry || undefined,
                    });
                  }}
                >
                  Ajouter
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowAddOverride(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Ajouter une exception d'accès
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Delete user dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'utilisateur</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer <strong>{user?.name}</strong> ({user?.email}) ?
              Cette action est irréversible. Toutes les portées d'accès et les données associées seront supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Super Admin toggle dialog */}
      <AlertDialog open={showSuperAdminDialog} onOpenChange={setShowSuperAdminDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {(user as any)?.isSuperAdmin
                ? 'Retirer le statut Super Administrateur'
                : 'Promouvoir en Super Administrateur'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(user as any)?.isSuperAdmin ? (
                <>
                  Êtes-vous sûr de vouloir retirer le statut super administrateur de <strong>{user?.name}</strong> ?
                  L'utilisateur perdra l'accès à la configuration globale. Ses délégations actuelles seront conservées
                  mais pourront être modifiées.
                </>
              ) : (
                <>
                  Êtes-vous sûr de vouloir promouvoir <strong>{user?.name}</strong> en super administrateur ?
                  L'utilisateur obtiendra automatiquement le rôle <strong>ADMIN</strong> sur toutes les délégations
                  et l'accès à la configuration globale de la plateforme.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className={(user as any)?.isSuperAdmin
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'bg-amber-600 text-white hover:bg-amber-700'}
              onClick={() => toggleSuperAdminMutation.mutate(!(user as any)?.isSuperAdmin)}
              disabled={toggleSuperAdminMutation.isPending}
            >
              {toggleSuperAdminMutation.isPending
                ? 'En cours...'
                : (user as any)?.isSuperAdmin
                  ? 'Retirer le statut'
                  : 'Confirmer la promotion'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
