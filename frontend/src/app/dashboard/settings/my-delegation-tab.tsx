'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MapPin, Users, Bell, Save, Lock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { organizationApi, type Delegation } from '@/lib/api/organization';
import { useDelegation } from '@/contexts/DelegationContext';

/**
 * Settings tab for a delegation MANAGE user.
 * Shows only the actions allowed per AUTH_MODEL § 1:
 *   - rename/describe the delegation
 *   - view sites and members count
 *   - shortcuts to users (scoped) and notification config
 *
 * If the user has MANAGE on multiple delegations, a switcher at the top
 * lists them and delegates to the header DelegationPicker to keep the
 * whole app (Sites, Users, Notifications) in sync with the tab.
 *
 * Super admins don't see this tab — they have the full "Structure" tab instead.
 */
export function MyDelegationTab() {
  const { currentDelegation, delegations, switchDelegation } = useDelegation();
  const activeDelegationId = currentDelegation?.delegationId ?? null;
  const activeRight = currentDelegation?.right ?? null;
  const manageableDelegations = delegations.filter((d) => d.right === 'MANAGE');
  const queryClient = useQueryClient();

  const { data: delegation, isLoading } = useQuery<Delegation | null>({
    queryKey: ['my-delegation', activeDelegationId],
    queryFn: async () => {
      if (!activeDelegationId) return null;
      return organizationApi.getDelegation(activeDelegationId);
    },
    enabled: !!activeDelegationId,
  });

  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [groupLabel, setGroupLabel] = useState('');
  const [groupColor, setGroupColor] = useState('#0070f3');

  useEffect(() => {
    if (delegation) {
      setName(delegation.name || '');
      setNotes(delegation.notes || '');
      setGroupLabel(delegation.groupLabel || '');
      setGroupColor(delegation.groupColor || '#0070f3');
    }
  }, [delegation]);

  const update = useMutation({
    mutationFn: (data: { name: string; notes?: string; groupLabel?: string; groupColor?: string }) =>
      organizationApi.updateDelegation(activeDelegationId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-delegation', activeDelegationId] });
      queryClient.invalidateQueries({ queryKey: ['organization-tree'] });
      toast.success('Délégation mise à jour');
    },
    onError: (err: any) => toast.error(err?.message || 'Erreur lors de la mise à jour'),
  });

  if (!activeDelegationId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ma délégation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Sélectionnez une délégation dans la barre de navigation pour accéder à sa configuration.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!delegation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ma délégation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Délégation introuvable.</p>
        </CardContent>
      </Card>
    );
  }

  const sitesCount = delegation.sites?.length ?? 0;
  const membersCount = (delegation as any)._count?.userDelegations ?? 0;
  const canEdit = activeRight === 'MANAGE';

  return (
    <div className="space-y-6">
      {/* Switcher when the user manages >1 delegation */}
      {manageableDelegations.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Mes délégations ({manageableDelegations.length})</CardTitle>
            <CardDescription>
              Vous êtes administrateur local sur plusieurs délégations. Cliquez pour basculer
              — le choix s&apos;applique aussi aux autres pages (Sites, Équipements, Utilisateurs…).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {manageableDelegations.map((d) => {
                const isActive = d.delegationId === activeDelegationId;
                return (
                  <Button
                    key={d.delegationId}
                    variant={isActive ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => switchDelegation(d.delegationId)}
                    className="gap-2"
                  >
                    {d.delegation.groupColor && (
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: d.delegation.groupColor }}
                      />
                    )}
                    {d.delegation.name}
                    <span className="text-[10px] font-mono opacity-70">{d.delegation.code}</span>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Banner when the user has READ/WRITE (not MANAGE) on the active delegation
          — they landed here via tab visibility on another delegation then switched */}
      {!canEdit && (
        <Card className="border-amber-500/40 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="flex items-start gap-3 py-4">
            <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-100">
                Lecture seule sur cette délégation
              </p>
              <p className="text-amber-800 dark:text-amber-200 mt-1">
                Vous avez le droit <strong>{activeRight || 'N/A'}</strong> ici, pas MANAGE.
                Sélectionnez une délégation où vous êtes administrateur dans la liste ci-dessus.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {canEdit ? 'Configurer' : 'Consulter'} : {delegation.name}
              </CardTitle>
              <CardDescription>
                {canEdit ? (
                  <>Renommage, notes, groupe visuel. Les réglages tenant (SSO, types, sauvegardes, modules) restent réservés au super-admin.</>
                ) : (
                  <>Détails de la délégation en lecture seule.</>
                )}
              </CardDescription>
            </div>
            <Badge variant="secondary" className="font-mono">{delegation.code}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input id="code" value={delegation.code} disabled />
              <p className="text-xs text-muted-foreground">
                Le code est fixé à la création par le super-admin.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="groupLabel">Groupe visuel</Label>
              <Input
                id="groupLabel"
                value={groupLabel}
                onChange={(e) => setGroupLabel(e.target.value)}
                placeholder="ex: Île-de-France"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="groupColor">Couleur du groupe</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="groupColor"
                  value={groupColor}
                  onChange={(e) => setGroupColor(e.target.value)}
                  className="w-10 h-10 rounded border-0 cursor-pointer disabled:opacity-50"
                  disabled={!canEdit}
                />
                <Input value={groupColor} onChange={(e) => setGroupColor(e.target.value)} disabled={!canEdit} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Description, informations internes, procédures…"
              rows={3}
              disabled={!canEdit}
            />
          </div>

          {canEdit && (
            <div className="flex justify-end">
              <Button
                onClick={() => update.mutate({ name, notes, groupLabel, groupColor })}
                disabled={update.isPending || !name.trim()}
              >
                {update.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Enregistrer
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Sites
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{sitesCount}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {sitesCount > 1 ? 'sites rattachés' : 'site rattaché'}
            </p>
            <Link href="/dashboard/sites" className="text-sm text-primary hover:underline mt-2 inline-block">
              Voir les sites →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Membres
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{membersCount}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {membersCount > 1 ? 'utilisateurs' : 'utilisateur'} avec accès
            </p>
            <Link href="/dashboard/users" className="text-sm text-primary hover:underline mt-2 inline-block">
              Gérer les membres →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4" /> Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Configurez les canaux (email, Teams) et les évènements suivis.
            </p>
            <Link
              href="/dashboard/settings/notifications"
              className="text-sm text-primary hover:underline mt-2 inline-block"
            >
              Configurer →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
