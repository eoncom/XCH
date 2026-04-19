// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, Trash2, Loader2, Settings } from 'lucide-react';
import { notificationsInboxApi, type UserNotification } from '@/lib/api/notifications-inbox';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export default function NotificationsPage() {
  const [items, setItems] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const load = async () => {
    setLoading(true);
    try {
      const list = await notificationsInboxApi.list({
        unreadOnly: filter === 'unread',
        limit: 200,
      });
      setItems(list || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const markRead = async (id: string) => {
    await notificationsInboxApi.markRead(id);
    setItems((xs) =>
      xs.map((x) => (x.id === id && !x.readAt ? { ...x, readAt: new Date().toISOString() } : x)),
    );
  };

  const markAll = async () => {
    await notificationsInboxApi.markAllRead();
    await load();
  };

  const remove = async (id: string) => {
    await notificationsInboxApi.remove(id);
    setItems((xs) => xs.filter((x) => x.id !== id));
  };

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
          <Button variant="outline" onClick={markAll} disabled={unreadCount === 0}>
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

      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Chargement...
        </div>
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
                        onClick={() => markRead(n.id)}
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
                      onClick={() => markRead(n.id)}
                      title="Marquer comme lu"
                    >
                      <CheckCheck className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(n.id)}
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
