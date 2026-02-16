'use client';

import { useAuthStore } from '@/stores/auth-store';
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
    assets: ['create', 'read', 'update'],
    racks: ['create', 'read', 'update'],
    tasks: ['create', 'read', 'update'],
    'floor-plans': ['read', 'create', 'update'],
    contacts: ['create', 'read', 'update'],
    'contact-types': ['read'],
  },
  VIEWER: {
    sites: ['read'],
    assets: ['read'],
    racks: ['read'],
    tasks: ['read'],
    'floor-plans': ['read'],
    contacts: ['read'],
    'contact-types': ['read'],
  },
};

export function usePermissions() {
  const { user } = useAuthStore();
  const role = (user?.role || 'VIEWER') as string;

  const can = (resource: string, action: string): boolean => {
    const rolePerms = ROLE_PERMISSIONS[role];
    if (!rolePerms) return false;
    return rolePerms[resource]?.includes(action) ?? false;
  };

  return {
    /** Check if the user can perform an action on a resource */
    can,

    /** Shorthand: can create a resource */
    canCreate: (resource: string) => can(resource, 'create'),

    /** Shorthand: can read a resource */
    canRead: (resource: string) => can(resource, 'read'),

    /** Shorthand: can update a resource */
    canUpdate: (resource: string) => can(resource, 'update'),

    /** Shorthand: can delete a resource */
    canDelete: (resource: string) => can(resource, 'delete'),

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
  };
}
