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

/**
 * Hook to fetch live monitor statuses from Uptime Kuma.
 * Shared across pages via the same React Query key.
 * Cache: 60s staleTime, retry: 1 (non-blocking if Uptime Kuma is offline).
 */
export function useLiveMonitors() {
  const { data: monitors = [], ...rest } = useQuery<LiveMonitor[]>({
    queryKey: ['uptime-kuma-monitors'],
    queryFn: () => integrationsApi.uptimeKuma.getMonitors(),
    retry: 1,
    staleTime: 60_000,
  });

  const statusMap = useMemo(() => {
    const map: Record<string, 'up' | 'down' | 'unknown'> = {};
    for (const m of monitors) {
      map[m.name] = m.status;
    }
    return map;
  }, [monitors]);

  return { monitors, statusMap, ...rest };
}
