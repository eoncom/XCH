'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  budgetsApi,
  type Budget,
  type BudgetStatus,
  type CreateBudgetData,
} from '@/lib/api/budgets';
import { organizationApi, type Delegation } from '@/lib/api/organization';
import { sitesApi } from '@/lib/api/sites';
import { billingEntitiesApi, type BillingEntity } from '@/lib/api/costs';
import { useDelegation } from '@/contexts/DelegationContext';
import { usePermissions } from '@/hooks/usePermissions';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  AlertTriangle,
  Wallet,
  Bell,
  BellOff,
  Eye,
  Wallet2,
  Download,
} from 'lucide-react';
import { saveAs } from 'file-saver';
import Link from 'next/link';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/currency';
import { AccessGate } from '@/components/AccessGate';

export default function BudgetsPageWrapper() {
  return (
    <AccessGate
      required="manage"
      title="Accès refusé"
      description="Le module Budgets est réservé aux administrateurs de délégation et aux super administrateurs."
    >
      <BudgetsPage />
    </AccessGate>
  );
}

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  EQUIPMENT: 'Équipement',
  SERVICE: 'Service',
  PROJECT: 'Projet',
  LICENSE: 'Licence',
  CONSUMABLE: 'Consommable',
  OTHER: 'Autre',
};

const FREQ_LABELS: Record<string, string> = {
  ONE_TIME: 'Ponctuel',
  MONTHLY: 'Mensuel',
  QUARTERLY: 'Trimestriel',
  YEARLY: 'Annuel',
};

function BudgetsPage() {
  const queryClient = useQueryClient();
  const { canWrite, isSuperAdmin } = usePermissions();
  const { currentDelegation } = useDelegation();
  const activeDelegationId = currentDelegation?.delegationId ?? null;

  const [showForm, setShowForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, BudgetStatus>>({});
  const [viewExpensesOf, setViewExpensesOf] = useState<Budget | null>(null);

  const { data: budgetsRes, isLoading } = useQuery({
    queryKey: ['budgets', activeDelegationId],
    queryFn: () => budgetsApi.getAll({ pageSize: 200 }),
  });

  const { data: delegations } = useQuery({
    queryKey: ['delegations'],
    queryFn: () => organizationApi.getDelegations(),
  });

  const budgets = budgetsRes?.data || [];

  // D5 — for each budget, the sum of its children's `spent`. Recursive so a
  // 3-level hierarchy totals correctly. The parent card uses this to show
  // "dont Xk€ issu des sous-budgets" next to its own total spent.
  const childrenSpentById = useMemo(() => {
    const map = new Map<string, number>();
    const childrenOf = new Map<string, Budget[]>();
    for (const b of budgets) {
      if (!b.parentId) continue;
      if (!childrenOf.has(b.parentId)) childrenOf.set(b.parentId, []);
      childrenOf.get(b.parentId)!.push(b);
    }
    const sumForNode = (id: string): number => {
      if (map.has(id)) return map.get(id)!;
      const kids = childrenOf.get(id) ?? [];
      let total = 0;
      for (const k of kids) {
        const own = statuses[k.id]?.spent ?? 0;
        total += own + sumForNode(k.id);
      }
      map.set(id, total);
      return total;
    };
    for (const b of budgets) sumForNode(b.id);
    return map;
  }, [budgets, statuses]);

  // P5 — group budgets by parent for hierarchical render. Roots = budgets
  // without a parent OR with a parentId pointing to a missing budget (orphans
  // are treated as roots so they remain visible). Children sorted by label.
  const groupedBudgets = useMemo(() => {
    const idSet = new Set(budgets.map((b) => b.id));
    const roots = budgets
      .filter((b) => !b.parentId || !idSet.has(b.parentId))
      .sort((a, b) => a.label.localeCompare(b.label));
    return roots.map((parent) => ({
      parent,
      children: budgets
        .filter((b) => b.parentId === parent.id)
        .sort((a, b) => a.label.localeCompare(b.label)),
    }));
  }, [budgets]);

  // Recompute statuses whenever the budgets query resolves (initial load,
  // a mutation invalidation, a delegation switch, or any external change
  // that refetches `['budgets']`). Keying on `updatedAt` ensures that even
  // when the list length is stable but an expense changed the picture
  // elsewhere, a full refetch triggered by `queryClient.invalidateQueries`
  // still re-pulls each status.
  const budgetsFingerprint = useMemo(
    () => budgets.map((b) => `${b.id}:${b.updatedAt}`).join('|'),
    [budgets],
  );
  useEffect(() => {
    if (budgets.length === 0) {
      setStatuses({});
      return;
    }
    let cancelled = false;
    const loadStatuses = async () => {
      const results: Record<string, BudgetStatus> = {};
      await Promise.all(
        budgets.map(async (b) => {
          try {
            results[b.id] = await budgetsApi.getStatus(b.id);
          } catch {
            /* ignore */
          }
        }),
      );
      if (!cancelled) setStatuses(results);
    };
    loadStatuses();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgetsFingerprint]);

  const defaultFormData = (): CreateBudgetData => ({
    label: '',
    period: 'YEAR',
    startDate: new Date().getFullYear() + '-01-01',
    endDate: new Date().getFullYear() + '-12-31',
    amount: 0,
    currency: 'EUR',
    billingEntityId: null,
    alertsEnabled: true,
    alertThresholdPct: 80,
  });
  const [formData, setFormData] = useState<CreateBudgetData>(defaultFormData);

  const { data: sitesForForm = [] } = useQuery({
    queryKey: ['sites', 'for-budget-form', formData.delegationId || 'none'],
    queryFn: () => sitesApi.getAll({ delegationId: formData.delegationId, pageSize: 500 }),
    enabled: !!formData.delegationId,
  });

  // Centres de coût pickable for the budget form:
  // - Restrict to the delegation picked (if any) + globals (delegationId=null).
  //   A CdC that belongs to a different delegation isn't semantically
  //   trackable by this budget, so it's not offered.
  const { data: billingEntitiesForForm = [] } = useQuery<BillingEntity[]>({
    queryKey: ['billing-entities', 'for-budget-form', formData.delegationId || 'none'],
    queryFn: () =>
      billingEntitiesApi.getAll({
        delegationId: formData.delegationId || undefined,
        includeGlobal: true,
        isActive: 'true',
      }),
  });

  // Potential parents: all budgets minus the one being edited and its descendants.
  const potentialParents = useMemo(() => {
    if (!editingBudget) return budgets;
    const forbidden = new Set<string>([editingBudget.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const b of budgets) {
        if (b.parentId && forbidden.has(b.parentId) && !forbidden.has(b.id)) {
          forbidden.add(b.id);
          changed = true;
        }
      }
    }
    return budgets.filter((b) => !forbidden.has(b.id));
  }, [budgets, editingBudget]);

  const resetForm = () => {
    setFormData(defaultFormData());
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
      billingEntityId: budget.billingEntityId || null,
      period: budget.period,
      startDate: budget.startDate.split('T')[0],
      endDate: budget.endDate.split('T')[0],
      amount: budget.amount,
      currency: budget.currency,
      notes: budget.notes || undefined,
      parentId: budget.parentId || null,
      alertsEnabled: budget.alertsEnabled,
      alertThresholdPct: budget.alertThresholdPct,
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
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateBudgetData> }) =>
      budgetsApi.update(id, data),
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
    // A manager (non super-admin) can only create budgets on delegations they
    // manage. Let the backend be the authority (403) but catch the common case
    // early for a clean error.
    if (!isSuperAdmin && !formData.delegationId) {
      toast.error('Sélectionnez une délégation pour ce budget.');
      return;
    }
    if (editingBudget) {
      updateMutation.mutate({ id: editingBudget.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const exportBudgetsCsv = () => {
    const rows: string[][] = [
      [
        'Label',
        'Période',
        'Début',
        'Fin',
        'Délégation',
        'Site',
        'Centre de coût',
        'Type',
        'Montant',
        'Dépensé',
        'Restant',
        'Progression (%)',
        'Seuil alerte (%)',
        'Alertes activées',
        'Sous-budget de',
      ],
      ...budgets.map((b) => {
        const s = statuses[b.id];
        return [
          b.label,
          b.period === 'YEAR' ? 'Annuel' : 'Mensuel',
          b.startDate.split('T')[0],
          b.endDate.split('T')[0],
          b.delegation?.name ?? '',
          b.site?.name ?? '',
          b.billingEntity ? `${b.billingEntity.code} — ${b.billingEntity.name}` : '',
          b.expenseType ?? '',
          String(b.amount),
          s ? String(s.spent) : '',
          s ? String(s.remaining) : '',
          s ? String(s.progressPct) : '',
          String(b.alertThresholdPct),
          b.alertsEnabled ? 'Oui' : 'Non',
          b.parent?.label ?? '',
        ];
      }),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, `xch-budgets-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // Totaux agrégés et compteurs over/threshold : ne compter QUE les budgets
  // racines. Un sous-budget est par construction un découpage de l'enveloppe
  // parent, donc l'inclure produirait un double comptage à la fois sur les
  // sommes (Σ children ≤ parent) et sur le compteur "En dépassement" (un
  // parent over-budget verrait aussi ses sous-budgets contribuer au total).
  const rootBudgets = budgets.filter((b) => !b.parentId);
  const overBudgetCount = rootBudgets.filter((b) => statuses[b.id]?.overBudget).length;
  const thresholdCount = rootBudgets.filter(
    (b) => statuses[b.id]?.thresholdReached && !statuses[b.id]?.overBudget,
  ).length;
  const totalBudgeted = rootBudgets.reduce((sum, b) => sum + (statuses[b.id]?.budgeted ?? 0), 0);
  const totalSpent = rootBudgets.reduce((sum, b) => sum + (statuses[b.id]?.spent ?? 0), 0);

  // P5 — single source for budget card rendering, used both for parent
  // (full-width container above sub-grid) and children (cells in sub-grid).
  // The parent/child relationship is conveyed by the spatial layout, so the
  // "Sous-budget de X" tag (U5) is intentionally absent here — it would be
  // redundant noise inside the visual hierarchy.
  const renderBudgetCard = (budget: Budget) => {
    const status = statuses[budget.id];
    const progressPct = status?.progressPct ?? 0;
    const isOver = status?.overBudget ?? false;
    const atThreshold = status?.thresholdReached && !isOver;

    return (
      <Card
        key={budget.id}
        className={
          isOver
            ? 'border-red-300 dark:border-red-800'
            : atThreshold
              ? 'border-orange-300 dark:border-orange-800'
              : ''
        }
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <CardTitle className="text-lg truncate">{budget.label}</CardTitle>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewExpensesOf(budget)}
                aria-label="Voir les dépenses de ce budget"
                title="Voir les dépenses"
              >
                <Eye className="h-4 w-4" />
              </Button>
              {canWrite && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(budget)}
                    aria-label="Modifier le budget"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setDeleteId(budget.id)}
                    aria-label="Supprimer le budget"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline">
              {budget.period === 'YEAR' ? 'Annuel' : 'Mensuel'}
            </Badge>
            {budget.delegation && (
              <Badge variant="secondary">{budget.delegation.name}</Badge>
            )}
            {budget.site && <Badge variant="secondary">{budget.site.name}</Badge>}
            {budget.expenseType && (
              <Badge variant="secondary">
                {EXPENSE_TYPE_LABELS[budget.expenseType] ?? budget.expenseType}
              </Badge>
            )}
            {budget.billingEntity && (
              <Badge variant="secondary" className="gap-1">
                <Wallet2 className="h-3 w-3" />
                {budget.billingEntity.code}
              </Badge>
            )}
            {(budget._count?.children ?? 0) > 0 && (
              <Badge variant="outline" className="text-xs">
                {budget._count?.children} sous-budget(s)
              </Badge>
            )}
            {!budget.alertsEnabled ? (
              <Badge variant="outline" className="text-xs">
                <BellOff className="h-3 w-3 mr-1" /> Alertes off
              </Badge>
            ) : atThreshold ? (
              <Badge variant="warning">
                <Bell className="h-3 w-3 mr-1" /> Seuil {budget.alertThresholdPct}% atteint
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {status
                  ? `${formatCurrency(status.spent, budget.currency)} / ${formatCurrency(
                      status.budgeted,
                      budget.currency,
                    )}`
                  : 'Calcul...'}
              </span>
              <span className={`font-medium ${isOver ? 'text-red-600' : ''}`}>
                {progressPct}%
              </span>
            </div>
            <Progress
              value={Math.min(progressPct, 100)}
              className={
                isOver
                  ? '[&>div]:bg-red-500'
                  : atThreshold
                    ? '[&>div]:bg-orange-500'
                    : ''
              }
            />
            {/* B9 (Track A PR2) — two autonomous figures, not a partition.
                Sub-budgets cumulés ⊥ Dépenses propres : the parent might count
                expenses outside the children's scope (delegation-vs-CdC mix). */}
            {(budget._count?.children ?? 0) > 0 && status && (() => {
              const fromKids = childrenSpentById.get(budget.id) ?? 0;
              if (fromKids <= 0) return null;
              return (
                <div className="space-y-0.5 text-xs text-muted-foreground">
                  <p>
                    Sous-budgets cumulés :{' '}
                    {formatCurrency(fromKids, budget.currency)}
                  </p>
                  <p>
                    Dépenses propres au budget :{' '}
                    {formatCurrency(status.spent, budget.currency)}
                  </p>
                </div>
              );
            })()}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{budget.startDate.split('T')[0]}</span>
              <span>{budget.endDate.split('T')[0]}</span>
            </div>
            {status && status.remaining < 0 && (
              <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Dépassement de{' '}
                {formatCurrency(Math.abs(status.remaining), budget.currency)}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/costs">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Budgets</h1>
            <p className="text-muted-foreground">
              Budgets par délégation, site ou type — hiérarchisables en sous-budgets.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportBudgetsCsv}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          {canWrite && (
            <Button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Nouveau budget
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Wallet className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total budgété</p>
                <p className="text-2xl font-bold">{formatCurrency(totalBudgeted)}</p>
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
                <p className="text-2xl font-bold">{formatCurrency(totalSpent)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Bell
                className={`h-8 w-8 ${
                  thresholdCount > 0 ? 'text-orange-500' : 'text-gray-400'
                }`}
              />
              <div>
                <p className="text-sm text-muted-foreground">Au seuil</p>
                <p className="text-2xl font-bold">{thresholdCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle
                className={`h-8 w-8 ${
                  overBudgetCount > 0 ? 'text-red-500' : 'text-gray-400'
                }`}
              />
              <div>
                <p className="text-sm text-muted-foreground">En dépassement</p>
                <p className="text-2xl font-bold">{overBudgetCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget list (hierarchical: parent full-width + children sub-grid) */}
      {isLoading ? (
        <CardSkeleton />
      ) : groupedBudgets.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              Aucun budget défini. Créez votre premier budget.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedBudgets.map(({ parent, children }) => {
            const parentStatus = statuses[parent.id];
            const isParentOver = parentStatus?.overBudget ?? false;
            const parentAtThreshold =
              parentStatus?.thresholdReached && !isParentOver;
            // P5 — wrap parent + sub-grid in a tinted container when the parent
            // is over/threshold AND has children. The propagated red/orange tint
            // signals "this section is in danger" at a glance — stronger cue
            // than an isolated border on a single card lost in a flat grid.
            const wrapperCls =
              children.length === 0
                ? 'space-y-4'
                : isParentOver
                  ? 'rounded-xl border border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/10 p-4 space-y-4'
                  : parentAtThreshold
                    ? 'rounded-xl border border-orange-200 bg-orange-50/40 dark:border-orange-900/40 dark:bg-orange-950/10 p-4 space-y-4'
                    : 'space-y-4';

            return (
              <div key={parent.id} className={wrapperCls}>
                {renderBudgetCard(parent)}
                {children.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {children.map((child) => renderBudgetCard(child))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open: boolean) => !open && resetForm()}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingBudget ? 'Modifier le budget' : 'Nouveau budget'}
            </DialogTitle>
            <DialogDescription>
              Un budget peut être rattaché à un parent pour former une hiérarchie (sous-budgets).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
            <div>
              <Label htmlFor="b-label">Label *</Label>
              <Input
                id="b-label"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="Budget IT 2026"
              />
            </div>
            <div>
              <Label htmlFor="b-parent">Budget parent (optionnel)</Label>
              <Select
                value={formData.parentId ?? '__none__'}
                onValueChange={(v) =>
                  setFormData({ ...formData, parentId: v === '__none__' ? null : v })
                }
              >
                <SelectTrigger id="b-parent">
                  <SelectValue placeholder="Aucun" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucun (budget racine)</SelectItem>
                  {potentialParents.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.label} ({formatCurrency(b.amount, b.currency)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Somme des sous-budgets ≤ montant du parent. Période du sous-budget incluse dans celle du parent.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="b-period">Période</Label>
                <Select
                  value={formData.period}
                  onValueChange={(v: 'MONTH' | 'YEAR') =>
                    setFormData({ ...formData, period: v })
                  }
                >
                  <SelectTrigger id="b-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YEAR">Annuel</SelectItem>
                    <SelectItem value="MONTH">Mensuel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="b-amount">Montant *</Label>
                <Input
                  id="b-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="b-start">Début</Label>
                <Input
                  id="b-start"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="b-end">Fin</Label>
                <Input
                  id="b-end"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="b-deleg">
                  Délégation {isSuperAdmin ? '(optionnel)' : <span className="text-red-500">*</span>}
                </Label>
                <Select
                  value={formData.delegationId || (isSuperAdmin ? '__none__' : '')}
                  onValueChange={(v) => {
                    const nextDelegationId = v === '__none__' ? undefined : v;
                    setFormData({
                      ...formData,
                      delegationId: nextDelegationId,
                      siteId: nextDelegationId ? formData.siteId : undefined,
                    });
                  }}
                >
                  <SelectTrigger id="b-deleg">
                    <SelectValue placeholder={isSuperAdmin ? 'Toutes' : 'Choisir une délégation'} />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Global scope (no delegation) is a super-admin privilege —
                        a manager who picks it would create a budget they can't
                        see back because of the per-delegation read scope. */}
                    {isSuperAdmin && (
                      <SelectItem value="__none__">Toutes les délégations</SelectItem>
                    )}
                    {(delegations || []).map((d: Delegation) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="b-site">Site (optionnel)</Label>
                <Select
                  value={formData.siteId || '__none__'}
                  onValueChange={(v) =>
                    setFormData({ ...formData, siteId: v === '__none__' ? undefined : v })
                  }
                  disabled={!formData.delegationId}
                >
                  <SelectTrigger id="b-site">
                    <SelectValue
                      placeholder={
                        formData.delegationId
                          ? 'Tous les sites'
                          : "Choisir d'abord une délégation"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Tous les sites de la délégation</SelectItem>
                    {sitesForForm.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="b-type">Type de dépense (optionnel)</Label>
              <Select
                value={formData.expenseType || '__none__'}
                onValueChange={(v) =>
                  setFormData({ ...formData, expenseType: v === '__none__' ? undefined : v })
                }
              >
                <SelectTrigger id="b-type">
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Tous les types</SelectItem>
                  {Object.entries(EXPENSE_TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="b-cdc" className="flex items-center gap-2">
                <Wallet2 className="h-4 w-4" />
                Centre de coût (optionnel)
              </Label>
              <Select
                value={formData.billingEntityId || '__none__'}
                onValueChange={(v) =>
                  setFormData({ ...formData, billingEntityId: v === '__none__' ? null : v })
                }
              >
                <SelectTrigger id="b-cdc">
                  <SelectValue placeholder="Toute la délégation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Toute la délégation (pas de CdC)</SelectItem>
                  {billingEntitiesForForm.map((cdc) => (
                    <SelectItem key={cdc.id} value={cdc.id}>
                      {cdc.code} — {cdc.name}
                      {!cdc.delegationId ? ' (global)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Si renseigné, ce budget ne surveille que les dépenses portées par ce centre de
                coût. La hiérarchie cible : Délégation → Centre de coût → Dépenses.
              </p>
            </div>
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="b-alerts" className="flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Alertes de seuil
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Notifie les managers de la délégation quand le seuil est franchi.
                  </p>
                </div>
                <Switch
                  id="b-alerts"
                  checked={formData.alertsEnabled ?? true}
                  onCheckedChange={(v) => setFormData({ ...formData, alertsEnabled: v })}
                />
              </div>
              {formData.alertsEnabled !== false && (
                <div>
                  <Label htmlFor="b-threshold">Seuil (%)</Label>
                  <Input
                    id="b-threshold"
                    type="number"
                    min={1}
                    max={100}
                    value={formData.alertThresholdPct ?? 80}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        alertThresholdPct: Math.max(
                          1,
                          Math.min(100, parseInt(e.target.value, 10) || 80),
                        ),
                      })
                    }
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
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
            <AlertDialogDescription>
              Cette action est irréversible. Si le budget a des sous-budgets, détachez-les ou
              supprimez-les d&apos;abord.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View-expenses dialog */}
      <Dialog open={!!viewExpensesOf} onOpenChange={(o) => !o && setViewExpensesOf(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Dépenses du budget « {viewExpensesOf?.label} »</DialogTitle>
            <DialogDescription>
              Toutes les dépenses qui correspondent au périmètre du budget (délégation, site, type)
              sur la période.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {viewExpensesOf && (
              <BudgetExpensesTable
                status={statuses[viewExpensesOf.id]}
                currency={viewExpensesOf.currency}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewExpensesOf(null)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BudgetExpensesTable({
  status,
  currency,
}: {
  status: BudgetStatus | undefined;
  currency: string;
}) {
  if (!status) {
    return <p className="text-sm text-muted-foreground py-4">Chargement...</p>;
  }
  if (status.expenses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Aucune dépense sur la période.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <div className="text-sm">
        <span className="text-muted-foreground">Total dépensé :</span>{' '}
        <span className="font-semibold">{formatCurrency(status.spent, currency)}</span>{' '}
        <span className="text-muted-foreground">
          sur {formatCurrency(status.budgeted, currency)} ({status.progressPct}%)
        </span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Libellé</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Fréquence</TableHead>
            <TableHead>Porteur</TableHead>
            <TableHead className="text-right">Part dans ce budget</TableHead>
            <TableHead className="text-right">Montant total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {status.expenses.map((e) => {
            const isPartial = Math.abs(e.contribution - e.totalAmount) > 0.01;
            return (
              <TableRow key={e.id}>
                <TableCell className="text-xs whitespace-nowrap">
                  {e.dateIncurred.split('T')[0]}
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={`/dashboard/costs/${e.id}`} className="hover:underline">
                    {e.label}
                  </Link>
                  {e.site && (
                    <div className="text-xs text-muted-foreground">{e.site.name}</div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {EXPENSE_TYPE_LABELS[e.type] ?? e.type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">
                    {FREQ_LABELS[e.frequency] ?? e.frequency}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">
                  {e.bearer ? (
                    <span>
                      {e.bearer.code} — {e.bearer.name}
                    </span>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatCurrency(e.contribution, e.currency)}
                </TableCell>
                <TableCell
                  className={
                    'text-right tabular-nums ' +
                    (isPartial ? 'text-muted-foreground' : 'font-medium')
                  }
                >
                  {formatCurrency(e.totalAmount, e.currency)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
