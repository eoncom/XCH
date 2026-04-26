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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Activity,
  Plus,
  Trash2,
  Play,
  Globe,
  Network,
  Wifi,
  Loader2,
} from 'lucide-react';
import {
  monitorsApi,
  MonitorCheck,
  MonitorKind,
  CreateMonitorCheckData,
} from '@/lib/api/monitors';

type TargetType = 'site' | 'asset' | 'link';

interface Props {
  /** Which kind of parent entity owns these monitors. */
  targetType: TargetType;
  /** ID of the parent entity (siteId, assetId, or linkId). */
  targetId: string;
  /** Pre-fill the target field on the create form (e.g. asset.networkInfo.ip). */
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

const INTERVAL_PRESETS = [
  { label: '1 min', value: 60 },
  { label: '5 min', value: 300 },
  { label: '15 min', value: 900 },
  { label: '1 h', value: 3600 },
];

export function MonitorConfigSection({
  targetType,
  targetId,
  defaultTarget,
  compact = false,
  readOnly = false,
}: Props) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

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
            <Button size="sm" onClick={() => setShowCreate(true)} disabled={isLoading}>
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
            onClick={() => setShowCreate(true)}
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
            onClick={() => setShowCreate(true)}
            className="w-full"
          >
            <Plus className="mr-1 h-4 w-4" />
            Ajouter un monitor
          </Button>
        )}
      </CardContent>

      {showCreate && (
        <CreateMonitorDialog
          targetType={targetType}
          targetId={targetId}
          defaultTarget={defaultTarget}
          onClose={() => setShowCreate(false)}
          onCreated={invalidate}
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

interface CreateDialogProps {
  targetType: TargetType;
  targetId: string;
  defaultTarget?: string;
  onClose: () => void;
  onCreated: () => void;
}

function CreateMonitorDialog({
  targetType,
  targetId,
  defaultTarget,
  onClose,
  onCreated,
}: CreateDialogProps) {
  const [kind, setKind] = useState<MonitorKind>('ICMP');
  const [target, setTarget] = useState(defaultTarget ?? '');
  const [targetPort, setTargetPort] = useState<string>('80');
  const [intervalSec, setIntervalSec] = useState<number>(300);
  const [expectedStatus, setExpectedStatus] = useState<string>('200');

  const createMutation = useMutation({
    mutationFn: (data: CreateMonitorCheckData) => monitorsApi.create(data),
    onSuccess: () => {
      toast.success('Monitor créé');
      onCreated();
      onClose();
    },
    onError: (err: any) =>
      toast.error(err?.data?.message || err.message || 'Échec de la création'),
  });

  const submit = () => {
    if (!target.trim()) {
      toast.error('Cible obligatoire');
      return;
    }
    const payload: CreateMonitorCheckData = {
      kind,
      target: target.trim(),
      intervalSec,
      siteId: targetType === 'site' ? targetId : undefined,
      assetId: targetType === 'asset' ? targetId : undefined,
      linkId: targetType === 'link' ? targetId : undefined,
    };
    if (kind === 'TCP') {
      const p = Number(targetPort);
      if (!Number.isInteger(p) || p < 1 || p > 65535) {
        toast.error('Port TCP invalide (1-65535)');
        return;
      }
      payload.targetPort = p;
    }
    if (kind === 'HTTP') {
      const s = Number(expectedStatus);
      payload.httpConfig = { expectedStatus: Number.isInteger(s) ? s : 200 };
    }
    createMutation.mutate(payload);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau monitor</DialogTitle>
          <DialogDescription>
            Probe ICMP / HTTP / TCP exécutée par le worker XCH (ADR-014).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Type de probe</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as MonitorKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ICMP">ICMP (ping)</SelectItem>
                <SelectItem value="HTTP">HTTP / HTTPS</SelectItem>
                <SelectItem value="TCP">TCP (port)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>
              Cible{' '}
              <span className="text-xs text-muted-foreground">
                ({kind === 'HTTP' ? 'URL complète' : 'host ou IP'})
              </span>
            </Label>
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={
                kind === 'HTTP' ? 'https://example.com/health' : 'example.com'
              }
            />
          </div>

          {kind === 'TCP' && (
            <div>
              <Label>Port TCP</Label>
              <Input
                type="number"
                min={1}
                max={65535}
                value={targetPort}
                onChange={(e) => setTargetPort(e.target.value)}
              />
            </div>
          )}

          {kind === 'HTTP' && (
            <div>
              <Label>Code HTTP attendu</Label>
              <Input
                type="number"
                min={100}
                max={599}
                value={expectedStatus}
                onChange={(e) => setExpectedStatus(e.target.value)}
              />
            </div>
          )}

          <div>
            <Label>Intervalle</Label>
            <Select
              value={String(intervalSec)}
              onValueChange={(v) => setIntervalSec(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVAL_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={String(p.value)}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : null}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
