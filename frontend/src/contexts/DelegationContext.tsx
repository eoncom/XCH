'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import type { DelegationRight } from '@/types';

export interface UserDelegation {
  id: string;
  userId: string;
  delegationId: string;
  right: DelegationRight;
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
  currentDelegation: UserDelegation | null;
  delegations: UserDelegation[];
  switchDelegation: (delegationId: string) => void;
  /** MANAGE | WRITE | READ in current delegation */
  localRight: DelegationRight | null;
  /** @deprecated Use localRight instead */
  localRole: string | null;
  isSuperAdmin: boolean;
  isLoading: boolean;
  hasDelegation: boolean;
}

const DelegationContext = createContext<DelegationContextValue>({
  currentDelegation: null,
  delegations: [],
  switchDelegation: () => {},
  localRight: null,
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

          // Auto-select the first delegation if none is stored, regardless of count.
          // Without this the api-client reads localStorage (null) and never sends
          // X-Delegation-Id → all delegation-scoped requests return 403 even
          // though currentDelegation (useMemo fallback) shows the right value.
          if (!activeDelegationId && data.length > 0) {
            setActiveDelegationId(data[0].delegationId);
            localStorage.setItem(STORAGE_KEY, data[0].delegationId);
          }

          // Stored delegation no longer granted → fall back to the first available
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

  const localRight = currentDelegation?.right || null;

  const value = useMemo<DelegationContextValue>(() => ({
    currentDelegation,
    delegations,
    switchDelegation,
    localRight,
    localRole: localRight, // backward compat
    isSuperAdmin,
    isLoading,
    hasDelegation: isSuperAdmin || delegations.length > 0,
  }), [currentDelegation, delegations, switchDelegation, localRight, isSuperAdmin, isLoading]);

  return (
    <DelegationContext.Provider value={value}>
      {children}
    </DelegationContext.Provider>
  );
}

export function useDelegation() {
  return useContext(DelegationContext);
}
