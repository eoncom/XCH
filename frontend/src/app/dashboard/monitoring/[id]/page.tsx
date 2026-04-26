'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Activity, Play, Loader2 } from 'lucide-react';
import { monitorsApi, MonitorStatus } from '@/lib/api/monitors';

const PAGE_SIZE = 50;
const SPARKLINE_LIMIT = 100;

export default function MonitorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'all' | MonitorStatus>('all');

  const { data: check } = useQuery({
    queryKey: ['monitor', id],
    queryFn: () => monitorsApi.getById(id),
  });

  const { data: summary } = useQuery({
    queryKey: ['monitor', id, 'summary'],
    queryFn: () => monitorsApi.summary(id),
    refetchInterval: 30_000,
  });

  const { data: sparkline } = useQuery({
    queryKey: ['monitor', id, 'sparkline'],
    queryFn: () => monitorsApi.history(id, { limit: SPARKLINE_LIMIT }),
    refetchInterval: 30_000,
  });

  const { data: history } = useQuery({
    queryKey: ['monitor', id, 'history', page, statusFilter],
    queryFn: () =>
      monitorsApi.history(id, {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
    placeholderData: (previousData) => previousData,
  });

  const runNow = useMutation({
    mutationFn: () => monitorsApi.runNow(id),
    onSuccess: () => {
      toast.success('Probe lancée — résultat dans quelques secondes');
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['monitor', id] });
      }, 3000);
    },
    onError: (e: any) => toast.error(e.message || 'Échec'),
  });

  const totalPages = history ? Math.max(1, Math.ceil(history.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/monitoring"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour
          </Link>
          <h1 className="text-2xl font-semibold mt-1 flex items-center gap-3">
            <Activity className="h-6 w-6" />
            <span className="font-mono text-base bg-muted px-2 py-1 rounded">
              {check?.target ?? '…'}
              {check?.targetPort ? `:${check.targetPort}` : ''}
            </span>
            {check && <StatusBadge status={check.lastStatus} />}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {check ? `${check.kind} · toutes les ${formatInterval(check.intervalSec)}` : '…'}
          </p>
        </div>
        <Button onClick={() => runNow.mutate()} disabled={runNow.isPending}>
          {runNow.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
          Lancer maintenant
        </Button>
      </div>

      <div className="grid gap-3 grid-cols-3">
        <UptimeCard label="24 h" data={summary?.['24h']} />
        <UptimeCard label="7 j" data={summary?.['7d']} />
        <UptimeCard label="30 j" data={summary?.['30d']} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">100 derniers résultats</CardTitle>
          <CardDescription>
            Vert = UP, rouge = DOWN, gris = inconnu. Plus récent à droite.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!sparkline || sparkline.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun résultat encore.</p>
          ) : (
            <div className="flex items-end gap-px h-16">
              {[...sparkline.items].reverse().map((r) => (
                <div
                  key={r.id}
                  className={
                    'flex-1 min-w-[2px] rounded-sm ' +
                    (r.status === 'UP'
                      ? 'bg-green-500'
                      : r.status === 'DOWN'
                      ? 'bg-red-500'
                      : 'bg-muted-foreground/40')
                  }
                  style={{
                    height:
                      r.status === 'UP' && r.responseMs
                        ? `${Math.min(100, Math.max(15, Math.round((r.responseMs / 1000) * 100)))}%`
                        : '100%',
                  }}
                  title={`${new Date(r.checkedAt).toLocaleString()} — ${r.status}${r.responseMs ? ` (${r.responseMs}ms)` : ''}${r.error ? ` — ${r.error}` : ''}`}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Historique détaillé</CardTitle>
            <CardDescription>
              {history ? `${history.total} résultat${history.total > 1 ? 's' : ''}` : '…'}
            </CardDescription>
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as any); setPage(0); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="UP">UP uniquement</SelectItem>
              <SelectItem value="DOWN">DOWN uniquement</SelectItem>
              <SelectItem value="UNKNOWN">UNKNOWN</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>RTT</TableHead>
                <TableHead>Erreur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    Aucun résultat.
                  </TableCell>
                </TableRow>
              )}
              {history?.items.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">
                    {new Date(r.checkedAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.responseMs != null ? `${r.responseMs} ms` : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-md">
                    {r.error ?? ''}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Précédent
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages - 1}
              >
                Suivant
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: MonitorStatus }) {
  if (status === 'UP') return <Badge className="bg-green-600 hover:bg-green-600">UP</Badge>;
  if (status === 'DOWN') return <Badge variant="destructive">DOWN</Badge>;
  return <Badge variant="secondary">—</Badge>;
}

function UptimeCard({
  label,
  data,
}: {
  label: string;
  data: { total: number; up: number; uptime: number | null } | undefined;
}) {
  const uptime = data?.uptime ?? null;
  const color =
    uptime === null
      ? 'text-muted-foreground'
      : uptime >= 99
      ? 'text-green-600'
      : uptime >= 95
      ? 'text-amber-600'
      : 'text-red-600';
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>Uptime {label}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-bold ${color}`}>
          {uptime === null ? '—' : `${uptime.toFixed(2)}%`}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {data ? `${data.up}/${data.total} probes` : '—'}
        </p>
      </CardContent>
    </Card>
  );
}

function formatInterval(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)} min`;
  return `${Math.round(sec / 3600)} h`;
}
