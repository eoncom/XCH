'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';
import { BrandingProvider } from '@/components/BrandingProvider';
import { DelegationProvider } from '@/contexts/DelegationContext';

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
