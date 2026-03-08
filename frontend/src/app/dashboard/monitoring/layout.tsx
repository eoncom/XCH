'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const monitoringTabs = [
  { name: 'Vue d\'ensemble', href: '/dashboard/monitoring' },
  { name: 'Configuration', href: '/dashboard/monitoring/config' },
  { name: 'Mapping', href: '/dashboard/monitoring/mapping' },
];

export default function MonitoringLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      {/* Sub-navigation tabs */}
      <div className="border-b">
        <nav className="flex gap-4 -mb-px" aria-label="Monitoring navigation">
          {monitoringTabs.map((tab) => {
            const isActive = tab.href === '/dashboard/monitoring'
              ? pathname === '/dashboard/monitoring'
              : pathname.startsWith(tab.href);

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'py-2 px-1 text-sm font-medium border-b-2 transition-colors',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                )}
              >
                {tab.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      {children}
    </div>
  );
}
