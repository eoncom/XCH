'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { floorPlansApi } from '@/lib/api/floor-plans';
import { sitesApi } from '@/lib/api/sites';
import { Plus, Search, FileImage, MapPin, Layers } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { usePermissions } from '@/hooks/usePermissions';
import Link from 'next/link';
import type { FloorPlan, Site } from '@/types';

/**
 * Deduplicate floor plans by planGroupId, keeping only the latest version.
 * Plans without planGroupId are treated as unique.
 */
function getLatestVersions(plans: FloorPlan[]): FloorPlan[] {
  const groupMap = new Map<string, FloorPlan>();

  for (const plan of plans) {
    const groupKey = plan.planGroupId || plan.id;
    const existing = groupMap.get(groupKey);

    if (!existing || plan.version > existing.version) {
      groupMap.set(groupKey, plan);
    }
  }

  return Array.from(groupMap.values());
}

/**
 * Count total versions per planGroupId
 */
function getVersionCounts(plans: FloorPlan[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const plan of plans) {
    const groupKey = plan.planGroupId || plan.id;
    counts.set(groupKey, (counts.get(groupKey) || 0) + 1);
  }

  return counts;
}

export default function FloorPlansPage() {
  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const { canCreate } = usePermissions();
  const router = useRouter();

  const { data: floorPlans, isLoading } = useQuery<FloorPlan[]>({
    queryKey: ['floor-plans', siteFilter],
    queryFn: () => floorPlansApi.getAll(siteFilter !== 'all' ? siteFilter : undefined),
  });

  const { data: sites } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: sitesApi.getAll,
  });

  // Deduplicate: show only latest version per plan group
  const latestPlans = floorPlans ? getLatestVersions(floorPlans) : [];
  const versionCounts = floorPlans ? getVersionCounts(floorPlans) : new Map<string, number>();

  const filteredFloorPlans = latestPlans.filter((plan) => {
    const searchLower = search.toLowerCase();
    return (
      plan.title?.toLowerCase().includes(searchLower) ||
      plan.floor?.toLowerCase().includes(searchLower) ||
      plan.building?.toLowerCase().includes(searchLower) ||
      plan.site?.name?.toLowerCase().includes(searchLower)
    );
  });

  if (isLoading) {
    return <div className="text-center">Chargement des plans...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Plans de sol</h1>
          <p className="text-muted-foreground">
            Gérez vos plans avec annotations et repères
          </p>
        </div>
        {canCreate('floor-plans') && (
          <Button asChild data-testid="create-floor-plan-btn">
            <Link href="/dashboard/floor-plans/new">
              <Plus className="mr-2 h-4 w-4" />
              Nouveau plan
            </Link>
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={siteFilter} onValueChange={setSiteFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Tous les sites" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les sites</SelectItem>
            {sites?.map((site) => (
              <SelectItem key={site.id} value={site.id}>
                {site.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Floor Plans Grid */}
      <div data-testid="floor-plans-list" className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredFloorPlans?.map((plan) => {
          const groupKey = plan.planGroupId || plan.id;
          const totalVersions = versionCounts.get(groupKey) || 1;

          return (
            <Card
              key={plan.id}
              data-testid="floor-plan-card"
              className="hover:shadow-lg transition-shadow cursor-pointer"
            >
              <Link href={`/dashboard/floor-plans/${plan.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <FileImage className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <CardTitle className="text-lg">{plan.title}</CardTitle>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-muted-foreground">
                            v{plan.version}
                          </p>
                          {totalVersions > 1 && (
                            <Badge variant="secondary" className="text-xs px-1.5 py-0">
                              <Layers className="h-3 w-3 mr-1" />
                              {totalVersions} versions
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {plan.site && (
                      <div className="flex items-center text-muted-foreground">
                        <MapPin className="mr-2 h-4 w-4" />
                        {plan.site.name}
                      </div>
                    )}

                    {(plan.building || plan.floor) && (
                      <div className="text-muted-foreground">
                        {plan.building && `Bâtiment ${plan.building}`}
                        {plan.building && plan.floor && ' - '}
                        {plan.floor && `Étage ${plan.floor}`}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Repères:</span>
                      <span className="font-medium">{plan.pins?.length || 0}</span>
                    </div>

                    {plan.fileSize && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Taille:</span>
                        <span className="font-medium">
                          {(plan.fileSize / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                    )}

                    {plan.uploadedAt && (
                      <div className="text-xs text-muted-foreground">
                        Ajouté le{' '}
                        {new Date(plan.uploadedAt).toLocaleDateString('fr-FR')}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Link>
            </Card>
          );
        })}
      </div>

      {filteredFloorPlans?.length === 0 && (
        <EmptyState
          icon={FileImage}
          title="Aucun plan trouvé"
          description={search ? 'Essayez de modifier votre recherche' : undefined}
        />
      )}
    </div>
  );
}
