// @ts-nocheck
'use client';

import { useQuery } from '@tanstack/react-query';
import { organizationApi, type Delegation } from '@/lib/api/organization';
import { sitesApi } from '@/lib/api/sites';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useDelegation } from '@/contexts/DelegationContext';

/**
 * ScopeValue — delegation-first model.
 * delegationId = organizational boundary (nullable for global entities)
 * siteId = optional site-level attachment
 */
export interface ScopeValue {
  delegationId: string | null;
  siteId: string | null;
}

interface ScopeSelectorProps {
  value: ScopeValue;
  onChange: (value: ScopeValue) => void;
  label?: string;
  showSiteSelector?: boolean;
  disabled?: boolean;
  className?: string;
  /**
   * Offer the "Global (toutes délégations)" option (super-admin only).
   * Default: true for backwards compat. Must be set to FALSE on pickers
   * whose target model requires a delegation (e.g. Expense.delegationId
   * is @IsNotEmpty — picking global used to save a null and 400-out).
   */
  allowGlobal?: boolean;
}

/**
 * Delegation + Site picker for entity attachment.
 * Pre-fills with active delegation from context.
 */
export function ScopeSelector({
  value,
  onChange,
  label = 'Rattachement organisationnel',
  showSiteSelector = true,
  disabled = false,
  className = '',
  allowGlobal = true,
}: ScopeSelectorProps) {
  const { delegations, isSuperAdmin } = useDelegation();

  // Load delegations for super admin (who may not have UserDelegation entries)
  const { data: allDelegations = [] } = useQuery({
    queryKey: ['delegations-all'],
    queryFn: () => organizationApi.getDelegations(),
    staleTime: 60_000,
    enabled: isSuperAdmin,
  });

  // Load sites for the selected delegation
  const { data: sitesData } = useQuery({
    queryKey: ['sites-for-delegation', value.delegationId],
    queryFn: () => sitesApi.getAllPaginated({ delegationId: value.delegationId!, pageSize: 200 }),
    staleTime: 60_000,
    enabled: !!value.delegationId,
  });

  const sites = sitesData?.data || [];

  // Delegation options: user's delegations + "Global" option for super admin
  const delegationOptions = isSuperAdmin
    ? allDelegations
    : delegations.map(d => d.delegation);

  return (
    <div className={`space-y-3 ${className}`}>
      {label && <Label className="text-sm font-medium">{label}</Label>}

      <div className="flex gap-3">
        {/* Delegation selector */}
        <Select
          value={value.delegationId || '_global'}
          onValueChange={(v) => {
            const delegationId = v === '_global' ? null : v;
            onChange({ delegationId, siteId: null });
          }}
          disabled={disabled}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Sélectionner une délégation..." />
          </SelectTrigger>
          <SelectContent>
            {isSuperAdmin && allowGlobal && (
              <SelectItem value="_global">Global (toutes délégations)</SelectItem>
            )}
            {delegationOptions.map((del) => (
              <SelectItem key={del.id} value={del.id}>
                <span className="flex items-center gap-2">
                  {del.groupColor && (
                    <span
                      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: del.groupColor }}
                    />
                  )}
                  {del.name}
                  {del.groupLabel && (
                    <span className="text-muted-foreground text-xs">({del.groupLabel})</span>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Site selector — optional, only if delegation is selected */}
        {showSiteSelector && value.delegationId && (
          <Select
            value={value.siteId || '_none'}
            onValueChange={(v) => {
              onChange({ delegationId: value.delegationId, siteId: v === '_none' ? null : v });
            }}
            disabled={disabled}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Site (optionnel)..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">Aucun site</SelectItem>
              {sites.map((site) => (
                <SelectItem key={site.id} value={site.id}>
                  {site.code} — {site.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}

/**
 * Displays the current scope as a badge.
 */
export function ScopeBadge({
  delegationId,
  siteId,
  delegationName,
  siteName,
}: {
  delegationId?: string | null;
  siteId?: string | null;
  delegationName?: string;
  siteName?: string;
}) {
  if (!delegationId) {
    return <Badge variant="outline">Global</Badge>;
  }

  const label = siteName
    ? `${delegationName || 'Délégation'} / ${siteName}`
    : delegationName || 'Délégation';

  return (
    <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300" variant="outline">
      {label}
    </Badge>
  );
}
