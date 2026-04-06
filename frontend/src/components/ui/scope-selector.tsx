// @ts-nocheck
'use client';

import { useQuery } from '@tanstack/react-query';
import { organizationApi, OrganizationTree } from '@/lib/api/organization';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export interface ScopeValue {
  scopeType: string | null;
  scopeId: string | null;
}

interface ScopeSelectorProps {
  value: ScopeValue;
  onChange: (value: ScopeValue) => void;
  label?: string;
  allowedTypes?: ('DIVISION' | 'DELEGATION' | 'SITE')[];
  disabled?: boolean;
  className?: string;
}

export function ScopeSelector({
  value,
  onChange,
  label = 'Rattachement organisationnel',
  allowedTypes = ['DIVISION', 'DELEGATION', 'SITE'],
  disabled = false,
  className = '',
}: ScopeSelectorProps) {
  const { data: tree = [] } = useQuery({
    queryKey: ['organization-tree'],
    queryFn: () => organizationApi.getTree(),
    staleTime: 60_000,
  });

  const scopeTypeOptions = [
    { value: '', label: 'Aucun (tenant)' },
    ...(allowedTypes.includes('DIVISION') ? [{ value: 'DIVISION', label: 'Division' }] : []),
    ...(allowedTypes.includes('DELEGATION') ? [{ value: 'DELEGATION', label: 'Délégation' }] : []),
    ...(allowedTypes.includes('SITE') ? [{ value: 'SITE', label: 'Site' }] : []),
  ];

  // Build entity options based on selected scope type
  const entityOptions = buildEntityOptions(tree, value.scopeType);

  return (
    <div className={`space-y-3 ${className}`}>
      {label && <Label className="text-sm font-medium">{label}</Label>}

      <div className="flex gap-3">
        {/* Scope Type */}
        <Select
          value={value.scopeType || ''}
          onValueChange={(v) => {
            onChange({ scopeType: v || null, scopeId: null });
          }}
          disabled={disabled}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Type de scope" />
          </SelectTrigger>
          <SelectContent>
            {scopeTypeOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value || '_none'}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Entity selector — only shown when scopeType is set */}
        {value.scopeType && (
          <Select
            value={value.scopeId || ''}
            onValueChange={(v) => {
              onChange({ scopeType: value.scopeType, scopeId: v || null });
            }}
            disabled={disabled}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={`Sélectionner ${getScopeLabel(value.scopeType)}...`} />
            </SelectTrigger>
            <SelectContent>
              {entityOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <span className="flex items-center gap-2">
                    {opt.parentLabel && (
                      <span className="text-muted-foreground text-xs">{opt.parentLabel} /</span>
                    )}
                    {opt.label}
                  </span>
                </SelectItem>
              ))}
              {entityOptions.length === 0 && (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  Aucun(e) {getScopeLabel(value.scopeType)} disponible
                </div>
              )}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}

/**
 * Displays the currently selected scope as a badge.
 */
export function ScopeBadge({
  scopeType,
  scopeId,
  tree,
}: {
  scopeType: string | null | undefined;
  scopeId: string | null | undefined;
  tree?: OrganizationTree[];
}) {
  if (!scopeType || !scopeId) {
    return <Badge variant="outline">Global</Badge>;
  }

  const resolved = resolveScopeName(tree || [], scopeType, scopeId);

  const colorMap: Record<string, string> = {
    DIVISION: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    DELEGATION: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    SITE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  };

  return (
    <Badge className={colorMap[scopeType] || ''} variant="outline">
      {getScopeLabel(scopeType)}: {resolved || scopeId.slice(0, 8)}
    </Badge>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getScopeLabel(scopeType: string | null): string {
  switch (scopeType) {
    case 'DIVISION': return 'Division';
    case 'DELEGATION': return 'Délégation';
    case 'SITE': return 'Site';
    default: return '';
  }
}

interface EntityOption {
  value: string;
  label: string;
  parentLabel?: string;
}

function buildEntityOptions(
  tree: OrganizationTree[],
  scopeType: string | null,
): EntityOption[] {
  if (!scopeType || !tree.length) return [];

  switch (scopeType) {
    case 'DIVISION':
      return tree.map((div) => ({
        value: div.id,
        label: div.name,
      }));

    case 'DELEGATION':
      return tree.flatMap((div) =>
        (div.delegations || []).map((del) => ({
          value: del.id,
          label: del.name,
          parentLabel: div.name,
        })),
      );

    case 'SITE':
      return tree.flatMap((div) =>
        (div.delegations || []).flatMap((del) =>
          (del.sites || []).map((site) => ({
            value: site.id,
            label: `${site.code} — ${site.name}`,
            parentLabel: `${div.name} / ${del.name}`,
          })),
        ),
      );

    default:
      return [];
  }
}

function resolveScopeName(
  tree: OrganizationTree[],
  scopeType: string,
  scopeId: string,
): string | null {
  for (const div of tree) {
    if (scopeType === 'DIVISION' && div.id === scopeId) return div.name;
    for (const del of div.delegations || []) {
      if (scopeType === 'DELEGATION' && del.id === scopeId) return del.name;
      for (const site of del.sites || []) {
        if (scopeType === 'SITE' && site.id === scopeId) return site.name;
      }
    }
  }
  return null;
}
