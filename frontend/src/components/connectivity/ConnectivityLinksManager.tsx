// @ts-nocheck
'use client';

import { useState, useEffect, useMemo } from 'react';
import { ResyncExpenseButton } from '@/components/expenses/ResyncExpenseButton';
import { GenerateExpenseToggle, type GenerateExpensePayload } from '@/components/expenses/GenerateExpenseToggle';
import { MonitorConfigSection } from '@/components/monitoring/MonitorConfigSection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { Wifi, Plus, Edit, Trash2, Receipt, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import {
  connectivityApi,
  type ConnectivityLink,
  type ConnectivityRole,
  type CreateConnectivityLinkData,
} from '@/lib/api/connectivity';
import { billingEntitiesApi, type BillingEntity } from '@/lib/api/costs';
import { assetsApi } from '@/lib/api/assets';
import { contactsApi } from '@/lib/api/contacts';
import type { Contact } from '@/types';
import { useEnumLabels } from '@/hooks/useEnumLabels';
import { EntitySelectCombobox } from '@/components/ui/entity-select-combobox';
import { useQuery } from '@tanstack/react-query';
import { formatMonthlyPrice } from '@/lib/currency';

interface Props {
  siteId: string;
  initialLinks?: ConnectivityLink[];
  canEdit: boolean;
}

const roleLabels: Record<ConnectivityRole, string> = {
  PRIMARY: 'Primaire',
  BACKUP: 'Backup',
  OTHER: 'Autre',
};

const typeOptions = ['FIBER', 'ADSL', 'VDSL', 'SDSL', '4G', '5G', 'STARLINK', 'SATELLITE', 'OTHER'];

export function ConnectivityLinksManager({ siteId, initialLinks = [], canEdit }: Props) {
  const [links, setLinks] = useState<ConnectivityLink[]>(initialLinks);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ConnectivityLink | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ConnectivityLink | null>(null);
  const [expenseDialog, setExpenseDialog] = useState<ConnectivityLink | null>(null);
  const [bearers, setBearers] = useState<BillingEntity[]>([]);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await connectivityApi.getAll({ siteId });
      setLinks(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialLinks.length === 0) {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  // Load bearers when opening expense dialog
  useEffect(() => {
    if (expenseDialog && bearers.length === 0) {
      billingEntitiesApi
        .getAll({ isActive: 'true' })
        .then((data) => setBearers(data || []))
        .catch(() => setBearers([]));
    }
  }, [expenseDialog, bearers.length]);

  const handleOpenNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (link: ConnectivityLink) => {
    setEditing(link);
    setDialogOpen(true);
  };

  const handleSave = async (data: CreateConnectivityLinkData, expensePayload?: GenerateExpensePayload) => {
    if (editing) {
      await connectivityApi.update(editing.id, data);
    } else {
      const created = await connectivityApi.create({ ...data, siteId });
      // ADR-011 Lot 8 — chain expense generation if user opted in. Failure
      // is non-fatal: the link exists, user can retry via the per-row
      // "Générer dépense" dialog.
      if (expensePayload?.enabled && expensePayload.bearerId) {
        try {
          await connectivityApi.generateExpense(created.id, {
            bearerId: expensePayload.bearerId,
            label: expensePayload.label || undefined,
          });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('Inline expense generation failed', e);
        }
      }
    }
    setDialogOpen(false);
    setEditing(null);
    refresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await connectivityApi.delete(deleteTarget.id);
    setDeleteTarget(null);
    refresh();
  };

  const handleGenerateExpense = async (bearerId: string, label?: string) => {
    if (!expenseDialog) return;
    await connectivityApi.generateExpense(expenseDialog.id, { bearerId, label });
    setExpenseDialog(null);
    refresh();
  };

  const roleBadgeVariant = (role: ConnectivityRole) => {
    if (role === 'PRIMARY') return 'success' as const;
    if (role === 'BACKUP') return 'warning' as const;
    return 'secondary' as const;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wifi className="h-5 w-5" />
            Connectivité
          </CardTitle>
          {canEdit && (
            <Button size="sm" onClick={handleOpenNew}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter un lien
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && links.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Chargement...</p>
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Aucun lien de connectivité. {canEdit && 'Cliquez sur "Ajouter un lien".'}
          </p>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {links.map((link) => (
              <div key={link.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={roleBadgeVariant(link.role)}>{roleLabels[link.role]}</Badge>
                    <span className="text-xs text-muted-foreground">{link.type}</span>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenEdit(link)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-600"
                        onClick={() => setDeleteTarget(link)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-semibold">{link.provider}</p>
                  {(link.bandwidthDown || link.bandwidthUp) && (
                    <p className="text-xs text-muted-foreground">
                      {link.bandwidthDown ? `↓ ${link.bandwidthDown} Mbps` : ''}
                      {link.bandwidthUp ? ` ↑ ${link.bandwidthUp} Mbps` : ''}
                    </p>
                  )}
                  {link.publicIp && (
                    <p className="text-xs font-mono text-muted-foreground">IP : {link.publicIp}</p>
                  )}
                  {link.contractRef && (
                    <p className="text-xs text-muted-foreground">Contrat : {link.contractRef}</p>
                  )}
                  {link.asset && (
                    <p className="text-xs text-muted-foreground">
                      Équipement :{' '}
                      <Link
                        href={`/dashboard/assets/${link.asset.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {link.asset.name || link.asset.serialNumber || link.asset.type}
                      </Link>
                    </p>
                  )}
                </div>
                {link.monthlyPrice && (
                  <div className="flex items-center justify-between text-sm pt-2 border-t">
                    <span className="font-medium">
                      {formatMonthlyPrice(link.monthlyPrice, link.currency)}
                    </span>
                    {link.expense ? (
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/costs?highlight=${link.expense.id}`}
                          className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                        >
                          <Receipt className="h-3 w-3" /> Dépense liée <ExternalLink className="h-3 w-3" />
                        </Link>
                        {/* ADR-011 — Resync linked Expense from current monthlyPrice. */}
                        {canEdit && (
                          <ResyncExpenseButton
                            resyncFn={() => connectivityApi.resyncExpense(link.id)}
                            currency={link.currency || 'EUR'}
                            invalidateKeys={[['expenses'], ['site', siteId, 'connectivity']]}
                            size="sm"
                          >
                            Sync
                          </ResyncExpenseButton>
                        )}
                      </div>
                    ) : canEdit ? (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setExpenseDialog(link)}>
                        <Receipt className="h-3 w-3 mr-1" /> Générer dépense
                      </Button>
                    ) : null}
                  </div>
                )}
                {link.notes && (
                  <p className="text-xs text-muted-foreground pt-1 border-t">{link.notes}</p>
                )}
                {/* Monitoring natif (ADR-014) — pre-rempli avec publicIp si dispo */}
                <div className="pt-2 border-t">
                  <MonitorConfigSection
                    targetType="link"
                    targetId={link.id}
                    defaultTarget={link.publicIp || ''}
                    compact
                    readOnly={!canEdit}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <ConnectivityLinkDialog
        canWrite={canEdit}
        siteId={siteId}
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
        editing={editing}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce lien ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera définitivement le lien <strong>{deleteTarget?.provider}</strong> ({deleteTarget?.type}).
              {deleteTarget?.expenseId && ' La dépense liée ne sera PAS supprimée.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Generate Expense Dialog */}
      <GenerateExpenseDialog
        open={!!expenseDialog}
        link={expenseDialog}
        bearers={bearers}
        onClose={() => setExpenseDialog(null)}
        onConfirm={handleGenerateExpense}
      />
    </Card>
  );
}

// ---------------------- Sub-components ----------------------

function ConnectivityLinkDialog({
  open,
  onClose,
  onSave,
  editing,
  canWrite,
  siteId,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: CreateConnectivityLinkData, expensePayload?: GenerateExpensePayload) => Promise<void>;
  editing: ConnectivityLink | null;
  canWrite: boolean;
  siteId: string;
}) {
  const [form, setForm] = useState<Partial<CreateConnectivityLinkData>>({});
  const [saving, setSaving] = useState(false);

  // Candidate assets for the "terminating equipment" picker: assets of this
  // site whose AssetType is flagged `isConnectivityCapable` on EnumLabel
  // (ROUTER / FIREWALL / BOX_5G — switches are LAN, excluded by design).
  const { getLabelsForType } = useEnumLabels('AssetType');
  const capableValues = useMemo(() => {
    const dyn = getLabelsForType('AssetType')
      .filter((item) => item.isConnectivityCapable)
      .map((item) => item.enumValue);
    // Defensive fallback during initial load.
    if (dyn.length === 0) return ['ROUTER', 'FIREWALL', 'BOX_5G'];
    return dyn;
  }, [getLabelsForType]);

  const { data: siteAssets = [] } = useQuery({
    queryKey: ['assets', { siteId, connectivityPicker: true }],
    // pageSize 500: a site can have >25 assets, the default pageSize. Without
    // this the picker silently hides the firewalls at position 26+ of the
    // createdAt-desc list, which is exactly the equipment a user wants here.
    queryFn: () => assetsApi.getAll({ siteId, pageSize: 500 }),
    enabled: open,
  });

  const assetCandidates = useMemo(
    () => siteAssets.filter((a: any) => capableValues.includes(a.type)),
    [siteAssets, capableValues],
  );

  // PROVIDER contacts (ISPs) for the operator picker. The stored value on
  // ConnectivityLink.provider is the contact's name string (kept that way so
  // legacy free-text entries keep rendering).
  const { data: providerContacts = [] } = useQuery<Contact[]>({
    queryKey: ['contacts', { category: 'PROVIDER', picker: 'connectivity' }],
    queryFn: () => contactsApi.getAll({ category: 'PROVIDER' }),
    enabled: open,
  });
  // ADR-011 Lot 8 — toggle visible only on creation (no editing) when no
  // expense is already linked. Mode edit keeps the existing UX (separate
  // dialog for after-the-fact generation).
  const [expensePayload, setExpensePayload] = useState<GenerateExpensePayload>({
    enabled: false, bearerId: '', label: '',
  });

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          role: editing.role,
          provider: editing.provider,
          type: editing.type,
          bandwidthDown: editing.bandwidthDown ?? undefined,
          bandwidthUp: editing.bandwidthUp ?? undefined,
          publicIp: editing.publicIp ?? undefined,
          monthlyPrice: editing.monthlyPrice ?? undefined,
          currency: editing.currency,
          startDate: editing.startDate ? editing.startDate.split('T')[0] : undefined,
          endDate: editing.endDate ? editing.endDate.split('T')[0] : undefined,
          contractRef: editing.contractRef ?? undefined,
          notes: editing.notes ?? undefined,
          assetId: editing.assetId ?? null,
        });
      } else {
        setForm({ role: 'PRIMARY', type: 'FIBER', currency: 'EUR', assetId: null });
      }
    }
  }, [open, editing]);

  const handleSubmit = async () => {
    if (!form.provider || !form.type || !form.role) return;
    setSaving(true);
    try {
      // Pass the expense payload along to the parent so it can chain
      // create + generateExpense atomically (only on first creation).
      await onSave(form as CreateConnectivityLinkData, editing ? undefined : expensePayload);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      {/* max-h + flex-col + scrollable body keep the footer (Enregistrer /
          Annuler) visible when the form grows — e.g. when the user types a
          monthlyPrice and the GenerateExpenseToggle section appears. */}
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{editing ? 'Modifier le lien' : 'Nouveau lien de connectivité'}</DialogTitle>
          <DialogDescription>
            {editing ? 'Mettez à jour les informations du lien.' : 'Ajoutez un lien internet pour ce site.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 overflow-y-auto flex-1 pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Rôle *</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as ConnectivityRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIMARY">Primaire</SelectItem>
                  <SelectItem value="BACKUP">Backup</SelectItem>
                  <SelectItem value="OTHER">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {typeOptions.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="connectivity-provider">Fournisseur / opérateur *</Label>
            <EntitySelectCombobox
              id="connectivity-provider"
              ariaLabel="Fournisseur / opérateur"
              options={providerContacts.map((c) => ({
                value: c.name,
                label: c.company ? `${c.name} (${c.company})` : c.name,
                searchText: [c.name, c.company, c.email].filter(Boolean).join(' '),
              }))}
              value={form.provider || null}
              onChange={(v) => setForm({ ...form, provider: v ?? '' })}
              clearable={false}
              placeholder="Sélectionner un opérateur..."
              searchPlaceholder="Rechercher un opérateur..."
              emptyMessage="Aucun contact de catégorie PROVIDER. Créez-en un dans Contacts."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Débit descendant (Mbps)</Label>
              <Input
                type="number"
                value={form.bandwidthDown ?? ''}
                onChange={(e) => setForm({ ...form, bandwidthDown: e.target.value === '' ? undefined : Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Débit montant (Mbps)</Label>
              <Input
                type="number"
                value={form.bandwidthUp ?? ''}
                onChange={(e) => setForm({ ...form, bandwidthUp: e.target.value === '' ? undefined : Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>IP publique</Label>
            <Input
              value={form.publicIp || ''}
              onChange={(e) => setForm({ ...form, publicIp: e.target.value })}
              placeholder="1.2.3.4"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Prix mensuel</Label>
              <Input
                type="number"
                step="0.01"
                value={form.monthlyPrice ?? ''}
                onChange={(e) => setForm({ ...form, monthlyPrice: e.target.value === '' ? undefined : Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Devise</Label>
              <Input
                value={form.currency || 'EUR'}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                placeholder="EUR"
              />
            </div>
            <div className="space-y-2">
              <Label>Référence contrat</Label>
              <Input
                value={form.contractRef || ''}
                onChange={(e) => setForm({ ...form, contractRef: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="connectivity-asset">Équipement associé</Label>
            <EntitySelectCombobox
              id="connectivity-asset"
              ariaLabel="Sélectionner l'équipement qui termine le lien"
              options={assetCandidates.map((a: any) => ({
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
              value={form.assetId ?? null}
              onChange={(v) => setForm({ ...form, assetId: v })}
              placeholder="Aucun (optionnel)"
              searchPlaceholder="Rechercher..."
              emptyMessage="Aucun équipement compatible sur ce site."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Date de début</Label>
              <Input
                type="date"
                value={form.startDate || ''}
                onChange={(e) => setForm({ ...form, startDate: e.target.value || undefined })}
              />
            </div>
            <div className="space-y-2">
              <Label>Date de fin</Label>
              <Input
                type="date"
                value={form.endDate || ''}
                onChange={(e) => setForm({ ...form, endDate: e.target.value || undefined })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
            />
          </div>

          {/* ADR-011 Lot 8 — generate the linked Expense in the same flow as
              the connectivity link creation. Hidden in edit mode (link may
              already have an expense; the per-row "Générer dépense" dialog
              still handles that case). */}
          {!editing && Number(form.monthlyPrice) > 0 && (
            <GenerateExpenseToggle
              title="Dépense mensuelle liée"
              helper="Crée immédiatement la dépense MONTHLY SERVICE associée."
              defaultLabel={`Connectivité ${form.provider || ''} ${form.type ? '(' + form.type + ')' : ''}`.trim()}
              defaultAmount={Number(form.monthlyPrice) || 0}
              currency={form.currency || 'EUR'}
              typeBadge="SERVICE"
              frequencyBadge="MONTHLY"
              canWrite={canWrite}
              onChange={setExpensePayload}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !form.provider || !form.type || !form.role || (expensePayload.enabled && !expensePayload.bearerId)}
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GenerateExpenseDialog({
  open,
  link,
  bearers,
  onClose,
  onConfirm,
}: {
  open: boolean;
  link: ConnectivityLink | null;
  bearers: BillingEntity[];
  onClose: () => void;
  onConfirm: (bearerId: string, label?: string) => Promise<void>;
}) {
  const [bearerId, setBearerId] = useState<string>('');
  const [label, setLabel] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && link) {
      setBearerId('');
      setLabel(`Connectivité ${link.provider} (${link.type})`);
    }
  }, [open, link]);

  const handle = async () => {
    if (!bearerId) return;
    setSaving(true);
    try {
      await onConfirm(bearerId, label || undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Générer une dépense récurrente</DialogTitle>
          <DialogDescription>
            Crée une dépense mensuelle de {link?.monthlyPrice} {link?.currency} liée à cette connectivité.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Entité qui supporte la dépense (bearer) *</Label>
            <Select value={bearerId} onValueChange={setBearerId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une entité..." />
              </SelectTrigger>
              <SelectContent>
                {bearers.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {bearers.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Aucune entité disponible. Créez-en une dans /dashboard/costs/billing-entities.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Libellé de la dépense</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button onClick={handle} disabled={saving || !bearerId}>
            {saving ? 'Génération...' : 'Générer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
