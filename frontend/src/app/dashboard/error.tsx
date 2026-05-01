'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/error-state';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[dashboard error boundary]', error);
  }, [error]);

  return (
    <ErrorState
      variant="page"
      title="Cette page n'a pas pu se charger"
      error={error}
      onRetry={reset}
    />
  );
}
