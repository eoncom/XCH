'use client';

import { use, useState, useEffect } from 'react';
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
import { contactsApi } from '@/lib/api/contacts';
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, MapPin, UserPlus, FolderOpen, Globe, FileText, Shield } from 'lucide-react';
import Link from 'next/link';
import type { Site, SiteContact, Contact } from '@/types';
import { toast } from 'sonner';

// Types de connexion disponibles
const CONNECTIVITY_TYPES = [
  'Fibre optique',
  '4G',
  '5G',
  'ADSL',
  'VDSL',
  'Satellite',
  'Radio',
  'Autre',
];

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

export default function EditSitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [isChangingStep, setIsChangingStep] = useState(false);

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
    trigger,
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

  const [contacts, setContacts] = useState<SiteContact[]>(site?.contacts || []);
  const [accessNotes, setAccessNotes] = useState(site?.accessNotes || {
    schedules: '', badges: '', procedures: '', safety: ''
  });
  const [serverInfo, setServerInfo] = useState(site?.metadata?.serverInfo || {
    smbPath: '', sharepointUrl: '', gedUrl: '', accessRightsUrl: '', notes: ''
  });
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Update serverInfo state when site data loads
  useEffect(() => {
    if (site?.metadata?.serverInfo) {
      setServerInfo(site.metadata.serverInfo);
    }
  }, [site]);

  // Charger les contacts de catégorie PROVIDER pour les opérateurs
  const { data: providerContacts } = useQuery<Contact[]>({
    queryKey: ['contacts', { category: 'PROVIDER' }],
    queryFn: () => contactsApi.getAll({ category: 'PROVIDER' }),
  });

  // Charger tous les contacts pour l'étape 3
  const { data: allContacts } = useQuery<Contact[]>({
    queryKey: ['contacts'],
    queryFn: () => contactsApi.getAll(),
  });

  const updateMutation = useMutation({
    mutationFn: (data: SiteFormData) => sitesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site', id] });
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      toast.success('Chantier mis à jour avec succès');
      router.push(`/dashboard/sites/${id}`);
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de la mise à jour: ${error.message}`);
    },
  });

  const nextStep = async () => {
    setIsChangingStep(true);

    let fieldsToValidate: (keyof SiteFormData)[] = [];

    if (currentStep === 1) {
      fieldsToValidate = ['code', 'name', 'status', 'address', 'city', 'postalCode', 'latitude', 'longitude'];
    }

    const isValid = await trigger(fieldsToValidate);
    if (isValid) {
      setCurrentStep(currentStep + 1);
    }

    setIsChangingStep(false);
  };

  const prevStep = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleGeocode = async () => {
    const address = watch('address');
    const city = watch('city');
    const postalCode = watch('postalCode');

    if (!address && !city) {
      return;
    }

    setIsGeocoding(true);
    try {
      const query = [address, postalCode, city, 'France'].filter(Boolean).join(', ');
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
        {
          headers: {
            'User-Agent': 'XCH-App/1.0'
          }
        }
      );

      const data = await response.json();

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setValue('latitude', lat);
        setValue('longitude', lon);
        toast.success(`📍 GPS : ${lat.toFixed(6)}, ${lon.toFixed(6)}`);
      }
    } catch (error) {
      console.error('Erreur géocodage:', error);
    } finally {
      setIsGeocoding(false);
    }
  };

  // Auto-géocodage quand l'adresse change (debounce 1.5s)
  useEffect(() => {
    const address = watch('address');
    const city = watch('city');
    const postalCode = watch('postalCode');

    if (!address && !city) return;

    const timeoutId = setTimeout(() => {
      handleGeocode();
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [watch('address'), watch('city'), watch('postalCode')]);

  const onSubmit = (data: SiteFormData) => {
    // Ne soumettre que si on est à la dernière étape ET qu'on n'est pas en train de changer d'étape
    if (currentStep !== STEPS.length || isChangingStep) {
      return;
    }

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

    // Build metadata with serverInfo
    const hasServerInfo = serverInfo.smbPath || serverInfo.sharepointUrl || serverInfo.gedUrl || serverInfo.accessRightsUrl || serverInfo.notes;
    const metadata = hasServerInfo
      ? { ...(site?.metadata || {}), serverInfo }
      : site?.metadata || undefined;

    const payload = {
      ...cleanedData,
      contacts: contacts.filter(c => c.name && c.email),
      accessNotes,
      ...(metadata ? { metadata } : {}),
    };
    updateMutation.mutate(payload);
  };

  const status = watch('status');

  if (isLoading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  if (!site) {
    toast.error('Chantier non trouvé');
    router.push('/dashboard/sites');
    return null;
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

      {/* Progress Indicator */}
      <div className="flex items-center justify-center gap-4">
        {STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                  currentStep > step.id
                    ? 'bg-green-600 border-green-600 text-white'
                    : currentStep === step.id
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-gray-300 text-gray-400'
                }`}
              >
                {currentStep > step.id ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <span>{step.id}</span>
                )}
              </div>
              <div className="mt-2 text-center">
                <div className={`text-sm font-medium ${currentStep >= step.id ? 'text-gray-900' : 'text-gray-400'}`}>
                  {step.name}
                </div>
                <div className="text-xs text-gray-500">{step.description}</div>
              </div>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={`w-16 h-0.5 mx-4 transition-colors ${
                  currentStep > step.id ? 'bg-green-600' : 'bg-gray-300'
                }`}
              />
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
            {/* Étape 1: Informations de base */}
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
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Coordonnées GPS</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleGeocode}
                      disabled={isGeocoding}
                    >
                      <MapPin className="h-4 w-4 mr-2" />
                      {isGeocoding ? 'Recherche...' : '🔄 Actualiser GPS'}
                    </Button>
                  </div>
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
                  <p className="text-sm text-muted-foreground">
                    💡 Les coordonnées GPS se mettent à jour automatiquement quand vous modifiez l'adresse.
                    Vous pouvez les corriger manuellement ou cliquer sur "Actualiser GPS".
                  </p>
                </div>
              </div>
            )}

            {/* Étape 2: Connectivité */}
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
                      <Select
                        value={watch('connectivity.primary.type') || ''}
                        onValueChange={(value) => setValue('connectivity.primary.type', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un type" />
                        </SelectTrigger>
                        <SelectContent>
                          {CONNECTIVITY_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="connectivity.primary.provider">Opérateur</Label>
                      <Select
                        value={watch('connectivity.primary.provider') || ''}
                        onValueChange={(value) => setValue('connectivity.primary.provider', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un opérateur" />
                        </SelectTrigger>
                        <SelectContent>
                          {(providerContacts || []).map((contact) => (
                            <SelectItem key={contact.id} value={contact.name}>
                              {contact.name}{contact.company ? ` (${contact.company})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                      <Select
                        value={watch('connectivity.backup.type') || ''}
                        onValueChange={(value) => setValue('connectivity.backup.type', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un type" />
                        </SelectTrigger>
                        <SelectContent>
                          {CONNECTIVITY_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.connectivity?.backup?.type && (
                        <p className="text-sm text-red-600">
                          {errors.connectivity.backup.type.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="connectivity.backup.provider">Opérateur</Label>
                      <Select
                        value={watch('connectivity.backup.provider') || ''}
                        onValueChange={(value) => setValue('connectivity.backup.provider', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un opérateur" />
                        </SelectTrigger>
                        <SelectContent>
                          {(providerContacts || []).map((contact) => (
                            <SelectItem key={contact.id} value={contact.name}>
                              {contact.name}{contact.company ? ` (${contact.company})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
            )}

            {/* Étape 3: Contacts & Accès */}
            {currentStep === 3 && (
              <div className="space-y-6">
                {/* Contacts */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Contacts</h3>
                    <div className="flex gap-2">
                      <Select
                        value=""
                        onValueChange={(contactId) => {
                          const existing = allContacts?.find(c => c.id === contactId);
                          if (existing) {
                            setContacts([...contacts, {
                              name: existing.name,
                              role: existing.role || existing.type?.name || '',
                              phone: existing.phone || existing.mobile || '',
                              email: existing.email || '',
                              company: existing.company || '',
                              isPrimary: false,
                              category: existing.type?.category || undefined,
                            }]);
                            toast.success(`Contact "${existing.name}" ajouté`);
                          }
                        }}
                      >
                        <SelectTrigger className="w-[220px]">
                          <div className="flex items-center gap-2">
                            <UserPlus className="h-4 w-4" />
                            <span className="text-muted-foreground">Importer un contact...</span>
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {(allContacts || []).map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}{c.company ? ` - ${c.company}` : ''}{c.role ? ` (${c.role})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        onClick={() => setContacts([...contacts, { name: '', role: '', phone: '', email: '', isPrimary: false }])}
                        variant="outline"
                        size="sm"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Manuel
                      </Button>
                    </div>
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
                          value={contact.role || ''}
                          onChange={(e) => {
                            const updated = [...contacts];
                            updated[index].role = e.target.value;
                            setContacts(updated);
                          }}
                        />
                        <Input
                          placeholder="Téléphone"
                          className="col-span-2"
                          value={contact.phone || ''}
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
                          value={contact.email || ''}
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

                {/* Serveurs & Données de production */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Serveurs & Données de production</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="serverInfo.smbPath" className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        Chemin SMB
                      </Label>
                      <Input
                        id="serverInfo.smbPath"
                        placeholder="\\\\server\\share"
                        value={serverInfo.smbPath}
                        onChange={(e) => setServerInfo({...serverInfo, smbPath: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="serverInfo.sharepointUrl" className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        URL SharePoint
                      </Label>
                      <Input
                        id="serverInfo.sharepointUrl"
                        placeholder="https://company.sharepoint.com/sites/..."
                        value={serverInfo.sharepointUrl}
                        onChange={(e) => setServerInfo({...serverInfo, sharepointUrl: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="serverInfo.gedUrl" className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        URL GED
                      </Label>
                      <Input
                        id="serverInfo.gedUrl"
                        placeholder="https://ged.example.com/..."
                        value={serverInfo.gedUrl}
                        onChange={(e) => setServerInfo({...serverInfo, gedUrl: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="serverInfo.accessRightsUrl" className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        URL droits d'accès serveur
                      </Label>
                      <Input
                        id="serverInfo.accessRightsUrl"
                        placeholder="https://..."
                        value={serverInfo.accessRightsUrl}
                        onChange={(e) => setServerInfo({...serverInfo, accessRightsUrl: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="serverInfo.notes" className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        Notes serveur
                      </Label>
                      <Textarea
                        id="serverInfo.notes"
                        placeholder="Informations complémentaires..."
                        rows={3}
                        value={serverInfo.notes}
                        onChange={(e) => setServerInfo({...serverInfo, notes: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-6 border-t">
              <div>
                {currentStep > 1 && (
                  <Button type="button" variant="outline" onClick={prevStep}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Précédent
                  </Button>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/dashboard/sites/${id}`)}
                >
                  Annuler
                </Button>

                {currentStep < STEPS.length ? (
                  <Button type="button" onClick={nextStep}>
                    Suivant
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleSubmit(onSubmit)}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
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
