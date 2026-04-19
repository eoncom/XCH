'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { budgetsApi, type Budget, type BudgetStatus, type CreateBudgetData } from '@/lib/api/budgets';
import { organizationApi, type Delegation } from '@/lib/api/organization';
import { sitesApi } from '@/lib/api/sites';
import { useDelegation } from '@/contexts/DelegationContext';
import { usePermissions } from '@/hooks/usePermissions';
import { ArrowLeft, Plus, Pencil, Trash2, TrendingUp, AlertTriangle, Wallet } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function BudgetsPage() {
  const queryClient = useQueryClient();
  const { canWrite } = usePermissions();
  const { currentDelegation } = useDelegation();
  const activeDelegationId = currentDelegation?.delegationId ?? null;
  const [showForm, setShowForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, BudgetStatus>>({});

  // queryKey depends on the active delegation so the list invalidates when the
  // user switches delegation — backend filters server-side via X-Delegation-Id.
  const { data: budgetsRes, isLoading } = useQuery({
    queryKey: ['budgets', activeDelegationId],
    queryFn: () => budgetsApi.getAll({ pageSize: 100 }),
  });

  const { data: delegations } = useQuery({
    queryKey: ['delegations'],
    queryFn: () => organizationApi.getDelegations(),
  });

  const budgets = budgetsRes?.data || [];

  // Load statuses for all budgets
  useEffect(() => {
    if (budgets.length === 0) return;
    const loadStatuses = async () => {
      const results: Record<string, BudgetStatus> = {};
      await Promise.all(
        budgets.map(async (b) => {
          try {
            results[b.id] = await budgetsApi.getStatus(b.id);
          } catch { /* ignore */ }
        })
      );
      setStatuses(results);
    };
    loadStatuses();
  }, [budgets.length]);

  const [formData, setFormData] = useState<CreateBudgetData>({
    label: '',
    period: 'YEAR',
    startDate: new Date().getFullYear() + '-01-01',
    endDate: new Date().getFullYear() + '-12-31',
    amount: 0,
    currency: 'EUR',
  });

  // Sites for the delegation picked in the budget form — lets the user scope
  // a budget to a specific site. The list refreshes when the delegation changes.
  const { data: sitesRes } = useQuery({
    queryKey: ['sites', 'for-budget-form', formData.delegationId || 'all'],
    queryFn: () => sitesApi.getAll({ pageSize: 500 }),
    enabled: !!formData.delegationId,
  });
  const sitesForForm = (sitesRes?.data || []).filter(
    (s: any) => !formData.delegationId || s.delegationId === formData.delegationId,
  );

  const resetForm = () => {
    setFormData({
      label: '', period: 'YEAR',
      startDate: new Date().getFullYear() + '-01-01',
      endDate: new Date().getFullYear() + '-12-31',
      amount: 0, currency: 'EUR',
    });
    setEditingBudget(null);
    setShowForm(false);
  };

  const handleEdit = (budget: Budget) => {
    setEditingBudget(budget);
    setFormData({
      label: budget.label,
      delegationId: budget.delegationId || undefined,
      siteId: budget.siteId || undefined,
      expenseType: budget.expenseType || undefined,
      period: budget.period,
      startDate: budget.startDate.split('T')[0],
      endDate: budget.endDate.split('T')[0],
      amount: budget.amount,
      currency: budget.currency,
      notes: budget.notes || undefined,
    });
    setShowForm(true);
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateBudgetData) => budgetsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Budget créé');
      resetForm();
    },
    onError: (e: any) => toast.error(e?.message || 'Erreur'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateBudgetData> }) => budgetsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Budget mis à jour');
      resetForm();
    },
    onError: (e: any) => toast.error(e?.message || 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => budgetsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Budget supprimé');
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e?.message || 'Erreur'),
  });

  const handleSave = () => {
    if (!formData.label || !formData.amount) {
      toast.error('Label et montant requis');
      return;
    }
    if (editingBudget) {
      updateMutation.mutate({ id: editingBudget.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const overBudgetCount = Object.values(statuses).filter((s) => s.overBudget).length;
  const totalBudgeted = Object.values(statuses).reduce((sum, s) => sum + s.budgeted, 0);
  const totalSpent = Object.values(statuses).reduce((sum, s) => sum + s.spent, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/costs"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Budgets</h1>
            <p className="text-muted-foreground">Suivi des budgets par délégation, site ou type de dépense</p>
          </div>
        </div>
        {canWrite && (
          <Button onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-1" />Nouveau budget
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Wallet className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total budgété</p>
                <p className="text-2xl font-bold">{totalBudgeted.toLocaleString('fr-FR')} EUR</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total dépensé</p>
                <p className="text-2xl font-bold">{totalSpent.toLocaleString('fr-FR')} EUR</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className={`h-8 w-8 ${overBudgetCount > 0 ? 'text-red-500' : 'text-gray-400'}`} />
              <div>
                <p className="text-sm text-muted-foreground">En dépassement</p>
                <p className="text-2xl font-bold">{overBudgetCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget list */}
      {isLoading ? (
        <Card><CardContent className="py-8"><p className="text-center text-muted-foreground">Chargement...</p></CardContent></Card>
      ) : budgets.length === 0 ? (
        <Card><CardContent className="py-12"><p className="text-center text-muted-foreground">Aucun budget défini. Créez votre premier budget.</p></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map((budget) => {
            const status = statuses[budget.id];
            const progressPct = status?.progressPct ?? 0;
            const isOver = status?.overBudget ?? false;

            return (
              <Card key={budget.id} className={isOver ? 'border-red-300 dark:border-red-800' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{budget.label}</CardTitle>
                    <div className="flex gap-1">
                      {canWrite && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(budget)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteId(budget.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline">{budget.period === 'YEAR' ? 'Annuel' : 'Mensuel'}</Badge>
                    {budget.delegation && <Badge variant="secondary">{budget.delegation.name}</Badge>}
                    {budget.site && <Badge variant="secondary">{budget.site.name}</Badge>}
                    {budget.expenseType && <Badge variant="secondary">{budget.expenseType}</Badge>}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {status ? `${status.spent.toLocaleString('fr-FR')} / ${status.budgeted.toLocaleString('fr-FR')} ${budget.currency}` : 'Calcul...'}
                      </span>
                      <span className={`font-medium ${isOver ? 'text-red-600' : ''}`}>
                        {progressPct}%
                      </span>
                    </div>
                    <Progress value={Math.min(progressPct, 100)} className={isOver ? '[&>div]:bg-red-500' : ''} />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{budget.startDate.split('T')[0]}</span>
                      <span>{budget.endDate.split('T')[0]}</span>
                    </div>
                    {status && status.remaining < 0 && (
                      <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Dépassement de {Math.abs(status.remaining).toLocaleString('fr-FR')} {budget.currency}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open: boolean) => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingBudget ? 'Modifier le budget' : 'Nouveau budget'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Label *</Label>
              <Input value={formData.label} onChange={(e) => setFormData({ ...formData, label: e.target.value })} placeholder="Budget IT 2026" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Période</Label>
                <Select value={formData.period} onValueChange={(v: 'MONTH' | 'YEAR') => setFormData({ ...formData, period: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YEAR">Annuel</SelectItem>
                    <SelectItem value="MONTH">Mensuel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Montant *</Label>
                <Input type="number" min="0" step="0.01" value={formData.amount || ''} onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Début</Label>
                <Input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} />
              </div>
              <div>
                <Label>Fin</Label>
                <Input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Délégation (optionnel)</Label>
                <Select
                  value={formData.delegationId || '__none__'}
                  onValueChange={(v) => {
                    const nextDelegationId = v === '__none__' ? undefined : v;
                    setFormData({
                      ...formData,
                      delegationId: nextDelegationId,
                      // Clear siteId if it no longer belongs to the new delegation scope.
                      siteId: nextDelegationId ? formData.siteId : undefined,
                    });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Toutes" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Toutes les délégations</SelectItem>
                    {(delegations || []).map((d: Delegation) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Site (optionnel)</Label>
                <Select
                  value={formData.siteId || '__none__'}
                  onValueChange={(v) => setFormData({ ...formData, siteId: v === '__none__' ? undefined : v })}
                  disabled={!formData.delegationId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.delegationId ? 'Tous les sites' : 'Choisir d\'abord une délégation'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Tous les sites de la délégation</SelectItem>
                    {sitesForForm.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Type de dépense (optionnel)</Label>
              <Select value={formData.expenseType || '__none__'} onValueChange={(v) => setFormData({ ...formData, expenseType: v === '__none__' ? undefined : v })}>
                <SelectTrigger><SelectValue placeholder="Tous" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Tous les types</SelectItem>
                  <SelectItem value="EQUIPMENT">Équipement</SelectItem>
                  <SelectItem value="SERVICE">Service</SelectItem>
                  <SelectItem value="PROJECT">Projet</SelectItem>
                  <SelectItem value="LICENSE">Licence</SelectItem>
                  <SelectItem value="CONSUMABLE">Consommable</SelectItem>
                  <SelectItem value="OTHER">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Annuler</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingBudget ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce budget ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
