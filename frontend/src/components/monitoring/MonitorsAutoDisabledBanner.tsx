'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2, Power, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

interface AutoDisabledMonitor {
  id: string;
  target: string;
  targetPort: number | null;
  kind: string;
}

interface AutoDisabledStatus {
  disabledMonitors: AutoDisabledMonitor[];
  acknowledged: boolean;
}

interface Props {
  entityType: 'asset' | 'site';
  entityId: string;
}

/**
 * Persistent banner shown on the asset/site detail page (ADR-016 §E.2).
 * Displays as long as the entity has auto-disabled monitors AND the user
 * hasn't acknowledged the latest auto-disable event.
 *
 * Two actions:
 *  - "Réactiver les N monitors" → bulk re-enable + auto-ack.
 *  - "Garder désactivés" → ack only, monitors stay off.
 */
export function MonitorsAutoDisabledBanner({ entityType, entityId }: Props) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<AutoDisabledStatus>({
    queryKey: ['monitors', 'auto-disabled', entityType, entityId],
    queryFn: () =>
      apiClient.get<AutoDisabledStatus>(
        `/api/monitors/auto-disabled/status?entityType=${entityType}&entityId=${entityId}`,
      ),
    refetchOnWindowFocus: false,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['monitors', 'auto-disabled', entityType, entityId] });
    queryClient.invalidateQueries({ queryKey: ['monitors'] });
  };

  const enableMutation = useMutation({
    mutationFn: () =>
      apiClient.post<{ count: number }>('/api/monitors/auto-disabled/bulk-enable', {
        entityType,
        entityId,
      }),
    onSuccess: (res) => {
      toast.success(`${res.count} monitor${res.count > 1 ? 's' : ''} réactivé${res.count > 1 ? 's' : ''}`);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message || 'Échec de la réactivation'),
  });

  const ackMutation = useMutation({
    mutationFn: () =>
      apiClient.post<{ acknowledged: boolean }>('/api/monitors/auto-disabled/ack', {
        entityType,
        entityId,
      }),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e.message || 'Échec'),
  });

  if (isLoading || !data) return null;
  if (data.acknowledged) return null;
  if (data.disabledMonitors.length === 0) return null;

  const n = data.disabledMonitors.length;
  const entityLabel = entityType === 'asset' ? 'cet équipement' : 'ce site';

  return (
    <Alert variant="default" className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-900 dark:text-amber-100">
        Surveillance suspendue
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <p className="text-sm text-amber-900 dark:text-amber-100">
          {n} monitor{n > 1 ? 's ont été désactivés' : ' a été désactivé'} automatiquement
          suite à un changement de statut sur {entityLabel}.
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => enableMutation.mutate()}
            disabled={enableMutation.isPending}
          >
            {enableMutation.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Power className="mr-1 h-4 w-4" />
            )}
            Réactiver {n} monitor{n > 1 ? 's' : ''}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => ackMutation.mutate()}
            disabled={ackMutation.isPending}
          >
            <X className="mr-1 h-4 w-4" />
            Garder désactivés
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
