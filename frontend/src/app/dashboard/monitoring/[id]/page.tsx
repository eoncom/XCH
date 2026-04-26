'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import {
  ArrowLeft,
  Activity,
  Play,
  Pencil,
  Trash2,
  Loader2,
  Globe,
  Network,
  Wifi,
  Building2,
  Package,
  Link as LinkIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { monitorsApi, MonitorCheck, MonitorKind, MonitorStatus } from '@/lib/api/monitors';
import { MonitorDialog } from '@/components/monitoring/MonitorDialog';

const PAGE_SIZE = 50;
const SPARKLINE_LIMIT = 100;

const KIND_ICONS: Record<MonitorKind, typeof Wifi> = {
  ICMP: Wifi,
  HTTP: Globe,
  TCP: Network,
};

const KIND_LABELS: Record<MonitorKind, string> = {
  ICMP: 'Ping (ICMP)',
  HTTP: 'Site web (HTTP)',
  TCP: 'Port TCP',
};

export default function MonitorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'all' | MonitorStatus>('all');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['monitor', id] });
    queryClient.invalidateQueries({ queryKey: ['monitors'] });
  };

  const runNow = useMutation({
    mutationFn: () => monitorsApi.runNow(id),
    onSuccess: () => {
      toast.success('Test lancé — résultat dans quelques secondes');
      setTimeout(invalidate, 3000);
    },
    onError: (e: any) => toast.error(e.message || 'Échec'),
  });

  const toggleEnabled = useMutation({
    mutationFn: (enabled: boolean) => monitorsApi.update(id, { enabled }),
    onSuccess: (_, enabled) => {
      toast.success(enabled ? 'Surveillance activée' : 'Surveillance désactivée');
      invalidate();
    },
    onError: (e: any) => toast.error(e.message || 'Échec'),
  });

  const deleteCheck = useMutation({
    mutationFn: () => monitorsApi.delete(id),
    onSuccess: () => {
      toast.success('Surveillance supprimée');
      router.push('/dashboard/monitoring');
    },
    onError: (e: any) => toast.error(e.message || 'Échec de la suppression'),
  });

  const totalPages = history ? Math.max(1, Math.ceil(history.total / PAGE_SIZE)) : 1;

  // ─────────────────────────────────────────────────────────────────────────
  // Parent context derivation (ADR-016)
  // ─────────────────────────────────────────────────────────────────────────
  const ParentIcon = check?.asset
    ? Package
    : check?.link
    ? LinkIcon
    : Building2;

  const displayName = check
    ? check.asset?.name ??
      (check.link ? `Lien ${check.link.role.toLowerCase()} ${check.link.provider}` : null) ??
      check.site?.name ??
      check.target
    : '…';

  const parentDescription = check?.asset
    ? `Équipement · ${check.asset.type}`
    : check?.link
    ? `Lien de connectivité · ${check.link.type ?? 'inconnu'}`
    : check?.site
    ? 'Surveillance globale du site'
    : '';

  const siteName =
    check?.site?.name ??
    check?.asset?.site?.name ??
    check?.link?.site?.name ??
    null;

  const siteId =
    check?.siteId ?? check?.asset?.siteId ?? check?.link?.siteId ?? null;

  const Icon = check ? KIND_ICONS[check.kind] : Activity;
  const targetTechnical =
    check?.kind === 'TCP'
      ? `${check.target}:${check.targetPort}`
      : check?.target ?? '';
  const probeLabel = check ? KIND_LABELS[check.kind] : '';

  return (
    <div className="space-y-6">
      {/* Header — parent context first, technical target second */}
      <div className="space-y-3">
        <Link
          href="/dashboard/monitoring"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Retour à la surveillance
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <ParentIcon className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-2xl font-semibold truncate">{displayName}</h1>
              {check && <StatusBadge status={check.lastStatus} enabled={check.enabled} />}
            </div>

            <p className="text-sm text-muted-foreground mt-1">
              {parentDescription}
              {siteName && (
                <>
                  {parentDescription && ' · '}
                  <Link
                    href={`/dashboard/sites/${siteId}`}
                    className="underline hover:text-foreground"
                  >
                    Site {siteName}
                  </Link>
                </>
              )}
            </p>

            {check && (
              <div className="flex items-center gap-2 mt-3 text-sm">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{probeLabel} ·</span>
                <code className="font-mono bg-muted px-2 py-0.5 rounded text-xs">
                  {targetTechnical}
                </code>
                <span className="text-xs text-muted-foreground">
                  · vérifié toutes les {formatInterval(check.intervalSec)}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {check && (
              <div className="flex items-center gap-2 mr-2">
                <span className="text-xs text-muted-foreground">
                  {check.enabled ? 'Active' : 'Désactivée'}
                </span>
                <Switch
                  checked={check.enabled}
                  onCheckedChange={(v) => toggleEnabled.mutate(v)}
                  disabled={toggleEnabled.isPending}
                  aria-label="Activer / désactiver la surveillance"
                />
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4 mr-1" />
              Modifier
            </Button>
            <Button onClick={() => runNow.mutate()} disabled={runNow.isPending} size="sm">
              {runNow.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-1" />
              )}
              Tester maintenant
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteOpen(true)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Uptime cards */}
      <div className="grid gap-3 grid-cols-3">
        <UptimeCard label="24 heures" data={summary?.['24h']} />
        <UptimeCard label="7 jours" data={summary?.['7d']} />
        <UptimeCard label="30 jours" data={summary?.['30d']} />
      </div>

      {/* Sparkline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tendance — 100 dernières vérifications</CardTitle>
          <CardDescription>
            Vert = disponible · Rouge = indisponible · Gris = en attente. Plus récent à droite.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!sparkline || sparkline.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">En attente du premier résultat.</p>
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
                  title={`${new Date(r.checkedAt).toLocaleString('fr-FR')} — ${humanStatus(r.status)}${r.responseMs ? ` (${r.responseMs}ms)` : ''}${r.error ? ` — ${r.error}` : ''}`}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed history */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Historique détaillé</CardTitle>
            <CardDescription>
              {history ? `${history.total} vérification${history.total > 1 ? 's' : ''}` : '…'}
            </CardDescription>
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v as any);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="UP">Disponible</SelectItem>
              <SelectItem value="DOWN">Indisponible</SelectItem>
              <SelectItem value="UNKNOWN">En attente</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Temps de réponse</TableHead>
                <TableHead>Erreur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    Aucune vérification ne correspond.
                  </TableCell>
                </TableRow>
              )}
              {history?.items.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">
                    {new Date(r.checkedAt).toLocaleString('fr-FR')}
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

      {/* Edit dialog */}
      {editOpen && check && (
        <MonitorDialog
          mode="edit"
          editing={check}
          onClose={() => setEditOpen(false)}
          onSaved={invalidate}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette surveillance ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'historique des {history?.total ?? 0} vérification(s) sera également supprimé.
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCheck.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status, enabled = true }: { status: MonitorStatus; enabled?: boolean }) {
  if (!enabled) return <Badge variant="outline">Désactivée</Badge>;
  if (status === 'UP') {
    return <Badge className="bg-green-600 hover:bg-green-600">Disponible</Badge>;
  }
  if (status === 'DOWN') return <Badge variant="destructive">Indisponible</Badge>;
  return <Badge variant="secondary">En attente</Badge>;
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
        <CardDescription>Disponibilité {label}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-bold ${color}`}>
          {uptime === null ? '—' : `${uptime.toFixed(2)}%`}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {data ? `${data.up}/${data.total} vérifications` : '—'}
        </p>
      </CardContent>
    </Card>
  );
}

function humanStatus(s: MonitorStatus): string {
  if (s === 'UP') return 'Disponible';
  if (s === 'DOWN') return 'Indisponible';
  return 'En attente';
}

function formatInterval(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)} min`;
  return `${Math.round(sec / 3600)} h`;
}
