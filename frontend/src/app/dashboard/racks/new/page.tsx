// @ts-nocheck - Temporary fix for Radix UI + React 19 type incompatibility
'use client';

import { useRouter } from 'next/navigation';
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
import { useSearchParams } from 'next/navigation';
import type { RackStatus, Site } from '@/types';

const rackStatusLabels: Record<RackStatus, string> = {
  IN_SERVICE: 'En service',
  OUT_OF_SERVICE: 'Hors service',
  PREPARATION: 'Préparation',
};

const rackHeightOptions = [4, 6, 12, 18, 24, 42];

const rackTypeLabels: Record<string, string> = {
  WALL_MOUNTED: 'Mural',
  FLOOR_STANDING: 'Sur pied',
  ENCLOSED_CABINET: 'Armoire fermée',
};

const rackSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  siteId: z.string().min(1, 'Le site est requis'),
  heightU: z.number().min(1, 'La hauteur est requise'),
  status: z.enum(['IN_SERVICE', 'OUT_OF_SERVICE', 'PREPARATION']),
  rackType: z.enum(['WALL_MOUNTED', 'FLOOR_STANDING', 'ENCLOSED_CABINET']).optional(),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  serialNumber: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  specs: z.object({
    depth: z.union([z.number(), z.nan(), z.string()]).transform((v) => { const n = Number(v); return isNaN(n) ? undefined : n; }).optional(),
    maxLoad: z.union([z.number(), z.nan(), z.string()]).transform((v) => { const n = Number(v); return isNaN(n) ? undefined : n; }).optional(),
    cooling: z.string().optional(),
    power: z.string().optional(),
  }).optional(),
});

type RackFormData = z.infer<typeof rackSchema>;

export default function NewRackPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const defaultSiteId = searchParams.get('siteId') || undefined;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<RackFormData>({
    resolver: zodResolver(rackSchema),
    defaultValues: {
      heightU: 42,
      status: 'PREPARATION',
      siteId: defaultSiteId,
    },
  });

  const { data: sites } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: sitesApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: (data: RackFormData) => racksApi.create(data),
    onSuccess: (rack) => {
      queryClient.invalidateQueries({ queryKey: ['racks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      if (rack.siteId) {
        queryClient.invalidateQueries({ queryKey: ['sites', rack.siteId] });
      }
      router.push(`/dashboard/racks/${rack.id}`);
    },
  });

  const onSubmit = (data: RackFormData) => {
    const cleaned: any = { ...data };

    // Clean empty strings
    if (!cleaned.serialNumber) delete cleaned.serialNumber;
    if (!cleaned.manufacturer) delete cleaned.manufacturer;
    if (!cleaned.model) delete cleaned.model;
    if (!cleaned.location) delete cleaned.location;
    if (!cleaned.notes) delete cleaned.notes;
    if (!cleaned.rackType) delete cleaned.rackType;

    // Clean specs: remove empty sub-fields, remove whole object if empty
    if (cleaned.specs) {
      const s = cleaned.specs;
      if (!s.depth && s.depth !== 0) delete s.depth;
      if (!s.maxLoad && s.maxLoad !== 0) delete s.maxLoad;
      if (!s.cooling) delete s.cooling;
      if (!s.power) delete s.power;
      if (Object.keys(s).length === 0) delete cleaned.specs;
    }

    createMutation.mutate(cleaned);
  };

  const siteId = watch('siteId');
  const heightU = watch('heightU');
  const status = watch('status');
  const rackType = watch('rackType');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/racks">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Nouvelle baie</h1>
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
                  <SelectTrigger><SelectValue placeholder="Sélectionner un site" /></SelectTrigger>
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
              <div className="space-y-2">
                <Label htmlFor="rackType">Type de baie</Label>
                <Select value={rackType || ''} onValueChange={(value) => setValue('rackType', value as any)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un type" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(rackTypeLabels).map(([value, label]) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}
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
                <Label htmlFor="model">Modèle</Label>
                <Input id="model" {...register('model')} placeholder="Ex: NetShelter SX 42U" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="serialNumber">Numéro de série</Label>
                <Input id="serialNumber" {...register('serialNumber')} placeholder="Ex: SN-2024-001" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Emplacement</Label>
                <Input id="location" {...register('location')} placeholder="Ex: Salle serveur, rangée B" />
                <p className="text-xs text-muted-foreground">Emplacement physique dans le bâtiment</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Spécifications techniques (optionnel) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Spécifications techniques
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">Optionnel</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="specs.depth">Profondeur (cm)</Label>
                <Input id="specs.depth" type="number" step="0.1" {...register('specs.depth', { valueAsNumber: true })} placeholder="Ex: 100" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="specs.maxLoad">Charge max (kg)</Label>
                <Input id="specs.maxLoad" type="number" step="0.1" {...register('specs.maxLoad', { valueAsNumber: true })} placeholder="Ex: 500" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="specs.cooling">Refroidissement</Label>
                <Input id="specs.cooling" {...register('specs.cooling')} placeholder="Ex: Ventilation active, climatisation..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="specs.power">Alimentation</Label>
                <Input id="specs.power" {...register('specs.power')} placeholder="Ex: 2x 16A, onduleur..." />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Notes (optionnel) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Notes
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">Optionnel</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea id="notes" {...register('notes')} placeholder="Informations complémentaires sur la baie..." rows={4} />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Info className="h-4 w-4" />
            Les champs marqués <span className="text-red-500">*</span> sont obligatoires
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => router.push('/dashboard/racks')}>Annuler</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Création...' : 'Créer la baie'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
