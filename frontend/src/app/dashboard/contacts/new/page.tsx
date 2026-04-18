// @ts-nocheck - Temporary fix for Radix UI + React 19 type incompatibility
'use client';

import { useState } from 'react';
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
import { ScopeSelector, type ScopeValue } from '@/components/ui/scope-selector';
import { ArrowLeft, Info } from 'lucide-react';
import Link from 'next/link';
import type { ContactType, ContactCategory } from '@/types';
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
  name: z.string().min(1, 'Le nom est requis').max(100, 'Le nom ne peut pas dépasser 100 caractères'),
  typeId: z.string().min(1, 'Le type est requis'),
  email: z.string().email('Email invalide').max(200).optional().or(z.literal('')),
  phone: z.string().max(30, 'Le téléphone ne peut pas dépasser 30 caractères').optional().or(z.literal('')),
  mobile: z.string().max(30, 'Le mobile ne peut pas dépasser 30 caractères').optional().or(z.literal('')),
  address: z.string().max(500, 'L\'adresse ne peut pas dépasser 500 caractères').optional().or(z.literal('')),
  company: z.string().max(200, 'L\'entreprise ne peut pas dépasser 200 caractères').optional().or(z.literal('')),
  role: z.string().max(100, 'Le rôle ne peut pas dépasser 100 caractères').optional().or(z.literal('')),
  notes: z.string().max(1000, 'Les notes ne peuvent pas dépasser 1000 caractères').optional().or(z.literal('')),
});

type ContactFormData = z.infer<typeof contactSchema>;

export default function NewContactPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<ScopeValue>({ delegationId: null, siteId: null });

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
    defaultValues: {
      name: '',
      typeId: '',
      email: '',
      phone: '',
      mobile: '',
      address: '',
      company: '',
      role: '',
      notes: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: ContactFormData) => {
      const cleaned = {
        name: data.name,
        typeId: data.typeId,
        email: data.email || undefined,
        phone: data.phone || undefined,
        mobile: data.mobile || undefined,
        address: data.address || undefined,
        company: data.company || undefined,
        role: data.role || undefined,
        notes: data.notes || undefined,
        delegationId: scope.delegationId || undefined,
        siteId: scope.siteId || undefined,
      };
      return contactsApi.create(cleaned);
    },
    onSuccess: (contact) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact créé avec succès');
      router.push(`/dashboard/contacts/${contact.id}`);
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de la création : ${error.message}`);
    },
  });

  const onSubmit = (data: ContactFormData) => {
    createMutation.mutate(data);
  };

  const typeId = watch('typeId');
  const selectedType = contactTypes?.find((t) => t.id === typeId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/contacts">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Nouveau contact</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Section 1: Identité (obligatoire) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Identité
              <span className="text-xs font-normal text-red-500 bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded">Obligatoire</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom <span className="text-red-500">*</span></Label>
                <Input id="name" {...register('name')} placeholder="Jean Dupont" />
                {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="typeId">Type <span className="text-red-500">*</span></Label>
                <Select value={typeId} onValueChange={(value) => setValue('typeId', value)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un type" /></SelectTrigger>
                  <SelectContent>
                    {contactTypes?.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        <div className="flex items-center gap-2">
                          {type.color && (
                            <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: type.color }} />
                          )}
                          <span>{type.name}</span>
                          <Badge className={`ml-1 text-[10px] px-1.5 py-0 ${categoryColors[type.category]}`}>
                            {categoryLabels[type.category]}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.typeId && <p className="text-sm text-red-600">{errors.typeId.message}</p>}
                {selectedType && (
                  <p className="text-xs text-muted-foreground">Catégorie : {categoryLabels[selectedType.category]}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Coordonnées (optionnel) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Coordonnées
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">Optionnel</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register('email')} placeholder="jean.dupont@entreprise.fr" />
                {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone fixe</Label>
                <Input id="phone" {...register('phone')} placeholder="+33 1 23 45 67 89" />
                {errors.phone && <p className="text-sm text-red-600">{errors.phone.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile</Label>
                <Input id="mobile" {...register('mobile')} placeholder="+33 6 12 34 56 78" />
                {errors.mobile && <p className="text-sm text-red-600">{errors.mobile.message}</p>}
              </div>
            </div>
            <div className="space-y-2 mt-4">
              <Label htmlFor="address">Adresse</Label>
              <Textarea id="address" {...register('address')} placeholder="Adresse postale complète" rows={2} />
              {errors.address && <p className="text-sm text-red-600">{errors.address.message}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Portée organisationnelle */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Portée organisationnelle
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">Optionnel</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScopeSelector
              value={scope}
              onChange={setScope}
              label=""
            />
            <p className="text-xs text-muted-foreground mt-2">
              Sans rattachement, le contact est visible par tout le tenant (global).
            </p>
          </CardContent>
        </Card>

        {/* Section 4: Informations professionnelles (optionnel) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Informations professionnelles
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">Optionnel</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company">Entreprise</Label>
                <Input id="company" {...register('company')} placeholder="Nom de l'entreprise" />
                {errors.company && <p className="text-sm text-red-600">{errors.company.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Rôle / Fonction</Label>
                <Input id="role" {...register('role')} placeholder="Responsable technique" />
                {errors.role && <p className="text-sm text-red-600">{errors.role.message}</p>}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" {...register('notes')} placeholder="Informations complémentaires sur le contact..." rows={4} />
                {errors.notes && <p className="text-sm text-red-600">{errors.notes.message}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Info className="h-4 w-4" />
            Les champs marqués <span className="text-red-500">*</span> sont obligatoires
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => router.push('/dashboard/contacts')}>Annuler</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Création...' : 'Créer le contact'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
