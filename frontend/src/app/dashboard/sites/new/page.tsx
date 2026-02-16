'use client';

import { useState, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { sitesApi } from '@/lib/api/sites';
import { contactsApi, contactTypesApi } from '@/lib/api/contacts';
import { ArrowLeft, Plus, Trash2, ChevronRight, ChevronLeft, Check, MapPin, UserPlus, FolderOpen, Globe, FileText, Shield, Search, Users, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { Contact, ContactType, ContactCategory } from '@/types';
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

export default function NewSitePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [isChangingStep, setIsChangingStep] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const [serverInfo, setServerInfo] = useState({
    smbPath: '', sharepointUrl: '', gedUrl: '', accessRightsUrl: '', notes: ''
  });
  const [isGeocoding, setIsGeocoding] = useState(false);

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

  // Charger les types de contacts pour le filtre
  const { data: contactTypes } = useQuery<ContactType[]>({
    queryKey: ['contact-types'],
    queryFn: () => contactTypesApi.getAll(),
  });

  // State pour le dialog de sélection de contacts
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contactPickerSearch, setContactPickerSearch] = useState('');
  const [contactPickerCategory, setContactPickerCategory] = useState<string>('ALL');
  const [contactPickerType, setContactPickerType] = useState<string>('ALL');

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
    // Ne soumettre que si on est à la dernière étape ET qu'on a explicitement demandé la soumission
    if (currentStep !== STEPS.length || isChangingStep || !isSubmitting) {
      return;
    }

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

    // Build metadata with serverInfo
    const hasServerInfo = serverInfo.smbPath || serverInfo.sharepointUrl || serverInfo.gedUrl || serverInfo.accessRightsUrl || serverInfo.notes;

    const payload = {
      ...cleanedData,
      contacts: contacts.filter(c => c.name && c.email),
      accessNotes: (accessNotes.schedules || accessNotes.badges || accessNotes.procedures || accessNotes.safety)
        ? accessNotes
        : undefined,
      ...(hasServerInfo ? { metadata: { serverInfo } } : {}),
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
      setIsChangingStep(true);
      setCurrentStep(currentStep + 1);
      // Débloquer après 500ms pour permettre le rendu
      setTimeout(() => setIsChangingStep(false), 500);
    }
  };

  const handlePrevious = () => {
    setIsChangingStep(true);
    setCurrentStep(currentStep - 1);
    setTimeout(() => setIsChangingStep(false), 500);
  };

  const handleGeocode = async () => {
    const address = watch('address');
    const city = watch('city');
    const postalCode = watch('postalCode');

    if (!address && !city) {
      return; // Ne rien faire si pas d'adresse
    }

    setIsGeocoding(true);
    try {
      // Construire la requête de géocodage
      const query = [address, postalCode, city, 'France'].filter(Boolean).join(', ');
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
        {
          headers: {
            'User-Agent': 'XCH-App/1.0' // Nominatim requiert un User-Agent
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
      // Pas d'alerte, juste un log silencieux
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
    }, 1500); // Attendre 1.5s après la dernière frappe

    return () => clearTimeout(timeoutId);
  }, [watch('address'), watch('city'), watch('postalCode')]);

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

      {/* Steps indicator — cliquable, navigation libre */}
      <div className="flex items-center justify-center gap-4 mb-8">
        {STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <button
              type="button"
              onClick={() => setCurrentStep(step.id)}
              className="flex flex-col items-center group cursor-pointer"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                  currentStep === step.id
                    ? 'bg-blue-600 border-blue-600 text-white ring-2 ring-blue-200'
                    : 'bg-white border-gray-300 text-gray-500 group-hover:border-blue-400 group-hover:text-blue-600'
                }`}
              >
                <span className="text-sm font-semibold">{step.id}</span>
              </div>
              <div className="mt-2 text-center">
                <div className={`text-sm font-medium transition-colors ${
                  currentStep === step.id ? 'text-blue-700' : 'text-gray-500 group-hover:text-blue-600'
                }`}>
                  {step.name}
                </div>
                <div className="text-xs text-gray-400">{step.description}</div>
              </div>
            </button>
            {index < STEPS.length - 1 && (
              <div className="w-16 h-0.5 mx-4 bg-gray-200" />
            )}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[currentStep - 1].name}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit(onSubmit)}
            onKeyDown={(e) => {
              // Empêcher Enter de soumettre si pas à la dernière étape
              if (e.key === 'Enter' && currentStep !== STEPS.length) {
                e.preventDefault();
              }
            }}
            className="space-y-6"
          >
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
                      {errors.latitude && (
                        <p className="text-sm text-red-600">{errors.latitude.message}</p>
                      )}
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
                      {errors.longitude && (
                        <p className="text-sm text-red-600">{errors.longitude.message}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    💡 Les coordonnées GPS se remplissent automatiquement depuis l'adresse.
                    Vous pouvez les modifier manuellement ou cliquer sur "Actualiser GPS" pour forcer une nouvelle recherche.
                  </p>
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
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={() => setShowContactPicker(true)}
                        variant="outline"
                        size="sm"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Importer un contact
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <Link href="/dashboard/contacts/new" target="_blank">
                          <Plus className="h-4 w-4 mr-2" />
                          Créer
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>

                  {/* Liste des contacts ajoutés */}
                  <div className="space-y-3">
                    {contacts.map((contact, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                          <div>
                            <p className="text-sm font-medium">{contact.name || 'Sans nom'}</p>
                            {contact.company && (
                              <p className="text-xs text-muted-foreground">{contact.company}</p>
                            )}
                          </div>
                          <div>
                            {contact.role && (
                              <Badge variant="outline" className="text-xs">{contact.role}</Badge>
                            )}
                            {contact.category && (
                              <Badge
                                variant="secondary"
                                className={`text-xs ml-1 ${
                                  contact.category === 'INTERNAL' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                  contact.category === 'PROVIDER' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                  contact.category === 'PARTNER' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                                  contact.category === 'TECHNICAL' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                                  contact.category === 'EMERGENCY' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                  ''
                                }`}
                              >
                                {contact.category === 'INTERNAL' ? 'Interne' :
                                 contact.category === 'PROVIDER' ? 'Fournisseur' :
                                 contact.category === 'PARTNER' ? 'Partenaire' :
                                 contact.category === 'TECHNICAL' ? 'Technique' :
                                 contact.category === 'EMERGENCY' ? 'Urgence' :
                                 contact.category}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {contact.phone && <span>{contact.phone}</span>}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            {contact.email && <span>{contact.email}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="flex items-center gap-1.5">
                            <Checkbox
                              checked={contact.isPrimary}
                              onCheckedChange={(checked) => {
                                const updated = [...contacts];
                                updated[index].isPrimary = checked as boolean;
                                setContacts(updated);
                              }}
                            />
                            <span className="text-xs text-muted-foreground">Principal</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setContacts(contacts.filter((_, i) => i !== index))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {contacts.length === 0 && (
                      <div className="text-center py-8 border-2 border-dashed rounded-lg">
                        <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground mb-2">
                          Aucun contact associé à ce chantier
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowContactPicker(true)}
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Importer depuis le module Contacts
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dialog de sélection de contacts (style page Contacts) */}
                <Dialog open={showContactPicker} onOpenChange={setShowContactPicker}>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Importer des contacts
                      </DialogTitle>
                    </DialogHeader>

                    {/* Onglets catégories */}
                    <Tabs value={contactPickerCategory} onValueChange={(value) => {
                      setContactPickerCategory(value);
                      setContactPickerType('ALL');
                    }}>
                      <TabsList className="flex-wrap h-auto gap-1">
                        <TabsTrigger value="ALL">
                          <Users className="mr-1.5 h-3.5 w-3.5" />
                          Tous
                        </TabsTrigger>
                        <TabsTrigger value="PROVIDER">Fournisseurs</TabsTrigger>
                        <TabsTrigger value="INTERNAL">Internes</TabsTrigger>
                        <TabsTrigger value="PARTNER">Partenaires</TabsTrigger>
                        <TabsTrigger value="TECHNICAL">Technique</TabsTrigger>
                        <TabsTrigger value="EMERGENCY">Urgence</TabsTrigger>
                      </TabsList>
                    </Tabs>

                    {/* Recherche + filtre type */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Rechercher par nom, email ou entreprise..."
                          value={contactPickerSearch}
                          onChange={(e) => setContactPickerSearch(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <Select value={contactPickerType} onValueChange={setContactPickerType}>
                        <SelectTrigger className="w-full sm:w-[220px]">
                          <SelectValue placeholder="Type de contact" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">Tous les types</SelectItem>
                          {(contactTypes || [])
                            .filter(t => contactPickerCategory === 'ALL' || t.category === contactPickerCategory)
                            .map((type) => (
                              <SelectItem key={type.id} value={type.id}>
                                <div className="flex items-center gap-2">
                                  {type.color && (
                                    <span
                                      className="inline-block w-2.5 h-2.5 rounded-full"
                                      style={{ backgroundColor: type.color }}
                                    />
                                  )}
                                  {type.name}
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Tableau de contacts */}
                    <div className="flex-1 overflow-y-auto border rounded-lg">
                      {(() => {
                        const searchLower = contactPickerSearch.toLowerCase();
                        const filtered = (allContacts || []).filter((c) => {
                          const matchesSearch = !searchLower ||
                            c.name.toLowerCase().includes(searchLower) ||
                            c.email?.toLowerCase().includes(searchLower) ||
                            c.company?.toLowerCase().includes(searchLower);
                          const matchesCategory =
                            contactPickerCategory === 'ALL' || c.type?.category === contactPickerCategory;
                          const matchesType =
                            contactPickerType === 'ALL' || c.typeId === contactPickerType;
                          const alreadyAdded = contacts.some(
                            (sc) => sc.name === c.name && sc.email === c.email
                          );
                          return matchesSearch && matchesCategory && matchesType && !alreadyAdded;
                        });

                        if (filtered.length === 0) {
                          return (
                            <div className="text-center py-8">
                              <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                              <p className="text-sm text-muted-foreground">Aucun contact trouvé</p>
                              {contactPickerSearch && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Essayez de modifier vos filtres de recherche
                                </p>
                              )}
                            </div>
                          );
                        }

                        return (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Nom</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Entreprise</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Téléphone</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filtered.map((c) => (
                                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50">
                                  <TableCell className="font-medium">{c.name}</TableCell>
                                  <TableCell>
                                    <Badge
                                      className="whitespace-nowrap text-xs"
                                      style={
                                        c.type?.color
                                          ? {
                                              backgroundColor: `${c.type.color}20`,
                                              color: c.type.color,
                                              borderColor: `${c.type.color}40`,
                                            }
                                          : undefined
                                      }
                                      variant={c.type?.color ? 'outline' : 'secondary'}
                                    >
                                      {c.type?.name || 'Non défini'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground text-sm">
                                    {c.company || '-'}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground text-sm">
                                    {c.email || '-'}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground text-sm">
                                    {c.phone || c.mobile || '-'}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setContacts([...contacts, {
                                          name: c.name,
                                          role: c.role || c.type?.name || '',
                                          phone: c.phone || c.mobile || '',
                                          email: c.email || '',
                                          company: c.company || '',
                                          isPrimary: false,
                                          category: c.type?.category || undefined,
                                        }]);
                                        toast.success(`Contact "${c.name}" ajouté`);
                                      }}
                                    >
                                      <Plus className="h-3.5 w-3.5 mr-1" />
                                      Ajouter
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        );
                      })()}
                    </div>

                    {/* Footer avec lien vers création */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        asChild
                        className="text-muted-foreground"
                      >
                        <Link href="/dashboard/contacts/new" target="_blank">
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Créer un nouveau contact
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowContactPicker(false);
                          setContactPickerSearch('');
                          setContactPickerCategory('ALL');
                          setContactPickerType('ALL');
                        }}
                      >
                        Fermer
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

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
                  <Button
                    type="button"
                    onClick={() => {
                      setIsSubmitting(true);
                      handleSubmit(onSubmit)();
                    }}
                    disabled={createMutation.isPending}
                  >
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
