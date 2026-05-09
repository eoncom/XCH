'use client';

// S8 / item 4 — side-effect import du Sentry browser init.
// Sans `withSentryConfig` (qu'on évite volontairement pour préserver la
// compat Konva externals — voir `instrumentation.ts`), le fichier
// `sentry.client.config.ts` doit être câblé manuellement côté browser.
// Cet import depuis un Client Component (Providers est `'use client'` et
// monté dans le root layout) place le fichier dans le bundle browser et
// exécute `Sentry.init()` au tout premier mount.
// Next 15.3+ fournira `instrumentation-client.ts` auto-loaded ; en
// attendant (15.0–15.2), ce wire explicite est la bonne pratique.
import '../../sentry.client.config';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';
import { BrandingProvider } from '@/components/BrandingProvider';
import { DelegationProvider } from '@/contexts/DelegationContext';
import { ApiError } from '@/lib/api-client';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Bumped from 60s to 5min (phase 6 T8). Pages that need fresher
            // data (e.g. notification inbox) already override staleTime locally.
            staleTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
            // Retry strategy aware of ApiError.kind (S6 PR1):
            //   - 5xx: 2 retries (transient server)
            //   - network down: 1 retry (likely flap)
            //   - 4xx / timeout / aborted: no retry (permanent or user-driven)
            retry: (failureCount, err) => {
              if (err instanceof ApiError) {
                if (err.kind === 'http' && err.status >= 500) return failureCount < 2;
                if (err.kind === 'network') return failureCount < 1;
                return false;
              }
              return failureCount < 1;
            },
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange={false}
      >
        <BrandingProvider>
          <DelegationProvider>
            {children}
          </DelegationProvider>
        </BrandingProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
