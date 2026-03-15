'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Legacy redirect — Integrations page has been split into:
 * - /dashboard/monitoring (Monitoring)
 * - /dashboard/netbox (NetBox)
 */
export default function IntegrationsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/netbox');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-muted-foreground">Redirection...</p>
    </div>
  );
}
