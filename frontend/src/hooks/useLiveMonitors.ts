'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { integrationsApi } from '@/lib/api/integrations';

export interface LiveMonitor {
  id: number;
  name: string;
  type: string;
  status: 'up' | 'down' | 'unknown';
  responseTime: number;
  certExpiry?: number;
}

export interface MonitorsResponse {
  monitors: LiveMonitor[];
  status: 'connected' | 'not_configured' | 'error';
  message?: string;
  lastFetch?: string;
}

/**
 * Hook to fetch live monitor statuses from Uptime Kuma.
 * Shared across pages via the same React Query key.
 * Cache: 60s staleTime, retry: 1 (non-blocking if Uptime Kuma is offline).
 */
export function useLiveMonitors() {
  const { data, ...rest } = useQuery<MonitorsResponse>({
    queryKey: ['uptime-kuma-monitors'],
    queryFn: async () => {
      const result = await integrationsApi.uptimeKuma.getMonitors();
      // Handle both old format (array) and new format (object with monitors)
      if (Array.isArray(result)) {
        return { monitors: result, status: 'connected' as const };
      }
      return result;
    },
    retry: 1,
    staleTime: 60_000,
  });

  const monitors = data?.monitors ?? [];
  const providerStatus = data?.status ?? 'not_configured';
  const providerMessage = data?.message;

  const statusMap = useMemo(() => {
    const map: Record<string, 'up' | 'down' | 'unknown'> = {};
    for (const m of monitors) {
      map[m.name] = m.status;
    }
    return map;
  }, [monitors]);

  return {
    monitors,
    statusMap,
    providerStatus,
    providerMessage,
    ...rest,
  };
}
