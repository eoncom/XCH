'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantsApi, type TenantModule } from '@/lib/api/tenants';

/**
 * Hook to manage tenant modules (feature flags).
 *
 * @returns
 *   - modules: array of module objects with { key, label, description, enabled }
 *   - isModuleEnabled(key): check if a specific module is enabled
 *   - isLoading: true while fetching
 *   - updateModules: mutation to toggle modules on/off
 */
export function useTenantModules() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['tenant-modules'],
    queryFn: () => tenantsApi.getModules(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  const updateModulesMutation = useMutation({
    mutationFn: (modules: Record<string, boolean>) =>
      tenantsApi.updateModules(modules),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-modules'] });
    },
  });

  const modules: TenantModule[] = data?.modules || [];

  /**
   * Check if a module is enabled.
   * Returns true by default if modules haven't loaded yet (optimistic).
   */
  const isModuleEnabled = (moduleKey: string): boolean => {
    if (isLoading || !data?.modules) return true; // Default: enabled while loading
    const mod = data.modules.find((m) => m.key === moduleKey);
    return mod ? mod.enabled : true; // Unknown modules default to enabled
  };

  return {
    modules,
    isModuleEnabled,
    isLoading,
    error,
    updateModules: updateModulesMutation.mutate,
    isUpdating: updateModulesMutation.isPending,
  };
}
