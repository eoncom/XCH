// @ts-nocheck - Temporary fix for Radix UI + React 19 type incompatibility
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { ArrowLeft, Info } from 'lucide-react';
import Link from 'next/link';
import type { Rack, RackStatus, Site } from '@/types';

const rackStatusLabels: Record<RackStatus, string> = {
  IN_SERVICE: 'En service',
  OUT_OF_SERVICE: 'Hors service',
  PREPARATION: 'Pr\u00e9paration',
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
  const queryClient = useQueryClient();
  const rackId = params.id as string;

  const { data: rack, isLoading } = useQuery<Rack>({
    queryKey: ['rack', rackId],
    queryFn: () => racksApi.getById(rackId),
  });

  const { data: sites } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: sitesApi.getAll,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<RackFormData>({
    resolver: zodResolver(rackSchema),
    values: rack
      ? {
          name: rack.name,
          siteId: rack.siteId,
          heightU: rack.heightU,
          status: rack.status,
          manufacturer: rack.manufacturer || '',
          model: rack.model || '',
          location: rack.location || '',
          notes: rack.notes || '',
        }
      : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<RackFormData>) => racksApi.update(rackId, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['rack', rackId] });
      queryClient.invalidateQueries({ queryKey: ['racks'] });
      if (result.siteId) {
        queryClient.invalidateQueries({ queryKey: ['sites', result.siteId] });
      }
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

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Section 1: Configuration (obligatoire) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Configuration
              <span className="text-xs font-normal text-red-500 bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded">Obligatoire</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom <span className="text-red-500">*</span></Label>
                <Input id="name" {...register('name')} placeholder="Ex: Baie A1" />
                {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="siteId">Site <span className="text-red-500">*</span></Label>
                <Select value={siteId} onValueChange={(value) => setValue('siteId', value)}>
                  <SelectTrigger><SelectValue placeholder="S\u00e9lectionner un site" /></SelectTrigger>
                  <SelectContent>
                    {sites?.map((site) => (<SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>))}
                  </SelectContent>
                </Select>
                {errors.siteId && <p className="text-sm text-red-600">{errors.siteId.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="heightU">Hauteur (U) <span className="text-red-500">*</span></Label>
                <Select value={String(heightU)} onValueChange={(value) => setValue('heightU', Number(value))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {rackHeightOptions.map((height) => (<SelectItem key={height} value={String(height)}>{height}U</SelectItem>))}
                  </SelectContent>
                </Select>
                {errors.heightU && <p className="text-sm text-red-600">{errors.heightU.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Statut <span className="text-red-500">*</span></Label>
                <Select value={status} onValueChange={(value) => setValue('status', value as RackStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(rackStatusLabels).map(([value, label]) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Identification (optionnel) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Identification
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">Optionnel</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="manufacturer">Fabricant</Label>
                <Input id="manufacturer" {...register('manufacturer')} placeholder="Ex: Dell, HP, APC..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Mod\u00e8le</Label>
                <Input id="model" {...register('model')} placeholder="Ex: NetShelter SX 42U" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="location">Emplacement</Label>
                <Input id="location" {...register('location')} placeholder="Ex: Salle serveur, rang\u00e9e B, position 3" />
                <p className="text-xs text-muted-foreground">Emplacement physique de la baie dans le b\u00e2timent</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Notes (optionnel) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Notes
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">Optionnel</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea id="notes" {...register('notes')} placeholder="Informations compl\u00e9mentaires sur la baie..." rows={4} />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Info className="h-4 w-4" />
            Les champs marqu\u00e9s <span className="text-red-500">*</span> sont obligatoires
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => router.push(`/dashboard/racks/${rackId}`)}>Annuler</Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
