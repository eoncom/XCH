'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Activity,
  Plus,
  Trash2,
  Play,
  Pencil,
  Globe,
  Network,
  Wifi,
  Loader2,
} from 'lucide-react';
import {
  monitorsApi,
  MonitorCheck,
  MonitorKind,
} from '@/lib/api/monitors';
import { MonitorDialog } from './MonitorDialog';

type TargetType = 'site' | 'asset' | 'link';

interface Props {
  /** Which kind of parent entity owns these monitors. */
  targetType: TargetType;
  /** ID of the parent entity (siteId, assetId, or linkId). */
  targetId: string;
  /** Pre-fill the target field on the create form (e.g. asset.ip). */
  defaultTarget?: string;
  /** Show in compact mode (used inside ConnectivityLinksManager rows). */
  compact?: boolean;
  /** Disable mutations (read-only mode for users without WRITE). */
  readOnly?: boolean;
}

const KIND_ICONS: Record<MonitorKind, typeof Wifi> = {
  ICMP: Wifi,
  HTTP: Globe,
  TCP: Network,
};

export function MonitorConfigSection({
  targetType,
  targetId,
  defaultTarget,
  compact = false,
  readOnly = false,
}: Props) {
  const queryClient = useQueryClient();
  const [dialogMode, setDialogMode] = useState<
    | { mode: 'closed' }
    | { mode: 'create' }
    | { mode: 'edit'; check: MonitorCheck }
  >({ mode: 'closed' });

  const queryKey = ['monitors', targetType, targetId];
  const { data: checks, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      monitorsApi.getAll({
        siteId: targetType === 'site' ? targetId : undefined,
        assetId: targetType === 'asset' ? targetId : undefined,
        linkId: targetType === 'link' ? targetId : undefined,
      }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => monitorsApi.delete(id),
    onSuccess: () => {
      toast.success('Monitor supprimé');
      invalidate();
    },
    onError: (err: any) => toast.error(err.message || 'Échec de la suppression'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      monitorsApi.update(id, { enabled }),
    onSuccess: () => invalidate(),
    onError: (err: any) => toast.error(err.message || 'Échec'),
  });

  const runNowMutation = useMutation({
    mutationFn: (id: string) => monitorsApi.runNow(id),
    onSuccess: () => {
      toast.success('Probe lancée — résultat dans quelques secondes');
      setTimeout(invalidate, 3000);
    },
    onError: (err: any) => toast.error(err.message || 'Échec'),
  });

  const list = checks ?? [];

  return (
    <Card className={compact ? 'border-0 shadow-none' : ''}>
      {!compact && (
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              Monitoring natif
            </CardTitle>
            <CardDescription>
              {list.length === 0
                ? 'Aucun monitor configuré pour cet objet.'
                : `${list.length} monitor${list.length > 1 ? 's' : ''} actif${list.length > 1 ? 's' : ''}.`}
            </CardDescription>
          </div>
          {!readOnly && (
            <Button size="sm" onClick={() => setDialogMode({ mode: 'create' })} disabled={isLoading}>
              <Plus className="mr-1 h-4 w-4" />
              Ajouter
            </Button>
          )}
        </CardHeader>
      )}
      <CardContent className="space-y-2">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement…
          </div>
        )}

        {!isLoading && list.length === 0 && compact && !readOnly && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialogMode({ mode: 'create' })}
            className="w-full"
          >
            <Plus className="mr-1 h-4 w-4" />
            Ajouter un monitor
          </Button>
        )}

        {list.map((check) => {
          const Icon = KIND_ICONS[check.kind];
          const targetDisplay =
            check.kind === 'TCP'
              ? `${check.target}:${check.targetPort}`
              : check.target;
          return (
            <div
              key={check.id}
              className="flex items-center gap-3 rounded-md border bg-card p-2 text-sm"
            >
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <StatusBadge status={check.lastStatus} />
              <SeverityBadge severity={check.severity} />
              <div className="flex-1 min-w-0">
                <div className="font-mono text-xs truncate">{targetDisplay}</div>
                <div className="text-xs text-muted-foreground">
                  {check.kind} · toutes les {formatInterval(check.intervalSec)}
                  {check.lastCheckedAt && ` · vérifié ${timeAgo(check.lastCheckedAt)}`}
                </div>
              </div>
              {!readOnly && (
                <>
                  <Switch
                    checked={check.enabled}
                    onCheckedChange={(enabled) =>
                      toggleMutation.mutate({ id: check.id, enabled })
                    }
                    aria-label={check.enabled ? 'Désactiver' : 'Activer'}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => runNowMutation.mutate(check.id)}
                    disabled={runNowMutation.isPending}
                    title="Lancer maintenant"
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDialogMode({ mode: 'edit', check })}
                    title="Modifier"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Link
                href={`/dashboard/monitoring/${check.id}`}
                className="text-xs text-primary hover:underline"
              >
                Historique
              </Link>
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm('Supprimer ce monitor ?')) {
                      deleteMutation.mutate(check.id);
                    }
                  }}
                  title="Supprimer"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        })}

        {compact && !readOnly && list.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialogMode({ mode: 'create' })}
            className="w-full"
          >
            <Plus className="mr-1 h-4 w-4" />
            Ajouter un monitor
          </Button>
        )}
      </CardContent>

      {dialogMode.mode === 'create' && (
        <MonitorDialog
          mode="create"
          targetType={targetType}
          targetId={targetId}
          defaultTarget={defaultTarget}
          onClose={() => setDialogMode({ mode: 'closed' })}
          onSaved={invalidate}
        />
      )}
      {dialogMode.mode === 'edit' && (
        <MonitorDialog
          mode="edit"
          editing={dialogMode.check}
          onClose={() => setDialogMode({ mode: 'closed' })}
          onSaved={invalidate}
        />
      )}
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: MonitorCheck['lastStatus'] }) {
  if (status === 'UP') return <Badge className="bg-green-600 hover:bg-green-600">UP</Badge>;
  if (status === 'DOWN') return <Badge variant="destructive">DOWN</Badge>;
  return <Badge variant="secondary">—</Badge>;
}

function SeverityBadge({ severity }: { severity: MonitorCheck['severity'] }) {
  // ADR-022 — operational severity surfaced as a small contextual badge.
  // Defaults are silent (WARNING) ; CRITICAL/INFO call attention.
  if (severity === 'CRITICAL') {
    return (
      <Badge variant="outline" className="border-red-500 text-red-700" title="Critique : DOWN escalade le site en CRITICAL">
        CRIT
      </Badge>
    );
  }
  if (severity === 'INFO') {
    return (
      <Badge variant="outline" className="border-blue-500 text-blue-700" title="Info : DOWN n'impacte pas la santé site">
        INFO
      </Badge>
    );
  }
  // WARNING is the default — display silently to avoid badge clutter
  return null;
}

// MonitorDialog extracted to ./MonitorDialog.tsx (ADR-016 follow-up) so it
// can be reused by the central /dashboard/monitoring/[id] detail page.

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function formatInterval(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)} min`;
  return `${Math.round(sec / 3600)} h`;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `il y a ${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `il y a ${Math.round(ms / 60_000)} min`;
  return `il y a ${Math.round(ms / 3_600_000)} h`;
}
