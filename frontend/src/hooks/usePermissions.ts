'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import { useDelegation } from '@/contexts/DelegationContext';
import { siteAccessApi, type MyPermissionsResponse } from '@/lib/api/site-access';
import type { DelegationRight } from '@/types';

/**
 * Right hierarchy: MANAGE > WRITE > READ.
 */
const RIGHT_RANK: Record<string, number> = {
  MANAGE: 3,
  WRITE: 2,
  READ: 1,
};

function rightSatisfies(actual: string | null, required: string): boolean {
  if (!actual) return false;
  return (RIGHT_RANK[actual] ?? 0) >= (RIGHT_RANK[required] ?? 0);
}

/**
 * Map actions to the minimum right needed.
 */
function actionToRight(action: string): string {
  switch (action) {
    case 'create':
    case 'update':
    case 'delete':
      return 'WRITE';
    case 'manage':
      return 'MANAGE';
    case 'read':
    default:
      return 'READ';
  }
}

/**
 * Resources that require MANAGE right (not just WRITE).
 */
const MANAGE_ONLY_RESOURCES = ['users', 'delegations', 'tenants'];

/**
 * usePermissions hook — v2 (MANAGE/WRITE/READ model).
 *
 * Uses UserDelegation.right for delegation-level permissions.
 * AccessOverride (ALLOW/DENY) is resolved server-side by PermissionService.
 * Frontend caches delegation rights for UX (show/hide buttons), but backend is authoritative.
 *
 * RULE: No delegation = NO ACCESS (unless super admin).
 */
export function usePermissions() {
  const { user } = useAuthStore();
  const { localRight, isSuperAdmin, hasDelegation } = useDelegation();

  // localRight = UserDelegation.right for the active delegation (MANAGE/WRITE/READ)
  // Super admin with no delegation selected → acts as MANAGE
  const effectiveRight: DelegationRight | null = localRight || (isSuperAdmin ? 'MANAGE' : null);

  const { data: myPerms, isLoading: isLoadingPerms } = useQuery<MyPermissionsResponse>({
    queryKey: ['my-permissions'],
    queryFn: () => siteAccessApi.myPermissions(),
    enabled: !!user,
    staleTime: 60_000,
    retry: 1,
  });

  const hasDelegationAccess = (() => {
    if (!myPerms) return undefined;
    return myPerms.isSuperAdmin || myPerms.hasDelegation;
  })();

  /**
   * Check if user can perform action on resource.
   *
   * Frontend uses delegation-level right for UX decisions.
   * Backend enforces full resolution (AccessOverride + delegation inheritance).
   */
  const can = (resource: string, action: string, _siteId?: string): boolean => {
    // Super admin can do everything
    if (isSuperAdmin) return true;

    // No delegation = no access
    if (!effectiveRight) return false;
    if (myPerms && !myPerms.hasDelegation) return false;

    // MANAGE-only resources require MANAGE right
    if (MANAGE_ONLY_RESOURCES.includes(resource)) {
      if (action !== 'read') {
        return rightSatisfies(effectiveRight, 'MANAGE');
      }
      // Reading users/delegations/tenants requires at least READ
      return rightSatisfies(effectiveRight, 'READ');
    }

    // Standard resources: map action to required right
    const requiredRight = actionToRight(action);
    return rightSatisfies(effectiveRight, requiredRight);
  };

  const canForSite = (resource: string, action: string, siteId: string): boolean => {
    return can(resource, action, siteId);
  };

  const hasAnySiteAccess = (): boolean => {
    if (isSuperAdmin) return true;
    if (!myPerms) return false;
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

    // Right-based checks (new model)
    canManage: rightSatisfies(effectiveRight, 'MANAGE'),
    canWrite: rightSatisfies(effectiveRight, 'WRITE'),

    // Backward-compatible role-like helpers
    isAdmin: effectiveRight === 'MANAGE' || isSuperAdmin,
    isManagerOrAbove: rightSatisfies(effectiveRight, 'WRITE') || isSuperAdmin,
    isTechnicien: effectiveRight === 'WRITE',
    isViewer: effectiveRight === 'READ',
    isSuperAdmin,

    /** Effective delegation right */
    right: effectiveRight,
    /** @deprecated Use right instead */
    role: (effectiveRight || 'READ') as string,

    delegations: myPerms?.delegations || [],
    allSitesAccess: myPerms?.allSitesAccess ?? false,
    hasAnySiteAccess,
    hasDelegation: hasDelegationAccess,
    isLoadingPerms,
  };
}
