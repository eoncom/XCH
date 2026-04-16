// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, Loader2, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { auditApi, type AuditEntry, type AuditQueryParams } from '@/lib/api/audit';

const ENTITY_LINKS: Record<string, (id: string) => string> = {
  Asset: (id) => `/dashboard/assets/${id}`,
  Site: (id) => `/dashboard/sites/${id}`,
  Rack: (id) => `/dashboard/racks/${id}`,
  Task: (id) => `/dashboard/tasks/${id}`,
  Contact: (id) => `/dashboard/contacts/${id}`,
  FloorPlan: (id) => `/dashboard/floor-plans/${id}`,
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  UPDATE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export default function AuditLogPage() {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [filters, setFilters] = useState<AuditQueryParams>({
    page: 1,
    pageSize: 50,
  });

  const load = async (p = page) => {
    setLoading(true);
    try {
      const res = await auditApi.query({ ...filters, page: p });
      setItems(res.data || []);
      setTotalPages(res.meta.totalPages);
      setTotal(res.meta.total);
      setPage(res.meta.page);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = () => load(1);

  const clearFilters = () => {
    setFilters({ page: 1, pageSize: 50 });
    setTimeout(() => load(1), 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Journal d&apos;audit</h1>
          <p className="text-sm text-muted-foreground">
            Historique des créations, modifications et suppressions
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-5">
            <div>
              <label className="text-xs font-medium">Entité</label>
              <input
                value={filters.entity || ''}
                onChange={(e) => setFilters({ ...filters, entity: e.target.value })}
                placeholder="Asset, Site, Task..."
                className="mt-1 block w-full border rounded-md px-3 py-2 text-sm bg-background"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Entity ID</label>
              <input
                value={filters.entityId || ''}
                onChange={(e) => setFilters({ ...filters, entityId: e.target.value })}
                placeholder="clxxxxxxxx"
                className="mt-1 block w-full border rounded-md px-3 py-2 text-sm bg-background"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Action</label>
              <select
                value={filters.action || ''}
                onChange={(e) => setFilters({ ...filters, action: (e.target.value || undefined) as any })}
                className="mt-1 block w-full border rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="">Toutes</option>
                <option value="CREATE">CREATE</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Depuis</label>
              <input
                type="date"
                value={filters.from ? filters.from.slice(0, 10) : ''}
                onChange={(e) => setFilters({ ...filters, from: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                className="mt-1 block w-full border rounded-md px-3 py-2 text-sm bg-background"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Jusqu&apos;au</label>
              <input
                type="date"
                value={filters.to ? filters.to.slice(0, 10) : ''}
                onChange={(e) => setFilters({ ...filters, to: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                className="mt-1 block w-full border rounded-md px-3 py-2 text-sm bg-background"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={applyFilters}>
              <Filter className="mr-2 h-4 w-4" /> Appliquer
            </Button>
            <Button variant="outline" onClick={clearFilters}>
              <X className="mr-2 h-4 w-4" /> Réinitialiser
            </Button>
            <div className="ml-auto text-sm text-muted-foreground self-center">
              {total} entrée(s)
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Chargement...
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground border rounded-md">
          Aucune entrée
        </div>
      ) : (
        <>
          <div className="border rounded-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Date</th>
                    <th className="px-3 py-2 text-left font-medium">Action</th>
                    <th className="px-3 py-2 text-left font-medium">Entité</th>
                    <th className="px-3 py-2 text-left font-medium">Utilisateur</th>
                    <th className="px-3 py-2 text-left font-medium">Changements</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((e) => {
                    const linkFn = ENTITY_LINKS[e.entityType];
                    const entityLink = e.entityId && linkFn ? linkFn(e.entityId) : null;
                    return (
                      <tr key={e.id} className="border-t hover:bg-accent/30">
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(e.timestamp).toLocaleString('fr-FR')}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[e.action] || 'bg-muted'}`}>
                            {e.action}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{e.entityType}</div>
                          {e.entityId && (
                            <>
                              {e.entityLabel ? (
                                <div className="text-xs">
                                  {entityLink ? (
                                    <Link href={entityLink} className="hover:underline">
                                      {e.entityLabel}
                                    </Link>
                                  ) : (
                                    <span>{e.entityLabel}</span>
                                  )}
                                </div>
                              ) : null}
                              <div
                                className="text-[10px] text-muted-foreground font-mono"
                                title={e.entityId}
                              >
                                {entityLink && !e.entityLabel ? (
                                  <Link href={entityLink} className="hover:underline">
                                    {e.entityId.slice(0, 8)}...
                                  </Link>
                                ) : (
                                  <>{e.entityId.slice(0, 8)}...</>
                                )}
                              </div>
                            </>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {e.user ? (
                            <>
                              <div className="font-medium">{e.user.name}</div>
                              <div className="text-xs text-muted-foreground">{e.user.email}</div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {e.changes ? (
                            <details>
                              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                Voir détails
                              </summary>
                              <pre className="mt-2 bg-muted p-2 rounded text-[10px] overflow-x-auto max-w-md">
                                {JSON.stringify(e.changes, null, 2)}
                              </pre>
                            </details>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => load(page - 1)}
              >
                Précédent
              </Button>
              <span className="text-sm">
                Page {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => load(page + 1)}
              >
                Suivant
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
