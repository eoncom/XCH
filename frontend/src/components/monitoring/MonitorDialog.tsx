'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  monitorsApi,
  MonitorCheck,
  MonitorKind,
  CreateMonitorCheckData,
  UpdateMonitorCheckData,
} from '@/lib/api/monitors';

const INTERVAL_PRESETS = [
  { label: '1 min', value: 60 },
  { label: '5 min', value: 300 },
  { label: '15 min', value: 900 },
  { label: '1 h', value: 3600 },
];

export type MonitorDialogTargetType = 'site' | 'asset' | 'link';

interface CreateProps {
  mode: 'create';
  targetType: MonitorDialogTargetType;
  targetId: string;
  defaultTarget?: string;
  onClose: () => void;
  onSaved: () => void;
}

interface EditProps {
  mode: 'edit';
  editing: MonitorCheck;
  onClose: () => void;
  onSaved: () => void;
}

export type MonitorDialogProps = CreateProps | EditProps;

/**
 * Unified create/edit dialog for a MonitorCheck (ADR-016).
 * Reused by MonitorConfigSection (per-entity inline) and the central
 * /dashboard/monitoring/[id] detail page.
 */
export function MonitorDialog(props: MonitorDialogProps) {
  const isEdit = props.mode === 'edit';
  const editing = isEdit ? props.editing : null;

  const [kind, setKind] = useState<MonitorKind>(editing?.kind ?? 'ICMP');
  const [target, setTarget] = useState(
    editing?.target ?? (props.mode === 'create' ? props.defaultTarget ?? '' : ''),
  );
  const [targetPort, setTargetPort] = useState<string>(
    editing?.targetPort != null ? String(editing.targetPort) : '80',
  );
  const [intervalSec, setIntervalSec] = useState<number>(editing?.intervalSec ?? 300);
  const [expectedStatus, setExpectedStatus] = useState<string>(
    editing?.httpConfig?.expectedStatus != null
      ? String(editing.httpConfig.expectedStatus)
      : '200',
  );

  const createMutation = useMutation({
    mutationFn: (data: CreateMonitorCheckData) => monitorsApi.create(data),
    onSuccess: () => {
      toast.success('Surveillance créée');
      props.onSaved();
      props.onClose();
    },
    onError: (err: any) =>
      toast.error(err?.data?.message || err.message || 'Échec de la création'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMonitorCheckData }) =>
      monitorsApi.update(id, data),
    onSuccess: () => {
      toast.success('Surveillance mise à jour');
      props.onSaved();
      props.onClose();
    },
    onError: (err: any) =>
      toast.error(err?.data?.message || err.message || 'Échec de la mise à jour'),
  });

  const submit = () => {
    if (!target.trim()) {
      toast.error('Cible obligatoire');
      return;
    }
    let port: number | undefined;
    if (kind === 'TCP') {
      port = Number(targetPort);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        toast.error('Port TCP invalide (1-65535)');
        return;
      }
    }
    const expectedStatusNum = kind === 'HTTP'
      ? (Number.isInteger(Number(expectedStatus)) ? Number(expectedStatus) : 200)
      : undefined;

    if (isEdit) {
      const data: UpdateMonitorCheckData = {
        kind,
        target: target.trim(),
        intervalSec,
        targetPort: (port ?? null) as any,
      };
      if (kind === 'HTTP') {
        data.httpConfig = { expectedStatus: expectedStatusNum };
      }
      updateMutation.mutate({ id: editing!.id, data });
    } else {
      const payload: CreateMonitorCheckData = {
        kind,
        target: target.trim(),
        intervalSec,
        siteId: props.targetType === 'site' ? props.targetId : undefined,
        assetId: props.targetType === 'asset' ? props.targetId : undefined,
        linkId: props.targetType === 'link' ? props.targetId : undefined,
      };
      if (port != null) payload.targetPort = port;
      if (kind === 'HTTP') payload.httpConfig = { expectedStatus: expectedStatusNum };
      createMutation.mutate(payload);
    }
  };

  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Modifier la surveillance' : 'Nouvelle surveillance'}
          </DialogTitle>
          <DialogDescription>
            Surveillance active de l&apos;objet — choisissez le type de sonde adapté.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Type de sonde</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as MonitorKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ICMP">Ping (ICMP)</SelectItem>
                <SelectItem value="HTTP">Site web (HTTP / HTTPS)</SelectItem>
                <SelectItem value="TCP">Port TCP</SelectItem>
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
              placeholder={kind === 'HTTP' ? 'https://example.com/health' : 'example.com'}
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
            <Label>Vérifier toutes les</Label>
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
          <Button variant="outline" onClick={props.onClose}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            {isEdit ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
