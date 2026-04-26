'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Activity, Globe, Network, Wifi, Search, Loader2, ListFilter, ChevronRight } from 'lucide-react';
import { sitesApi } from '@/lib/api/sites';
import { organizationApi } from '@/lib/api/organization';
import { monitorsApi, MonitorCheck, MonitorKind, MonitorStatus } from '@/lib/api/monitors';

const KIND_ICONS: Record<MonitorKind, typeof Wifi> = {
  ICMP: Wifi,
  HTTP: Globe,
  TCP: Network,
};

const KIND_LABELS: Record<MonitorKind, string> = {
  ICMP: 'Ping',
  HTTP: 'Site web',
  TCP: 'Port',
};

interface Props {
  /** When set, restrict to monitors attached (directly or via asset/link) to this site. */
  siteId?: string;
  /** Initial group-by mode. User toggle persisted to localStorage. */
  defaultGroupBy?: 'site' | 'none';
}

type GroupBy = 'site' | 'none';
const STORAGE_KEY = 'xch-monitors-list-view';

/**
 * Tenant-wide list of native monitor checks (ADR-016 §F — UX produit).
 *
 * Hiérarchie : nom métier (asset.name / "Lien primaire Orange" / site name)
 * en titre, cible technique (IP/URL) en sous-titre. Pastille colorée à
 * gauche pour le statut, badge texte explicite à droite. Vocabulaire :
 * "Disponible / Indisponible" plutôt que "UP / DOWN".
 *
 * Filtres : recherche texte, site (dropdown alimenté par /api/sites), type
 * de sonde (Ping / Site web / Port), statut. Toggle de vue (à plat /
 * groupé par site) avec persistance localStorage.
 */
export function NativeMonitorsList({ siteId, defaultGroupBy = 'site' }: Props) {
  const [groupBy, setGroupBy] = useState<GroupBy>(defaultGroupBy);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | MonitorStatus>('all');
  const [kindFilter, setKindFilter] = useState<'all' | MonitorKind>('all');
  const [siteFilter, setSiteFilter] = useState<string>(siteId ?? 'all');
  const [delegationFilter, setDelegationFilter] = useState<string>('all');

  // Hydrate persisted preferences (skip when caller pinned a siteId).
  useEffect(() => {
    if (siteId) return;
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.groupBy === 'site' || parsed.groupBy === 'none') setGroupBy(parsed.groupBy);
      }
    } catch { /* noop */ }
  }, [siteId]);
  useEffect(() => {
    if (siteId) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ groupBy })); } catch { /* noop */ }
  }, [groupBy, siteId]);

  const { data, isLoading } = useQuery({
    queryKey: ['monitors', 'all', siteId ?? null],
    queryFn: () => monitorsApi.getAll(siteId ? { siteId } : undefined),
    refetchInterval: 30_000,
  });

  const { data: sites } = useQuery({
    queryKey: ['sites', 'for-filter'],
    queryFn: () => sitesApi.getAll({ pageSize: 200 } as any),
    enabled: !siteId, // only fetch when we need the dropdown
  });

  const { data: delegations } = useQuery({
    queryKey: ['delegations', 'for-filter'],
    queryFn: () => organizationApi.getDelegations(false),
    enabled: !siteId,
  });

  const list: MonitorCheck[] = data ?? [];

  const sitesList = useMemo(() => {
    const arr = (sites as any)?.data ?? sites ?? [];
    return Array.isArray(arr) ? arr : [];
  }, [sites]);

  // Map siteId → delegationId for the Délégation filter (sites carry it).
  const siteToDelegation = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sitesList) {
      if (s.id && s.delegationId) m.set(s.id, s.delegationId);
    }
    return m;
  }, [sitesList]);

  const filtered = useMemo(() => {
    return list.filter((c) => {
      if (statusFilter !== 'all' && c.lastStatus !== statusFilter) return false;
      if (kindFilter !== 'all' && c.kind !== kindFilter) return false;
      if (!siteId && siteFilter !== 'all') {
        const cSite = effectiveSiteId(c);
        if (cSite !== siteFilter) return false;
      }
      if (!siteId && delegationFilter !== 'all') {
        const cSite = effectiveSiteId(c);
        const cDeleg = cSite ? siteToDelegation.get(cSite) : undefined;
        if (cDeleg !== delegationFilter) return false;
      }
      if (search) {
        const needle = search.toLowerCase();
        const haystack = [
          displayName(c),
          c.target,
          c.site?.name,
          c.asset?.name,
          c.asset?.site?.name,
          c.link?.provider,
          c.link?.site?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [list, search, statusFilter, kindFilter, siteFilter, delegationFilter, siteToDelegation, siteId]);

  const counts = useMemo(() => {
    const c = { total: filtered.length, up: 0, down: 0, unknown: 0, disabled: 0 };
    for (const m of filtered) {
      if (!m.enabled) c.disabled++;
      else if (m.lastStatus === 'UP') c.up++;
      else if (m.lastStatus === 'DOWN') c.down++;
      else c.unknown++;
    }
    return c;
  }, [filtered]);

  const delegationsList = (delegations ?? []).filter((d) => d.isActive);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              Surveillance
            </CardTitle>
            <CardDescription>{summarize(counts)}</CardDescription>
          </div>
          {!siteId && (
            <div className="flex items-center gap-1 border rounded-md p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setGroupBy('site')}
                className={`px-2 py-1 rounded transition-colors ${groupBy === 'site' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Par site
              </button>
              <button
                type="button"
                onClick={() => setGroupBy('none')}
                className={`px-2 py-1 rounded transition-colors ${groupBy === 'none' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                À plat
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un équipement, un lien, un site…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          {!siteId && (
            <>
              <Select value={delegationFilter} onValueChange={setDelegationFilter}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes délégations</SelectItem>
                  {delegationsList.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={siteFilter} onValueChange={setSiteFilter}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les sites</SelectItem>
                  {sitesList
                    .filter((s: any) => delegationFilter === 'all' || s.delegationId === delegationFilter)
                    .map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </>
          )}
          <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as any)}>
            <SelectTrigger className="w-[140px] h-9">
              <ListFilter className="h-3.5 w-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes sondes</SelectItem>
              <SelectItem value="ICMP">Ping</SelectItem>
              <SelectItem value="HTTP">Site web</SelectItem>
              <SelectItem value="TCP">Port</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="UP">Disponible</SelectItem>
              <SelectItem value="DOWN">Indisponible</SelectItem>
              <SelectItem value="UNKNOWN">En attente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {list.length === 0
              ? 'Aucune surveillance configurée. Ajoutez-en depuis la fiche d\'un équipement ou d\'un lien de connectivité.'
              : 'Aucun résultat ne correspond aux filtres.'}
          </p>
        ) : siteId || groupBy === 'none' ? (
          <FlatList items={filtered} />
        ) : (
          <GroupedBySite items={filtered} />
        )}
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ────────────────────────────────────────────────────────────────────────────

function FlatList({ items }: { items: MonitorCheck[] }) {
  return (
    <div className="space-y-1.5">
      {items.map((c) => (
        <MonitorRow key={c.id} check={c} />
      ))}
    </div>
  );
}

function GroupedBySite({ items }: { items: MonitorCheck[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, { siteName: string; checks: MonitorCheck[] }>();
    for (const c of items) {
      const sid = effectiveSiteId(c) ?? '__orphan';
      const sname = effectiveSiteName(c) ?? 'Sans site';
      if (!map.has(sid)) map.set(sid, { siteName: sname, checks: [] });
      map.get(sid)!.checks.push(c);
    }
    return Array.from(map.entries())
      .map(([sid, g]) => ({ sid, ...g }))
      .sort((a, b) => a.siteName.localeCompare(b.siteName, 'fr'));
  }, [items]);

  return (
    <div className="space-y-4">
      {groups.map(({ sid, siteName, checks }) => {
        const up = checks.filter((c) => c.enabled && c.lastStatus === 'UP').length;
        const down = checks.filter((c) => c.enabled && c.lastStatus === 'DOWN').length;
        return (
          <div key={sid}>
            <div className="flex items-center justify-between text-xs mb-2">
              <div className="font-medium text-foreground">
                {siteName}
                <span className="ml-2 text-muted-foreground font-normal">
                  · {checks.length} surveillance{checks.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="text-muted-foreground">
                {down > 0 && <span className="text-red-600 dark:text-red-400 font-medium mr-2">{down} indisponible{down > 1 ? 's' : ''}</span>}
                {up > 0 && <span>{up} disponible{up > 1 ? 's' : ''}</span>}
              </div>
            </div>
            <div className="space-y-1.5">
              {checks.map((c) => (
                <MonitorRow key={c.id} check={c} hideSite />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonitorRow({ check, hideSite = false }: { check: MonitorCheck; hideSite?: boolean }) {
  const Icon = KIND_ICONS[check.kind];
  const statusColor = !check.enabled
    ? 'bg-muted-foreground/30'
    : check.lastStatus === 'UP'
    ? 'bg-green-500'
    : check.lastStatus === 'DOWN'
    ? 'bg-red-500'
    : 'bg-amber-400';
  const statusLabel = !check.enabled
    ? 'Désactivée'
    : check.lastStatus === 'UP'
    ? 'Disponible'
    : check.lastStatus === 'DOWN'
    ? 'Indisponible'
    : 'En attente';
  const statusClass = !check.enabled
    ? 'text-muted-foreground'
    : check.lastStatus === 'UP'
    ? 'text-green-700 dark:text-green-400'
    : check.lastStatus === 'DOWN'
    ? 'text-red-700 dark:text-red-400'
    : 'text-amber-700 dark:text-amber-500';

  const targetTechnical = check.kind === 'TCP' ? `${check.target}:${check.targetPort}` : check.target;
  const probeLabel = KIND_LABELS[check.kind];
  const intervalLabel = `vérifié toutes les ${formatInterval(check.intervalSec)}`;
  const lastCheckLabel = check.lastCheckedAt ? `il y a ${timeAgo(check.lastCheckedAt)}` : null;
  const siteName = !hideSite ? effectiveSiteName(check) : null;

  return (
    <Link
      href={`/dashboard/monitoring/${check.id}`}
      className="flex items-stretch gap-3 rounded-md border bg-card hover:border-primary/50 hover:bg-accent/30 transition-colors group"
    >
      <span className={`w-1 rounded-l-md ${statusColor}`} aria-hidden />
      <div className="flex-1 flex items-center gap-3 py-2 pr-3 min-w-0">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-medium text-sm text-foreground truncate">{displayName(check)}</span>
            {siteName && (
              <span className="text-xs text-muted-foreground truncate">· {siteName}</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <span>{probeLabel}</span>
            <span>·</span>
            <span className="font-mono truncate">{targetTechnical}</span>
            <span>·</span>
            <span className="hidden sm:inline">{intervalLabel}</span>
            {lastCheckLabel && (
              <>
                <span className="hidden md:inline">·</span>
                <span className="hidden md:inline">{lastCheckLabel}</span>
              </>
            )}
          </div>
        </div>
        <span className={`text-xs font-medium whitespace-nowrap ${statusClass}`}>{statusLabel}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
      </div>
    </Link>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function displayName(c: MonitorCheck): string {
  if (c.asset?.name) return c.asset.name;
  if (c.asset?.type) return c.asset.type;
  if (c.link) {
    const role = c.link.role === 'PRIMARY' ? 'principal' : c.link.role === 'BACKUP' ? 'secours' : c.link.role.toLowerCase();
    return `Lien ${role} ${c.link.provider}`;
  }
  if (c.site?.name) return `Site ${c.site.name}`;
  return c.target;
}

function effectiveSiteId(c: MonitorCheck): string | undefined {
  return c.siteId ?? c.asset?.siteId ?? c.link?.siteId ?? undefined;
}

function effectiveSiteName(c: MonitorCheck): string | undefined {
  return c.site?.name ?? c.asset?.site?.name ?? c.link?.site?.name ?? undefined;
}

function summarize(c: { total: number; up: number; down: number; unknown: number; disabled: number }): string {
  if (c.total === 0) return 'Aucune surveillance configurée pour le moment.';
  const parts: string[] = [];
  if (c.up > 0) parts.push(`${c.up} disponible${c.up > 1 ? 's' : ''}`);
  if (c.down > 0) parts.push(`${c.down} indisponible${c.down > 1 ? 's' : ''}`);
  if (c.unknown > 0) parts.push(`${c.unknown} en attente`);
  if (c.disabled > 0) parts.push(`${c.disabled} désactivée${c.disabled > 1 ? 's' : ''}`);
  return `${c.total} surveillance${c.total > 1 ? 's' : ''} · ${parts.join(' · ')}`;
}

function formatInterval(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)} min`;
  return `${Math.round(sec / 3600)} h`;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min`;
  return `${Math.round(ms / 3_600_000)} h`;
}
