'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { organizationApi } from '@/lib/api/organization';

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

/**
 * Reusable site selector grouped by Division > Délégation.
 * Uses the organization tree API to display sites hierarchically.
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
  const { data: orgTree } = useQuery({
    queryKey: ['organization-tree'],
    queryFn: () => organizationApi.getTree(),
    staleTime: 60_000,
  });

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNone && (
          <SelectItem value={noneValue}>{noneLabel}</SelectItem>
        )}
        {orgTree?.map((division) => {
          const allSites = division.delegations.flatMap((d) => d.sites || []);
          if (allSites.length === 0 && !showCount) return null;
          return (
            <div key={division.id}>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-2">
                {division.color && (
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: division.color }}
                  />
                )}
                {division.name}
                {showCount && (
                  <span className="text-muted-foreground/60">({allSites.length})</span>
                )}
              </div>
              {division.delegations.map((del) =>
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
 * Filter variant: "Tous les sites" option + grouped sites by Division > Délégation.
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
