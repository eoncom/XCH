'use client';

import { ShieldAlert } from 'lucide-react';
import {
  getWarrantyStatus,
  getWarrantyDaysLeft,
  getWarrantyLabel,
  getWarrantyBadgeClasses,
  useWarrantyThresholds,
  type WarrantyStatus,
} from '@/lib/warranty';

interface WarrantyBadgeProps {
  warrantyEnd?: string | null;
  /** Show badge even for 'ok' status (default: false) */
  showOk?: boolean;
  /** Compact mode — icon only, no text (default: false) */
  compact?: boolean;
  className?: string;
}

export function WarrantyBadge({ warrantyEnd, showOk = false, compact = false, className = '' }: WarrantyBadgeProps) {
  const thresholds = useWarrantyThresholds();
  const status = getWarrantyStatus(warrantyEnd, thresholds);

  // Don't render if no warranty info or warranty is OK (unless showOk)
  if (status === 'none') return null;
  if (status === 'ok' && !showOk) return null;

  const daysLeft = warrantyEnd ? getWarrantyDaysLeft(warrantyEnd) : undefined;
  const label = getWarrantyLabel(status, daysLeft);
  const classes = getWarrantyBadgeClasses(status);

  if (compact) {
    return (
      <span
        className={`inline-flex items-center justify-center h-6 w-6 rounded-full ${classes.bg} ${classes.border} border ${className}`}
        title={label}
      >
        <ShieldAlert className={`h-3.5 w-3.5 ${classes.icon}`} />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border ${classes.bg} ${classes.text} ${classes.border} ${className}`}
    >
      <ShieldAlert className={`h-3 w-3 ${classes.icon}`} />
      {label}
    </span>
  );
}

/**
 * Warranty alert banner — for asset detail page
 */
interface WarrantyAlertBannerProps {
  warrantyEnd?: string | null;
}

export function WarrantyAlertBanner({ warrantyEnd }: WarrantyAlertBannerProps) {
  const thresholds = useWarrantyThresholds();
  const status = getWarrantyStatus(warrantyEnd, thresholds);

  if (status === 'none' || status === 'ok') return null;

  const daysLeft = warrantyEnd ? getWarrantyDaysLeft(warrantyEnd) : 0;
  const classes = getWarrantyBadgeClasses(status);

  const messages: Record<Exclude<WarrantyStatus, 'ok' | 'none'>, { title: string; description: string }> = {
    expired: {
      title: 'Garantie expirée',
      description: `La garantie de cet équipement a expiré depuis ${Math.abs(daysLeft)} jour${Math.abs(daysLeft) > 1 ? 's' : ''} (${warrantyEnd ? new Date(warrantyEnd).toLocaleDateString('fr-FR') : ''}).`,
    },
    expiring_critical: {
      title: 'Garantie bientôt expirée',
      description: `La garantie expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''} (${warrantyEnd ? new Date(warrantyEnd).toLocaleDateString('fr-FR') : ''}).`,
    },
    expiring_warning: {
      title: 'Fin de garantie approche',
      description: `La garantie expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''} (${warrantyEnd ? new Date(warrantyEnd).toLocaleDateString('fr-FR') : ''}).`,
    },
  };

  const msg = messages[status as keyof typeof messages];

  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border ${classes.bg} ${classes.border}`}>
      <ShieldAlert className={`h-5 w-5 mt-0.5 flex-shrink-0 ${classes.icon}`} />
      <div>
        <p className={`font-medium text-sm ${classes.text}`}>{msg.title}</p>
        <p className={`text-sm mt-0.5 ${classes.text} opacity-80`}>{msg.description}</p>
      </div>
    </div>
  );
}
