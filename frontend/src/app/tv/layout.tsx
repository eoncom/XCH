'use client';

import { useAuthStore } from '@/stores/auth-store';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DashboardSkeleton } from '@/components/ui/skeleton';

/**
 * Minimal layout for TV dashboard — no sidebar, no navigation header.
 * Auth via same JWT/cookie mechanism as dashboard.
 * Uses checkSession() to validate HTTP-only cookie (works in new tabs).
 */
export default function TVLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, checkSession } = useAuthStore();
  const router = useRouter();
  const [sessionChecked, setSessionChecked] = useState(false);

  // Check session on mount (verify HTTP-only cookie is valid)
  useEffect(() => {
    checkSession().finally(() => setSessionChecked(true));
  }, [checkSession]);

  // Only redirect after session check is complete
  useEffect(() => {
    if (sessionChecked && !isAuthenticated) {
      router.push('/login');
    }
  }, [sessionChecked, isAuthenticated, router]);

  // Show skeleton while checking session
  if (!sessionChecked) return <DashboardSkeleton />;
  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen h-screen overflow-y-auto bg-background">
      {children}
    </div>
  );
}
