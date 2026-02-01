'use client';

import { useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { sitesApi } from '@/lib/api/sites';
import { ArrowLeft, Plus, Trash2, ChevronRight, ChevronLeft, Check } from 'lucide-react';
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

const STEPS = [
  { id: 1, name: 'Informations de base', description: 'Code, nom, adresse' },
  { id: 2, name: 'Connectivité', description: 'Liaisons réseau' },
  { id: 3, name: 'Contacts & Accès', description: 'Contacts et notes d\'accès' },
];

export default function NewSitePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    trigger,
  } = useForm<SiteFormData>({
    resolver: zodResolver(siteSchema),
    mode: 'onChange',
    defaultValues: {
      status: 'ACTIVE',
      connectivity: {
        primary: { type: '', provider: '', ref: '' },
        backup: { type: '', provider: '', ref: '' },
        cutProcedure: '',
      },
    },
  });

  const [contacts, setContacts] = useState<Array<{name: string; role: string; phone: string; email: string; isPrimary: boolean}>>([]);
  const [accessNotes, setAccessNotes] = useState({
    schedules: '',
    badges: '',
    procedures: '',
    safety: '',
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
      if (
        !cleanedData.connectivity.primary?.type &&
        !cleanedData.connectivity.primary?.provider &&
        !cleanedData.connectivity.primary?.ref
      ) {
        delete cleanedData.connectivity.primary;
      }

      if (
        !cleanedData.connectivity.backup?.type &&
        !cleanedData.connectivity.backup?.provider &&
        !cleanedData.connectivity.backup?.ref
      ) {
        delete cleanedData.connectivity.backup;
      }

      if (!cleanedData.connectivity.cutProcedure) {
        delete cleanedData.connectivity.cutProcedure;
      }

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
      accessNotes: (accessNotes.schedules || accessNotes.badges || accessNotes.procedures || accessNotes.safety)
        ? accessNotes
        : undefined,
    };

    createMutation.mutate(payload);
  };

  const handleNext = async () => {
    let fieldsToValidate: Array<keyof SiteFormData> = [];

    if (currentStep === 1) {
      fieldsToValidate = ['code', 'name', 'status', 'address', 'city', 'postalCode', 'latitude', 'longitude'];
    }

    const isValid = await trigger(fieldsToValidate);

    if (isValid) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentStep(currentStep - 1);
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

      {/* Steps indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                currentStep > step.id
                  ? 'bg-green-500 border-green-500 text-white'
                  : currentStep === step.id
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'bg-gray-200 border-gray-300 text-gray-500'
              }`}>
                {currentStep > step.id ? <Check className="h-5 w-5" /> : step.id}
              </div>
              <div className="mt-2 text-center">
                <p className={`text-sm font-medium ${currentStep === step.id ? 'text-blue-600' : 'text-gray-500'}`}>
                  {step.name}
                </p>
                <p className="text-xs text-gray-400">{step.description}</p>
              </div>
            </div>
            {index < STEPS.length - 1 && (
              <div className={`w-20 h-1 mx-2 ${currentStep > step.id ? 'bg-green-500' : 'bg-gray-300'}`} />
            )}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[currentStep - 1].name}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* STEP 1: Informations de base */}
            {currentStep === 1 && (
              <div className="space-y-6">
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
              </div>
            )}

            {/* STEP 2: Connectivité */}
            {currentStep === 2 && (
              <div className="space-y-6">
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
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="connectivity.primary.provider">Opérateur</Label>
                      <Input
                        id="connectivity.primary.provider"
                        {...register('connectivity.primary.provider')}
                        placeholder="Ex: Orange Business"
                        maxLength={100}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="connectivity.primary.ref">Référence Contrat</Label>
                      <Input
                        id="connectivity.primary.ref"
                        {...register('connectivity.primary.ref')}
                        placeholder="Ex: CTR-2024-0001"
                        maxLength={100}
                      />
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
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="connectivity.backup.provider">Opérateur</Label>
                      <Input
                        id="connectivity.backup.provider"
                        {...register('connectivity.backup.provider')}
                        placeholder="Ex: SFR Business"
                        maxLength={100}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="connectivity.backup.ref">Référence Contrat</Label>
                      <Input
                        id="connectivity.backup.ref"
                        {...register('connectivity.backup.ref')}
                        placeholder="Ex: CTR-2024-0002"
                        maxLength={100}
                      />
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
                </div>
              </div>
            )}

            {/* STEP 3: Contacts & Accès */}
            {currentStep === 3 && (
              <div className="space-y-6">
                {/* Contacts */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Contacts</h3>
                    <Button
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

                {/* Access Notes */}
                <div className="border-t pt-6">
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
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex justify-between pt-6 border-t">
              <div>
                {currentStep > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrevious}
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Précédent
                  </Button>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/dashboard/sites')}
                >
                  Annuler
                </Button>

                {currentStep < STEPS.length ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                  >
                    Suivant
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Création...' : 'Créer le chantier'}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
