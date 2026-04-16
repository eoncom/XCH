'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { usersApi } from '@/lib/api/users';
import { apiClient } from '@/lib/api-client';
import { showToast } from '@/lib/toast';
import { Pagination, type PaginationMeta } from '@/components/ui/pagination';
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
import { Users, UserPlus, Mail, Phone, Shield, Send, Loader2, Search, X, Trash2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import Link from 'next/link';
import type { User } from '@/types';

const rightLabels: Record<string, string> = {
  MANAGE: 'Administrateur',
  WRITE: 'Écriture',
  READ: 'Lecture',
};

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [rightFilter, setRightFilter] = useState<string>('all');
  const queryClient = useQueryClient();

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, rightFilter]);

  // Invite dialog state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRight, setInviteRight] = useState('READ');

  // Delete user state
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      showToast.success('Utilisateur supprimé');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      showToast.error(err.message || 'Erreur lors de la suppression');
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; name: string; right: string }) =>
      apiClient.post('/api/auth/invite', data),
    onSuccess: () => {
      showToast.success('Invitation envoyée avec succès !');
      setInviteOpen(false);
      setInviteEmail('');
      setInviteName('');
      setInviteRight('READ');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      showToast.error(err.message || 'Erreur lors de l\'envoi de l\'invitation');
    },
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    inviteMutation.mutate({ email: inviteEmail, name: inviteName, right: inviteRight });
  };

  const { data: response, isLoading, error } = useQuery({
    queryKey: ['users', page, pageSize, search, rightFilter],
    queryFn: () => usersApi.getAllPaginated({
      page,
      pageSize,
      search: search || undefined,
    }),
    placeholderData: keepPreviousData,
  });
  const users = response?.data ?? [];
  const meta = response?.meta;

  const getRightBadgeColor = (right: string) => {
    switch (right) {
      case 'MANAGE':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300';
      case 'WRITE':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
      case 'READ':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300';
    }
  };

  const getRightLabel = (right: string) => {
    switch (right) {
      case 'MANAGE':
        return 'Administrateur';
      case 'WRITE':
        return 'Écriture';
      case 'READ':
        return 'Lecture';
      default:
        return right;
    }
  };

  if (isLoading) {
    return <div className="text-center py-12">Chargement des utilisateurs...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Erreur lors du chargement des utilisateurs</p>
        <p className="text-sm text-muted-foreground mt-2">
          {error instanceof Error ? error.message : 'Erreur inconnue'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            Utilisateurs
          </h1>
          <p className="text-muted-foreground">Gestion des utilisateurs de la plateforme</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="invite-user-btn">
                <Send className="h-4 w-4 mr-2" />
                Inviter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Inviter un utilisateur</DialogTitle>
                <DialogDescription>
                  Un email d'invitation sera envoyé pour activer le compte.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="invite-name" className="text-sm font-medium">Nom</label>
                  <Input
                    id="invite-name"
                    placeholder="Jean Dupont"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="invite-email" className="text-sm font-medium">Email</label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="email@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="invite-right" className="text-sm font-medium">Droit</label>
                  <Select value={inviteRight} onValueChange={setInviteRight}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MANAGE">Administrateur</SelectItem>
                      <SelectItem value="WRITE">Écriture</SelectItem>
                      <SelectItem value="READ">Lecture</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={inviteMutation.isPending}>
                    {inviteMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Envoi...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Envoyer l'invitation
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Button asChild data-testid="create-user-btn">
            <Link href="/dashboard/users/new">
              <UserPlus className="h-4 w-4 mr-2" />
              Ajouter un utilisateur
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={rightFilter} onValueChange={setRightFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Tous les droits" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les droits</SelectItem>
            {Object.entries(rightLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search || rightFilter !== 'all') && (
          <Button variant="ghost" onClick={() => { setSearch(''); setRightFilter('all'); }} className="flex items-center gap-2">
            <X className="h-4 w-4" />
            Effacer les filtres
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-6 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Super Admins</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter((u) => (u as any).isSuperAdmin).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actifs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter((u) => u.active !== false).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactifs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter((u) => u.active === false).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sans délégation</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter((u) => !(u as any).userDelegations?.length).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des utilisateurs</CardTitle>
        </CardHeader>
        <CardContent>
          <div data-testid="users-list" className="space-y-4">
            {users.map((user) => (
              <div
                key={user.id}
                data-testid="user-card"
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg">
                    {user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{user.name || 'Nom non défini'}</p>
                      {(user as any).userDelegations?.length > 0 ? (
                        (user as any).userDelegations.map((ud: any) => (
                          <Badge key={ud.id} className={getRightBadgeColor(ud.right)}>
                            {getRightLabel(ud.right)}
                            {ud.delegation?.name && (
                              <span className="ml-1 opacity-70 text-[10px]">({ud.delegation.groupLabel ? `${ud.delegation.groupLabel} > ` : ''}{ud.delegation.name})</span>
                            )}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Sans délégation
                        </Badge>
                      )}
                      {(user as any).isSuperAdmin && (
                        <Badge variant="outline" className="text-xs border-amber-500 text-amber-500">Super Admin</Badge>
                      )}
                      {user.active === false && (
                        <Badge variant="secondary" className="text-xs">Inactif</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {user.email}
                      </span>
                      {user.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {user.phone}
                        </span>
                      )}
                      {user.lastLoginAt && (
                        <span className="text-xs">
                          Dern. connexion : {new Date(user.lastLoginAt).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild data-testid="edit-user-btn">
                    <Link href={`/dashboard/users/${user.id}/edit`}>
                      Modifier
                    </Link>
                  </Button>
                  {!(user as any).isSuperAdmin && <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteTarget(user)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>}
                </div>
              </div>
            ))}
          </div>
          {users.length === 0 && (
            <EmptyState
              icon={Users}
              title="Aucun utilisateur disponible"
              action={{ label: 'Ajouter un utilisateur', href: '/dashboard/users/new', icon: UserPlus }}
            />
          )}

          {meta && <Pagination meta={meta} onPageChange={setPage} onPageSizeChange={setPageSize} />}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'utilisateur</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer <strong>{deleteTarget?.name}</strong> ({deleteTarget?.email}) ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Suppression...</>
              ) : (
                'Supprimer'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
