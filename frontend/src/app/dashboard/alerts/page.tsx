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
import { useWarrantyThresholds } from '@/lib/warranty';
import { computeAlerts, type AlertCategory, type AlertItem } from '@/lib/alerts';

// Map shared iconKey back to a concrete lucide icon
const ICON_MAP: Record<string, any> = {
  WifiOff, Activity, Ban, AlertTriangle, Clock, Package, ShieldAlert,
};

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

  // v1.4 — Alert computation delegated to the shared computeAlerts() so the count
  // matches the Dashboard widget and the /tv dashboard exactly. Everything below
  // this useMemo block is presentation-only (filters, grouping by site, rendering).
  const alertData = useMemo(() => {
    return computeAlerts({ sites, assets, tasks, monitors, warrantyThresholds });
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
                  {group.items.map((item: AlertItem) => {
                    const Icon = ICON_MAP[item.iconKey] || AlertTriangle;
                    return (
                    <Link
                      key={item.id}
                      href={item.link}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className={`h-4 w-4 flex-shrink-0 ${
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
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
