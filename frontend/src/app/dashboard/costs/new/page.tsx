// @ts-nocheck
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EntitySelectCombobox } from '@/components/ui/entity-select-combobox';
import { formatCurrency } from '@/lib/currency';
import { expensesApi, billingEntitiesApi, type BillingEntity, type CreateExpenseData } from '@/lib/api/costs';
import { assetsApi } from '@/lib/api/assets';
import { ScopeSelector, type ScopeValue } from '@/components/ui/scope-selector';
import { VendorCombobox } from '@/components/costs/vendor-combobox';
import { ArrowLeft, Plus, X, Percent, Package } from 'lucide-react';
import Link from 'next/link';
import type { Asset } from '@/types';
import { AccessGate } from '@/components/AccessGate';

export default function NewExpensePageWrapper() {
  return (
    <AccessGate
      required="manage"
      title="Accès refusé"
      description="La création de dépense est réservée aux administrateurs de délégation et aux super administrateurs."
    >
      <NewExpensePage />
    </AccessGate>
  );
}

const EXPENSE_TYPES = [
  { value: 'EQUIPMENT', label: 'Équipement' },
  { value: 'SERVICE', label: 'Service' },
  { value: 'PROJECT', label: 'Projet' },
  { value: 'CONSUMABLE', label: 'Consommable' },
  { value: 'LICENSE', label: 'Licence' },
  { value: 'OTHER', label: 'Autre' },
];

const FREQUENCIES = [
  { value: 'ONE_TIME', label: 'Ponctuel' },
  { value: 'MONTHLY', label: 'Mensuel' },
  { value: 'QUARTERLY', label: 'Trimestriel' },
  { value: 'YEARLY', label: 'Annuel' },
];

interface AllocationRow {
  targetId: string;
  percentage: number;
  notes: string;
}

function NewExpensePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('OTHER');
  const [totalAmount, setTotalAmount] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [frequency, setFrequency] = useState('ONE_TIME');
  const [dateIncurred, setDateIncurred] = useState(new Date().toISOString().split('T')[0]);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [bearerId, setBearerId] = useState('');
  const [scope, setScope] = useState<ScopeValue>({ delegationId: null, siteId: null });
  const [externalRef, setExternalRef] = useState('');
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [assetId, setAssetId] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);

  // Phase 6.5 cascade audit: both lists now follow the Expense's chosen scope.
  // BillingEntities are fetched with delegationId + includeGlobal=true so the
  // picker always shows tenant-wide centres de coût + the delegation ones.
  // Assets are scoped to the selected site (or empty until the user picks one).
  const { data: entities = [] } = useQuery<BillingEntity[]>({
    queryKey: ['billing-entities', { delegationId: scope.delegationId }],
    queryFn: () => billingEntitiesApi.getAll({
      delegationId: scope.delegationId || undefined,
      includeGlobal: true,
      isActive: 'true',
    }),
  });

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ['assets', { siteId: scope.siteId }],
    queryFn: () => assetsApi.getAll(scope.siteId ? { siteId: scope.siteId } : {}),
    enabled: !!scope.siteId,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateExpenseData) => expensesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      router.push('/dashboard/costs');
    },
  });

  const totalPercentage = allocations.reduce((sum, a) => sum + a.percentage, 0);
  const amount = parseFloat(totalAmount) || 0;

  const addAllocation = () => {
    setAllocations([...allocations, { targetId: '', percentage: 0, notes: '' }]);
  };

  const removeAllocation = (index: number) => {
    setAllocations(allocations.filter((_, i) => i !== index));
  };

  const updateAllocation = (index: number, field: keyof AllocationRow, value: any) => {
    setAllocations(allocations.map((a, i) => i === index ? { ...a, [field]: value } : a));
  };

  const handleSubmit = () => {
    const data: CreateExpenseData = {
      label,
      description: description || undefined,
      type,
      totalAmount: amount,
      currency,
      frequency,
      dateIncurred,
      dateStart: dateStart || undefined,
      dateEnd: dateEnd || undefined,
      bearerId,
      delegationId: scope.delegationId || undefined,
      siteId: scope.siteId || undefined,
      vendorId: vendorId || undefined,
      assetId: assetId || undefined,
      externalRef: externalRef || undefined,
      invoiceRef: invoiceRef || undefined,
      poNumber: poNumber || undefined,
      notes: notes || undefined,
      allocations: allocations.filter(a => a.targetId && a.percentage > 0),
    };
    createMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/costs"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <h1 className="text-3xl font-bold">Nouvelle dépense</h1>
      </div>

      {/* Section: Quoi */}
      <Card>
        <CardHeader><CardTitle>Description</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Label <span className="text-red-500">*</span></Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Achat Switch Cisco x10" />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label>Montant <span className="text-red-500">*</span></Label>
              <Input type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="10000" />
            </div>
            <div className="space-y-1">
              <Label>Devise</Label>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Fréquence</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Date <span className="text-red-500">*</span></Label>
              <Input type="date" value={dateIncurred} onChange={(e) => setDateIncurred(e.target.value)} />
            </div>
          </div>
          {frequency !== 'ONE_TIME' && (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Début période</Label>
                <Input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Fin période</Label>
                <Input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
              </div>
            </div>
          )}
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      {/* Section: Qui paie */}
      <Card>
        <CardHeader><CardTitle>Porteur (qui paie)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="expense-bearer">Centre de coût porteur <span className="text-red-500">*</span></Label>
            <EntitySelectCombobox
              id="expense-bearer"
              ariaLabel="Centre de coût porteur de la dépense"
              options={entities.map((e) => ({
                value: e.id,
                label: `${e.code} — ${e.name}`,
                searchText: `${e.code} ${e.name}`,
              }))}
              value={bearerId || null}
              onChange={(v) => setBearerId(v ?? '')}
              clearable={false}
              placeholder="Sélectionner le porteur..."
              searchPlaceholder="Rechercher un centre de coût..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Section: Scope organisationnel — la délégation est REQUISE
          (Expense.delegationId @IsNotEmpty côté back). Le site reste optionnel. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Rattachement organisationnel <span className="text-red-500">*</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScopeSelector value={scope} onChange={setScope} label="" />
          <p className="text-xs text-muted-foreground mt-2">
            Une dépense est toujours rattachée à une délégation. Le site est optionnel
            si la dépense concerne toute la délégation.
          </p>
        </CardContent>
      </Card>

      {/* Section: Liens */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Liens <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">Optionnel</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Fournisseur</Label>
              <VendorCombobox
                value={vendorId}
                onChange={setVendorId}
                delegationId={scope.delegationId}
              />
            </div>
            <div className="space-y-1">
              <Label>Ref. externe</Label>
              <Input value={externalRef} onChange={(e) => setExternalRef(e.target.value)} placeholder="N° contrat, abonnement..." />
            </div>
            {type === 'EQUIPMENT' && (
              <div className="space-y-1">
                <Label htmlFor="expense-asset" className="flex items-center gap-1">
                  <Package className="h-3.5 w-3.5" /> Équipement lié
                </Label>
                <EntitySelectCombobox
                  id="expense-asset"
                  ariaLabel="Équipement lié à la dépense (optionnel)"
                  options={assets.map((a) => ({
                    value: a.id,
                    label: `${a.manufacturer ?? ''} ${a.model ?? ''} (${a.serialNumber || a.type})`.trim(),
                    searchText: [a.manufacturer, a.model, a.serialNumber, a.type, a.name]
                      .filter(Boolean)
                      .join(' '),
                  }))}
                  value={assetId || null}
                  onChange={(v) => setAssetId(v ?? '')}
                  placeholder="Aucun"
                  searchPlaceholder="Rechercher un équipement..."
                />
              </div>
            )}
            <div className="space-y-1">
              <Label>N° facture</Label>
              <Input value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} placeholder="FAC-2026-001" />
            </div>
            <div className="space-y-1">
              <Label>N° bon de commande</Label>
              <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="PO-2026-042" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section: Refacturation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Refacturation</span>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-normal ${totalPercentage > 100 ? 'text-red-500' : 'text-muted-foreground'}`}>
                {totalPercentage}% réparti
              </span>
              {/* Progress bar */}
              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${totalPercentage > 100 ? 'bg-red-500' : totalPercentage === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min(totalPercentage, 100)}%` }}
                />
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {allocations.map((alloc, index) => (
            <div key={index} className="flex items-end gap-3 p-3 border rounded-lg">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Cible</Label>
                <Select value={alloc.targetId} onValueChange={(v) => updateAllocation(index, 'targetId', v)}>
                  <SelectTrigger><SelectValue placeholder="Centre de coût cible" /></SelectTrigger>
                  <SelectContent>
                    {entities.filter(e => e.id !== bearerId).map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.code} - {e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24 space-y-1">
                <Label className="text-xs">%</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={alloc.percentage}
                    onChange={(e) => updateAllocation(index, 'percentage', parseFloat(e.target.value) || 0)}
                    className="pr-8"
                  />
                  <Percent className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="w-28 text-right">
                <p className="text-sm font-medium">
                  {formatCurrency(amount * alloc.percentage / 100, currency)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => removeAllocation(index)}
                aria-label="Supprimer cette allocation"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addAllocation}>
            <Plus className="mr-1 h-4 w-4" />
            Ajouter une ligne
          </Button>

          {/* D3 — always surface "who nets what" so the user sees the
              bearer's real remainder at a glance. */}
          {(() => {
            const bearerPct = Math.max(0, 100 - totalPercentage);
            const bearerAmount = (amount || 0) * (bearerPct / 100);
            const selectedBearer = entities.find((e) => e.id === bearerId);
            const bearerName = selectedBearer ? `${selectedBearer.code} — ${selectedBearer.name}` : 'Le porteur';
            if (totalPercentage > 100) return null; // already surfaced by red progress bar
            return (
              <div
                className={`rounded-md border px-3 py-2 text-sm flex items-center justify-between ${
                  totalPercentage === 0
                    ? 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200'
                    : totalPercentage === 100
                      ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200'
                      : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200'
                }`}
              >
                <span>
                  <span className="font-semibold">{bearerName}</span>{' '}
                  {totalPercentage === 100
                    ? 'ne supporte rien (100% refacturé).'
                    : `supporte ${bearerPct}% de cette dépense.`}
                </span>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(bearerAmount, currency)}
                </span>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardContent className="pt-4">
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col items-end gap-2">
        {!scope.delegationId && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Sélectionnez une délégation pour rattacher la dépense (elle est obligatoire —
            la portée Globale/Délégation se configure au niveau du Centre de coût).
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/dashboard/costs')}>Annuler</Button>
          <Button
            onClick={handleSubmit}
            disabled={!label || !totalAmount || !bearerId || !dateIncurred || !scope.delegationId || totalPercentage > 100 || createMutation.isPending}
          >
            {createMutation.isPending ? 'Création...' : 'Créer la dépense'}
          </Button>
        </div>
      </div>
    </div>
  );
}
