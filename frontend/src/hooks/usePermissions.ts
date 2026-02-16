'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { siteAccessApi, type UserSiteAccess, type ResourcePermissionLevel } from '@/lib/api/site-access';
import type { UserRole } from '@/types';

/**
 * Permission definitions based on Casbin policy.csv
 * Maps role → resource → allowed actions
 */
const ROLE_PERMISSIONS: Record<string, Record<string, string[]>> = {
  ADMIN: {
    sites: ['create', 'read', 'update', 'delete'],
    assets: ['create', 'read', 'update', 'delete'],
    racks: ['create', 'read', 'update', 'delete'],
    tasks: ['create', 'read', 'update', 'delete'],
    'floor-plans': ['create', 'read', 'update', 'delete'],
    integrations: ['read', 'create', 'update'],
    users: ['create', 'read', 'update', 'delete'],
    tenants: ['read', 'update'],
    contacts: ['create', 'read', 'update', 'delete'],
    'contact-types': ['create', 'read', 'update', 'delete'],
  },
  MANAGER: {
    sites: ['read'],
    assets: ['read'],
    racks: ['read'],
    tasks: ['create', 'read', 'update'],
    'floor-plans': ['read', 'update'],
    integrations: ['read'],
    users: ['read'],
    contacts: ['create', 'read', 'update'],
    'contact-types': ['read'],
  },
  TECHNICIEN: {
    sites: ['read'],
    tenants: ['read'],
    assets: ['create', 'read', 'update'],
    racks: ['create', 'read', 'update'],
    tasks: ['create', 'read', 'update'],
    'floor-plans': ['read', 'create', 'update'],
    contacts: ['read'],
    'contact-types': ['read'],
  },
  VIEWER: {
    sites: ['read'],
    tenants: ['read'],
    assets: ['read'],
    racks: ['read'],
    tasks: ['read'],
    'floor-plans': ['read'],
    contacts: ['read'],
    'contact-types': ['read'],
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

export function usePermissions() {
  const { user } = useAuthStore();
  const role = (user?.role || 'VIEWER') as string;

  // Fetch per-site permissions from backend for TECHNICIEN/VIEWER
  const { data: myPerms } = useQuery({
    queryKey: ['my-permissions'],
    queryFn: () => siteAccessApi.myPermissions(),
    enabled: !!user && (role === 'TECHNICIEN' || role === 'VIEWER'),
    staleTime: 60_000, // Cache for 1 minute
    retry: 1,
  });

  /**
   * Check if user can do action on resource.
   * Without siteId → uses global role-based permissions.
   * With siteId → uses per-site resourcePermissions if available.
   */
  const can = (resource: string, action: string, siteId?: string): boolean => {
    // ADMIN and MANAGER always use role-based permissions (they have full access)
    if (role === 'ADMIN' || role === 'MANAGER') {
      const rolePerms = ROLE_PERMISSIONS[role];
      if (!rolePerms) return false;
      return rolePerms[resource]?.includes(action) ?? false;
    }

    // TECHNICIEN / VIEWER — check per-site permissions if siteId is provided
    if (siteId && myPerms?.siteAccess) {
      const siteAccess = myPerms.siteAccess.find(
        (sa: UserSiteAccess) => sa.siteId === siteId
      );

      if (!siteAccess) {
        // No access to this site at all
        return false;
      }

      // Check resourcePermissions override
      const resourceKey = RESOURCE_KEY_MAP[resource] || resource;
      const resourcePerms = siteAccess.resourcePermissions as Record<string, ResourcePermissionLevel> | null | undefined;

      if (resourcePerms && resourceKey in resourcePerms) {
        const level = resourcePerms[resourceKey];
        const allowedActions = permLevelToActions(level);
        return allowedActions.includes(action);
      }

      // No per-resource override → fallback to accessLevel
      if (siteAccess.accessLevel === 'WRITE') {
        // User has WRITE on this site, use role-based permissions
        const rolePerms = ROLE_PERMISSIONS[role];
        if (!rolePerms) return false;
        return rolePerms[resource]?.includes(action) ?? false;
      } else {
        // READ access level → only allow read
        return action === 'read';
      }
    }

    // No siteId context or no permissions loaded → fallback to role-based
    const rolePerms = ROLE_PERMISSIONS[role];
    if (!rolePerms) return false;
    return rolePerms[resource]?.includes(action) ?? false;
  };

  /**
   * Check per-site resource permission. Returns true/false.
   * This is the site-aware version that should be used on detail pages.
   */
  const canForSite = (resource: string, action: string, siteId: string): boolean => {
    return can(resource, action, siteId);
  };

  return {
    /** Check if the user can perform an action on a resource (with optional siteId context) */
    can,

    /** Check permission for a specific site context */
    canForSite,

    /** Shorthand: can create a resource (global role-based) */
    canCreate: (resource: string, siteId?: string) => can(resource, 'create', siteId),

    /** Shorthand: can read a resource */
    canRead: (resource: string, siteId?: string) => can(resource, 'read', siteId),

    /** Shorthand: can update a resource */
    canUpdate: (resource: string, siteId?: string) => can(resource, 'update', siteId),

    /** Shorthand: can delete a resource */
    canDelete: (resource: string, siteId?: string) => can(resource, 'delete', siteId),

    /** Is the user an admin */
    isAdmin: role === 'ADMIN',

    /** Is the user a manager or admin */
    isManagerOrAbove: role === 'ADMIN' || role === 'MANAGER',

    /** Is the user a technician */
    isTechnicien: role === 'TECHNICIEN',

    /** Is the user a viewer */
    isViewer: role === 'VIEWER',

    /** The user's role */
    role: role as UserRole,

    /** Per-site access data (for TECHNICIEN/VIEWER) */
    siteAccess: myPerms?.siteAccess || [],
  };
}
