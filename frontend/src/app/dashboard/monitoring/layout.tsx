'use client';

/**
 * Monitoring layout (ADR-016) — native monitoring only.
 * Overview here, per-monitor history at /dashboard/monitoring/[id].
 */
export default function MonitoringLayout({ children }: { children: React.ReactNode }) {
  return <div className="space-y-6">{children}</div>;
}
