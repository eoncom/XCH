'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect /dashboard/integrations/monitoring → /dashboard/monitoring/mapping
 * The monitoring configuration has been consolidated under /dashboard/monitoring/*
 */
export default function IntegrationsMonitoringRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/monitoring/mapping');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-muted-foreground">Redirection vers la configuration monitoring...</p>
    </div>
  );
}
