'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/lib/api-client';

export interface UserDelegation {
  id: string;
  userId: string;
  delegationId: string;
  role: string;
  grantedAt: string;
  delegation: {
    id: string;
    name: string;
    code: string;
    groupLabel?: string;
    groupColor?: string;
    isActive: boolean;
  };
}

interface DelegationContextValue {
  /** Currently active delegation (null if super admin with no selection, or loading) */
  currentDelegation: UserDelegation | null;
  /** All delegations accessible to this user */
  delegations: UserDelegation[];
  /** Switch active delegation */
  switchDelegation: (delegationId: string) => void;
  /** Local role in current delegation */
  localRole: string | null;
  /** Whether user is super admin */
  isSuperAdmin: boolean;
  /** Whether delegations are still loading */
  isLoading: boolean;
  /** Whether user has at least one delegation */
  hasDelegation: boolean;
}

const DelegationContext = createContext<DelegationContextValue>({
  currentDelegation: null,
  delegations: [],
  switchDelegation: () => {},
  localRole: null,
  isSuperAdmin: false,
  isLoading: true,
  hasDelegation: false,
});

const STORAGE_KEY = 'xch-active-delegation';

export function DelegationProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuthStore();
  const [delegations, setDelegations] = useState<UserDelegation[]>([]);
  const [activeDelegationId, setActiveDelegationId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY);
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(true);

  const isSuperAdmin = !!(user as any)?.isSuperAdmin;

  // Fetch user's delegations after login
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setDelegations([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const fetchDelegations = async () => {
      try {
        const data = await apiClient.get<UserDelegation[]>('/api/user-delegations/mine');
        if (!cancelled) {
          setDelegations(data);

          // Auto-select if only one delegation and no stored preference
          if (data.length === 1 && !activeDelegationId) {
            setActiveDelegationId(data[0].delegationId);
            localStorage.setItem(STORAGE_KEY, data[0].delegationId);
          }

          // Validate stored preference still exists
          if (activeDelegationId && !data.some(d => d.delegationId === activeDelegationId)) {
            if (data.length > 0) {
              setActiveDelegationId(data[0].delegationId);
              localStorage.setItem(STORAGE_KEY, data[0].delegationId);
            } else {
              setActiveDelegationId(null);
              localStorage.removeItem(STORAGE_KEY);
            }
          }

          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch delegations:', err);
        if (!cancelled) {
          setDelegations([]);
          setIsLoading(false);
        }
      }
    };

    fetchDelegations();
    return () => { cancelled = true; };
  }, [isAuthenticated, user]);

  const switchDelegation = useCallback((delegationId: string) => {
    setActiveDelegationId(delegationId);
    localStorage.setItem(STORAGE_KEY, delegationId);
  }, []);

  const currentDelegation = useMemo(() => {
    if (!activeDelegationId) return delegations[0] || null;
    return delegations.find(d => d.delegationId === activeDelegationId) || delegations[0] || null;
  }, [delegations, activeDelegationId]);

  const localRole = currentDelegation?.role || null;

  const value = useMemo<DelegationContextValue>(() => ({
    currentDelegation,
    delegations,
    switchDelegation,
    localRole,
    isSuperAdmin,
    isLoading,
    hasDelegation: isSuperAdmin || delegations.length > 0,
  }), [currentDelegation, delegations, switchDelegation, localRole, isSuperAdmin, isLoading]);

  return (
    <DelegationContext.Provider value={value}>
      {children}
    </DelegationContext.Provider>
  );
}

export function useDelegation() {
  return useContext(DelegationContext);
}
