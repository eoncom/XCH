'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { racksApi } from '@/lib/api/racks';
import { sitesApi } from '@/lib/api/sites';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { Rack, RackStatus, Site } from '@/types';

const rackStatusLabels: Record<RackStatus, string> = {
  IN_SERVICE: 'En service',
  OUT_OF_SERVICE: 'Hors service',
  PREPARATION: 'Préparation',
};

const rackHeightOptions = [4, 6, 12, 18, 24, 42];

const rackSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  siteId: z.string().min(1, 'Le site est requis'),
  heightU: z.number().min(1, 'La hauteur est requise'),
  status: z.enum(['IN_SERVICE', 'OUT_OF_SERVICE', 'PREPARATION']),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

type RackFormData = z.infer<typeof rackSchema>;

export default function EditRackPage() {
  const params = useParams();
  const router = useRouter();
  const rackId = params.id as string;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<RackFormData>({
    resolver: zodResolver(rackSchema),
  });

  const { data: rack, isLoading } = useQuery<Rack>({
    queryKey: ['rack', rackId],
    queryFn: () => racksApi.getById(rackId),
  });

  const { data: sites } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: sitesApi.getAll,
  });

  useEffect(() => {
    if (rack) {
      setValue('name', rack.name);
      setValue('siteId', rack.siteId);
      setValue('heightU', rack.heightU);
      setValue('status', rack.status);
      setValue('manufacturer', rack.manufacturer || '');
      setValue('model', rack.model || '');
      setValue('location', rack.location || '');
      setValue('notes', rack.notes || '');
    }
  }, [rack, setValue]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<RackFormData>) => racksApi.update(rackId, data),
    onSuccess: () => {
      router.push(`/dashboard/racks/${rackId}`);
    },
  });

  const onSubmit = (data: RackFormData) => {
    updateMutation.mutate(data);
  };

  const siteId = watch('siteId');
  const heightU = watch('heightU');
  const status = watch('status');

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/racks/${rackId}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Modifier la baie</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations de la baie</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom *</Label>
                <Input
                  id="name"
                  {...register('name')}
                  placeholder="Baie A1"
                />
                {errors.name && (
                  <p className="text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="siteId">Site *</Label>
                <Select
                  value={siteId}
                  onValueChange={(value) => setValue('siteId', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites?.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.siteId && (
                  <p className="text-sm text-red-600">{errors.siteId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="heightU">Hauteur (U) *</Label>
                <Select
                  value={String(heightU)}
                  onValueChange={(value) => setValue('heightU', Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {rackHeightOptions.map((height) => (
                      <SelectItem key={height} value={String(height)}>
                        {height}U
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.heightU && (
                  <p className="text-sm text-red-600">{errors.heightU.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Statut *</Label>
                <Select
                  value={status}
                  onValueChange={(value) => setValue('status', value as RackStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(rackStatusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="manufacturer">Fabricant</Label>
                <Input
                  id="manufacturer"
                  {...register('manufacturer')}
                  placeholder="Dell, HP, etc."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Modèle</Label>
                <Input
                  id="model"
                  {...register('model')}
                  placeholder="PowerEdge R740"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Emplacement</Label>
              <Input
                id="location"
                {...register('location')}
                placeholder="Salle serveur, rangée B"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                {...register('notes')}
                placeholder="Informations complémentaires..."
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/dashboard/racks/${rackId}`)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
