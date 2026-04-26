/**
 * Unified alert computation (v1.4 — Lot 4 finalization).
 *
 * Before v1.4, the Dashboard widget, the /alerts page and the /tv dashboard each
 * computed their own alert set with subtly different rules (dedup of blocked+urgent,
 * inclusion or not of WARNING sites, monitoring-only vs all sources). This module
 * is the single source of truth that all three consume so counts are consistent.
 */

import type { Site, Asset, Task } from '@/types';
import {
  getWarrantyStatus,
  getWarrantyDaysLeft,
  type WarrantyThresholds,
} from '@/lib/warranty';

export type AlertCategory =
  | 'all'
  | 'monitoring'
  | 'health'
  | 'tasks'
  | 'equipment'
  | 'warranty';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface AlertItem {
  id: string;
  category: Exclude<AlertCategory, 'all'>;
  severity: AlertSeverity;
  title: string;
  subtitle?: string;
  siteName?: string;
  siteId?: string;
  link: string;
  /** lucide icon ref — kept loose to avoid importing lucide from this shared lib */
  iconKey: 'WifiOff' | 'Activity' | 'Ban' | 'AlertTriangle' | 'Clock' | 'Package' | 'ShieldAlert';
  badgeLabel: string;
  badgeColor: string;
}

export interface AlertsBucket {
  items: AlertItem[];
  counts: Record<AlertCategory, number>;
  total: number;
}

export interface NativeDownMonitor {
  id: string;
  displayName: string;
  target: string;
  siteId: string | null;
  siteName: string | null;
  assetName: string | null;
  linkProvider: string | null;
}

export interface ComputeAlertsInput {
  sites: Site[];
  assets: Asset[];
  tasks: Task[];
  /** Native monitors currently DOWN (already filtered + flattened by caller). */
  downMonitors: NativeDownMonitor[];
  warrantyThresholds: WarrantyThresholds;
}

export function computeAlerts(input: ComputeAlertsInput): AlertsBucket {
  const { sites, assets, tasks, downMonitors, warrantyThresholds } = input;
  const now = new Date();

  const criticalSites = sites.filter((s) => s.healthStatus === 'CRITICAL');
  const warningSites = sites.filter((s) => s.healthStatus === 'WARNING');

  const blockedTasks = tasks.filter((t) => t.status === 'BLOCKED');
  const urgentTasks = tasks.filter(
    (t) => t.priority === 'URGENT' && t.status !== 'DONE' && t.status !== 'CANCELLED',
  );
  const overdueTasks = tasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE' && t.status !== 'CANCELLED',
  );

  const outOfService = assets.filter((a) => a.status === 'OUT_OF_SERVICE');

  const warrantyExpired = assets.filter(
    (a) => getWarrantyStatus(a.warrantyEnd, warrantyThresholds) === 'expired',
  );
  const warrantyCritical = assets.filter(
    (a) => getWarrantyStatus(a.warrantyEnd, warrantyThresholds) === 'expiring_critical',
  );
  const warrantyWarning = assets.filter(
    (a) => getWarrantyStatus(a.warrantyEnd, warrantyThresholds) === 'expiring_warning',
  );

  const items: AlertItem[] = [];

  // ADR-016 — native monitors already carry their entity context via
  // FK relations (siteId / assetId / linkId). No more monitorName mapping.
  downMonitors.forEach((m) => {
    items.push({
      id: `monitor-${m.id}`,
      category: 'monitoring',
      severity: 'critical',
      title: m.displayName,
      subtitle: m.assetName
        ? `Équipement: ${m.assetName}`
        : m.linkProvider
        ? `Lien : ${m.linkProvider}`
        : 'Surveillance',
      siteName: m.siteName ?? undefined,
      siteId: m.siteId ?? undefined,
      link: `/dashboard/monitoring/${m.id}`,
      iconKey: 'WifiOff',
      badgeLabel: 'Indisponible',
      badgeColor: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200',
    });
  });

  criticalSites.forEach((s) => {
    items.push({
      id: `health-crit-${s.id}`,
      category: 'health',
      severity: 'critical',
      title: s.name,
      subtitle: `${s.code} — ${s.city || 'N/A'}`,
      siteName: s.name,
      siteId: s.id,
      link: `/dashboard/sites/${s.id}`,
      iconKey: 'Activity',
      badgeLabel: 'Critique',
      badgeColor: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200',
    });
  });

  warningSites.forEach((s) => {
    items.push({
      id: `health-warn-${s.id}`,
      category: 'health',
      severity: 'warning',
      title: s.name,
      subtitle: `${s.code} — ${s.city || 'N/A'}`,
      siteName: s.name,
      siteId: s.id,
      link: `/dashboard/sites/${s.id}`,
      iconKey: 'Activity',
      badgeLabel: 'Attention',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900 dark:text-amber-200',
    });
  });

  blockedTasks.forEach((t) => {
    const site = t.siteId ? sites.find((s) => s.id === t.siteId) : null;
    items.push({
      id: `task-blocked-${t.id}`,
      category: 'tasks',
      severity: 'critical',
      title: t.title,
      subtitle: 'Tâche bloquée',
      siteName: site?.name,
      siteId: site?.id,
      link: '/dashboard/tasks',
      iconKey: 'Ban',
      badgeLabel: 'Bloquée',
      badgeColor: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200',
    });
  });

  urgentTasks.forEach((t) => {
    // Dedup: a BLOCKED task already emitted above
    if (t.status === 'BLOCKED') return;
    const site = t.siteId ? sites.find((s) => s.id === t.siteId) : null;
    items.push({
      id: `task-urgent-${t.id}`,
      category: 'tasks',
      severity: 'warning',
      title: t.title,
      subtitle: 'Tâche urgente',
      siteName: site?.name,
      siteId: site?.id,
      link: '/dashboard/tasks',
      iconKey: 'AlertTriangle',
      badgeLabel: 'Urgente',
      badgeColor: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-200',
    });
  });

  overdueTasks.forEach((t) => {
    if (t.status === 'BLOCKED') return;
    // Dedup: don't emit a second row for the same task if already urgent
    if (t.priority === 'URGENT') return;
    const site = t.siteId ? sites.find((s) => s.id === t.siteId) : null;
    const daysLate = Math.ceil(
      (now.getTime() - new Date(t.dueDate!).getTime()) / (1000 * 60 * 60 * 24),
    );
    items.push({
      id: `task-overdue-${t.id}`,
      category: 'tasks',
      severity: 'warning',
      title: t.title,
      subtitle: `En retard de ${daysLate} jour${daysLate > 1 ? 's' : ''}`,
      siteName: site?.name,
      siteId: site?.id,
      link: '/dashboard/tasks',
      iconKey: 'Clock',
      badgeLabel: `${daysLate}j retard`,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900 dark:text-amber-200',
    });
  });

  outOfService.forEach((a) => {
    const site = a.siteId ? sites.find((s) => s.id === a.siteId) : null;
    items.push({
      id: `asset-oos-${a.id}`,
      category: 'equipment',
      severity: 'warning',
      title: a.name || `${a.manufacturer || ''} ${a.model || ''}`.trim() || 'Équipement',
      subtitle: `SN: ${a.serialNumber || 'N/A'}`,
      siteName: site?.name,
      siteId: site?.id,
      link: `/dashboard/assets/${a.id}`,
      iconKey: 'Package',
      badgeLabel: 'Hors service',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-200',
    });
  });

  [...warrantyExpired, ...warrantyCritical, ...warrantyWarning].forEach((a) => {
    const site = a.siteId ? sites.find((s) => s.id === a.siteId) : null;
    const ws = getWarrantyStatus(a.warrantyEnd, warrantyThresholds);
    const daysLeft = getWarrantyDaysLeft(a.warrantyEnd);
    items.push({
      id: `warranty-${a.id}`,
      category: 'warranty',
      severity: ws === 'expired' ? 'critical' : 'warning',
      title: a.name || `${a.manufacturer || ''} ${a.model || ''}`.trim() || 'Équipement',
      subtitle:
        ws === 'expired'
          ? 'Garantie expirée'
          : `Expire dans ${daysLeft} jour${(daysLeft || 0) > 1 ? 's' : ''}`,
      siteName: site?.name,
      siteId: site?.id,
      link: `/dashboard/assets/${a.id}`,
      iconKey: 'ShieldAlert',
      badgeLabel:
        ws === 'expired' ? 'Expirée' : ws === 'expiring_critical' ? 'Critique' : 'Bientôt',
      badgeColor:
        ws === 'expired'
          ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200'
          : 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200',
    });
  });

  const severityRank = { critical: 0, warning: 1, info: 2 };
  items.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  const counts: Record<AlertCategory, number> = {
    all: items.length,
    monitoring: items.filter((i) => i.category === 'monitoring').length,
    health: items.filter((i) => i.category === 'health').length,
    tasks: items.filter((i) => i.category === 'tasks').length,
    equipment: items.filter((i) => i.category === 'equipment').length,
    warranty: items.filter((i) => i.category === 'warranty').length,
  };

  return { items, counts, total: items.length };
}
