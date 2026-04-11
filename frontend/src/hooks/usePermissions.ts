'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { useDelegation } from '@/contexts/DelegationContext';
import { siteAccessApi, type ResourcePermissionLevel, type ResourcePermissions, type MyPermissionsResponse } from '@/lib/api/site-access';
import type { UserRole } from '@/types';

/**
 * Permission definitions based on Casbin policy.csv
 * Maps role -> resource -> allowed actions
 */
const ROLE_PERMISSIONS: Record<string, Record<string, string[]>> = {
  ADMIN: {
    sites: ['create', 'read', 'update', 'delete'],
    assets: ['create', 'read', 'update', 'delete'],
    racks: ['create', 'read', 'update', 'delete'],
    tasks: ['create', 'read', 'update', 'delete'],
    'floor-plans': ['create', 'read', 'update', 'delete'],
    integrations: ['read', 'create', 'update'],
    monitoring: ['read', 'manage'],
    netbox: ['read', 'manage'],
    users: ['create', 'read', 'update', 'delete'],
    tenants: ['read', 'update'],
    contacts: ['create', 'read', 'update', 'delete'],
    'contact-types': ['create', 'read', 'update', 'delete'],
    delegations: ['create', 'read', 'update', 'delete'],
    'billing-entities': ['create', 'read', 'update', 'delete'],
    expenses: ['create', 'read', 'update', 'delete'],
  },
  MANAGER: {
    sites: ['read'],
    assets: ['read'],
    racks: ['read'],
    tasks: ['create', 'read', 'update'],
    'floor-plans': ['read', 'update'],
    integrations: ['read'],
    monitoring: ['read'],
    tenants: ['read'],
    users: ['read'],
    contacts: ['create', 'read', 'update'],
    'contact-types': ['read'],
    delegations: ['read'],
    'billing-entities': ['read'],
    expenses: ['create', 'read', 'update'],
  },
  TECHNICIEN: {
    sites: ['read'],
    tenants: ['read'],
    assets: ['create', 'read', 'update'],
    racks: ['create', 'read', 'update'],
    tasks: ['create', 'read', 'update'],
    'floor-plans': ['read', 'create', 'update'],
    integrations: ['read'],
    monitoring: ['read'],
    contacts: ['read'],
    'contact-types': ['read'],
    delegations: ['read'],
  },
  VIEWER: {
    sites: ['read'],
    tenants: ['read'],
    assets: ['read'],
    racks: ['read'],
    tasks: ['read'],
    'floor-plans': ['read'],
    integrations: ['read'],
    monitoring: ['read'],
    contacts: ['read'],
    'contact-types': ['read'],
    delegations: ['read'],
  },
};

/**
 * Map from kebab-case resource names to camelCase keys (for resourcePermissions JSON)
 */
const RESOURCE_KEY_MAP: Record<string, string> = {
  'floor-plans': 'floorPlans',
  assets: 'assets',
  racks: 'racks',
  tasks: 'tasks',
  sites: 'sites',
  contacts: 'contacts',
  monitoring: 'monitoring',
  netbox: 'netbox',
  'billing-entities': 'billingEntities',
  expenses: 'expenses',
};

function permLevelToActions(level: ResourcePermissionLevel): string[] {
  switch (level) {
    case 'WRITE':
      return ['create', 'read', 'update', 'delete'];
    case 'READ':
      return ['read'];
    case 'NONE':
      return [];
    default:
      return ['read'];
  }
}

function roleToPermLevel(role: string, resource: string): ResourcePermissionLevel {
  const rolePerms = ROLE_PERMISSIONS[role];
  if (!rolePerms || !rolePerms[resource]) return 'NONE';
  const actions = rolePerms[resource];
  if (actions.includes('create') || actions.includes('update') || actions.includes('delete') || actions.includes('manage')) {
    return 'WRITE';
  }
  if (actions.includes('read')) return 'READ';
  return 'NONE';
}

function maxPerm(a: ResourcePermissionLevel, b: ResourcePermissionLevel): ResourcePermissionLevel {
  const order: Record<string, number> = { NONE: 0, READ: 1, WRITE: 2 };
  return (order[a] || 0) >= (order[b] || 0) ? a : b;
}

/**
 * usePermissions hook — Delegation-first version.
 *
 * Uses UserDelegation + AccessGrant for permission resolution.
 * Role comes from localRole in the active delegation (R7).
 *
 * RULE: No delegation + no grant = NO ACCESS to anything (unless super admin).
 */
export function usePermissions() {
  const { user } = useAuthStore();
  const { localRole, isSuperAdmin, hasDelegation } = useDelegation();

  // Use localRole from active delegation (R7) — NO fallback to user.role
  // If no localRole and not super admin → no permissions (role stays null → empty perms)
  const role = localRole || (isSuperAdmin ? 'ADMIN' : null) as string | null;

  // Fetch permissions
  const { data: myPerms, isLoading: isLoadingPerms } = useQuery<MyPermissionsResponse>({
    queryKey: ['my-permissions'],
    queryFn: () => siteAccessApi.myPermissions(),
    enabled: !!user,
    staleTime: 60_000,
    retry: 1,
  });

  /**
   * Whether the user has at least one delegation or grant.
   * Super admin always has access.
   */
  const hasDelegationAccess = (() => {
    if (!myPerms) return undefined; // Still loading
    return myPerms.isSuperAdmin || myPerms.hasDelegation;
  })();

  /**
   * Check if user can do action on resource.
   *
   * CRITICAL: If user has no delegation AND no grant AND is not super admin, ALWAYS returns false.
   */
  const can = (resource: string, action: string, siteId?: string): boolean => {
    if (!myPerms) return false;

    // Super admin can do everything
    if (myPerms.isSuperAdmin) return true;

    // No delegation + no grant = NO ACCESS
    if (!myPerms.hasDelegation) return false;

    // Org-level resources (not site-scoped) — use role-based check
    const orgResources = ['users', 'tenants', 'delegations', 'contact-types', 'integrations', 'billing-entities', 'expenses'];
    if (orgResources.includes(resource)) {
      const rolePerms = ROLE_PERMISSIONS[role];
      if (!rolePerms) return false;
      return rolePerms[resource]?.includes(action) ?? false;
    }

    // If user has allSitesAccess and no siteId specified, use role-based
    if (!siteId && myPerms.allSitesAccess) {
      const rolePerms = ROLE_PERMISSIONS[role];
      if (!rolePerms) return false;
      return rolePerms[resource]?.includes(action) ?? false;
    }

    // If no siteId, check if user has any delegation
    if (!siteId) {
      if (myPerms.delegations.length > 0) {
        const rolePerms = ROLE_PERMISSIONS[role];
        if (!rolePerms) return false;
        return rolePerms[resource]?.includes(action) ?? false;
      }

      // No delegations — check if any grant covers this resource
      const resourceKey = RESOURCE_KEY_MAP[resource] || resource;
      for (const grant of myPerms.accessGrants) {
        const grantPerms = grant.resourcePermissions as ResourcePermissions;
        if (grantPerms && resourceKey in grantPerms) {
          const level = (grantPerms as any)[resourceKey] as ResourcePermissionLevel;
          if (level && permLevelToActions(level).includes(action)) {
            return true;
          }
        }
      }

      return false;
    }

    // With siteId: compute effective permission level
    const resourceKey = RESOURCE_KEY_MAP[resource] || resource;
    let effectiveLevel: ResourcePermissionLevel = 'NONE';

    // SOURCE 1: UserDelegations — if site is in accessibleSiteIds, role applies
    if (myPerms.allSitesAccess || (myPerms.accessibleSiteIds && myPerms.accessibleSiteIds.includes(siteId))) {
      if (myPerms.delegations.length > 0) {
        const rolePerm = roleToPermLevel(role, resource);
        effectiveLevel = maxPerm(effectiveLevel, rolePerm);
      }
    }

    // SOURCE 2: AccessGrants — additive, only listed resourcePermissions
    for (const grant of myPerms.accessGrants) {
      const grantPerms = grant.resourcePermissions as ResourcePermissions;
      if (grantPerms && resourceKey in grantPerms) {
        const grantLevel = (grantPerms as any)[resourceKey] as ResourcePermissionLevel;
        if (grantLevel) {
          effectiveLevel = maxPerm(effectiveLevel, grantLevel);
        }
      }
    }

    return permLevelToActions(effectiveLevel).includes(action);
  };

  const canForSite = (resource: string, action: string, siteId: string): boolean => {
    return can(resource, action, siteId);
  };

  const hasAnySiteAccess = (): boolean => {
    if (!myPerms) return false;
    if (myPerms.isSuperAdmin) return true;
    if (!myPerms.hasDelegation) return false;
    return myPerms.allSitesAccess || (myPerms.accessibleSiteIds !== null && myPerms.accessibleSiteIds.length > 0);
  };

  return {
    can,
    canForSite,
    canCreate: (resource: string, siteId?: string) => can(resource, 'create', siteId),
    canRead: (resource: string, siteId?: string) => can(resource, 'read', siteId),
    canUpdate: (resource: string, siteId?: string) => can(resource, 'update', siteId),
    canDelete: (resource: string, siteId?: string) => can(resource, 'delete', siteId),
    isAdmin: role === 'ADMIN' || isSuperAdmin,
    isManagerOrAbove: role === 'ADMIN' || role === 'MANAGER' || isSuperAdmin,
    isTechnicien: role === 'TECHNICIEN',
    isViewer: role === 'VIEWER',
    isSuperAdmin,
    role: (role || 'VIEWER') as UserRole,
    /** User delegations (for display) */
    delegations: myPerms?.delegations || [],
    /** User access grants (for display) */
    accessGrants: myPerms?.accessGrants || [],
    /** All sites access flag */
    allSitesAccess: myPerms?.allSitesAccess ?? false,
    hasAnySiteAccess,
    /** Whether user has at least one delegation or grant (undefined = loading) */
    hasDelegation: hasDelegationAccess,
    /** Whether permissions are still loading */
    isLoadingPerms,
  };
}
