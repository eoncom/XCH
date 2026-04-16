// @ts-nocheck
'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Zap, Server, Euro } from 'lucide-react';
import { consumptionApi, type SiteConsumption } from '@/lib/api/consumption';

export default function SiteConsumptionPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = use(params);
  const [data, setData] = useState<SiteConsumption | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    consumptionApi.site(siteId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [siteId]);

  if (loading) {
    return <div className="flex justify-center items-center h-64">Chargement...</div>;
  }
  if (!data) {
    return <p className="text-muted-foreground">Impossible de charger les données.</p>;
  }

  const byTypeEntries = Object.entries(data.byType || {}).sort((a, b) => b[1].watts - a[1].watts);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/consumption">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="h-7 w-7 text-yellow-500" />
            {data.site.name}
          </h1>
          <p className="text-muted-foreground">Code : {data.site.code}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.assetCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Puissance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.totalWatts.toFixed(0)} W</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Conso mensuelle</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.kWhMonth.toFixed(1)} kWh</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Coût mensuel</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {data.costMonth.toFixed(2)} {data.currency}
            </p>
            <p className="text-xs text-muted-foreground">{data.costPerKwh.toFixed(3)} {data.currency}/kWh</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-5 w-5" /> Répartition par type d'asset
          </CardTitle>
        </CardHeader>
        <CardContent>
          {byTypeEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Aucun asset avec puissance renseignée.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Puissance totale</TableHead>
                  <TableHead>% du total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byTypeEntries.map(([type, stats]) => {
                  const pct = data.totalWatts > 0 ? (stats.watts / data.totalWatts) * 100 : 0;
                  return (
                    <TableRow key={type}>
                      <TableCell className="font-medium">
                        <Badge variant="secondary">{type}</Badge>
                      </TableCell>
                      <TableCell>{stats.count}</TableCell>
                      <TableCell>{stats.watts.toFixed(0)} W</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden min-w-[100px] max-w-[200px]">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{pct.toFixed(1)}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data.site.autoGenerateElectricityExpense && (
        <Card className="border-green-300 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-4">
            <p className="text-sm">
              <strong>Auto-génération activée :</strong> une dépense électricité sera créée chaque mois pour ce site.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
