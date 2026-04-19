'use client';

import { NotificationsConfigPanel } from './NotificationsConfigPanel';

/**
 * Standalone route `/dashboard/settings/notifications` — kept routable for
 * external links and bookmarks. Renders the same NotificationsConfigPanel as
 * the in-tab usage inside `settings/page.tsx`, with the "← Retour" header on
 * (`embedded={false}`).
 *
 * The actual UI lives in `./NotificationsConfigPanel.tsx` so it can be reused
 * across the standalone route and the Settings tab system without breaking
 * the tab continuity (phase 6 fix).
 */
export default function NotificationsSettingsPage() {
  return <NotificationsConfigPanel />;
}
