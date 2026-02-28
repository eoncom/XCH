import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

// ── Types ────────────────────────────────────────────────────

export type WarrantyStatus = 'ok' | 'expiring_warning' | 'expiring_critical' | 'expired' | 'none';

export interface WarrantyThresholds {
  warning: number;  // jours (défaut 90)
  critical: number; // jours (défaut 30)
}

export const DEFAULT_THRESHOLDS: WarrantyThresholds = { warning: 90, critical: 30 };

// ── Core utility ─────────────────────────────────────────────

export function getWarrantyDaysLeft(warrantyEnd: string): number {
  return Math.ceil((new Date(warrantyEnd).getTime() - Date.now()) / 86_400_000);
}

export function getWarrantyStatus(
  warrantyEnd?: string | null,
  thresholds: WarrantyThresholds = DEFAULT_THRESHOLDS,
): WarrantyStatus {
  if (!warrantyEnd) return 'none';
  const days = getWarrantyDaysLeft(warrantyEnd);
  if (days < 0) return 'expired';
  if (days <= thresholds.critical) return 'expiring_critical';
  if (days <= thresholds.warning) return 'expiring_warning';
  return 'ok';
}

export function getWarrantyLabel(status: WarrantyStatus, daysLeft?: number): string {
  switch (status) {
    case 'expired':
      return daysLeft !== undefined ? `Expirée (${Math.abs(daysLeft)}j)` : 'Expirée';
    case 'expiring_critical':
      return daysLeft !== undefined ? `Expire dans ${daysLeft}j` : 'Expire bientôt';
    case 'expiring_warning':
      return daysLeft !== undefined ? `Garantie ${daysLeft}j` : 'Garantie courte';
    case 'ok':
      return 'Garantie OK';
    case 'none':
      return 'Pas de garantie';
  }
}

/** Returns Tailwind classes for badge styling */
export function getWarrantyBadgeClasses(status: WarrantyStatus): {
  bg: string;
  text: string;
  border: string;
  icon: string;
} {
  switch (status) {
    case 'expired':
      return {
        bg: 'bg-red-100 dark:bg-red-900/30',
        text: 'text-red-800 dark:text-red-300',
        border: 'border-red-200 dark:border-red-800',
        icon: 'text-red-600 dark:text-red-400',
      };
    case 'expiring_critical':
      return {
        bg: 'bg-orange-100 dark:bg-orange-900/30',
        text: 'text-orange-800 dark:text-orange-300',
        border: 'border-orange-200 dark:border-orange-800',
        icon: 'text-orange-600 dark:text-orange-400',
      };
    case 'expiring_warning':
      return {
        bg: 'bg-amber-100 dark:bg-amber-900/30',
        text: 'text-amber-800 dark:text-amber-300',
        border: 'border-amber-200 dark:border-amber-800',
        icon: 'text-amber-600 dark:text-amber-400',
      };
    default:
      return {
        bg: 'bg-green-100 dark:bg-green-900/30',
        text: 'text-green-800 dark:text-green-300',
        border: 'border-green-200 dark:border-green-800',
        icon: 'text-green-600 dark:text-green-400',
      };
  }
}

// ── Hook: read thresholds from tenant config ─────────────────

export function useWarrantyThresholds(): WarrantyThresholds {
  const { isAuthenticated } = useAuthStore();

  const { data: tenant } = useQuery<any>({
    queryKey: ['tenant-branding'],
    queryFn: () => apiClient.get('/api/tenants/current'),
    staleTime: 10 * 60 * 1000,
    enabled: isAuthenticated,
  });

  const cfg = tenant?.config?.warrantyAlertThresholds;
  return {
    warning: cfg?.warning ?? DEFAULT_THRESHOLDS.warning,
    critical: cfg?.critical ?? DEFAULT_THRESHOLDS.critical,
  };
}
