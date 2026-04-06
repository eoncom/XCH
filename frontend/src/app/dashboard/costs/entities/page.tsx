// @ts-nocheck
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { billingEntitiesApi, type BillingEntity } from '@/lib/api/costs';
import { organizationApi, type OrganizationTree } from '@/lib/api/organization';
import { ScopeSelector, ScopeBadge, type ScopeValue } from '@/components/ui/scope-selector';
import { usePermissions } from '@/hooks/usePermissions';
import { ArrowLeft, Plus, Pencil, Trash2, Building2 } from 'lucide-react';
import Link from 'next/link';

const ENTITY_TYPES = ['DIRECTION', 'BU', 'DELEGATION', 'SITE', 'SERVICE', 'OTHER'];
const ENTITY_TYPE_LABELS: Record<string, string> = {
  DIRECTION: 'Direction',
  BU: 'Business Unit',
  DELEGATION: 'Délégation',
  SITE: 'Site',
  SERVICE: 'Service',
  OTHER: 'Autre',
};

export default function BillingEntitiesPage() {
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', code: '', type: 'OTHER', description: '' });
  const [formScope, setFormScope] = useState<ScopeValue>({ scopeType: null, scopeId: null });
  const [pendingDeleteEntity, setPendingDeleteEntity] = useState<BillingEntity | null>(null);

  const { data: entities = [], isLoading } = useQuery<BillingEntity[]>({
    queryKey: ['billing-entities'],
    queryFn: () => billingEntitiesApi.getAll(),
  });

  const { data: orgTree = [] } = useQuery<OrganizationTree[]>({
    queryKey: ['organization-tree'],
    queryFn: () => organizationApi.getTree(),
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<BillingEntity>) => billingEntitiesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-entities'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BillingEntity> }) => billingEntitiesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-entities'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => billingEntitiesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['billing-entities'] }),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ name: '', code: '', type: 'OTHER', description: '' });
    setFormScope({ scopeType: null, scopeId: null });
  };

  const startEdit = (entity: BillingEntity) => {
    setEditingId(entity.id);
    setFormData({ name: entity.name, code: entity.code, type: entity.type, description: entity.description || '' });
    setFormScope({ scopeType: entity.scopeType || null, scopeId: entity.scopeId || null });
    setShowForm(true);
  };

  const handleSubmit = () => {
    const data = {
      ...formData,
      scopeType: formScope.scopeType || undefined,
      scopeId: formScope.scopeId || undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) return <div className="text-center">Chargement...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/costs"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Centres de coût</h1>
          <p className="text-muted-foreground">Entités de facturation et refacturation</p>
        </div>
      </div>

      {/* Form */}
      {showForm ? (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Modifier' : 'Nouveau'} centre de coût</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label>Nom</Label>
                <Input value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Code</Label>
                <Input value={formData.code} onChange={(e) => setFormData(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
              </div>
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{ENTITY_TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Input value={formData.description} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} />
              </div>
            </div>
            <ScopeSelector value={formScope} onChange={setFormScope} label="Rattachement organisationnel" />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={resetForm}>Annuler</Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.name || !formData.code || createMutation.isPending || updateMutation.isPending}
              >
                {editingId ? 'Enregistrer' : 'Créer'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : canCreate('billing-entities') ? (
        <Button variant="outline" onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau centre de coût
        </Button>
      ) : null}

      {/* Table */}
      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Portee</TableHead>
                <TableHead>Statut</TableHead>
                {(canUpdate('billing-entities') || canDelete('billing-entities')) && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {entities.map((entity) => (
                <TableRow key={entity.id}>
                  <TableCell className="font-medium">{entity.name}</TableCell>
                  <TableCell><Badge variant="outline">{entity.code}</Badge></TableCell>
                  <TableCell>
                    <Badge variant="secondary">{ENTITY_TYPE_LABELS[entity.type] || entity.type}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{entity.description || '—'}</TableCell>
                  <TableCell>
                    <ScopeBadge scopeType={entity.scopeType} scopeId={entity.scopeId} tree={orgTree} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={entity.isActive ? 'success' : 'secondary'}>
                      {entity.isActive ? 'Actif' : 'Inactif'}
                    </Badge>
                  </TableCell>
                  {(canUpdate('billing-entities') || canDelete('billing-entities')) && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canUpdate('billing-entities') && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(entity)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete('billing-entities') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setPendingDeleteEntity(entity)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {entities.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Aucun centre de coût
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingDeleteEntity} onOpenChange={(open) => !open && setPendingDeleteEntity(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Supprimer &laquo;&nbsp;{pendingDeleteEntity?.name}&nbsp;&raquo; ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDeleteEntity) deleteMutation.mutate(pendingDeleteEntity.id);
                setPendingDeleteEntity(null);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
