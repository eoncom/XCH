'use client';

import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { expensesApi } from '@/lib/api/costs';
import { formatCurrency } from '@/lib/currency';
import { BarChart3 } from 'lucide-react';

/**
 * Monthly spending bar chart. Defaults to the trailing 12 months so a user
 * opening /dashboard/costs gets an immediate sense of how spending evolves.
 * Consumes the /expenses/reports/by-month endpoint which handles the
 * expansion of recurring expenses over their effective window.
 */
export function CostsEvolutionChart({
  delegationId,
  expenseType,
}: {
  delegationId?: string;
  expenseType?: string;
}) {
  const today = new Date();
  const dateTo = new Date(today.getFullYear(), today.getMonth(), 1);
  const dateFrom = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const { data = [], isLoading } = useQuery({
    queryKey: ['expenses-by-month', delegationId || '', expenseType || '', fmt(dateFrom), fmt(dateTo)],
    queryFn: () =>
      expensesApi.reportByMonth({
        dateFrom: fmt(dateFrom),
        dateTo: new Date(dateTo.getFullYear(), dateTo.getMonth() + 1, 0).toISOString().slice(0, 10),
        delegationId,
        expenseType,
      }),
  });

  // Ensure 12 months even if the API skipped months with zero spend.
  const monthLabels = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(dateFrom.getFullYear(), dateFrom.getMonth() + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const byKey = new Map(data.map((r) => [r.month, r.total]));
  const chartData = monthLabels.map((m) => {
    const [y, mm] = m.split('-');
    return {
      month: `${mm}/${y.slice(2)}`,
      rawMonth: m,
      total: byKey.get(m) ?? 0,
    };
  });

  const ytdTotal = chartData.reduce((acc, d) => acc + d.total, 0);
  const hasSpend = chartData.some((d) => d.total > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Évolution mensuelle — 12 derniers mois
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            Total {formatCurrency(ytdTotal)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Chargement...</p>
        ) : !hasSpend ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Aucune dépense sur les 12 derniers mois.
          </p>
        ) : (
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  className="text-muted-foreground"
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Total']}
                  labelClassName="text-sm font-medium"
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
