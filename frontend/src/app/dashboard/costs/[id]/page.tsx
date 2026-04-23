'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Pencil, Building2, Package, Receipt, ExternalLink } from 'lucide-react';
import { expensesApi } from '@/lib/api/costs';
import { formatCurrency } from '@/lib/currency';
import { AccessGate } from '@/components/AccessGate';
import { usePermissions } from '@/hooks/usePermissions';

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  EQUIPMENT: 'Équipement',
  SERVICE: 'Service',
  PROJECT: 'Projet',
  CONSUMABLE: 'Consommable',
  LICENSE: 'Licence',
  OTHER: 'Autre',
};

const FREQ_LABELS: Record<string, string> = {
  ONE_TIME: 'Ponctuel',
  MONTHLY: 'Mensuel',
  QUARTERLY: 'Trimestriel',
  YEARLY: 'Annuel',
};

export default function ExpenseDetailPageWrapper() {
  return (
    <AccessGate
      required="manage"
      title="Accès refusé"
      description="Le détail d'une dépense est réservé aux administrateurs de délégation et aux super administrateurs."
    >
      <ExpenseDetailPage />
    </AccessGate>
  );
}

function ExpenseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { canWrite } = usePermissions();
  const expenseId = params?.id as string;

  const { data: expense, isLoading, error } = useQuery({
    queryKey: ['expense', expenseId],
    queryFn: () => expensesApi.getById(expenseId),
    enabled: !!expenseId,
  });

  if (isLoading) {
    return <p className="text-muted-foreground text-center py-12">Chargement…</p>;
  }
  if (error || !expense) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-muted-foreground">Dépense introuvable.</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/costs">
            <ArrowLeft className="mr-2 h-4 w-4" /> Retour
          </Link>
        </Button>
      </div>
    );
  }

  const e = expense as any;
  const totalPct = (e.allocations ?? []).reduce(
    (s: number, a: any) => s + Number(a.percentage ?? 0),
    0,
  );
  const bearerPct = Math.max(0, 100 - totalPct);
  const bearerAmount = Number(e.totalAmount) * (bearerPct / 100);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/costs">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold truncate">{e.label}</h1>
            <p className="text-sm text-muted-foreground">
              Dépense {FREQ_LABELS[e.frequency] ?? e.frequency} · créée le{' '}
              {new Date(e.createdAt).toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>
        {canWrite && (
          <Button asChild>
            <Link href={`/dashboard/costs/${expenseId}/edit`}>
              <Pencil className="mr-2 h-4 w-4" /> Modifier
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Synthèse</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
            <div>
              <p className="text-muted-foreground">Montant total</p>
              <p className="text-2xl font-bold tabular-nums">
                {formatCurrency(e.totalAmount, e.currency)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Type</p>
              <Badge variant="outline" className="mt-1">
                {EXPENSE_TYPE_LABELS[e.type] ?? e.type}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Fréquence</p>
              <Badge variant="secondary" className="mt-1">
                {FREQ_LABELS[e.frequency] ?? e.frequency}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Date</p>
              <p className="font-medium">
                {new Date(e.dateIncurred).toLocaleDateString('fr-FR')}
              </p>
              {e.frequency !== 'ONE_TIME' && (
                <p className="text-xs text-muted-foreground mt-1">
                  {e.dateStart
                    ? `Du ${new Date(e.dateStart).toLocaleDateString('fr-FR')}`
                    : '—'}
                  {e.dateEnd
                    ? ` au ${new Date(e.dateEnd).toLocaleDateString('fr-FR')}`
                    : e.dateStart
                      ? ' (sans fin)'
                      : ''}
                </p>
              )}
            </div>
          </div>
          {e.description && (
            <p className="text-sm mt-4 pt-4 border-t text-muted-foreground">
              {e.description}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" /> Porteur & Rattachement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <p className="text-muted-foreground">Porteur</p>
              <p className="font-medium">
                {e.bearer ? `${e.bearer.code} — ${e.bearer.name}` : '—'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Délégation</p>
              <p className="font-medium">
                {e.delegation?.name ?? e.delegationId ?? '—'}
              </p>
            </div>
            {e.site && (
              <div>
                <p className="text-muted-foreground">Site</p>
                <p className="font-medium">{e.site.name}</p>
              </div>
            )}
            {e.assetId && (
              <div>
                <p className="text-muted-foreground flex items-center gap-1">
                  <Package className="h-3 w-3" /> Équipement lié
                </p>
                <Link
                  href={`/dashboard/assets/${e.assetId}`}
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  Voir l'équipement <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4" /> Références
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {e.vendorContact ? (
              <div>
                <p className="text-muted-foreground">Fournisseur</p>
                <p className="font-medium">
                  {e.vendorContact.name}
                  {e.vendorContact.company ? ` — ${e.vendorContact.company}` : ''}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Aucun fournisseur lié.
              </p>
            )}
            {e.externalRef && (
              <div>
                <p className="text-muted-foreground">Référence externe</p>
                <p className="font-medium">{e.externalRef}</p>
              </div>
            )}
            {e.invoiceRef && (
              <div>
                <p className="text-muted-foreground">N° facture</p>
                <p className="font-medium">{e.invoiceRef}</p>
              </div>
            )}
            {e.poNumber && (
              <div>
                <p className="text-muted-foreground">Bon de commande</p>
                <p className="font-medium">{e.poNumber}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Refacturation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={
              'rounded-md border px-3 py-2 text-sm flex items-center justify-between ' +
              (totalPct === 0
                ? 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200'
                : totalPct === 100
                  ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200'
                  : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200')
            }
          >
            <span>
              <span className="font-semibold">
                {e.bearer ? `${e.bearer.code} — ${e.bearer.name}` : 'Le porteur'}
              </span>{' '}
              {totalPct === 100
                ? 'ne supporte rien (100% refacturé).'
                : `supporte ${bearerPct}% de cette dépense.`}
            </span>
            <span className="font-semibold tabular-nums">
              {formatCurrency(bearerAmount, e.currency)}
            </span>
          </div>

          {(e.allocations?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              Aucune refacturation configurée.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cible</TableHead>
                  <TableHead className="text-right">Pourcentage</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {e.allocations.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      {a.target?.code
                        ? `${a.target.code} — ${a.target.name}`
                        : a.targetId}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(a.percentage).toFixed(2)} %
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(a.amount, e.currency)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {a.notes ?? ''}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {e.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{e.notes}</CardContent>
        </Card>
      )}
    </div>
  );
}
