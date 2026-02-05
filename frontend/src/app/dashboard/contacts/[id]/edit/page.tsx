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
import { Badge } from '@/components/ui/badge';
import { contactsApi, contactTypesApi } from '@/lib/api/contacts';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { Contact, ContactType, ContactCategory } from '@/types';
import { toast } from 'sonner';

const categoryLabels: Record<ContactCategory, string> = {
  PROVIDER: 'Fournisseur',
  INTERNAL: 'Interne',
  PARTNER: 'Partenaire',
  TECHNICAL: 'Technique',
  EMERGENCY: 'Urgence',
};

const categoryColors: Record<ContactCategory, string> = {
  PROVIDER: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  INTERNAL: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  PARTNER: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  TECHNICAL: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  EMERGENCY: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const contactSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(100, 'Le nom ne peut pas depasser 100 caracteres'),
  typeId: z.string().min(1, 'Le type est requis'),
  email: z.string().email('Email invalide').max(200).optional().or(z.literal('')),
  phone: z.string().max(30, 'Le telephone ne peut pas depasser 30 caracteres').optional().or(z.literal('')),
  mobile: z.string().max(30, 'Le mobile ne peut pas depasser 30 caracteres').optional().or(z.literal('')),
  company: z.string().max(200, 'L\'entreprise ne peut pas depasser 200 caracteres').optional().or(z.literal('')),
  role: z.string().max(100, 'Le role ne peut pas depasser 100 caracteres').optional().or(z.literal('')),
  notes: z.string().max(1000, 'Les notes ne peuvent pas depasser 1000 caracteres').optional().or(z.literal('')),
});

type ContactFormData = z.infer<typeof contactSchema>;

export default function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: contact, isLoading } = useQuery<Contact>({
    queryKey: ['contact', id],
    queryFn: () => contactsApi.getById(id),
  });

  const { data: contactTypes } = useQuery<ContactType[]>({
    queryKey: ['contact-types'],
    queryFn: () => contactTypesApi.getAll({ isActive: true }),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    values: contact
      ? {
          name: contact.name,
          typeId: contact.typeId,
          email: contact.email || '',
          phone: contact.phone || '',
          mobile: contact.mobile || '',
          company: contact.company || '',
          role: contact.role || '',
          notes: contact.notes || '',
        }
      : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: (data: ContactFormData) => {
      const cleaned = {
        name: data.name,
        typeId: data.typeId,
        email: data.email || undefined,
        phone: data.phone || undefined,
        mobile: data.mobile || undefined,
        company: data.company || undefined,
        role: data.role || undefined,
        notes: data.notes || undefined,
      };
      return contactsApi.update(id, cleaned);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', id] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact mis a jour avec succes');
      router.push(`/dashboard/contacts/${id}`);
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de la mise a jour: ${error.message}`);
    },
  });

  const onSubmit = (data: ContactFormData) => {
    updateMutation.mutate(data);
  };

  const typeId = watch('typeId');
  const selectedType = contactTypes?.find((t) => t.id === typeId);

  if (isLoading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  if (!contact) {
    toast.error('Contact non trouve');
    router.push('/dashboard/contacts');
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/contacts/${id}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Modifier {contact.name}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations du contact</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom *</Label>
                <Input
                  id="name"
                  {...register('name')}
                  placeholder="Jean Dupont"
                />
                {errors.name && (
                  <p className="text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="typeId">Type *</Label>
                <Select
                  value={typeId}
                  onValueChange={(value) => setValue('typeId', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selectionner un type" />
                  </SelectTrigger>
                  <SelectContent>
                    {contactTypes?.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        <div className="flex items-center gap-2">
                          {type.color && (
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: type.color }}
                            />
                          )}
                          <span>{type.name}</span>
                          <Badge
                            className={`ml-1 text-[10px] px-1.5 py-0 ${categoryColors[type.category]}`}
                          >
                            {categoryLabels[type.category]}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.typeId && (
                  <p className="text-sm text-red-600">{errors.typeId.message}</p>
                )}
                {selectedType && (
                  <p className="text-xs text-muted-foreground">
                    Categorie : {categoryLabels[selectedType.category]}
                  </p>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...register('email')}
                  placeholder="jean.dupont@entreprise.fr"
                />
                {errors.email && (
                  <p className="text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">Entreprise</Label>
                <Input
                  id="company"
                  {...register('company')}
                  placeholder="Nom de l'entreprise"
                />
                {errors.company && (
                  <p className="text-sm text-red-600">{errors.company.message}</p>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Telephone fixe</Label>
                <Input
                  id="phone"
                  {...register('phone')}
                  placeholder="+33 1 23 45 67 89"
                />
                {errors.phone && (
                  <p className="text-sm text-red-600">{errors.phone.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile</Label>
                <Input
                  id="mobile"
                  {...register('mobile')}
                  placeholder="+33 6 12 34 56 78"
                />
                {errors.mobile && (
                  <p className="text-sm text-red-600">{errors.mobile.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role / Fonction</Label>
                <Input
                  id="role"
                  {...register('role')}
                  placeholder="Responsable technique"
                />
                {errors.role && (
                  <p className="text-sm text-red-600">{errors.role.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                {...register('notes')}
                placeholder="Informations complementaires sur le contact..."
                rows={4}
              />
              {errors.notes && (
                <p className="text-sm text-red-600">{errors.notes.message}</p>
              )}
            </div>

            {Object.keys(errors).length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm text-red-800 font-medium">Erreurs de validation :</p>
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
                onClick={() => router.push(`/dashboard/contacts/${id}`)}
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
