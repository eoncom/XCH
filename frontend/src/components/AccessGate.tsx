'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';

type GateMode = 'super-admin' | 'manage' | 'write' | 'read';

interface AccessGateProps {
  /**
   * Minimum right needed to view the gated children.
   * - 'super-admin' : isSuperAdmin only
   * - 'manage'      : MANAGE on any delegation OR super admin
   * - 'write'       : WRITE+ on the active delegation OR super admin
   * - 'read'        : READ+ on the active delegation OR super admin
   */
  required: GateMode;
  /**
   * When true, redirect to `redirectTo` after a brief blocker frame (default /dashboard).
   * When false, render the blocker indefinitely — useful for embedded sub-screens.
   */
  redirect?: boolean;
  redirectTo?: string;
  title?: string;
  description?: string;
  children: React.ReactNode;
}

/**
 * Page-level fail-closed gate.
 *
 * Backend enforcement is authoritative (PermissionGuard). This component exists
 * strictly to stop UX from exposing forms or actions a user cannot actually use,
 * and to emit a clear 403-style blocker when a user lands on an URL they
 * shouldn't access.
 */
export function AccessGate({
  required,
  redirect = true,
  redirectTo = '/dashboard',
  title = 'Accès refusé',
  description = 'Vous n’avez pas les droits nécessaires pour consulter cette page.',
  children,
}: AccessGateProps) {
  const router = useRouter();
  const { isSuperAdmin, canManage, canWrite, right, isLoadingPerms } = usePermissions();

  const allowed =
    required === 'super-admin'
      ? isSuperAdmin
      : required === 'manage'
        ? canManage || isSuperAdmin
        : required === 'write'
          ? canWrite || isSuperAdmin
          : !!right || isSuperAdmin;

  useEffect(() => {
    if (isLoadingPerms) return;
    if (!allowed && redirect) {
      const t = setTimeout(() => router.replace(redirectTo), 1500);
      return () => clearTimeout(t);
    }
  }, [isLoadingPerms, allowed, redirect, redirectTo, router]);

  if (isLoadingPerms) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] max-w-md mx-auto text-center space-y-6">
        <div className="rounded-full bg-destructive/10 p-6">
          <ShieldAlert className="h-12 w-12 text-destructive" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">{title}</h2>
          <p className="text-muted-foreground">{description}</p>
        </div>
        <Button variant="outline" onClick={() => router.replace(redirectTo)}>
          Retour au tableau de bord
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
