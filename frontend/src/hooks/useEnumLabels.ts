'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, type EnumLabelItem, type UpdateEnumLabelData } from '@/lib/api/admin';

/**
 * Hook to manage custom enum labels (AssetType, AssetStatus, PinType).
 * Returns labels merged with defaults.
 */
export function useEnumLabels(enumType?: string) {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['enum-labels', enumType],
    queryFn: () => adminApi.getEnumLabels(enumType),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  const updateMutation = useMutation({
    mutationFn: (dto: UpdateEnumLabelData) => adminApi.updateEnumLabel(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enum-labels'] });
    },
  });

  const resetMutation = useMutation({
    mutationFn: (type?: string) => adminApi.resetEnumLabels(type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enum-labels'] });
    },
  });

  /**
   * Get the display label for an enum value.
   * Falls back to the raw value if not found.
   */
  const getLabel = (type: string, value: string): string => {
    if (!data) return value;
    const items = data[type];
    if (!items) return value;
    const item = items.find((i) => i.enumValue === value);
    return item?.label || value;
  };

  /**
   * Get the color for an enum value.
   */
  const getColor = (type: string, value: string): string | null => {
    if (!data) return null;
    const items = data[type];
    if (!items) return null;
    const item = items.find((i) => i.enumValue === value);
    return item?.color || null;
  };

  /**
   * Get all labels for a specific enum type.
   */
  const getLabelsForType = (type: string): EnumLabelItem[] => {
    if (!data) return [];
    return data[type] || [];
  };

  return {
    labels: data || {},
    isLoading,
    error,
    getLabel,
    getColor,
    getLabelsForType,
    updateLabel: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    resetLabels: resetMutation.mutate,
    isResetting: resetMutation.isPending,
  };
}
