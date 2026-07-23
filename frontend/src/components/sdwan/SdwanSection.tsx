'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EntitySelectCombobox } from '@/components/ui/entity-select-combobox';
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
import { Network, Plus, Settings, Trash2 } from 'lucide-react';
import {
  sdwanApi,
  type SdwanConfig,
  type SdwanFirewallRole,
  type UpsertSdwanConfigData,
} from '@/lib/api/sdwan';
import { assetsApi } from '@/lib/api/assets';
import { contactsApi } from '@/lib/api/contacts';
import type { Contact } from '@/types';
import { useEnumLabels } from '@/hooks/useEnumLabels';

const ROLE_LABELS: Record<SdwanFirewallRole, string> = {
  active: 'Actif',
  passive: 'Passif',
  peer: 'Pair',
};

interface Props {
  siteId: string;
  canEdit: boolean;
}

export function SdwanSection({ siteId, canEdit }: Props) {
  const queryClient = useQueryClient();
  const [configDialog, setConfigDialog] = useState(false);
  const [attachDialog, setAttachDialog] = useState(false);
  const [detachTarget, setDetachTarget] = useState<string | null>(null);

  const { data: config, isLoading } = useQuery({
    queryKey: ['sdwan', siteId],
    queryFn: () => sdwanApi.get(siteId),
  });

  const upsertMutation = useMutation({
    mutationFn: (data: UpsertSdwanConfigData) => sdwanApi.upsert(siteId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sdwan', siteId] });
      queryClient.invalidateQueries({ queryKey: ['site', siteId] });
      setConfigDialog(false);
    },
  });

  const [removeConfirm, setRemoveConfirm] = useState(false);

  const removeMutation = useMutation({
    mutationFn: () => sdwanApi.remove(siteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sdwan', siteId] });
      queryClient.invalidateQueries({ queryKey: ['site', siteId] });
      setRemoveConfirm(false);
      setConfigDialog(false);
    },
  });

  const detachMutation = useMutation({
    mutationFn: (assetId: string) => sdwanApi.detachFirewall(siteId, assetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sdwan', siteId] });
      setDetachTarget(null);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="h-5 w-5" />
            SD-WAN
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-2">Chargement...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="h-5 w-5" />
            SD-WAN
            {config && (
              <Badge variant={config.enabled ? 'success' : 'secondary'}>
                {config.enabled ? 'Activé' : 'Désactivé'}
              </Badge>
            )}
            {/* Badge status retiré — SdwanConfig.status n'existe plus (ADR-016),
                le statut overlay vient de l'agrégation santé des firewalls. */}
          </CardTitle>
          {canEdit && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfigDialog(true)}>
                <Settings className="h-3.5 w-3.5 mr-1" />
                {config ? 'Configurer' : 'Activer SD-WAN'}
              </Button>
              {config && (
                <Button size="sm" onClick={() => setAttachDialog(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter un firewall
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!config ? (
          <p className="text-sm text-muted-foreground py-2">
            Aucune configuration SD-WAN. {canEdit && 'Cliquez sur "Activer SD-WAN".'}
          </p>
        ) : (
          <>
            <div className="text-sm space-y-1">
              {config.provider && (
                <p>
                  <span className="text-muted-foreground">Provider :</span>{' '}
                  <span className="font-medium">{config.provider}</span>
                </p>
              )}
              {config.notes && (
                <p className="text-xs text-muted-foreground">{config.notes}</p>
              )}
            </div>

            {config.firewalls.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2 border-t pt-3">
                Aucun firewall attaché. {canEdit && 'Cliquez sur "Ajouter un firewall".'}
              </p>
            ) : (
              <div className="grid md:grid-cols-2 gap-2 border-t pt-3">
                {config.firewalls.map((fw) => {
                  // ADR-016 lot E removed monitorStatus from Asset; ADR-018
                  // dropped Asset.networkInfo entirely. Live monitor status is
                  // surfaced via the dedicated Monitoring tab now.
                  return (
                    <div key={fw.id} className="border rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {fw.role && (
                            <Badge variant="outline">
                              {ROLE_LABELS[fw.role as SdwanFirewallRole] ?? fw.role}
                            </Badge>
                          )}
                        </div>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-600"
                            aria-label="Détacher ce firewall"
                            onClick={() => setDetachTarget(fw.assetId)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      <Link
                        href={`/dashboard/assets/${fw.asset.id}`}
                        className="font-semibold text-blue-600 hover:underline"
                      >
                        {fw.asset.name || fw.asset.serialNumber || fw.asset.type}
                      </Link>
                      {fw.asset.serialNumber && fw.asset.name && (
                        <p className="text-xs text-muted-foreground font-mono">
                          {fw.asset.serialNumber}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </CardContent>

      <SdwanConfigDialog
        open={configDialog}
        existing={config}
        onClose={() => setConfigDialog(false)}
        onSave={(data) => upsertMutation.mutate(data)}
        onRemove={config ? () => setRemoveConfirm(true) : undefined}
        saving={upsertMutation.isPending}
        removing={removeMutation.isPending}
      />

      <AlertDialog open={removeConfirm} onOpenChange={(v) => !v && setRemoveConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la configuration SD-WAN ?</AlertDialogTitle>
            <AlertDialogDescription>
              La configuration sera supprimée ainsi que tous les firewalls qui y sont
              attachés ({config?.firewalls.length ?? 0}). Les équipements eux-mêmes ne
              sont pas supprimés — seule l&apos;attache à la config SD-WAN l&apos;est.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMutation.isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                removeMutation.mutate();
              }}
              disabled={removeMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {removeMutation.isPending ? 'Suppression...' : 'Supprimer la configuration'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AttachFirewallDialog
        open={attachDialog}
        siteId={siteId}
        existingAssetIds={new Set(config?.firewalls.map((f) => f.assetId) ?? [])}
        onClose={() => setAttachDialog(false)}
        onAttach={(assetId, role) =>
          sdwanApi.attachFirewall(siteId, { assetId, role }).then(() => {
            queryClient.invalidateQueries({ queryKey: ['sdwan', siteId] });
            setAttachDialog(false);
          })
        }
      />

      <AlertDialog open={!!detachTarget} onOpenChange={(v) => !v && setDetachTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Détacher ce firewall ?</AlertDialogTitle>
            <AlertDialogDescription>
              L&apos;équipement n&apos;est pas supprimé, juste retiré de la configuration SD-WAN.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => detachTarget && detachMutation.mutate(detachTarget)}
              className="bg-red-600 hover:bg-red-700"
            >
              Détacher
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ---------------------- Sub-components ----------------------

function SdwanConfigDialog({
  open,
  existing,
  onClose,
  onSave,
  onRemove,
  saving,
  removing,
}: {
  open: boolean;
  existing: SdwanConfig | null | undefined;
  onClose: () => void;
  onSave: (data: UpsertSdwanConfigData) => void;
  onRemove?: () => void;
  saving: boolean;
  removing: boolean;
}) {
  const [enabled, setEnabled] = useState(existing?.enabled ?? true);
  const [provider, setProvider] = useState(existing?.provider ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');

  // PROVIDER contacts (vendors — Fortinet, Cisco, VeloCloud...). The stored
  // value on SdwanConfig.provider is the contact's name string, same pattern
  // as ConnectivityLink.provider.
  const { data: providerContacts = [] } = useQuery<Contact[]>({
    queryKey: ['contacts', { category: 'PROVIDER', picker: 'sdwan' }],
    queryFn: () => contactsApi.getAll({ category: 'PROVIDER' }),
    enabled: open,
  });

  // Reset form state when the dialog opens or the config changes underneath.
  useEffect(() => {
    if (!open) return;
    setEnabled(existing?.enabled ?? true);
    setProvider(existing?.provider ?? '');
    setNotes(existing?.notes ?? '');
  }, [open, existing?.id, existing?.updatedAt]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? 'Configurer SD-WAN' : 'Activer SD-WAN'}</DialogTitle>
          <DialogDescription>
            Les firewalls attachés alimentent le statut SD-WAN agrégé.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="sdwan-enabled">Activé</Label>
            <Switch id="sdwan-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sdwan-provider">Provider</Label>
            <EntitySelectCombobox
              id="sdwan-provider"
              ariaLabel="Provider SD-WAN (vendor)"
              options={providerContacts.map((c) => ({
                value: c.name,
                label: c.company ? `${c.name} (${c.company})` : c.name,
                searchText: [c.name, c.company, c.email].filter(Boolean).join(' '),
              }))}
              value={provider || null}
              onChange={(v) => setProvider(v ?? '')}
              placeholder="Sélectionner un provider..."
              searchPlaceholder="Rechercher un provider..."
              emptyMessage="Aucun contact PROVIDER. Créez-en un dans Contacts."
            />
          </div>
          {/* Champ « Monitor externe (overlay) » retiré — SdwanConfig.monitorName
              n'existe plus (ADR-016) : le statut overlay est dérivé des monitors
              des firewalls attachés. L'envoyer faisait rejeter TOUT le save en
              400 (whitelist ValidationPipe). */}
          <div className="space-y-2">
            <Label htmlFor="sdwan-notes">Notes</Label>
            <Textarea
              id="sdwan-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          {existing && onRemove && (
            <Button
              type="button"
              variant="destructive"
              onClick={onRemove}
              disabled={removing || saving}
              className="mr-auto"
            >
              Supprimer la config
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button
            onClick={() =>
              onSave({
                enabled,
                provider: provider.trim() || null,
                notes: notes.trim() || null,
              })
            }
            disabled={saving}
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Attach-firewall dialog. Asset picker is the shared `EntitySelectCombobox`
 * (searchable + virtualized). Candidates are the site's assets whose type is
 * flagged `isConnectivityCapable` on EnumLabel.
 */
function AttachFirewallDialog({
  open,
  siteId,
  existingAssetIds,
  onClose,
  onAttach,
}: {
  open: boolean;
  siteId: string;
  existingAssetIds: Set<string>;
  onClose: () => void;
  onAttach: (assetId: string, role: SdwanFirewallRole) => Promise<void>;
}) {
  const [assetId, setAssetId] = useState('');
  const [role, setRole] = useState<SdwanFirewallRole>('active');
  const [saving, setSaving] = useState(false);

  // SD-WAN node candidates: types flagged `isSdwanCapable` on EnumLabel
  // (FIREWALL primarily, ROUTER as rare exception). Box 5G is a WAN modem, not
  // an SD-WAN node — intentionally excluded. Switches are LAN, excluded.
  const { getLabelsForType } = useEnumLabels('AssetType');
  const sdwanCapableValues = getLabelsForType('AssetType')
    .filter((item) => item.isSdwanCapable)
    .map((item) => item.enumValue);
  const capableValues = sdwanCapableValues.length > 0
    ? sdwanCapableValues
    : ['FIREWALL', 'ROUTER']; // defensive fallback during initial load

  const { data: siteAssets = [] } = useQuery({
    queryKey: ['assets', { siteId, sdwanPicker: true }],
    // pageSize 500: see ConnectivityLinksManager note — default 25 hides
    // firewalls on sites with 25+ assets.
    queryFn: () => assetsApi.getAll({ siteId, pageSize: 500 }),
    enabled: open,
  });

  const candidates = siteAssets.filter(
    (a: any) =>
      !existingAssetIds.has(a.id) &&
      capableValues.includes(a.type),
  );

  const handleSubmit = async () => {
    if (!assetId) return;
    setSaving(true);
    try {
      await onAttach(assetId, role);
      setAssetId('');
      setRole('active');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          onClose();
          setAssetId('');
          setRole('active');
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Attacher un firewall</DialogTitle>
          <DialogDescription>
            Seuls les équipements compatibles connectivité (firewall / routeur) de ce site
            sont listés.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="sdwan-fw-asset">Équipement *</Label>
            <EntitySelectCombobox
              id="sdwan-fw-asset"
              ariaLabel="Sélectionner l'équipement firewall"
              options={candidates.map((a: any) => ({
                value: a.id,
                label: (a.name || a.serialNumber || a.type) as string,
                searchText: [a.name, a.serialNumber, a.type].filter(Boolean).join(' '),
                render: () => (
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {a.name || a.serialNumber || a.type}
                    </div>
                    {a.serialNumber && a.name && (
                      <div className="truncate text-xs text-muted-foreground font-mono">
                        {a.serialNumber}
                      </div>
                    )}
                  </div>
                ),
              }))}
              value={assetId || null}
              onChange={(v) => setAssetId(v ?? '')}
              placeholder="Sélectionner un équipement..."
              searchPlaceholder="Rechercher par nom ou numéro de série..."
              emptyMessage="Aucun équipement compatible disponible."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sdwan-fw-role">Rôle</Label>
            <Select value={role} onValueChange={(v) => setRole(v as SdwanFirewallRole)}>
              <SelectTrigger id="sdwan-fw-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Actif</SelectItem>
                <SelectItem value="passive">Passif</SelectItem>
                <SelectItem value="peer">Pair</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !assetId}>
            {saving ? 'Attachement...' : 'Attacher'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
