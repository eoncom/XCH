// @ts-nocheck
'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ErrorState } from '@/components/ui/error-state';
import { Zap, Server, Euro, TrendingUp, Info } from 'lucide-react';
import { consumptionApi, type ConsumptionSummary } from '@/lib/api/consumption';
import { assetStatusLabels } from '@/lib/asset-labels';
import { formatCurrency } from '@/lib/currency';

export default function ConsumptionPage() {
  // S6 PR4 — was useState+useEffect with a silent .catch(setData(null))
  // that displayed a static "Impossible de charger les données" with no
  // retry. Now properly surfaces network errors via <ErrorState>.
  const { data, isLoading, isError, error, refetch } = useQuery<ConsumptionSummary>({
    queryKey: ['consumption-summary'],
    queryFn: () => consumptionApi.summary(),
  });

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Chargement...</div>;
  }

  if (isError) {
    return (
      <ErrorState
        title="Impossible de charger les consommations"
        error={error}
        onRetry={() => refetch()}
      />
    );
  }

  if (!data) {
    return <p className="text-muted-foreground">Aucune donnée de consommation disponible.</p>;
  }

  const { totals, sites } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Zap className="h-8 w-8 text-yellow-500" />
          Consommation électrique
        </h1>
        <p className="text-muted-foreground mt-1">
          Estimation de la consommation et du coût mensuel (24h/24, 30j) par site — {totals.costPerKwh.toFixed(3)} {totals.currency}/kWh
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" /> Puissance totale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totals.totalWatts.toFixed(0)} W</p>
            <p className="text-xs text-muted-foreground mt-1">Tous les assets actifs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" /> Consommation mensuelle
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totals.kWhMonth.toFixed(1)} kWh</p>
            <p className="text-xs text-muted-foreground mt-1">par mois (30 jours)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Euro className="h-4 w-4 text-green-500" /> Coût mensuel estimé
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(totals.costMonth, totals.currency)}</p>
            <p className="text-xs text-muted-foreground mt-1">par mois</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-5 w-5" /> Détail par site
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sites.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Aucun site.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1.5">
                      Assets
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label="Détail de la colonne Assets"
                              className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Info className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                            <p>Total des équipements liés au site.</p>
                            <p className="mt-1">
                              <strong>Actifs</strong> (parenthèses) = {assetStatusLabels.IN_SERVICE} +{' '}
                              {assetStatusLabels.UNDER_MAINTENANCE} — seuls ces équipements consomment.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </span>
                  </TableHead>
                  <TableHead>Puissance (W)</TableHead>
                  <TableHead>Mensuel (kWh)</TableHead>
                  <TableHead>Coût estimé</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map((s) => (
                  <TableRow key={s.site.id}>
                    <TableCell className="font-medium">
                      <Link href={`/dashboard/consumption/${s.site.id}`} className="hover:underline text-blue-600">
                        {s.site.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{s.site.code}</div>
                    </TableCell>
                    <TableCell>
                      {s.assetCount}
                      {typeof (s as any).activeAssetCount === 'number' && (s as any).activeAssetCount !== s.assetCount && (
                        <span className="text-xs text-muted-foreground ml-1" title={`Actifs (${assetStatusLabels.IN_SERVICE} / ${assetStatusLabels.UNDER_MAINTENANCE}) — seuls ceux-ci contribuent au calcul de la consommation`}>
                          ({(s as any).activeAssetCount} actifs)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{s.totalWatts.toFixed(0)} W</TableCell>
                    <TableCell>{s.kWhMonth.toFixed(1)} kWh</TableCell>
                    <TableCell className="font-semibold">
                      {formatCurrency(s.costMonth, totals.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
