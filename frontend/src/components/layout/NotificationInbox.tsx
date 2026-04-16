// @ts-nocheck
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, X, Loader2 } from 'lucide-react';
import { notificationsInboxApi, type UserNotification } from '@/lib/api/notifications-inbox';
import { cn } from '@/lib/utils';

const POLL_INTERVAL_MS = 60_000;

function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.max(1, Math.round((now - then) / 1000));
  if (diffSec < 60) return `il y a ${diffSec}s`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `il y a ${diffMin}min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  const diffD = Math.round(diffH / 24);
  return `il y a ${diffD}j`;
}

export function NotificationInbox() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = async () => {
    try {
      const [count, list] = await Promise.all([
        notificationsInboxApi.countUnread(),
        notificationsInboxApi.list({ limit: 15 }),
      ]);
      setUnread(count.count || 0);
      setItems(list || []);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const toggleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      try {
        const list = await notificationsInboxApi.list({ limit: 15 });
        setItems(list || []);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await notificationsInboxApi.markRead(id);
      setItems((xs) =>
        xs.map((x) => (x.id === id && !x.readAt ? { ...x, readAt: new Date().toISOString() } : x)),
      );
      setUnread((c) => Math.max(0, c - 1));
    } catch {
      /* ignore */
    }
  };

  const handleMarkAll = async () => {
    try {
      const res = await notificationsInboxApi.markAllRead();
      setItems((xs) => xs.map((x) => (x.readAt ? x : { ...x, readAt: new Date().toISOString() })));
      setUnread(0);
    } catch {
      /* ignore */
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await notificationsInboxApi.remove(id);
      const toDelete = items.find((x) => x.id === id);
      setItems((xs) => xs.filter((x) => x.id !== id));
      if (toDelete && !toDelete.readAt) setUnread((c) => Math.max(0, c - 1));
    } catch {
      /* ignore */
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        title="Notifications"
        className="relative inline-flex items-center justify-center rounded-md hover:bg-accent w-9 h-9"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[380px] max-w-[calc(100vw-2rem)] bg-background border rounded-lg shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="font-semibold text-sm">Notifications</div>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Tout lire
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="py-10 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Chargement...
              </div>
            ) : items.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Aucune notification
              </div>
            ) : (
              items.map((n) => {
                const isUnread = !n.readAt;
                const body = (
                  <div
                    className={cn(
                      'px-4 py-3 border-b last:border-b-0 text-sm transition-colors',
                      isUnread ? 'bg-accent/40' : '',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className={cn('font-medium truncate', isUnread && 'font-semibold')}>
                          {n.title}
                        </div>
                        {n.body && (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {n.body}
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">
                          {n.type} · {timeAgo(n.createdAt)}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        {isUnread && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleMarkRead(n.id);
                            }}
                            title="Marquer comme lu"
                            className="text-muted-foreground hover:text-foreground text-xs"
                          >
                            <CheckCheck className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRemove(n.id);
                          }}
                          title="Supprimer"
                          className="text-muted-foreground hover:text-red-500 text-xs"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
                return n.link ? (
                  <Link
                    key={n.id}
                    href={n.link}
                    onClick={() => {
                      if (isUnread) handleMarkRead(n.id);
                      setOpen(false);
                    }}
                    className="block hover:bg-accent/60"
                  >
                    {body}
                  </Link>
                ) : (
                  <div key={n.id}>{body}</div>
                );
              })
            )}
          </div>

          <div className="border-t px-4 py-2 text-center">
            <Link
              href="/dashboard/notifications"
              onClick={() => setOpen(false)}
              className="text-xs text-primary hover:underline"
            >
              Voir toutes les notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
