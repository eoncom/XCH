'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { expensesApi, type BearerReport } from '@/lib/api/costs';
import { formatCurrency } from '@/lib/currency';
import { Building2, ExternalLink } from 'lucide-react';

/**
 * Top-N summary of amounts supported per BillingEntity ("centre de coût").
 * Links through to /dashboard/costs/reports for the full detailed report.
 */
export function BearerSummaryCard({ limit = 5 }: { limit?: number }) {
  const { data = [], isLoading } = useQuery<BearerReport[]>({
    queryKey: ['report-by-bearer', 'costs-summary'],
    queryFn: () => expensesApi.reportByBearer(),
  });

  const top = data.slice(0, limit);
  const totalAll = data.reduce((sum, b) => sum + b.totalBorne, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Top centres de coût
          </span>
          <Link
            href="/dashboard/costs/reports"
            className="text-xs font-normal text-blue-600 hover:underline flex items-center gap-1"
          >
            Tout voir <ExternalLink className="h-3 w-3" />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Chargement...</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Aucune dépense rattachée.</p>
        ) : (
          <div className="space-y-2">
            {top.map((b) => {
              const pct = totalAll > 0 ? Math.round((b.totalBorne / totalAll) * 100) : 0;
              return (
                <div key={b.bearer.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">
                      <span className="font-medium">{b.bearer.code}</span>{' '}
                      <span className="text-muted-foreground">— {b.bearer.name}</span>
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(b.totalBorne)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded bg-muted">
                    <div
                      className="h-full rounded bg-primary"
                      style={{ width: `${pct}%` }}
                      aria-label={`${pct}%`}
                    />
                  </div>
                </div>
              );
            })}
            {data.length > limit && (
              <p className="text-xs text-muted-foreground pt-1">
                + {data.length - limit} autre(s) — voir le rapport complet.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
