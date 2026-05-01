'use client';

import { useEffect, useState } from 'react';

const DEBOUNCE_MS = 1000;

/**
 * Reactive `navigator.onLine` with a 1s debounce on transitions.
 * Construction-site networks flap rapidly; emitting the raw event leads to
 * toast spam in consumers (NotificationInbox, OfflineBanner). The hook
 * absorbs short blips and only flips when the new state has stabilized.
 *
 * SSR-safe: returns `true` (assume online) before hydration.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let pendingTimeout: ReturnType<typeof setTimeout> | null = null;

    const schedule = (next: boolean) => {
      if (pendingTimeout) clearTimeout(pendingTimeout);
      pendingTimeout = setTimeout(() => {
        setOnline((prev) => (prev === next ? prev : next));
        pendingTimeout = null;
      }, DEBOUNCE_MS);
    };

    const handleOnline = () => schedule(true);
    const handleOffline = () => schedule(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Resync on mount in case the value drifted between SSR fallback and hydration.
    setOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (pendingTimeout) clearTimeout(pendingTimeout);
    };
  }, []);

  return online;
}
