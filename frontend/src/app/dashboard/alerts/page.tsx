'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { sitesApi } from '@/lib/api/sites';
import { assetsApi } from '@/lib/api/assets';
import { tasksApi } from '@/lib/api/tasks';
import { useLiveMonitors } from '@/hooks/useLiveMonitors';
import {
  ArrowLeft, ArrowRight, WifiOff, Activity, Ban, AlertTriangle, Clock,
  Package, ShieldAlert, CheckCircle2, MapPin, Filter,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import type { Task, Asset, Site } from '@/types';
import { getWarrantyStatus, getWarrantyDaysLeft, useWarrantyThresholds } from '@/lib/warranty';

type AlertCategory = 'all' | 'monitoring' | 'health' | 'tasks' | 'equipment' | 'warranty';

const categories: { key: AlertCategory; label: string; icon: any }[] = [
  { key: 'all', label: 'Toutes', icon: Filter },
  { key: 'monitoring', label: 'Monitoring', icon: WifiOff },
  { key: 'health', label: 'Santé sites', icon: Activity },
  { key: 'tasks', label: 'Tâches', icon: AlertTriangle },
  { key: 'equipment', label: 'Équipements', icon: Package },
  { key: 'warranty', label: 'Garanties', icon: ShieldAlert },
];

export default function AlertsPage() {
  const [filter, setFilter] = useState<AlertCategory>('all');

  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: sitesApi.getAll });
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: () => assetsApi.getAll() });
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: () => tasksApi.getAll() });
  const { monitors } = useLiveMonitors();

  const warrantyThresholds = useWarrantyThresholds();

  // Compute all alerts
  const alertData = useMemo(() => {
    const now = new Date();

    // Monitoring
    const downMonitors = monitors.filter(m => m.status === 'down');

    // Health
    const criticalSites = sites.filter((s: Site) => s.healthStatus === 'CRITICAL');
    const warningSites = sites.filter((s: Site) => s.healthStatus === 'WARNING');

    // Tasks
    const blockedTasks = tasks.filter((t: Task) => t.status === 'BLOCKED');
    const urgentTasks = tasks.filter((t: Task) => t.priority === 'URGENT' && t.status !== 'DONE' && t.status !== 'CANCELLED');
    const overdueTasks = tasks.filter((t: Task) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE' && t.status !== 'CANCELLED');

    // Equipment
    const outOfService = assets.filter((a: Asset) => a.status === 'OUT_OF_SERVICE');

    // Warranty
    const warrantyExpired = assets.filter((a: Asset) => getWarrantyStatus(a.warrantyEnd, warrantyThresholds) === 'expired');
    const warrantyCritical = assets.filter((a: Asset) => getWarrantyStatus(a.warrantyEnd, warrantyThresholds) === 'expiring_critical');
    const warrantyWarning = assets.filter((a: Asset) => getWarrantyStatus(a.warrantyEnd, warrantyThresholds) === 'expiring_warning');

    // Match DOWN monitors to sites
    const monitorToSite = new Map<string, Site>();
    const monitorToAsset = new Map<string, Asset>();

    assets.forEach((a: Asset) => {
      const mn = (a.networkInfo as any)?.monitorName;
      if (mn) {
        monitorToAsset.set(mn, a);
        if (a.siteId) {
          const site = sites.find((s: Site) => s.id === a.siteId);
          if (site) monitorToSite.set(mn, site);
        }
      }
    });

    sites.forEach((s: Site) => {
      const connectivity = s.connectivity as any;
      const links = connectivity?.links || connectivity?.v2?.links || [];
      links.forEach((link: any) => { if (link.monitorName) monitorToSite.set(link.monitorName, s); });
      const sdwan = connectivity?.sdwan || connectivity?.v2?.sdwan;
      if (sdwan?.monitorName) monitorToSite.set(sdwan.monitorName, s);
    });

    // Build structured alert items
    type AlertItem = {
      id: string;
      category: AlertCategory;
      severity: 'critical' | 'warning' | 'info';
      title: string;
      subtitle?: string;
      siteName?: string;
      siteId?: string;
      link: string;
      icon: any;
      badgeLabel: string;
      badgeColor: string;
    };

    const items: AlertItem[] = [];

    // DOWN monitors
    downMonitors.forEach(m => {
      const site = monitorToSite.get(m.name);
      const asset = monitorToAsset.get(m.name);
      items.push({
        id: `monitor-${m.id}`,
        category: 'monitoring',
        severity: 'critical',
        title: m.name,
        subtitle: asset ? `Équipement: ${asset.name || asset.manufacturer || ''}` : 'Lien / Connectivité',
        siteName: site?.name,
        siteId: site?.id,
        link: '/dashboard/monitoring',
        icon: WifiOff,
        badgeLabel: 'DOWN',
        badgeColor: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200',
      });
    });

    // CRITICAL health sites
    criticalSites.forEach((s: Site) => {
      items.push({
        id: `health-crit-${s.id}`,
        category: 'health',
        severity: 'critical',
        title: s.name,
        subtitle: `${s.code} — ${s.city || 'N/A'}`,
        siteName: s.name,
        siteId: s.id,
        link: `/dashboard/sites/${s.id}`,
        icon: Activity,
        badgeLabel: 'Critique',
        badgeColor: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200',
      });
    });

    // WARNING health sites
    warningSites.forEach((s: Site) => {
      items.push({
        id: `health-warn-${s.id}`,
        category: 'health',
        severity: 'warning',
        title: s.name,
        subtitle: `${s.code} — ${s.city || 'N/A'}`,
        siteName: s.name,
        siteId: s.id,
        link: `/dashboard/sites/${s.id}`,
        icon: Activity,
        badgeLabel: 'Attention',
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900 dark:text-amber-200',
      });
    });

    // Blocked tasks
    blockedTasks.forEach((t: Task) => {
      const site = t.siteId ? sites.find((s: Site) => s.id === t.siteId) : null;
      items.push({
        id: `task-blocked-${t.id}`,
        category: 'tasks',
        severity: 'critical',
        title: t.title,
        subtitle: 'Tâche bloquée',
        siteName: site?.name,
        siteId: site?.id,
        link: `/dashboard/tasks`,
        icon: Ban,
        badgeLabel: 'Bloquée',
        badgeColor: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200',
      });
    });

    // Urgent tasks
    urgentTasks.forEach((t: Task) => {
      // Don't duplicate blocked+urgent
      if (t.status === 'BLOCKED') return;
      const site = t.siteId ? sites.find((s: Site) => s.id === t.siteId) : null;
      items.push({
        id: `task-urgent-${t.id}`,
        category: 'tasks',
        severity: 'warning',
        title: t.title,
        subtitle: 'Tâche urgente',
        siteName: site?.name,
        siteId: site?.id,
        link: `/dashboard/tasks`,
        icon: AlertTriangle,
        badgeLabel: 'Urgente',
        badgeColor: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-200',
      });
    });

    // Overdue tasks
    overdueTasks.forEach((t: Task) => {
      if (t.status === 'BLOCKED') return;
      const site = t.siteId ? sites.find((s: Site) => s.id === t.siteId) : null;
      const daysLate = Math.ceil((now.getTime() - new Date(t.dueDate!).getTime()) / (1000 * 60 * 60 * 24));
      items.push({
        id: `task-overdue-${t.id}`,
        category: 'tasks',
        severity: 'warning',
        title: t.title,
        subtitle: `En retard de ${daysLate} jour${daysLate > 1 ? 's' : ''}`,
        siteName: site?.name,
        siteId: site?.id,
        link: `/dashboard/tasks`,
        icon: Clock,
        badgeLabel: `${daysLate}j retard`,
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900 dark:text-amber-200',
      });
    });

    // Out of service equipment
    outOfService.forEach((a: Asset) => {
      const site = a.siteId ? sites.find((s: Site) => s.id === a.siteId) : null;
      items.push({
        id: `asset-oos-${a.id}`,
        category: 'equipment',
        severity: 'warning',
        title: a.name || `${a.manufacturer || ''} ${a.model || ''}`.trim() || 'Équipement',
        subtitle: `SN: ${a.serialNumber || 'N/A'}`,
        siteName: site?.name,
        siteId: site?.id,
        link: `/dashboard/assets/${a.id}`,
        icon: Package,
        badgeLabel: 'Hors service',
        badgeColor: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-200',
      });
    });

    // Warranty alerts
    [...warrantyExpired, ...warrantyCritical, ...warrantyWarning].forEach((a: Asset) => {
      const site = a.siteId ? sites.find((s: Site) => s.id === a.siteId) : null;
      const ws = getWarrantyStatus(a.warrantyEnd, warrantyThresholds);
      const daysLeft = getWarrantyDaysLeft(a.warrantyEnd);
      items.push({
        id: `warranty-${a.id}`,
        category: 'warranty',
        severity: ws === 'expired' ? 'critical' : 'warning',
        title: a.name || `${a.manufacturer || ''} ${a.model || ''}`.trim() || 'Équipement',
        subtitle: ws === 'expired'
          ? 'Garantie expirée'
          : `Expire dans ${daysLeft} jour${(daysLeft || 0) > 1 ? 's' : ''}`,
        siteName: site?.name,
        siteId: site?.id,
        link: `/dashboard/assets/${a.id}`,
        icon: ShieldAlert,
        badgeLabel: ws === 'expired' ? 'Expirée' : ws === 'expiring_critical' ? 'Critique' : 'Bientôt',
        badgeColor: ws === 'expired'
          ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200'
          : 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200',
      });
    });

    // Sort: critical first, then warning
    items.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    // Category counts
    const counts: Record<AlertCategory, number> = {
      all: items.length,
      monitoring: items.filter(i => i.category === 'monitoring').length,
      health: items.filter(i => i.category === 'health').length,
      tasks: items.filter(i => i.category === 'tasks').length,
      equipment: items.filter(i => i.category === 'equipment').length,
      warranty: items.filter(i => i.category === 'warranty').length,
    };

    return { items, counts };
  }, [sites, assets, tasks, monitors, warrantyThresholds]);

  // Filtered items
  const filtered = filter === 'all' ? alertData.items : alertData.items.filter(i => i.category === filter);

  // Group filtered items by site
  const groupedBySite = useMemo(() => {
    const groups = new Map<string, { site: Site | null; items: typeof filtered }>();

    filtered.forEach(item => {
      const key = item.siteId || '__no-site__';
      if (!groups.has(key)) {
        const site = item.siteId ? sites.find((s: Site) => s.id === item.siteId) || null : null;
        groups.set(key, { site, items: [] });
      }
      groups.get(key)!.items.push(item);
    });

    return Array.from(groups.entries())
      .map(([key, val]) => ({ key, ...val }))
      .sort((a, b) => {
        // Sites with critical alerts first
        const aCrit = a.items.filter(i => i.severity === 'critical').length;
        const bCrit = b.items.filter(i => i.severity === 'critical').length;
        if (aCrit !== bCrit) return bCrit - aCrit;
        return b.items.length - a.items.length;
      });
  }, [filtered, sites]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link href="/dashboard"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="text-2xl font-bold">Alertes</h1>
          {alertData.counts.all > 0 && (
            <Badge variant="destructive">{alertData.counts.all}</Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm ml-10">Détail de toutes les alertes actives</p>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => {
          const count = alertData.counts[cat.key];
          const isActive = filter === cat.key;
          if (cat.key !== 'all' && count === 0) return null;
          return (
            <Button
              key={cat.key}
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              className="h-8"
              onClick={() => setFilter(cat.key)}
            >
              <cat.icon className="h-3.5 w-3.5 mr-1.5" />
              {cat.label}
              {count > 0 && <Badge variant={isActive ? 'secondary' : 'destructive'} className="ml-1.5 text-[10px] h-4 px-1">{count}</Badge>}
            </Button>
          );
        })}
      </div>

      {/* Content */}
      {alertData.counts.all === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-500" />
            <p className="text-lg font-semibold text-green-700 dark:text-green-400">Aucune alerte</p>
            <p className="text-sm text-muted-foreground mt-1">Tous les systèmes sont opérationnels</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>Aucune alerte dans cette catégorie</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupedBySite.map(group => (
            <Card key={group.key} className={group.items.some(i => i.severity === 'critical') ? 'border-red-200 dark:border-red-800' : ''}>
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-semibold">
                    {group.site ? (
                      <Link href={`/dashboard/sites/${group.site.id}`} className="hover:underline hover:text-primary">
                        {group.site.name}
                        <span className="text-xs font-normal text-muted-foreground ml-2">{group.site.code}</span>
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Sans site</span>
                    )}
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px] h-5">{group.items.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <div className="divide-y">
                  {group.items.map(item => (
                    <Link
                      key={item.id}
                      href={item.link}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <item.icon className={`h-4 w-4 flex-shrink-0 ${
                          item.severity === 'critical' ? 'text-red-500' : 'text-amber-500'
                        }`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          {item.subtitle && (
                            <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <Badge className={`text-[10px] h-5 px-1.5 ${item.badgeColor}`}>
                          {item.badgeLabel}
                        </Badge>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
