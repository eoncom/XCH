// @ts-nocheck
'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { expensesApi, type BearerReport, type TargetReport } from '@/lib/api/costs';
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import Link from 'next/link';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
}

export default function CostReportsPage() {
  const { data: bearerReport = [] } = useQuery<BearerReport[]>({
    queryKey: ['report-by-bearer'],
    queryFn: () => expensesApi.reportByBearer(),
  });

  const { data: targetReport = [] } = useQuery<TargetReport[]>({
    queryKey: ['report-by-target'],
    queryFn: () => expensesApi.reportByTarget(),
  });

  const totalBorne = bearerReport.reduce((s, r) => s + r.totalBorne, 0);
  const totalImputed = targetReport.reduce((s, r) => s + r.totalImputed, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/costs"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Rapports coûts</h1>
          <p className="text-muted-foreground">Vue consolidée des dépenses et refacturations</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total porté</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBorne)}</div>
            <p className="text-xs text-muted-foreground">{bearerReport.length} porteur(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total imputé</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalImputed)}</div>
            <p className="text-xs text-muted-foreground">{targetReport.length} cible(s)</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="bearer" className="w-full">
        <TabsList>
          <TabsTrigger value="bearer">Par porteur</TabsTrigger>
          <TabsTrigger value="target">Par cible</TabsTrigger>
        </TabsList>

        {/* By Bearer */}
        <TabsContent value="bearer" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Dépenses par porteur</CardTitle>
              <p className="text-sm text-muted-foreground">Qui a payé combien, et combien a été refacturé</p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Porteur</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Total porté</TableHead>
                    <TableHead className="text-right">Total refacturé</TableHead>
                    <TableHead className="text-right">Solde net</TableHead>
                    <TableHead className="text-right">Dépenses</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bearerReport.map((row) => (
                    <TableRow key={row.bearer.id}>
                      <TableCell className="font-medium">{row.bearer.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.bearer.type}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(row.totalBorne)}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(row.totalRefactured)}</TableCell>
                      <TableCell className="text-right font-medium">
                        <span className={row.netBorne > 0 ? 'text-red-600' : 'text-green-600'}>
                          {formatCurrency(row.netBorne)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{row.expenseCount}</TableCell>
                    </TableRow>
                  ))}
                  {bearerReport.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Aucune donnée
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Target */}
        <TabsContent value="target" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Coûts imputés par cible</CardTitle>
              <p className="text-sm text-muted-foreground">Combien est refacturé à chaque entité</p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cible</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Total imputé</TableHead>
                    <TableHead className="text-right">Nb allocations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {targetReport.map((row) => (
                    <TableRow key={row.target.id}>
                      <TableCell className="font-medium">{row.target.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.target.type}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(row.totalImputed)}</TableCell>
                      <TableCell className="text-right">{row.allocationCount}</TableCell>
                    </TableRow>
                  ))}
                  {targetReport.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Aucune donnée
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
