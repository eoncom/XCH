'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { sitesApi } from '@/lib/api/sites';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const siteSchema = z.object({
  code: z.string().min(1, 'Le code est requis'),
  name: z.string().min(1, 'Le nom est requis'),
  status: z.enum(['PREPARATION', 'ACTIVE', 'CLOSED']),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  latitude: z.union([z.number(), z.nan(), z.string()]).optional().transform((val) => {
    if (typeof val === 'string' && val === '') return undefined;
    if (typeof val === 'number' && !isNaN(val)) return val;
    return undefined;
  }),
  longitude: z.union([z.number(), z.nan(), z.string()]).optional().transform((val) => {
    if (typeof val === 'string' && val === '') return undefined;
    if (typeof val === 'number' && !isNaN(val)) return val;
    return undefined;
  }),
  connectivity: z.object({
    primary: z.object({
      type: z.string().max(50, 'Max 50 caractères').optional().or(z.literal('')),
      provider: z.string().max(100, 'Max 100 caractères').optional().or(z.literal('')),
      ref: z.string().max(100, 'Max 100 caractères').optional().or(z.literal('')),
    }).optional(),
    backup: z.object({
      type: z.string().max(50, 'Max 50 caractères').optional().or(z.literal('')),
      provider: z.string().max(100, 'Max 100 caractères').optional().or(z.literal('')),
      ref: z.string().max(100, 'Max 100 caractères').optional().or(z.literal('')),
    }).optional(),
    cutProcedure: z.string().max(2000, 'Max 2000 caractères').optional().or(z.literal('')),
  }).optional(),
});

type SiteFormData = z.infer<typeof siteSchema>;

export default function NewSitePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<SiteFormData>({
    resolver: zodResolver(siteSchema),
    defaultValues: {
      status: 'ACTIVE',
      connectivity: {
        primary: { type: '', provider: '', ref: '' },
        backup: { type: '', provider: '', ref: '' },
        cutProcedure: '',
      },
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: SiteFormData) => sitesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      router.push('/dashboard/sites');
    },
    onError: (error) => {
      console.error('Erreur création chantier:', error);
      alert(`Erreur lors de la création: ${error.message}`);
    },
  });

  const onSubmit = (data: SiteFormData) => {
    // Nettoyer connectivity : supprimer objets vides
    const cleanedData = { ...data };

    if (cleanedData.connectivity) {
      // Si primary est vide, le supprimer
      if (
        !cleanedData.connectivity.primary?.type &&
        !cleanedData.connectivity.primary?.provider &&
        !cleanedData.connectivity.primary?.ref
      ) {
        delete cleanedData.connectivity.primary;
      }

      // Si backup est vide, le supprimer
      if (
        !cleanedData.connectivity.backup?.type &&
        !cleanedData.connectivity.backup?.provider &&
        !cleanedData.connectivity.backup?.ref
      ) {
        delete cleanedData.connectivity.backup;
      }

      // Si cutProcedure vide, le supprimer
      if (!cleanedData.connectivity.cutProcedure) {
        delete cleanedData.connectivity.cutProcedure;
      }

      // Si tout connectivity est vide, le supprimer
      if (
        !cleanedData.connectivity.primary &&
        !cleanedData.connectivity.backup &&
        !cleanedData.connectivity.cutProcedure
      ) {
        delete cleanedData.connectivity;
      }
    }

    createMutation.mutate(cleanedData);
  };

  const status = watch('status');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/sites">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Nouveau chantier</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations du chantier</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  {...register('code')}
                  placeholder="CH-2025-001"
                />
                {errors.code && (
                  <p className="text-sm text-red-600">{errors.code.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nom *</Label>
                <Input
                  id="name"
                  {...register('name')}
                  placeholder="Chantier Exemple"
                />
                {errors.name && (
                  <p className="text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Statut *</Label>
                <Select
                  value={status}
                  onValueChange={(value) =>
                    setValue('status', value as 'PREPARATION' | 'ACTIVE' | 'CLOSED')
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PREPARATION">Préparation</SelectItem>
                    <SelectItem value="ACTIVE">Actif</SelectItem>
                    <SelectItem value="CLOSED">Fermé</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Ville</Label>
                <Input id="city" {...register('city')} placeholder="Paris" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="postalCode">Code postal</Label>
                <Input
                  id="postalCode"
                  {...register('postalCode')}
                  placeholder="75001"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Adresse</Label>
              <Input
                id="address"
                {...register('address')}
                placeholder="123 Rue de la République"
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Coordonnées GPS</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    {...register('latitude', { valueAsNumber: true })}
                    placeholder="48.856614"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    {...register('longitude', { valueAsNumber: true })}
                    placeholder="2.3522219"
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 border-t pt-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold">Connectivité</h3>
                <p className="text-sm text-muted-foreground">
                  Configuration des liaisons réseau primaire et backup
                </p>
              </div>

              {/* Primary Connectivity */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-700">Connexion Primaire</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="connectivity.primary.type">Type</Label>
                    <Input
                      id="connectivity.primary.type"
                      {...register('connectivity.primary.type')}
                      placeholder="Ex: Fiber, 4G, Satellite"
                      maxLength={50}
                    />
                    {errors.connectivity?.primary?.type && (
                      <p className="text-sm text-red-600">
                        {errors.connectivity.primary.type.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="connectivity.primary.provider">Opérateur</Label>
                    <Input
                      id="connectivity.primary.provider"
                      {...register('connectivity.primary.provider')}
                      placeholder="Ex: Orange Business"
                      maxLength={100}
                    />
                    {errors.connectivity?.primary?.provider && (
                      <p className="text-sm text-red-600">
                        {errors.connectivity.primary.provider.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="connectivity.primary.ref">Référence Contrat</Label>
                    <Input
                      id="connectivity.primary.ref"
                      {...register('connectivity.primary.ref')}
                      placeholder="Ex: CTR-2024-0001"
                      maxLength={100}
                    />
                    {errors.connectivity?.primary?.ref && (
                      <p className="text-sm text-red-600">
                        {errors.connectivity.primary.ref.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Backup Connectivity */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-700">Connexion Backup</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="connectivity.backup.type">Type</Label>
                    <Input
                      id="connectivity.backup.type"
                      {...register('connectivity.backup.type')}
                      placeholder="Ex: 4G, ADSL"
                      maxLength={50}
                    />
                    {errors.connectivity?.backup?.type && (
                      <p className="text-sm text-red-600">
                        {errors.connectivity.backup.type.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="connectivity.backup.provider">Opérateur</Label>
                    <Input
                      id="connectivity.backup.provider"
                      {...register('connectivity.backup.provider')}
                      placeholder="Ex: SFR Business"
                      maxLength={100}
                    />
                    {errors.connectivity?.backup?.provider && (
                      <p className="text-sm text-red-600">
                        {errors.connectivity.backup.provider.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="connectivity.backup.ref">Référence Contrat</Label>
                    <Input
                      id="connectivity.backup.ref"
                      {...register('connectivity.backup.ref')}
                      placeholder="Ex: CTR-2024-0002"
                      maxLength={100}
                    />
                    {errors.connectivity?.backup?.ref && (
                      <p className="text-sm text-red-600">
                        {errors.connectivity.backup.ref.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Cut Procedure */}
              <div className="space-y-2">
                <Label htmlFor="connectivity.cutProcedure">Procédure Coupure</Label>
                <Textarea
                  id="connectivity.cutProcedure"
                  {...register('connectivity.cutProcedure')}
                  placeholder="Procédure à suivre en cas de coupure réseau (contacts, escalade, basculement backup...)"
                  rows={4}
                  maxLength={2000}
                />
                {errors.connectivity?.cutProcedure && (
                  <p className="text-sm text-red-600">
                    {errors.connectivity.cutProcedure.message}
                  </p>
                )}
              </div>
            </div>

            {Object.keys(errors).length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm text-red-800 font-medium">Erreurs de validation:</p>
                <ul className="list-disc list-inside text-sm text-red-700 mt-1">
                  {Object.entries(errors).map(([field, error]) => (
                    <li key={field}>
                      {field}: {error?.message?.toString() || 'Erreur inconnue'}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/dashboard/sites')}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Création...' : 'Créer'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
