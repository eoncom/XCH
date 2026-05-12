'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { NativeMonitorsList } from '@/components/monitoring/NativeMonitorsList';

/**
 * Monitoring overview page (ADR-016).
 * Single source of truth = MonitorCheck rows, listed by NativeMonitorsList.
 */
export default function MonitoringOverviewPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">Surveillance</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-10">
            Surveillance temps réel : disponibilité des liens, équipements et services.
          </p>
        </div>
      </div>
      <NativeMonitorsList />
    </div>
  );
}
