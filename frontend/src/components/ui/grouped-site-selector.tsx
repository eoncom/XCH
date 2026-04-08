'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { organizationApi, type Delegation } from '@/lib/api/organization';
import { Search } from 'lucide-react';

interface GroupedSiteSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  /** Show "Aucun" / "Tous les sites" as first option */
  allowNone?: boolean;
  noneLabel?: string;
  noneValue?: string;
  /** Show site count per delegation */
  showCount?: boolean;
  /** Disable the selector */
  disabled?: boolean;
  className?: string;
}

interface DelegationGroup {
  label: string;
  color?: string;
  delegations: Delegation[];
}

/**
 * Reusable site selector grouped by delegation groupLabel.
 * Uses the organization tree API (flat delegation list from backend).
 * Includes search for long lists.
 */
export function GroupedSiteSelector({
  value,
  onValueChange,
  placeholder = 'Sélectionner un site...',
  allowNone = false,
  noneLabel = 'Aucun',
  noneValue = 'none',
  showCount = false,
  disabled = false,
  className,
}: GroupedSiteSelectorProps) {
  const [search, setSearch] = useState('');

  const { data: delegations } = useQuery({
    queryKey: ['organization-tree'],
    queryFn: () => organizationApi.getTree(),
    staleTime: 60_000,
  });

  // Group delegations by groupLabel
  const groups = useMemo((): DelegationGroup[] => {
    if (!delegations) return [];
    const groupMap = new Map<string, DelegationGroup>();

    for (const del of delegations) {
      const label = del.groupLabel || 'Autres';
      if (!groupMap.has(label)) {
        groupMap.set(label, { label, color: del.groupColor || undefined, delegations: [] });
      }
      groupMap.get(label)!.delegations.push(del);
    }

    return Array.from(groupMap.values());
  }, [delegations]);

  // Count total sites for search threshold
  const totalSites = useMemo(() => {
    if (!delegations) return 0;
    return delegations.reduce((sum, del) => sum + (del.sites?.length || 0), 0);
  }, [delegations]);

  // Filter by search
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups
      .map(group => ({
        ...group,
        delegations: group.delegations
          .map(del => ({
            ...del,
            sites: (del.sites || []).filter(site =>
              site.name.toLowerCase().includes(q) ||
              site.code.toLowerCase().includes(q) ||
              del.code.toLowerCase().includes(q) ||
              del.name.toLowerCase().includes(q) ||
              (site.city && site.city.toLowerCase().includes(q))
            ),
          }))
          .filter(del => (del.sites?.length || 0) > 0),
      }))
      .filter(group => group.delegations.length > 0);
  }, [groups, search]);

  const showSearch = totalSites > 5;

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {showSearch && (
          <div className="px-2 pb-2">
            <div className="relative">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Rechercher un site..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-7 text-sm"
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}
        {allowNone && (
          <SelectItem value={noneValue}>{noneLabel}</SelectItem>
        )}
        {filteredGroups.map((group) => {
          const allSites = group.delegations.flatMap(d => d.sites || []);
          if (allSites.length === 0 && !showCount) return null;
          return (
            <div key={group.label}>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-2">
                {group.color && (
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: group.color }}
                  />
                )}
                {group.label}
                {showCount && (
                  <span className="text-muted-foreground/60">({allSites.length})</span>
                )}
              </div>
              {group.delegations.map((del) =>
                (del.sites || []).map((site) => (
                  <SelectItem key={site.id} value={site.id} className="pl-6">
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">{del.code}</span>
                      <span>{site.name}</span>
                      <span className="text-muted-foreground text-xs">({site.code})</span>
                    </span>
                  </SelectItem>
                ))
              )}
            </div>
          );
        })}
        {filteredGroups.length === 0 && search && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            Aucun site trouvé
          </div>
        )}
      </SelectContent>
    </Select>
  );
}

interface SiteFilterSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

/**
 * Filter variant: "Tous les sites" option + grouped sites by delegation groupLabel.
 * Use in list pages (assets, racks, tasks, etc.)
 */
export function SiteFilterSelect({
  value,
  onValueChange,
  className,
}: SiteFilterSelectProps) {
  return (
    <GroupedSiteSelector
      value={value}
      onValueChange={onValueChange}
      allowNone
      noneLabel="Tous les sites"
      noneValue="all"
      placeholder="Tous les sites"
      showCount
      className={className}
    />
  );
}
