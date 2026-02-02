'use client';

import { use } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { providersApi } from '@/lib/api/providers';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { Provider, ProviderType } from '@/types';
import { toast } from 'sonner';

const providerSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(100, 'Le nom ne peut pas dépasser 100 caractères'),
  type: z.enum(['TELECOM', 'INTERNET', 'CLOUD', 'HOSTING', 'SECURITY', 'NETWORK', 'MAINTENANCE', 'ENERGY', 'CUSTOM', 'OTHER']),
  customType: z.string().max(50, 'Le type personnalisé ne peut pas dépasser 50 caractères').optional(),
  contact: z.string().max(200, 'Le contact ne peut pas dépasser 200 caractères').optional(),
  notes: z.string().max(1000, 'Les notes ne peuvent pas dépasser 1000 caractères').optional(),
}).refine((data) => {
  // Si type est CUSTOM, customType est requis
  if (data.type === 'CUSTOM' && (!data.customType || data.customType.trim() === '')) {
    return false;
  }
  return true;
}, {
  message: 'Le type personnalisé est requis quand le type est "Personnalisé"',
  path: ['customType'],
});

type ProviderFormData = z.infer<typeof providerSchema>;

export default function EditProviderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: provider, isLoading } = useQuery<Provider>({
    queryKey: ['provider', parseInt(id)],
    queryFn: () => providersApi.getById(parseInt(id)),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ProviderFormData>({
    resolver: zodResolver(providerSchema),
    values: provider
      ? {
          name: provider.name,
          type: provider.type,
          customType: provider.customType || '',
          contact: provider.contact || '',
          notes: provider.notes || '',
        }
      : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: (data: ProviderFormData) => providersApi.update(parseInt(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider', parseInt(id)] });
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      toast.success('Fournisseur mis à jour avec succès');
      router.push(`/dashboard/providers/${id}`);
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de la mise à jour: ${error.message}`);
    },
  });

  const onSubmit = (data: ProviderFormData) => {
    updateMutation.mutate(data);
  };

  const type = watch('type');

  if (isLoading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  if (!provider) {
    toast.error('Fournisseur non trouvé');
    router.push('/dashboard/providers');
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/providers/${id}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Modifier {provider.name}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations du fournisseur</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom *</Label>
                <Input
                  id="name"
                  {...register('name')}
                  placeholder="Orange Business Services"
                />
                {errors.name && (
                  <p className="text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <Select
                  value={type}
                  onValueChange={(value) => setValue('type', value as ProviderType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TELECOM">Télécom</SelectItem>
                    <SelectItem value="INTERNET">Internet</SelectItem>
                    <SelectItem value="CLOUD">Cloud</SelectItem>
                    <SelectItem value="HOSTING">Hébergement</SelectItem>
                    <SelectItem value="SECURITY">Sécurité</SelectItem>
                    <SelectItem value="NETWORK">Réseau</SelectItem>
                    <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                    <SelectItem value="ENERGY">Énergie</SelectItem>
                    <SelectItem value="CUSTOM">Personnalisé</SelectItem>
                    <SelectItem value="OTHER">Autre</SelectItem>
                  </SelectContent>
                </Select>
                {errors.type && (
                  <p className="text-sm text-red-600">{errors.type.message}</p>
                )}
              </div>
            </div>

            {/* Champ Type Personnalisé (affiché seulement si type=CUSTOM) */}
            {type === 'CUSTOM' && (
              <div className="space-y-2">
                <Label htmlFor="customType">Type personnalisé *</Label>
                <Input
                  id="customType"
                  {...register('customType')}
                  placeholder="Ex: Climatisation, Ascenseurs, Plomberie..."
                />
                {errors.customType && (
                  <p className="text-sm text-red-600">{errors.customType.message}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="contact">Contact</Label>
              <Input
                id="contact"
                {...register('contact')}
                placeholder="support@provider.com, +33 1 23 45 67 89"
              />
              {errors.contact && (
                <p className="text-sm text-red-600">{errors.contact.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                {...register('notes')}
                placeholder="Informations complémentaires sur le fournisseur..."
                rows={4}
              />
              {errors.notes && (
                <p className="text-sm text-red-600">{errors.notes.message}</p>
              )}
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
                onClick={() => router.push(`/dashboard/providers/${id}`)}
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
