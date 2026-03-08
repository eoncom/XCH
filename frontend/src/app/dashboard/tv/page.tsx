'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect /dashboard/tv → /tv (dedicated route without sidebar)
 */
export default function DashboardTVRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/tv');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-muted-foreground">Redirection vers le Dashboard TV...</p>
    </div>
  );
}
