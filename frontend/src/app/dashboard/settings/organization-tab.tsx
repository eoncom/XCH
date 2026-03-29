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
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown, Building2, MapPin, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { organizationApi, type Division, type OrganizationTree, type CreateDivisionDto, type CreateDelegationDto } from '@/lib/api/organization';

export function OrganizationTab() {
  const queryClient = useQueryClient();
  const [expandedDivisions, setExpandedDivisions] = useState<Set<string>>(new Set());

  // Division dialog state
  const [divisionDialog, setDivisionDialog] = useState<{ open: boolean; editing?: Division }>({ open: false });
  const [divisionForm, setDivisionForm] = useState<CreateDivisionDto>({ name: '', code: '' });

  // Delegation dialog state
  const [delegationDialog, setDelegationDialog] = useState<{ open: boolean; divisionId?: string; editing?: any }>({ open: false });
  const [delegationForm, setDelegationForm] = useState<CreateDelegationDto>({ divisionId: '', name: '', code: '' });

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; type: 'division' | 'delegation'; id: string; name: string }>({ open: false, type: 'division', id: '', name: '' });

  // Fetch tree
  const { data: tree, isLoading } = useQuery({
    queryKey: ['organization-tree'],
    queryFn: () => organizationApi.getTree(true),
  });

  // Mutations
  const createDivision = useMutation({
    mutationFn: (data: CreateDivisionDto) => organizationApi.createDivision(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-tree'] });
      setDivisionDialog({ open: false });
      toast.success('Division créée');
    },
    onError: (err: any) => toast.error(err.message || 'Erreur lors de la création'),
  });

  const updateDivision = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateDivisionDto> }) => organizationApi.updateDivision(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-tree'] });
      setDivisionDialog({ open: false });
      toast.success('Division mise à jour');
    },
    onError: (err: any) => toast.error(err.message || 'Erreur lors de la mise à jour'),
  });

  const deleteDivision = useMutation({
    mutationFn: (id: string) => organizationApi.deleteDivision(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-tree'] });
      setDeleteConfirm({ ...deleteConfirm, open: false });
      toast.success('Division supprimée');
    },
    onError: (err: any) => toast.error(err.message || 'Erreur lors de la suppression'),
  });

  const createDelegation = useMutation({
    mutationFn: (data: CreateDelegationDto) => organizationApi.createDelegation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-tree'] });
      setDelegationDialog({ open: false });
      toast.success('Délégation créée');
    },
    onError: (err: any) => toast.error(err.message || 'Erreur lors de la création'),
  });

  const updateDelegation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => organizationApi.updateDelegation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-tree'] });
      setDelegationDialog({ open: false });
      toast.success('Délégation mise à jour');
    },
    onError: (err: any) => toast.error(err.message || 'Erreur lors de la mise à jour'),
  });

  const deleteDelegation = useMutation({
    mutationFn: (id: string) => organizationApi.deleteDelegation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-tree'] });
      setDeleteConfirm({ ...deleteConfirm, open: false });
      toast.success('Délégation supprimée');
    },
    onError: (err: any) => toast.error(err.message || 'Erreur lors de la suppression'),
  });

  const toggleDivision = (id: string) => {
    const next = new Set(expandedDivisions);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedDivisions(next);
  };

  const openDivisionDialog = (editing?: Division) => {
    if (editing) {
      setDivisionForm({ name: editing.name, code: editing.code, color: editing.color || '', notes: editing.notes || '' });
    } else {
      setDivisionForm({ name: '', code: '' });
    }
    setDivisionDialog({ open: true, editing });
  };

  const openDelegationDialog = (divisionId: string, editing?: any) => {
    if (editing) {
      setDelegationForm({ divisionId: editing.divisionId || divisionId, name: editing.name, code: editing.code, notes: editing.notes || '' });
    } else {
      setDelegationForm({ divisionId, name: '', code: '' });
    }
    setDelegationDialog({ open: true, divisionId, editing });
  };

  const handleDivisionSubmit = () => {
    if (divisionDialog.editing) {
      updateDivision.mutate({ id: divisionDialog.editing.id, data: divisionForm });
    } else {
      createDivision.mutate(divisionForm);
    }
  };

  const handleDelegationSubmit = () => {
    if (delegationDialog.editing) {
      updateDelegation.mutate({ id: delegationDialog.editing.id, data: delegationForm });
    } else {
      createDelegation.mutate(delegationForm);
    }
  };

  const totalDelegations = tree?.reduce((sum, d) => sum + d.delegations.length, 0) || 0;
  const totalSites = tree?.reduce((sum, d) => sum + d.delegations.reduce((s, del) => s + del.sites.length, 0), 0) || 0;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Structure organisationnelle</CardTitle>
              <CardDescription>
                Divisions, délégations et rattachement des sites. La hiérarchie organise, elle ne contrôle pas les accès.
              </CardDescription>
            </div>
            <Button onClick={() => openDivisionDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Division
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Stats */}
          <div className="flex gap-4 mb-6">
            <Badge variant="secondary" className="text-sm">
              {tree?.length || 0} division{(tree?.length || 0) > 1 ? 's' : ''}
            </Badge>
            <Badge variant="secondary" className="text-sm">
              {totalDelegations} délégation{totalDelegations > 1 ? 's' : ''}
            </Badge>
            <Badge variant="secondary" className="text-sm">
              {totalSites} site{totalSites > 1 ? 's' : ''}
            </Badge>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !tree?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Aucune division créée</p>
              <p className="text-sm mt-1">Commencez par créer une division pour organiser vos délégations et sites.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tree.map((division) => (
                <div key={division.id} className="border rounded-lg">
                  {/* Division row */}
                  <div className="flex items-center gap-2 p-3 hover:bg-muted/50 cursor-pointer" onClick={() => toggleDivision(division.id)}>
                    {expandedDivisions.has(division.id) ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    {division.color && (
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: division.color }} />
                    )}
                    <span className="font-medium">{division.name}</span>
                    <Badge variant="outline" className="text-xs">{division.code}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto mr-2">
                      {division.delegations.length} délég. / {division.delegations.reduce((s, d) => s + d.sites.length, 0)} sites
                    </span>
                    {!division.isActive && <Badge variant="secondary" className="text-xs">Inactif</Badge>}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openDivisionDialog(division); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ open: true, type: 'division', id: division.id, name: division.name }); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Delegations */}
                  {expandedDivisions.has(division.id) && (
                    <div className="border-t bg-muted/20">
                      {division.delegations.map((delegation) => (
                        <div key={delegation.id} className="flex items-center gap-2 pl-10 pr-3 py-2 border-b last:border-b-0 hover:bg-muted/30">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm">{delegation.name}</span>
                          <Badge variant="outline" className="text-xs">{delegation.code}</Badge>
                          <span className="text-xs text-muted-foreground ml-auto mr-2">
                            {delegation.sites.length} site{delegation.sites.length > 1 ? 's' : ''}
                          </span>
                          {!delegation.isActive && <Badge variant="secondary" className="text-xs">Inactif</Badge>}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDelegationDialog(division.id, delegation)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteConfirm({ open: true, type: 'delegation', id: delegation.id, name: delegation.name })}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                      {/* Sites preview */}
                      {division.delegations.map((delegation) =>
                        delegation.sites.length > 0 ? (
                          <div key={`sites-${delegation.id}`} className="pl-16 pr-3 py-1">
                            {delegation.sites.map((site) => (
                              <div key={site.id} className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3 flex-shrink-0" />
                                <span>{site.name}</span>
                                <Badge variant="outline" className="text-[10px] px-1">{site.code}</Badge>
                              </div>
                            ))}
                          </div>
                        ) : null
                      )}
                      {/* Add delegation button */}
                      <div className="pl-10 pr-3 py-2">
                        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => openDelegationDialog(division.id)}>
                          <Plus className="mr-1 h-3 w-3" />
                          Ajouter une délégation
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Division Dialog */}
      <Dialog open={divisionDialog.open} onOpenChange={(open) => setDivisionDialog({ ...divisionDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{divisionDialog.editing ? 'Modifier la division' : 'Nouvelle division'}</DialogTitle>
            <DialogDescription>
              Une division regroupe plusieurs délégations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nom</Label>
                <Input value={divisionForm.name} onChange={(e) => setDivisionForm({ ...divisionForm, name: e.target.value })} placeholder="Île-de-France" />
              </div>
              <div>
                <Label>Code</Label>
                <Input value={divisionForm.code} onChange={(e) => setDivisionForm({ ...divisionForm, code: e.target.value.toUpperCase() })} placeholder="IDF" maxLength={20} />
              </div>
            </div>
            <div>
              <Label>Couleur</Label>
              <div className="flex items-center gap-2">
                <Input type="color" value={divisionForm.color || '#0070f3'} onChange={(e) => setDivisionForm({ ...divisionForm, color: e.target.value })} className="w-12 h-9 p-1 cursor-pointer" />
                <Input value={divisionForm.color || ''} onChange={(e) => setDivisionForm({ ...divisionForm, color: e.target.value })} placeholder="#0070f3" maxLength={7} className="flex-1" />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={divisionForm.notes || ''} onChange={(e) => setDivisionForm({ ...divisionForm, notes: e.target.value })} placeholder="Notes optionnelles..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDivisionDialog({ open: false })}>Annuler</Button>
            <Button onClick={handleDivisionSubmit} disabled={!divisionForm.name || !divisionForm.code || createDivision.isPending || updateDivision.isPending}>
              {(createDivision.isPending || updateDivision.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {divisionDialog.editing ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delegation Dialog */}
      <Dialog open={delegationDialog.open} onOpenChange={(open) => setDelegationDialog({ ...delegationDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{delegationDialog.editing ? 'Modifier la délégation' : 'Nouvelle délégation'}</DialogTitle>
            <DialogDescription>
              Une délégation regroupe plusieurs sites au sein d'une division.
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
            <div>
              <Label>Notes</Label>
              <Textarea value={delegationForm.notes || ''} onChange={(e) => setDelegationForm({ ...delegationForm, notes: e.target.value })} placeholder="Notes optionnelles..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelegationDialog({ open: false })}>Annuler</Button>
            <Button onClick={handleDelegationSubmit} disabled={!delegationForm.name || !delegationForm.code || createDelegation.isPending || updateDelegation.isPending}>
              {(createDelegation.isPending || updateDelegation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {delegationDialog.editing ? 'Enregistrer' : 'Créer'}
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
              Voulez-vous supprimer {deleteConfirm.type === 'division' ? 'la division' : 'la délégation'} &quot;{deleteConfirm.name}&quot; ?
              {deleteConfirm.type === 'division'
                ? ' Toutes ses délégations vides seront également supprimées.'
                : ' Les sites doivent être transférés au préalable.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirm.type === 'division') {
                  deleteDivision.mutate(deleteConfirm.id);
                } else {
                  deleteDelegation.mutate(deleteConfirm.id);
                }
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
