'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
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
import { Loader2, RotateCcw } from 'lucide-react';
import { showToast } from '@/lib/toast';
import { formatCurrency } from '@/lib/currency';

/**
 * ADR-011 — Resync the linked Expense's totalAmount from the current source
 * (asset / task / connectivity). The Expense is frozen-by-default after
 * creation; this button is the explicit opt-in to refresh it.
 *
 * Two-step UX: click opens an AlertDialog. Confirm calls the mutation, which
 * returns { expense, before, after } so the post-success toast can show the
 * delta.
 */
interface ResyncExpenseButtonProps {
  /**
   * Performs the actual API call. Returns { before, after } in EUR/cents
   * so the dialog confirmation can quote the diff.
   */
  resyncFn: () => Promise<{ before: number; after: number; expense?: any }>;
  /** Currency for the displayed amounts. Defaults to EUR. */
  currency?: string;
  /** Disable the button (e.g. user lacks WRITE permission). */
  disabled?: boolean;
  /** Variant of the underlying Button. */
  variant?: 'outline' | 'ghost' | 'default' | 'secondary';
  /** Size of the underlying Button. */
  size?: 'sm' | 'default' | 'lg' | 'icon';
  /** Optional cache keys to invalidate after a successful resync. */
  invalidateKeys?: string[][];
  /** Children override for the button label. Defaults to "Synchroniser dépense". */
  children?: React.ReactNode;
}

export function ResyncExpenseButton({
  resyncFn,
  currency = 'EUR',
  disabled = false,
  variant = 'outline',
  size = 'sm',
  invalidateKeys = [['expenses']],
  children,
}: ResyncExpenseButtonProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: resyncFn,
    onSuccess: ({ before, after }) => {
      const fmt = (n: number) => formatCurrency(n, currency);
      if (before === after) {
        showToast.success(`Dépense synchronisée — montant inchangé (${fmt(after)})`);
      } else {
        showToast.success(`Dépense synchronisée : ${fmt(before)} → ${fmt(after)}`);
      }
      invalidateKeys.forEach((k) => queryClient.invalidateQueries({ queryKey: k }));
      setOpen(false);
    },
    onError: (e: any) => {
      showToast.error(`Synchronisation : ${e?.message || 'erreur'}`);
    },
  });

  return (
    <>
      <Button
        variant={variant}
        size={size}
        disabled={disabled || mutation.isPending}
        onClick={() => setOpen(true)}
      >
        {mutation.isPending ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <RotateCcw className="h-4 w-4 mr-2" />
        )}
        {children ?? 'Synchroniser dépense'}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Synchroniser la dépense liée ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le montant de la dépense sera recalculé depuis la valeur actuelle de
              l&apos;entité source. Les autres champs (centre de coût, libellé, dates)
              restent inchangés. Cette opération est immédiate et tracée dans
              l&apos;audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? 'Synchronisation…' : 'Synchroniser'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
