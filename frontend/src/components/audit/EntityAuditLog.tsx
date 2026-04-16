// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { Activity, Loader2 } from 'lucide-react';
import { auditApi, type AuditEntry } from '@/lib/api/audit';

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  UPDATE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

interface Props {
  entityType: string;
  entityId: string;
  limit?: number;
}

export function EntityAuditLog({ entityType, entityId, limit = 50 }: Props) {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    auditApi
      .forEntity(entityType, entityId, limit)
      .then((r) => {
        if (!ignore) setItems(r.data || []);
      })
      .catch(() => {
        if (!ignore) setItems([]);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [entityType, entityId, limit]);

  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement de l&apos;historique...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground border rounded-md">
        <Activity className="h-6 w-6 mx-auto mb-2 text-muted-foreground/50" />
        Aucune activité enregistrée
      </div>
    );
  }

  return (
    <div className="border rounded-md divide-y">
      {items.map((e) => (
        <div key={e.id} className="p-3 text-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[e.action] || 'bg-muted'}`}
            >
              {e.action}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(e.timestamp).toLocaleString('fr-FR')}
            </span>
            {e.user && (
              <span className="text-xs">
                par <strong>{e.user.name}</strong>
              </span>
            )}
          </div>
          {e.changes && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                Voir les modifications
              </summary>
              <pre className="mt-1 bg-muted p-2 rounded text-[10px] overflow-x-auto">
                {JSON.stringify(e.changes, null, 2)}
              </pre>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}
