// @ts-nocheck
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { expensesApi, billingEntitiesApi, type Expense, type BillingEntity } from '@/lib/api/costs';
import { usePermissions } from '@/hooks/usePermissions';
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
import { Plus, Search, Receipt, Building2, TrendingUp, DollarSign, Trash2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useState, useMemo, useEffect } from 'react';

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  EQUIPMENT: 'Équipement',
  SERVICE: 'Service',
  PROJECT: 'Projet',
  CONSUMABLE: 'Consommable',
  LICENSE: 'Licence',
  OTHER: 'Autre',
};

const EXPENSE_TYPE_COLORS: Record<string, string> = {
  EQUIPMENT: 'bg-blue-100 text-blue-800',
  SERVICE: 'bg-purple-100 text-purple-800',
  PROJECT: 'bg-orange-100 text-orange-800',
  CONSUMABLE: 'bg-gray-100 text-gray-800',
  LICENSE: 'bg-green-100 text-green-800',
  OTHER: 'bg-yellow-100 text-yellow-800',
};

const FREQ_LABELS: Record<string, string> = {
  ONE_TIME: 'Ponctuel',
  MONTHLY: 'Mensuel',
  QUARTERLY: 'Trimestriel',
  YEARLY: 'Annuel',
};

function formatCurrency(amount: number, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
}

export default function CostsPage() {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterBearerId, setFilterBearerId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { canCreate, canDelete } = usePermissions();

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [filterType, filterBearerId]);

  const { data: response, isLoading } = useQuery({
    queryKey: ['expenses', filterType, filterBearerId, page, pageSize],
    queryFn: () => expensesApi.getAll({
      type: filterType || undefined,
      bearerId: filterBearerId || undefined,
      page,
      pageSize,
    }),
  });
  const expenses = response?.data ?? [];
  const paginationMeta = response?.meta;

  const { data: entitiesResponse } = useQuery<BillingEntity[]>({
    queryKey: ['billing-entities'],
    queryFn: () => billingEntitiesApi.getAll(),
  });
  const entities = entitiesResponse ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expensesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  });

  const filtered = useMemo(() => {
    if (!search) return expenses;
    const q = search.toLowerCase();
    return expenses.filter(e =>
      e.label.toLowerCase().includes(q) ||
      e.vendor?.toLowerCase().includes(q) ||
      e.bearer?.name?.toLowerCase().includes(q)
    );
  }, [expenses, search]);

  // Summary cards
  const totalAmount = filtered.reduce((sum, e) => sum + e.totalAmount, 0);
  const totalAllocated = filtered.reduce((sum, e) =>
    sum + e.allocations.reduce((s, a) => s + a.amount, 0), 0
  );
  const typeCounts = filtered.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (isLoading) return <div className="text-center">Chargement...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Coûts</h1>
          <p className="text-muted-foreground">Suivi des dépenses et répartition des coûts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/costs/entities">
              <Building2 className="mr-2 h-4 w-4" />
              Centres de coût
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/costs/reports">
              <TrendingUp className="mr-2 h-4 w-4" />
              Rapports
            </Link>
          </Button>
          {canCreate('expenses') && (
            <Button asChild>
              <Link href="/dashboard/costs/new">
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle dépense
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total dépenses</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div>
            <p className="text-xs text-muted-foreground">{filtered.length} dépense(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total réparti</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalAllocated)}</div>
            <p className="text-xs text-muted-foreground">
              {totalAmount > 0 ? Math.round((totalAllocated / totalAmount) * 100) : 0}% du total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Par type</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {Object.entries(typeCounts).map(([type, count]) => (
                <Badge key={type} variant="outline" className="text-xs">
                  {EXPENSE_TYPE_LABELS[type] || type}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une dépense..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterType} onValueChange={(v) => setFilterType(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {Object.entries(EXPENSE_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterBearerId} onValueChange={(v) => setFilterBearerId(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Porteur" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les porteurs</SelectItem>
            {entities.map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Expenses table */}
      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Porteur</TableHead>
                <TableHead>Cibles</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="font-medium">
                    <Link href={`/dashboard/costs/${expense.id}/edit`} className="hover:underline">
                      {expense.label}
                    </Link>
                    {expense.vendor && (
                      <span className="block text-xs text-muted-foreground">{expense.vendor}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${EXPENSE_TYPE_COLORS[expense.type] || ''}`}>
                      {EXPENSE_TYPE_LABELS[expense.type] || expense.type}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(expense.totalAmount, expense.currency)}
                    {expense.frequency !== 'ONE_TIME' && (
                      <span className="block text-xs text-muted-foreground">
                        {FREQ_LABELS[expense.frequency]}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{expense.bearer?.name || '—'}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {expense.allocations.map((a) => (
                        <Badge key={a.id} variant="secondary" className="text-xs">
                          {a.target?.name || a.targetId} ({a.percentage}%)
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(expense.dateIncurred).toLocaleDateString('fr-FR')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/costs/${expense.id}/edit`}>Modifier</Link>
                      </Button>
                      {canDelete('expenses') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setPendingDeleteId(expense.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Aucune dépense trouvée
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {paginationMeta && <Pagination meta={paginationMeta} onPageChange={setPage} onPageSizeChange={setPageSize} />}
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingDeleteId} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Supprimer cette dépense ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDeleteId) deleteMutation.mutate(pendingDeleteId);
                setPendingDeleteId(null);
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
