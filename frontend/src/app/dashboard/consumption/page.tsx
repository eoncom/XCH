// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Zap, Server, Euro, TrendingUp } from 'lucide-react';
import { consumptionApi, type ConsumptionSummary } from '@/lib/api/consumption';

export default function ConsumptionPage() {
  const [data, setData] = useState<ConsumptionSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    consumptionApi.summary()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center h-64">Chargement...</div>;
  }

  if (!data) {
    return <p className="text-muted-foreground">Impossible de charger les données.</p>;
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
            <p className="text-3xl font-bold">{totals.costMonth.toFixed(2)} {totals.currency}</p>
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
                  <TableHead>Assets</TableHead>
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
                    <TableCell>{s.assetCount}</TableCell>
                    <TableCell>{s.totalWatts.toFixed(0)} W</TableCell>
                    <TableCell>{s.kWhMonth.toFixed(1)} kWh</TableCell>
                    <TableCell className="font-semibold">
                      {s.costMonth.toFixed(2)} {totals.currency}
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
