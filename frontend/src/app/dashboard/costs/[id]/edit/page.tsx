// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { expensesApi, billingEntitiesApi, type BillingEntity, type Expense } from '@/lib/api/costs';
import { contactsApi } from '@/lib/api/contacts';
import { assetsApi } from '@/lib/api/assets';
import { GroupedSiteSelector } from '@/components/ui/grouped-site-selector';
import { ArrowLeft, Plus, X, Percent, Package } from 'lucide-react';
import Link from 'next/link';
import type { Contact, Asset } from '@/types';

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

export default function EditExpensePage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const expenseId = params.id as string;

  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('OTHER');
  const [totalAmount, setTotalAmount] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [frequency, setFrequency] = useState('ONE_TIME');
  const [dateIncurred, setDateIncurred] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [bearerId, setBearerId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [externalRef, setExternalRef] = useState('');
  const [vendor, setVendor] = useState('');
  const [assetId, setAssetId] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const { data: expense, isLoading } = useQuery<Expense>({
    queryKey: ['expense', expenseId],
    queryFn: () => expensesApi.getById(expenseId),
  });

  const { data: entities = [] } = useQuery<BillingEntity[]>({
    queryKey: ['billing-entities'],
    queryFn: () => billingEntitiesApi.getAll(),
  });

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['contacts'],
    queryFn: () => contactsApi.getAll(),
  });

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ['assets'],
    queryFn: () => assetsApi.getAll({}),
  });

  const providerContacts = contacts.filter(c => c.category === 'PROVIDER');

  // Load expense data into form
  useEffect(() => {
    if (expense && !loaded) {
      setLabel(expense.label);
      setDescription(expense.description || '');
      setType(expense.type);
      setTotalAmount(String(expense.totalAmount));
      setCurrency(expense.currency);
      setFrequency(expense.frequency);
      setDateIncurred(new Date(expense.dateIncurred).toISOString().split('T')[0]);
      setDateStart(expense.dateStart ? new Date(expense.dateStart).toISOString().split('T')[0] : '');
      setDateEnd(expense.dateEnd ? new Date(expense.dateEnd).toISOString().split('T')[0] : '');
      setBearerId(expense.bearerId);
      setSiteId(expense.siteId || '');
      setAssetId(expense.assetId || '');
      setExternalRef(expense.externalRef || '');
      setVendor(expense.vendor || '');
      setInvoiceRef(expense.invoiceRef || '');
      setPoNumber(expense.poNumber || '');
      setNotes(expense.notes || '');
      setAllocations(expense.allocations.map(a => ({
        targetId: a.targetId,
        percentage: a.percentage,
        notes: a.notes || '',
      })));
      setLoaded(true);
    }
  }, [expense, loaded]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => expensesApi.update(expenseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense', expenseId] });
      router.push('/dashboard/costs');
    },
  });

  const totalPercentage = allocations.reduce((sum, a) => sum + a.percentage, 0);
  const amount = parseFloat(totalAmount) || 0;

  const addAllocation = () => setAllocations([...allocations, { targetId: '', percentage: 0, notes: '' }]);
  const removeAllocation = (index: number) => setAllocations(allocations.filter((_, i) => i !== index));
  const updateAllocation = (index: number, field: keyof AllocationRow, value: any) => {
    setAllocations(allocations.map((a, i) => i === index ? { ...a, [field]: value } : a));
  };

  const handleSubmit = () => {
    updateMutation.mutate({
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
      siteId: siteId || undefined,
      assetId: assetId || undefined,
      externalRef: externalRef || undefined,
      vendor: vendor || undefined,
      invoiceRef: invoiceRef || undefined,
      poNumber: poNumber || undefined,
      notes: notes || undefined,
      allocations: allocations.filter(a => a.targetId && a.percentage > 0),
    });
  };

  if (isLoading) return <div className="text-center">Chargement...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/costs"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <h1 className="text-3xl font-bold">Modifier la dépense</h1>
      </div>

      {/* Same form structure as new page */}
      <Card>
        <CardHeader><CardTitle>Description</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Label <span className="text-red-500">*</span></Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} />
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
              <Input type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
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

      <Card>
        <CardHeader><CardTitle>Porteur (qui paie)</CardTitle></CardHeader>
        <CardContent>
          <Select value={bearerId} onValueChange={setBearerId}>
            <SelectTrigger><SelectValue placeholder="Sélectionner le porteur..." /></SelectTrigger>
            <SelectContent>
              {entities.map(e => <SelectItem key={e.id} value={e.id}>{e.code} - {e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Liens <span className="text-xs font-normal text-muted-foreground">Optionnel</span></CardTitle></CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Site</Label>
              <GroupedSiteSelector
                value={siteId || 'none'}
                onValueChange={(v) => setSiteId(v === 'none' ? '' : v)}
                allowNone
                noneLabel="Aucun"
                placeholder="Aucun"
              />
            </div>
            <div className="space-y-1">
              <Label>Ref. externe</Label>
              <Input value={externalRef} onChange={(e) => setExternalRef(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Fournisseur</Label>
              <Select value={vendor} onValueChange={setVendor}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun</SelectItem>
                  {providerContacts.map(c => (
                    <SelectItem key={c.id} value={c.company || c.name}>{c.company || c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Ou saisir un nom..." className="mt-1" />
            </div>
            {type === 'EQUIPMENT' && (
              <div className="space-y-1">
                <Label className="flex items-center gap-1"><Package className="h-3.5 w-3.5" /> Équipement lié</Label>
                <Select value={assetId || 'none'} onValueChange={(v) => setAssetId(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {assets.filter(a => !siteId || a.siteId === siteId).map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.manufacturer} {a.model} ({a.serialNumber || a.type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>N° facture</Label>
              <Input value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>N° bon de commande</Label>
              <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Refacturation</span>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-normal ${totalPercentage > 100 ? 'text-red-500' : 'text-muted-foreground'}`}>
                {totalPercentage}% réparti
              </span>
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
                  {new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount * alloc.percentage / 100)}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeAllocation(index)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addAllocation}>
            <Plus className="mr-1 h-4 w-4" /> Ajouter une ligne
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.push('/dashboard/costs')}>Annuler</Button>
        <Button
          onClick={handleSubmit}
          disabled={!label || !totalAmount || !bearerId || !dateIncurred || totalPercentage > 100 || updateMutation.isPending}
        >
          {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </div>
    </div>
  );
}
