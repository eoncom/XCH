'use client';

import { useAuthStore } from '@/stores/auth-store';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { DashboardSkeleton } from '@/components/ui/skeleton';

/**
 * Minimal layout for TV dashboard — no sidebar, no navigation header.
 * Auth via same JWT/cookie mechanism as dashboard.
 */
export default function TVLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) return <DashboardSkeleton />;
  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}
