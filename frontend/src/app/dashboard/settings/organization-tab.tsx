'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Plus, Pencil, Trash2, Building2, MapPin, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { organizationApi, type Delegation, type CreateDelegationDto } from '@/lib/api/organization';

export function OrganizationTab() {
  const queryClient = useQueryClient();

  // Delegation dialog state
  const [delegationDialog, setDelegationDialog] = useState<{ open: boolean; editing?: Delegation }>({ open: false });
  const [delegationForm, setDelegationForm] = useState<CreateDelegationDto>({ name: '', code: '' });

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: '', name: '' });

  // Fetch delegations (flat list with sites)
  const { data: delegations, isLoading } = useQuery({
    queryKey: ['organization-tree'],
    queryFn: () => organizationApi.getTree(true),
  });

  // Mutations
  const createDelegation = useMutation({
    mutationFn: (data: CreateDelegationDto) => organizationApi.createDelegation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-tree'] });
      setDelegationDialog({ open: false });
      toast.success('Delegation creee');
    },
    onError: (err: any) => toast.error(err.message || 'Erreur lors de la creation'),
  });

  const updateDelegation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => organizationApi.updateDelegation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-tree'] });
      setDelegationDialog({ open: false });
      toast.success('Delegation mise a jour');
    },
    onError: (err: any) => toast.error(err.message || 'Erreur lors de la mise a jour'),
  });

  const deleteDelegation = useMutation({
    mutationFn: (id: string) => organizationApi.deleteDelegation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-tree'] });
      setDeleteConfirm({ ...deleteConfirm, open: false });
      toast.success('Delegation supprimee');
    },
    onError: (err: any) => toast.error(err.message || 'Erreur lors de la suppression'),
  });

  const openDelegationDialog = (editing?: Delegation) => {
    if (editing) {
      setDelegationForm({
        name: editing.name,
        code: editing.code,
        notes: editing.notes || '',
        groupLabel: editing.groupLabel || '',
        groupColor: editing.groupColor || '',
      });
    } else {
      setDelegationForm({ name: '', code: '' });
    }
    setDelegationDialog({ open: true, editing });
  };

  const handleDelegationSubmit = () => {
    if (delegationDialog.editing) {
      updateDelegation.mutate({ id: delegationDialog.editing.id, data: delegationForm });
    } else {
      createDelegation.mutate(delegationForm);
    }
  };

  const totalSites = delegations?.reduce((sum, d) => sum + (d.sites?.length || 0), 0) || 0;

  // Group delegations by groupLabel for display
  const grouped = delegations?.reduce<Record<string, Delegation[]>>((acc, del) => {
    const key = del.groupLabel || '';
    if (!acc[key]) acc[key] = [];
    acc[key].push(del);
    return acc;
  }, {}) || {};

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Structure organisationnelle</CardTitle>
              <CardDescription>
                Delegations et rattachement des sites. La structure organise, elle ne controle pas les acces.
              </CardDescription>
            </div>
            <Button onClick={() => openDelegationDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Delegation
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Stats */}
          <div className="flex gap-4 mb-6">
            <Badge variant="secondary" className="text-sm">
              {delegations?.length || 0} delegation{(delegations?.length || 0) > 1 ? 's' : ''}
            </Badge>
            <Badge variant="secondary" className="text-sm">
              {totalSites} site{totalSites > 1 ? 's' : ''}
            </Badge>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !delegations?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Aucune delegation creee</p>
              <p className="text-sm mt-1">Commencez par creer une delegation pour organiser vos sites.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).map(([groupLabel, dels]) => (
                <div key={groupLabel || '__none__'}>
                  {groupLabel && (
                    <div className="flex items-center gap-2 mb-2">
                      {dels[0]?.groupColor && (
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: dels[0].groupColor }} />
                      )}
                      <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{groupLabel}</span>
                    </div>
                  )}
                  <div className="space-y-2">
                    {dels.map((delegation) => (
                      <div key={delegation.id} className="border rounded-lg">
                        <div className="flex items-center gap-2 p-3 hover:bg-muted/50">
                          <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          {delegation.groupColor && !groupLabel && (
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: delegation.groupColor }} />
                          )}
                          <span className="font-medium">{delegation.name}</span>
                          <Badge variant="outline" className="text-xs">{delegation.code}</Badge>
                          <span className="text-xs text-muted-foreground ml-auto mr-2">
                            {delegation.sites?.length || delegation._count?.sites || 0} site{(delegation.sites?.length || delegation._count?.sites || 0) > 1 ? 's' : ''}
                          </span>
                          {!delegation.isActive && <Badge variant="secondary" className="text-xs">Inactif</Badge>}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDelegationDialog(delegation)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteConfirm({ open: true, id: delegation.id, name: delegation.name })}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {/* Sites preview */}
                        {delegation.sites && delegation.sites.length > 0 && (
                          <div className="border-t bg-muted/20 pl-10 pr-3 py-1">
                            {delegation.sites.map((site) => (
                              <div key={site.id} className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3 flex-shrink-0" />
                                <span>{site.name}</span>
                                <Badge variant="outline" className="text-[10px] px-1">{site.code}</Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delegation Dialog */}
      <Dialog open={delegationDialog.open} onOpenChange={(open) => setDelegationDialog({ ...delegationDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{delegationDialog.editing ? 'Modifier la delegation' : 'Nouvelle delegation'}</DialogTitle>
            <DialogDescription>
              Une delegation regroupe plusieurs sites.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nom</Label>
                <Input value={delegationForm.name} onChange={(e) => setDelegationForm({ ...delegationForm, name: e.target.value })} placeholder="Paris Ouest" />
              </div>
              <div>
                <Label>Code</Label>
                <Input value={delegationForm.code} onChange={(e) => setDelegationForm({ ...delegationForm, code: e.target.value.toUpperCase() })} placeholder="PAR-O" maxLength={20} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Groupe (optionnel)</Label>
                <Input value={delegationForm.groupLabel || ''} onChange={(e) => setDelegationForm({ ...delegationForm, groupLabel: e.target.value })} placeholder="ex: Ile-de-France" />
                <p className="text-xs text-muted-foreground mt-1">Regroupement visuel des delegations</p>
              </div>
              <div>
                <Label>Couleur du groupe</Label>
                <div className="flex items-center gap-2">
                  <Input type="color" value={delegationForm.groupColor || '#0070f3'} onChange={(e) => setDelegationForm({ ...delegationForm, groupColor: e.target.value })} className="w-12 h-9 p-1 cursor-pointer" />
                  <Input value={delegationForm.groupColor || ''} onChange={(e) => setDelegationForm({ ...delegationForm, groupColor: e.target.value })} placeholder="#0070f3" maxLength={7} className="flex-1" />
                </div>
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={delegationForm.notes || ''} onChange={(e) => setDelegationForm({ ...delegationForm, notes: e.target.value })} placeholder="Notes optionnelles..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelegationDialog({ open: false })}>Annuler</Button>
            <Button onClick={handleDelegationSubmit} disabled={!delegationForm.name || !delegationForm.code || createDelegation.isPending || updateDelegation.isPending}>
              {(createDelegation.isPending || updateDelegation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {delegationDialog.editing ? 'Enregistrer' : 'Creer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => setDeleteConfirm({ ...deleteConfirm, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous supprimer la delegation &quot;{deleteConfirm.name}&quot; ?
              Les sites doivent etre transferes au prealable.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteDelegation.mutate(deleteConfirm.id)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
