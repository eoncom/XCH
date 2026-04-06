'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
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
    divisions: ['create', 'read', 'update', 'delete'],
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
    divisions: ['read'],
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
    divisions: ['read'],
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
    divisions: ['read'],
    delegations: ['read'],
  },
};

/**
 * Map from kebab-case resource names (used in Casbin/frontend)
 * to camelCase keys (used in resourcePermissions JSON)
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

/**
 * Map ResourcePermissionLevel to allowed actions
 */
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

/**
 * Map role to default ResourcePermissionLevel for a resource.
 */
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
 * usePermissions hook — Phase B version.
 *
 * Uses UserScope + AccessGrant for permission resolution.
 * ALL roles fetch my-permissions (including ADMIN/MANAGER, since they are now scope-bound).
 *
 * RULE: No scope + no grant = NO ACCESS to anything.
 * The role NEVER bypasses scope requirements.
 */
export function usePermissions() {
  const { user } = useAuthStore();
  const role = (user?.role || 'VIEWER') as string;

  // Fetch permissions for ALL roles (Phase B: ADMIN/MANAGER are scope-bound too)
  const { data: myPerms, isLoading: isLoadingPerms } = useQuery<MyPermissionsResponse>({
    queryKey: ['my-permissions'],
    queryFn: () => siteAccessApi.myPermissions(),
    enabled: !!user,
    staleTime: 60_000,
    retry: 1,
  });

  /**
   * Whether the user has at least one scope or grant.
   * If false, the user has NO access to anything.
   */
  const hasScope = (() => {
    if (!myPerms) return undefined; // Still loading
    return myPerms.scopes.length > 0 || myPerms.accessGrants.length > 0;
  })();

  /**
   * Check if user can do action on resource.
   *
   * CRITICAL: If user has no scope AND no grant, ALWAYS returns false.
   *
   * Without siteId: checks if the user has ANY scope that grants this permission.
   * With siteId: checks if the specific site is covered by scopes or grants.
   *
   * Resolution:
   * 1. UserScopes: if site is covered -> full role permissions apply
   * 2. AccessGrants: if site is covered AND resource is listed -> grant's level applies
   * 3. MAX of both sources
   */
  const can = (resource: string, action: string, siteId?: string): boolean => {
    // If permissions haven't loaded yet, block everything (safe default)
    if (!myPerms) return false;

    // RULE: No scope + no grant = NO ACCESS (role never bypasses scope)
    if (hasScope === false) return false;

    // Resources that are not site-scoped (org-level) — use role-based check
    // (but only if user has at least one scope — enforced above)
    const orgResources = ['users', 'tenants', 'divisions', 'delegations', 'contact-types', 'integrations', 'billing-entities', 'expenses'];
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

    // If no siteId, check if user has ANY scope (meaning they have access somewhere)
    if (!siteId) {
      if (myPerms.scopes.length > 0) {
        // User has at least one scope — check role-based permission for the resource
        const rolePerms = ROLE_PERMISSIONS[role];
        if (!rolePerms) return false;
        return rolePerms[resource]?.includes(action) ?? false;
      }

      // No scopes — check if any grant covers this resource
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

    // SOURCE 1: UserScopes — if site is in accessibleSiteIds (or allSitesAccess), role applies
    if (myPerms.allSitesAccess || (myPerms.accessibleSiteIds && myPerms.accessibleSiteIds.includes(siteId))) {
      // Check if the site is covered by scopes (not just grants)
      // Since allSitesAccess includes both scopes and grants, we need to check scopes separately
      // For simplicity: if user has any scope, the role applies on covered sites
      if (myPerms.scopes.length > 0) {
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

  /**
   * Check per-site resource permission.
   */
  const canForSite = (resource: string, action: string, siteId: string): boolean => {
    return can(resource, action, siteId);
  };

  /**
   * Check if user has access to at least one site.
   */
  const hasAnySiteAccess = (): boolean => {
    if (!myPerms) return false; // Safe default while loading
    if (hasScope === false) return false; // No scope = no site access
    return myPerms.allSitesAccess || (myPerms.accessibleSiteIds !== null && myPerms.accessibleSiteIds.length > 0);
  };

  return {
    can,
    canForSite,
    canCreate: (resource: string, siteId?: string) => can(resource, 'create', siteId),
    canRead: (resource: string, siteId?: string) => can(resource, 'read', siteId),
    canUpdate: (resource: string, siteId?: string) => can(resource, 'update', siteId),
    canDelete: (resource: string, siteId?: string) => can(resource, 'delete', siteId),
    isAdmin: role === 'ADMIN',
    isManagerOrAbove: role === 'ADMIN' || role === 'MANAGER',
    isTechnicien: role === 'TECHNICIEN',
    isViewer: role === 'VIEWER',
    role: role as UserRole,
    /** User scopes (for display) */
    scopes: myPerms?.scopes || [],
    /** User access grants (for display) */
    accessGrants: myPerms?.accessGrants || [],
    /** All sites access flag */
    allSitesAccess: myPerms?.allSitesAccess ?? false,
    hasAnySiteAccess,
    /** Whether user has at least one scope or grant (undefined = loading) */
    hasScope,
    /** Whether permissions are still loading */
    isLoadingPerms,
  };
}
