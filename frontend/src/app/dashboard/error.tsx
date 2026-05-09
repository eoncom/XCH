'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
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
    // S8 / item 6 — route le unhandled vers GlitchTip projet xch-frontend
    // (DSN public, runtime=browser tag set au boot init via sentry.client.config).
    // Le scrubber `beforeSend` filtre déjà les erreurs légitimes (401/403/404/
    // ChunkLoadError/AbortError) → ici on n'arrive que pour du vrai unhandled.
    // `error.digest` (Next 15) est inclus dans extras pour corréler avec les
    // logs serveur si l'erreur vient d'un Server Component.
    Sentry.captureException(error, {
      extra: error.digest ? { digest: error.digest } : undefined,
    });
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
