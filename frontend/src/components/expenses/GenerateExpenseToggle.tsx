'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { billingEntitiesApi, type BillingEntity } from '@/lib/api/costs';
import { Receipt, Lock } from 'lucide-react';

/**
 * ADR-011 — Reusable inline expense toggle.
 *
 * Sits at the bottom of an Asset / Task / ConnectivityLink form. When checked
 * (pre-checked when a non-zero `defaultAmount` is detected), reveals a
 * mini-form: bearer (BillingEntity) + label + readonly badge for type/freq.
 *
 * The PARENT FORM is responsible for actually calling the backend
 * `generate-expense` endpoint AFTER its own create/update succeeded — this
 * component only collects the payload and exposes it via `onChange`. That
 * keeps each entity controller in charge of its create-then-generate flow.
 */
export interface GenerateExpensePayload {
  enabled: boolean;
  bearerId: string;
  label: string;
}

interface GenerateExpenseToggleProps {
  /** Default label suggested in the input — usually built from the source entity name. */
  defaultLabel: string;
  /** Default amount detected on the source. Used to pre-check the toggle when > 0. */
  defaultAmount: number;
  /** Currency to display next to the amount. */
  currency?: string;
  /** Type label shown as a read-only badge ("EQUIPMENT" / "LICENSE" / "SERVICE"). */
  typeBadge: string;
  /** Frequency label shown as a read-only badge ("ONE_TIME" / "MONTHLY"). */
  frequencyBadge: string;
  /** Whether the caller has WRITE permission on the target delegation. */
  canWrite: boolean;
  /** Title shown at the top of the toggle card (e.g. "Dépense liée"). */
  title?: string;
  /** Optional helper line below the title. */
  helper?: string;
  /** Called whenever the toggle, bearer or label changes. */
  onChange: (payload: GenerateExpensePayload) => void;
}

export function GenerateExpenseToggle({
  defaultLabel,
  defaultAmount,
  currency = 'EUR',
  typeBadge,
  frequencyBadge,
  canWrite,
  title = 'Dépense liée',
  helper,
  onChange,
}: GenerateExpenseToggleProps) {
  const initialEnabled = canWrite && defaultAmount > 0;
  const [enabled, setEnabled] = useState<boolean>(initialEnabled);
  const [bearerId, setBearerId] = useState<string>('');
  const [label, setLabel] = useState<string>(defaultLabel);

  // Refresh defaults if the source amount changes (user edited price field).
  useEffect(() => {
    if (defaultAmount > 0 && !enabled && canWrite) {
      // Auto-flip to enabled when a price gets entered after mount.
      setEnabled(true);
    } else if (defaultAmount === 0 && enabled) {
      setEnabled(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultAmount]);

  useEffect(() => {
    setLabel(defaultLabel);
  }, [defaultLabel]);

  const { data: bearers = [] } = useQuery<BillingEntity[]>({
    queryKey: ['billing-entities', 'for-expense-toggle'],
    queryFn: () => billingEntitiesApi.getAll({ isActive: 'true' }) as any,
    enabled,
  });

  // Notify parent on every change.
  useEffect(() => {
    onChange({ enabled, bearerId, label });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, bearerId, label]);

  return (
    <Card className="p-4 border-dashed">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Checkbox
            id="generate-expense-toggle"
            checked={enabled}
            disabled={!canWrite || defaultAmount <= 0}
            onCheckedChange={(v) => setEnabled(Boolean(v))}
            className="mt-1"
          />
          <div className="space-y-1">
            <Label htmlFor="generate-expense-toggle" className="flex items-center gap-2 cursor-pointer">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              {title}
            </Label>
            {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
            {!canWrite && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Vous n'avez pas le droit de créer des dépenses sur cette délégation.
              </p>
            )}
            {canWrite && defaultAmount <= 0 && (
              <p className="text-xs text-muted-foreground">
                Renseignez un prix sur l'entité pour activer la création de dépense.
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">
            {defaultAmount > 0
              ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(defaultAmount)
              : '—'}
          </p>
          <div className="flex gap-1 mt-1 justify-end">
            <Badge variant="secondary" className="text-[10px]">{typeBadge}</Badge>
            <Badge variant="outline" className="text-[10px]">{frequencyBadge}</Badge>
          </div>
        </div>
      </div>

      {enabled && (
        <div className="mt-4 grid md:grid-cols-2 gap-4 pt-4 border-t">
          <div className="space-y-1">
            <Label htmlFor="expense-bearer">Centre de coût (qui paie) *</Label>
            <Select value={bearerId} onValueChange={setBearerId}>
              <SelectTrigger id="expense-bearer">
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {bearers.length === 0 && (
                  <SelectItem value="__none__" disabled>
                    Aucun centre de coût disponible
                  </SelectItem>
                )}
                {bearers.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} <span className="text-xs text-muted-foreground">({b.code})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="expense-label">Libellé</Label>
            <Input
              id="expense-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={defaultLabel}
            />
          </div>
        </div>
      )}
    </Card>
  );
}
