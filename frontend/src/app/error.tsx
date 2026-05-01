'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/error-state';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[root error boundary]', error);
  }, [error]);

  return (
    <html lang="fr">
      <body>
        <ErrorState
          variant="page"
          title="Une erreur inattendue est survenue"
          error={error}
          onRetry={reset}
        />
      </body>
    </html>
  );
}
