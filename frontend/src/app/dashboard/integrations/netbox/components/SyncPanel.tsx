'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Loader2, CheckCircle2, AlertCircle, Plus, Pencil, MinusCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { SyncResult } from '@/types';

interface SyncPanelProps {
  title: string;
  onSync: () => Promise<SyncResult>;
  entityLabel: string;
  description?: string;
  disabled?: boolean;
  disabledReason?: string;
}

export function SyncPanel({
  title,
  onSync,
  entityLabel,
  description,
  disabled = false,
  disabledReason,
}: SyncPanelProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await onSync();
      setLastResult(result);
      setLastSyncTime(new Date());

      const totalProcessed = result.created + result.updated + result.skipped;

      if (result.errors && result.errors.length > 0) {
        toast.warning(`Synchronisation terminee avec ${result.errors.length} erreur(s)`, {
          description: `${result.created} crees, ${result.updated} mis a jour, ${result.skipped} ignores`,
        });
      } else if (totalProcessed > 0) {
        toast.success(`Synchronisation des ${entityLabel} reussie`, {
          description: `${result.created} crees, ${result.updated} mis a jour, ${result.skipped} ignores`,
        });
      } else {
        toast.info(`Aucun ${entityLabel} a synchroniser`, {
          description: 'Les donnees sont deja a jour',
        });
      }
    } catch (error) {
      toast.error('Erreur lors de la synchronisation', {
        description: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
        {lastSyncTime && (
          <span className="text-xs text-muted-foreground">
            Derniere sync: {lastSyncTime.toLocaleTimeString('fr-FR')}
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}

        {/* Sync Button */}
        <div className="flex items-center gap-4">
          <Button
            onClick={handleSync}
            disabled={disabled || isSyncing}
            className="min-w-[180px]"
          >
            {isSyncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Synchronisation...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Synchroniser {entityLabel}
              </>
            )}
          </Button>
          {disabled && disabledReason && (
            <span className="text-sm text-muted-foreground">{disabledReason}</span>
          )}
        </div>

        {/* Results Display */}
        {lastResult && (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="font-medium">Resultats de la synchronisation</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {lastResult.created > 0 && (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  <Plus className="mr-1 h-3 w-3" />
                  {lastResult.created} crees
                </Badge>
              )}
              {lastResult.updated > 0 && (
                <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                  <Pencil className="mr-1 h-3 w-3" />
                  {lastResult.updated} mis a jour
                </Badge>
              )}
              {lastResult.skipped > 0 && (
                <Badge variant="secondary">
                  <MinusCircle className="mr-1 h-3 w-3" />
                  {lastResult.skipped} ignores
                </Badge>
              )}
              {lastResult.fetched > 0 && (
                <Badge variant="outline">
                  {lastResult.fetched} recuperes
                </Badge>
              )}
            </div>

            {/* Errors Section */}
            {lastResult.errors && lastResult.errors.length > 0 && (
              <div className="mt-3 rounded-lg bg-destructive/10 p-3 space-y-2">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium text-sm">
                    {lastResult.errors.length} erreur(s)
                  </span>
                </div>
                <ul className="text-sm text-destructive/90 space-y-1 pl-6 list-disc">
                  {lastResult.errors.slice(0, 5).map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                  {lastResult.errors.length > 5 && (
                    <li className="text-muted-foreground">
                      ... et {lastResult.errors.length - 5} autre(s)
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!lastResult && !isSyncing && (
          <div className="rounded-lg border border-dashed p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Cliquez sur &quot;Synchroniser&quot; pour importer les {entityLabel} depuis NetBox
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
