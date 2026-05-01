'use client';

import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/**
 * Sticky top banner shown when the device drops offline. Hidden by default.
 * Mounted in the dashboard layout so authenticated users see it on every page.
 *
 * The hook itself debounces transitions ~1s — short network blips do not
 * flicker this banner.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-warning text-warning-foreground px-4 py-2 text-sm flex items-center justify-center gap-2 border-b border-warning/30"
    >
      <WifiOff className="h-4 w-4" aria-hidden />
      <span>Connexion réseau perdue — les données affichées peuvent être obsolètes.</span>
    </div>
  );
}
