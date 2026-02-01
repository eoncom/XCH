'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { sitesApi } from '@/lib/api/sites';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import type { Site } from '@/types';

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

export default function EditSitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: site, isLoading } = useQuery<Site>({
    queryKey: ['site', id],
    queryFn: () => sitesApi.getById(id),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<SiteFormData>({
    resolver: zodResolver(siteSchema),
    values: site
      ? {
          code: site.code,
          name: site.name,
          status: site.status,
          address: site.address || '',
          city: site.city || '',
          postalCode: site.postalCode || '',
          latitude: site.latitude,
          longitude: site.longitude,
          connectivity: site.connectivity || {
            primary: { type: '', provider: '', ref: '' },
            backup: { type: '', provider: '', ref: '' },
            cutProcedure: '',
          },
        }
      : undefined,
  });

  const [contacts, setContacts] = useState(site?.contacts || []);
  const [accessNotes, setAccessNotes] = useState(site?.accessNotes || {
    schedules: '', badges: '', procedures: '', safety: ''
  });

  const updateMutation = useMutation({
    mutationFn: (data: SiteFormData) => sitesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites', id] });
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      router.push(`/dashboard/sites/${id}`);
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

    const payload = {
      ...cleanedData,
      contacts: contacts.filter(c => c.name && c.email),
      accessNotes
    };
    updateMutation.mutate(payload);
  };

  const status = watch('status');

  if (isLoading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  if (!site) {
    return <div className="text-center py-12">Chantier non trouvé</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/sites/${id}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Modifier {site.name}</h1>
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

            {/* Contacts */}
            <div className="mt-8 border-t pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Contacts</h3>
                <Button
                  data-testid="add-contact-btn"
                  type="button"
                  onClick={() => setContacts([...contacts, { name: '', role: '', phone: '', email: '', isPrimary: false }])}
                  variant="outline"
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter
                </Button>
              </div>

              <div className="space-y-3">
                {contacts.map((contact, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-start p-3 border rounded">
                    <Input
                      placeholder="Nom"
                      className="col-span-3"
                      value={contact.name}
                      onChange={(e) => {
                        const updated = [...contacts];
                        updated[index].name = e.target.value;
                        setContacts(updated);
                      }}
                    />
                    <Input
                      placeholder="Rôle"
                      className="col-span-2"
                      value={contact.role}
                      onChange={(e) => {
                        const updated = [...contacts];
                        updated[index].role = e.target.value;
                        setContacts(updated);
                      }}
                    />
                    <Input
                      placeholder="Téléphone"
                      className="col-span-2"
                      value={contact.phone}
                      onChange={(e) => {
                        const updated = [...contacts];
                        updated[index].phone = e.target.value;
                        setContacts(updated);
                      }}
                    />
                    <Input
                      placeholder="Email"
                      type="email"
                      className="col-span-3"
                      value={contact.email}
                      onChange={(e) => {
                        const updated = [...contacts];
                        updated[index].email = e.target.value;
                        setContacts(updated);
                      }}
                    />
                    <div className="col-span-1 flex items-center justify-center">
                      <Checkbox
                        checked={contact.isPrimary}
                        onCheckedChange={(checked) => {
                          const updated = [...contacts];
                          updated[index].isPrimary = checked as boolean;
                          setContacts(updated);
                        }}
                      />
                    </div>
                    <Button
                      data-testid="delete-contact-btn"
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="col-span-1"
                      onClick={() => setContacts(contacts.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {contacts.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucun contact. Cliquez sur "Ajouter" pour en créer un.
                  </p>
                )}
              </div>
            </div>

            {/* Connectivity */}
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

            {/* Access Notes */}
            <div className="mt-8 border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Notes d'Accès</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Horaires d'accès</Label>
                  <Textarea
                    placeholder="Lun-Ven 8h-18h, Sam 9h-12h..."
                    rows={2}
                    value={accessNotes.schedules}
                    onChange={(e) => setAccessNotes({...accessNotes, schedules: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Badges requis</Label>
                  <Textarea
                    placeholder="Badge site + badge bâtiment A..."
                    rows={2}
                    value={accessNotes.badges}
                    onChange={(e) => setAccessNotes({...accessNotes, badges: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Procédures d'entrée</Label>
                  <Textarea
                    placeholder="1. S'enregistrer à l'accueil&#10;2. Récupérer badge..."
                    rows={3}
                    value={accessNotes.procedures}
                    onChange={(e) => setAccessNotes({...accessNotes, procedures: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Consignes de sécurité</Label>
                  <Textarea
                    placeholder="Port du casque obligatoire, EPI requis..."
                    rows={3}
                    value={accessNotes.safety}
                    onChange={(e) => setAccessNotes({...accessNotes, safety: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/dashboard/sites/${id}`)}
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
