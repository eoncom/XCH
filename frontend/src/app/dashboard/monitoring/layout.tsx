'use client';

/**
 * Monitoring layout (ADR-016) — sub-tabs Configuration / Mapping retired
 * along with the legacy Gatus/Kuma providers. Only the overview lives here
 * now; per-monitor history at /dashboard/monitoring/[id].
 */
export default function MonitoringLayout({ children }: { children: React.ReactNode }) {
  return <div className="space-y-6">{children}</div>;
}
