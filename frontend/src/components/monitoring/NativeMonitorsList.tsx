'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Activity, Globe, Network, Wifi, Search, Loader2 } from 'lucide-react';
import { monitorsApi, MonitorCheck, MonitorKind, MonitorStatus } from '@/lib/api/monitors';

const KIND_ICONS: Record<MonitorKind, typeof Wifi> = {
  ICMP: Wifi,
  HTTP: Globe,
  TCP: Network,
};

/**
 * Tenant-wide list of native monitor checks. Embedded at the top of
 * /dashboard/monitoring so the operator can see every probe in one place,
 * filter by kind / status, and jump to the per-monitor history.
 */
export function NativeMonitorsList() {
  const { data, isLoading } = useQuery({
    queryKey: ['monitors', 'all'],
    queryFn: () => monitorsApi.getAll(),
    refetchInterval: 30_000,
  });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | MonitorStatus>('all');
  const [kindFilter, setKindFilter] = useState<'all' | MonitorKind>('all');

  const list = data ?? [];

  const filtered = useMemo(() => {
    return list.filter((c) => {
      if (statusFilter !== 'all' && c.lastStatus !== statusFilter) return false;
      if (kindFilter !== 'all' && c.kind !== kindFilter) return false;
      if (search) {
        const needle = search.toLowerCase();
        const haystack =
          `${c.target} ${c.site?.name ?? ''} ${c.asset?.name ?? ''} ${c.link?.provider ?? ''}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [list, search, statusFilter, kindFilter]);

  const counts = useMemo(() => {
    const c = { total: list.length, up: 0, down: 0, unknown: 0 };
    for (const m of list) {
      if (m.lastStatus === 'UP') c.up++;
      else if (m.lastStatus === 'DOWN') c.down++;
      else c.unknown++;
    }
    return c;
  }, [list]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              Monitors
            </CardTitle>
            <CardDescription>
              {counts.total} monitor{counts.total > 1 ? 's' : ''}
              {counts.total > 0 && (
                <>
                  {' · '}
                  <span className="text-green-600">{counts.up} UP</span>
                  {counts.down > 0 && (
                    <>
                      {' · '}
                      <span className="text-red-600 font-medium">{counts.down} DOWN</span>
                    </>
                  )}
                  {counts.unknown > 0 && ` · ${counts.unknown} en attente`}
                </>
              )}
            </CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher cible / site / équipement…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as any)}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous types</SelectItem>
              <SelectItem value="ICMP">ICMP</SelectItem>
              <SelectItem value="HTTP">HTTP</SelectItem>
              <SelectItem value="TCP">TCP</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="UP">UP</SelectItem>
              <SelectItem value="DOWN">DOWN</SelectItem>
              <SelectItem value="UNKNOWN">En attente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {list.length === 0
              ? 'Aucun monitor configuré. Ajoutez-en depuis la fiche d\'un équipement ou d\'un lien de connectivité.'
              : 'Aucun monitor ne correspond aux filtres.'}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Cible</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Rattaché à</TableHead>
                <TableHead>Intervalle</TableHead>
                <TableHead>Dernière vérif.</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const Icon = KIND_ICONS[c.kind];
                const targetDisplay = c.kind === 'TCP' ? `${c.target}:${c.targetPort}` : c.target;
                const parent =
                  c.asset?.name ??
                  (c.link ? `${c.link.provider} (${c.link.role})` : null) ??
                  c.site?.name ??
                  '—';
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-xs truncate">
                      {targetDisplay}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.lastStatus} enabled={c.enabled} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {parent}
                      {c.site?.name && c.asset?.name && (
                        <span className="text-xs text-muted-foreground ml-1">· {c.site.name}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatInterval(c.intervalSec)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.lastCheckedAt ? timeAgo(c.lastCheckedAt) : 'jamais'}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/dashboard/monitoring/${c.id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        Détail
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status, enabled }: { status: MonitorStatus; enabled: boolean }) {
  if (!enabled) return <Badge variant="outline">Désactivé</Badge>;
  if (status === 'UP') return <Badge className="bg-green-600 hover:bg-green-600">UP</Badge>;
  if (status === 'DOWN') return <Badge variant="destructive">DOWN</Badge>;
  return <Badge variant="secondary">—</Badge>;
}

function formatInterval(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)} min`;
  return `${Math.round(sec / 3600)} h`;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min`;
  return `${Math.round(ms / 3_600_000)} h`;
}
