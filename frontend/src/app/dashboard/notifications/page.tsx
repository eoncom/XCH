// @ts-nocheck
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Trash2, Loader2, Settings } from 'lucide-react';
import { notificationsInboxApi, type UserNotification } from '@/lib/api/notifications-inbox';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { showToast } from '@/lib/toast';
import { mapApiErrorToFr } from '@/lib/error-messages';

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  // S6 PR4 — was useState+useEffect with a silent catch that hid errors
  // behind an empty list. Now properly surfaces network errors via <ErrorState>.
  const queryKey = ['notifications-inbox', { unreadOnly: filter === 'unread', limit: 200 }];
  const { data: items = [], isLoading, isError, error, refetch } = useQuery<UserNotification[]>({
    queryKey,
    queryFn: () => notificationsInboxApi.list({
      unreadOnly: filter === 'unread',
      limit: 200,
    }),
    staleTime: 60_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsInboxApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications-inbox'] }),
    onError: (err) => showToast.error(mapApiErrorToFr(err)),
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsInboxApi.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications-inbox'] }),
    onError: (err) => showToast.error(mapApiErrorToFr(err)),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => notificationsInboxApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications-inbox'] }),
    onError: (err) => showToast.error(mapApiErrorToFr(err)),
  });

  const unreadCount = items.filter((x) => !x.readAt).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Bell className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Boîte de réception</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Tout est lu'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border">
            <button
              onClick={() => setFilter('all')}
              className={cn(
                'px-3 py-1.5 text-sm',
                filter === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
              )}
            >
              Toutes
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={cn(
                'px-3 py-1.5 text-sm border-l',
                filter === 'unread' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
              )}
            >
              Non lues
            </button>
          </div>
          <Button
            variant="outline"
            onClick={() => markAllMutation.mutate()}
            disabled={unreadCount === 0 || markAllMutation.isPending}
          >
            <CheckCheck className="mr-2 h-4 w-4" /> Tout marquer lu
          </Button>
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                {/* Deep-link into the Settings page on the Notifications tab —
                    Tabs are controlled by ?tab=notifications, no separate route. */}
                <Button variant="outline" size="icon" asChild aria-label="Configurer les notifications">
                  <Link href="/dashboard/settings?tab=notifications">
                    <Settings className="h-4 w-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Règles et canaux</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Chargement...
        </div>
      ) : isError ? (
        <ErrorState
          title="Impossible de charger vos notifications"
          error={error}
          onRetry={() => refetch()}
        />
      ) : items.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground border rounded-md">
          Aucune notification{filter === 'unread' ? ' non lue' : ''}
        </div>
      ) : (
        <div className="border rounded-md divide-y">
          {items.map((n) => {
            const isUnread = !n.readAt;
            return (
              <div
                key={n.id}
                className={cn(
                  'px-4 py-3 flex items-start gap-3 transition-colors',
                  isUnread ? 'bg-accent/40' : '',
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className={cn('font-medium', isUnread && 'font-semibold')}>
                    {n.link ? (
                      <Link
                        href={n.link}
                        className="hover:underline"
                        onClick={() => markReadMutation.mutate(n.id)}
                      >
                        {n.title}
                      </Link>
                    ) : (
                      n.title
                    )}
                  </div>
                  {n.body && (
                    <div className="text-sm text-muted-foreground mt-1">{n.body}</div>
                  )}
                  <div className="text-xs text-muted-foreground mt-2 uppercase tracking-wide">
                    {n.type} · {new Date(n.createdAt).toLocaleString('fr-FR')}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isUnread && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markReadMutation.mutate(n.id)}
                      disabled={markReadMutation.isPending}
                      title="Marquer comme lu"
                    >
                      <CheckCheck className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMutation.mutate(n.id)}
                    disabled={removeMutation.isPending}
                    title="Supprimer"
                    className="text-muted-foreground hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
