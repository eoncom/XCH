'use client';

import { use, useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { sitesApi } from '@/lib/api/sites';
import { AccessGate } from '@/components/AccessGate';
import { assetsApi } from '@/lib/api/assets';
import { tasksApi } from '@/lib/api/tasks';
import { contactsApi, contactTypesApi } from '@/lib/api/contacts';
import { organizationApi } from '@/lib/api/organization';
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, MapPin, UserPlus, FolderOpen, Globe, FileText, Shield, Search, Users, ExternalLink, Wifi, Network } from 'lucide-react';
import Link from 'next/link';
import type { Site, SiteContact, Contact, ContactType, ContactCategory, Asset, ConnectivityLink, SdwanConfig } from '@/types';
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
  delegationId: z.string().min(1, 'La délégation est requise'),
  code: z.string().min(1, 'Le code est requis'),
  name: z.string().min(1, 'Le nom est requis'),
  status: z.enum(['PREPARATION', 'ACTIVE', 'CLOSED']),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
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
  cutProcedure: z.string().max(2000, 'Max 2000 caractères').optional().or(z.literal('')),
});

type SiteFormData = z.infer<typeof siteSchema>;

const STEPS = [
  { id: 1, name: 'Informations de base', description: 'Code, nom, adresse' },
  { id: 2, name: 'Connectivité', description: 'Liaisons réseau' },
  { id: 3, name: 'Contacts & Accès', description: 'Contacts et notes d\'accès' },
];

export default function EditSitePageWrapper({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <AccessGate
      required="write"
      title="Accès refusé"
      description="La modification de site requiert un droit WRITE ou MANAGE sur la délégation propriétaire. Seuls les éditeurs, administrateurs et super administrateurs peuvent accéder à ce formulaire."
    >
      <Suspense fallback={<div className="text-center py-12">Chargement...</div>}>
        <EditSitePage params={params} />
      </Suspense>
    </AccessGate>
  );
}

function EditSitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const initialStep = (() => {
    const stepParam = searchParams.get('step');
    if (stepParam) {
      const n = parseInt(stepParam, 10);
      if (n >= 1 && n <= STEPS.length) return n;
    }
    return 1;
  })();
  const [currentStep, setCurrentStep] = useState(initialStep);
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
          delegationId: site.delegationId || '',
          code: site.code,
          name: site.name,
          status: site.status,
          address: site.address || '',
          city: site.city || '',
          postalCode: site.postalCode || '',
          country: site.country || '',
          notes: site.notes || '',
          latitude: site.latitude,
          longitude: site.longitude,
          cutProcedure: site.connectivity?.cutProcedure || '',
        }
      : undefined,
  });

  // V2 connectivity state (links + SD-WAN) managed outside react-hook-form
  const initLinks = (): ConnectivityLink[] => {
    const conn = site?.connectivity;
    if (!conn) return [];
    if (Array.isArray(conn.links)) return conn.links;
    return [];
  };

  const initSdwan = (): SdwanConfig => {
    if (site?.connectivity?.sdwan) return site.connectivity.sdwan;
    return { enabled: false, firewallIds: [] };
  };

  const [connectivityLinks, setConnectivityLinks] = useState<ConnectivityLink[]>(initLinks());
  const [sdwan, setSdwan] = useState<SdwanConfig>(initSdwan());

  // Load site assets for equipment association
  const { data: siteAssets } = useQuery<Asset[]>({
    queryKey: ['assets', { siteId: id }],
    queryFn: () => assetsApi.getAll({ siteId: id }),
    enabled: !!id,
  });

  // Re-initialize when site loads
  useEffect(() => {
    if (site) {
      setConnectivityLinks(initLinks());
      setSdwan(initSdwan());
    }
  }, [site?.id]);

  const networkAssets = (siteAssets || []).filter(a =>
    ['ROUTER', 'FIREWALL', 'BOX_5G', 'SWITCH'].includes(a.type)
  );
  const firewallAssets = (siteAssets || []).filter(a => a.type === 'FIREWALL');

  const addLink = () => {
    const hasP = connectivityLinks.some(l => l.role === 'primary');
    setConnectivityLinks([...connectivityLinks, {
      id: crypto.randomUUID(),
      role: hasP ? 'backup' : 'primary',
    }]);
  };

  const removeLink = (linkId: string) => {
    setConnectivityLinks(connectivityLinks.filter(l => l.id !== linkId));
  };

  const updateLink = (linkId: string, field: keyof ConnectivityLink, value: any) => {
    setConnectivityLinks(connectivityLinks.map(l =>
      l.id === linkId ? { ...l, [field]: value } : l
    ));
  };

  const [contacts, setContacts] = useState<SiteContact[]>(site?.contacts || []);
  const [accessNotes, setAccessNotes] = useState(site?.accessNotes || {
    schedules: '', badges: '', procedures: '', safety: ''
  });
  const [serverInfo, setServerInfo] = useState(site?.metadata?.serverInfo || {
    smbPath: '', sharepointUrl: '', gedUrl: '', accessRightsUrl: '', notes: ''
  });
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Close site warning dialog state
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [closeWarningInfo, setCloseWarningInfo] = useState<{ activeAssets: number; openTasks: number }>({ activeAssets: 0, openTasks: 0 });
  const [pendingSubmitData, setPendingSubmitData] = useState<any>(null);

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

  const updateMutation = useMutation({
    mutationFn: (data: SiteFormData) => sitesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site', id] });
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      toast.success('Site mis à jour avec succès');
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
      fieldsToValidate = ['code', 'name', 'status', 'address', 'city', 'postalCode', 'country', 'notes', 'latitude', 'longitude'];
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

  const buildPayload = (data: SiteFormData) => {
    const cleanedData = { ...data };

    // Build V2 connectivity
    const cleanedLinks = connectivityLinks.filter(l =>
      l.type || l.provider || l.ref || l.bandwidth || l.assetId
    );
    const connectivity: any = {};
    if (cleanedLinks.length > 0) connectivity.links = cleanedLinks;
    if (sdwan.enabled) connectivity.sdwan = sdwan;
    if (cleanedData.cutProcedure) connectivity.cutProcedure = cleanedData.cutProcedure;
    delete (cleanedData as any).cutProcedure;

    // Build metadata with serverInfo
    const hasServerInfo = serverInfo.smbPath || serverInfo.sharepointUrl || serverInfo.gedUrl || serverInfo.accessRightsUrl || serverInfo.notes;
    const metadata = hasServerInfo
      ? { ...(site?.metadata || {}), serverInfo }
      : site?.metadata || undefined;

    return {
      ...cleanedData,
      connectivity: Object.keys(connectivity).length > 0 ? connectivity : undefined,
      contacts: contacts.filter(c => c.name && c.email),
      accessNotes,
      ...(metadata ? { metadata } : {}),
    };
  };

  const confirmCloseAndSubmit = () => {
    if (pendingSubmitData) {
      updateMutation.mutate(pendingSubmitData);
      setPendingSubmitData(null);
    }
    setShowCloseWarning(false);
  };

  const onSubmit = async (data: SiteFormData) => {
    // Ne soumettre que si on est à la dernière étape ET qu'on n'est pas en train de changer d'étape
    if (currentStep !== STEPS.length || isChangingStep) {
      return;
    }

    const payload = buildPayload(data);

    // Check if status is being changed to CLOSED
    const isClosing = data.status === 'CLOSED' && site?.status !== 'CLOSED';

    if (isClosing) {
      try {
        // Fetch active assets and open tasks for this site
        const [activeAssets, openTasks] = await Promise.all([
          assetsApi.getAll({ siteId: id, status: 'IN_SERVICE' })
            .then(assets => assets.length)
            .catch(() => 0),
          tasksApi.getAll({ siteId: id })
            .then(tasks => tasks.filter(t => ['TODO', 'IN_PROGRESS', 'BLOCKED'].includes(t.status)).length)
            .catch(() => 0),
        ]);

        // Also count IN_TRANSIT assets
        const inTransitCount = await assetsApi.getAll({ siteId: id, status: 'IN_TRANSIT' })
          .then(assets => assets.length)
          .catch(() => 0);

        const totalActiveAssets = activeAssets + inTransitCount;

        if (totalActiveAssets > 0 || openTasks > 0) {
          setCloseWarningInfo({ activeAssets: totalActiveAssets, openTasks });
          setPendingSubmitData(payload);
          setShowCloseWarning(true);
          return;
        }
      } catch {
        // If checks fail, proceed with save anyway
      }
    }

    updateMutation.mutate(payload);
  };

  const status = watch('status');
  const selectedDelegationId = watch('delegationId');

  // Organization tree for delegation selector
  const { data: orgTree } = useQuery({
    queryKey: ['organization-tree'],
    queryFn: () => organizationApi.getTree(),
  });

  const selectedDelegation = orgTree?.find((d: any) => d.id === selectedDelegationId);

  if (isLoading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  if (!site) {
    toast.error('Site non trouvé');
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

      {/* Progress Indicator — cliquable, navigation libre */}
      <div className="flex items-center justify-center gap-4">
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
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Étape 1: Informations de base */}
            {currentStep === 1 && (
              <div className="space-y-6">
                {/* Delegation selector */}
                <div className="space-y-2">
                  <Label>Délégation *</Label>
                  <Select
                    value={selectedDelegationId || ''}
                    onValueChange={(value) => setValue('delegationId', value, { shouldValidate: true })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une délégation..." />
                    </SelectTrigger>
                    <SelectContent>
                      {orgTree?.map((del: any) => (
                        <SelectItem key={del.id} value={del.id}>
                          <span className="flex items-center gap-2">
                            {del.groupColor && <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: del.groupColor }} />}
                            {del.name} ({del.code})
                            {del.groupLabel && <span className="text-xs text-muted-foreground">({del.groupLabel})</span>}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedDelegation?.groupLabel && (
                    <p className="text-xs text-muted-foreground">
                      Groupe : {selectedDelegation.groupLabel}
                    </p>
                  )}
                  {errors.delegationId && (
                    <p className="text-sm text-red-600">{errors.delegationId.message}</p>
                  )}
                </div>

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
                      placeholder="Site Exemple"
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

                  <div className="space-y-2">
                    <Label htmlFor="country">Pays</Label>
                    <Input
                      id="country"
                      {...register('country')}
                      placeholder="France"
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

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    {...register('notes')}
                    placeholder="Informations complémentaires sur le site..."
                    rows={4}
                  />
                </div>
              </div>
            )}

            {/* Étape 2: Connectivité */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Wifi className="h-5 w-5" />
                    Connectivité
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Liens Internet, SD-WAN et procédure de coupure
                  </p>
                </div>

                {/* === Liens Internet (dynamique) === */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Liens Internet</h4>
                    <Button type="button" variant="outline" size="sm" onClick={addLink}>
                      <Plus className="h-4 w-4 mr-1" /> Ajouter un lien
                    </Button>
                  </div>

                  {connectivityLinks.length === 0 && (
                    <p className="text-sm text-muted-foreground italic py-4 text-center border border-dashed rounded-lg">
                      Aucun lien configuré. Cliquez sur &quot;Ajouter un lien&quot; pour commencer.
                    </p>
                  )}

                  {connectivityLinks.map((link, idx) => (
                    <div key={link.id} className={`border rounded-lg p-4 space-y-3 ${link.role === 'primary' ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-amber-500'}`}>
                      <div className="flex items-center justify-between">
                        <Badge variant={link.role === 'primary' ? 'success' : 'warning'} className="text-xs">
                          {link.role === 'primary' ? 'Primaire' : 'Backup'}
                        </Badge>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeLink(link.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Rôle</Label>
                          <Select value={link.role} onValueChange={(v) => updateLink(link.id, 'role', v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="primary">Primaire</SelectItem>
                              <SelectItem value="backup">Backup</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Type</Label>
                          <Select value={link.type || ''} onValueChange={(v) => updateLink(link.id, 'type', v)}>
                            <SelectTrigger><SelectValue placeholder="Type de lien" /></SelectTrigger>
                            <SelectContent>
                              {CONNECTIVITY_TYPES.map((t) => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Opérateur</Label>
                          <Input
                            value={link.provider || ''}
                            onChange={(e) => updateLink(link.id, 'provider', e.target.value)}
                            placeholder="Orange, SFR..."
                            maxLength={100}
                            list="provider-suggestions"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Référence</Label>
                          <Input
                            value={link.ref || ''}
                            onChange={(e) => updateLink(link.id, 'ref', e.target.value)}
                            placeholder="FTTO-XXX-001"
                            maxLength={100}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Bande passante</Label>
                          <Input
                            value={link.bandwidth || ''}
                            onChange={(e) => updateLink(link.id, 'bandwidth', e.target.value)}
                            placeholder="1 Gbps / 500 Mbps"
                            maxLength={100}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Équipement associé</Label>
                          <Select value={link.assetId || '_none'} onValueChange={(v) => updateLink(link.id, 'assetId', v === '_none' ? undefined : v)}>
                            <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none">Aucun</SelectItem>
                              {networkAssets.map(a => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.name || a.type} {a.manufacturer ? `(${a.manufacturer})` : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* === SD-WAN === */}
                <div className="space-y-4 border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Network className="h-5 w-5" />
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">SD-WAN</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="sdwan-toggle" className="text-xs text-muted-foreground">
                        {sdwan.enabled ? 'Activé' : 'Désactivé'}
                      </Label>
                      <Checkbox
                        id="sdwan-toggle"
                        checked={sdwan.enabled}
                        onCheckedChange={(checked) => setSdwan({ ...sdwan, enabled: !!checked })}
                      />
                    </div>
                  </div>

                  {sdwan.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs">Fournisseur SD-WAN</Label>
                        <Input
                          value={sdwan.provider || ''}
                          onChange={(e) => setSdwan({ ...sdwan, provider: e.target.value })}
                          placeholder="Fortinet SD-WAN, Meraki, VeloCloud..."
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">
                          Firewalls ({sdwan.firewallIds.length}/2)
                          {sdwan.firewallIds.length === 2 && (
                            <Badge variant="outline" className="ml-2 text-xs">HA</Badge>
                          )}
                        </Label>
                        <Select
                          value="_select"
                          onValueChange={(v) => {
                            if (v === '_select') return;
                            if (sdwan.firewallIds.length >= 2) {
                              toast.error('Maximum 2 firewalls pour HA');
                              return;
                            }
                            if (!sdwan.firewallIds.includes(v)) {
                              setSdwan({ ...sdwan, firewallIds: [...sdwan.firewallIds, v] });
                            }
                          }}
                        >
                          <SelectTrigger><SelectValue placeholder="Ajouter un firewall..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_select" disabled>Sélectionner...</SelectItem>
                            {firewallAssets
                              .filter(a => !sdwan.firewallIds.includes(a.id))
                              .map(a => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.name || 'Firewall'} {a.model ? `(${a.model})` : ''}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        {sdwan.firewallIds.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {sdwan.firewallIds.map(fwId => {
                              const fw = firewallAssets.find(a => a.id === fwId);
                              return (
                                <Badge key={fwId} variant="secondary" className="gap-1">
                                  {fw?.name || fw?.model || 'Firewall'}
                                  <button
                                    type="button"
                                    onClick={() => setSdwan({ ...sdwan, firewallIds: sdwan.firewallIds.filter(id => id !== fwId) })}
                                    className="ml-1 hover:text-red-500"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <Label className="text-xs">Notes SD-WAN</Label>
                        <Input
                          value={sdwan.notes || ''}
                          onChange={(e) => setSdwan({ ...sdwan, notes: e.target.value })}
                          placeholder="Notes complémentaires..."
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Provider suggestions datalist */}
                <datalist id="provider-suggestions">
                  {(providerContacts || []).map((contact) => (
                    <option key={contact.id} value={contact.name}>
                      {contact.company ? `${contact.company}` : ''}
                    </option>
                  ))}
                </datalist>

                {/* Cut Procedure */}
                <div className="space-y-2">
                  <Label htmlFor="cutProcedure">Procédure Coupure</Label>
                  <Textarea
                    id="cutProcedure"
                    {...register('cutProcedure')}
                    placeholder="Procédure à suivre en cas de coupure réseau (contacts, escalade, basculement backup...)"
                    rows={4}
                    maxLength={2000}
                  />
                  {errors.cutProcedure && (
                    <p className="text-sm text-red-600">
                      {errors.cutProcedure.message}
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
                          Aucun contact associé à ce site
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
                          // Exclure les contacts déjà ajoutés (par nom + email)
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
                  <div className="grid md:grid-cols-2 gap-4">
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
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="serverInfo.notes" className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        Notes serveur
                      </Label>
                      <Textarea
                        id="serverInfo.notes"
                        placeholder="Informations complémentaires..."
                        rows={2}
                        value={serverInfo.notes}
                        onChange={(e) => setServerInfo({...serverInfo, notes: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Access Notes */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Notes d'Accès</h3>
                  <div className="grid md:grid-cols-2 gap-4">
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
                        rows={2}
                        value={accessNotes.procedures}
                        onChange={(e) => setAccessNotes({...accessNotes, procedures: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Consignes de sécurité</Label>
                      <Textarea
                        placeholder="Port du casque obligatoire, EPI requis..."
                        rows={2}
                        value={accessNotes.safety}
                        onChange={(e) => setAccessNotes({...accessNotes, safety: e.target.value})}
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

      {/* Warning dialog when closing a site with active assets/tasks */}
      <AlertDialog open={showCloseWarning} onOpenChange={setShowCloseWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la fermeture du site</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Ce site a encore{' '}
                  {closeWarningInfo.activeAssets > 0 && (
                    <strong>{closeWarningInfo.activeAssets} {closeWarningInfo.activeAssets === 1 ? 'equipement actif' : 'equipements actifs'}</strong>
                  )}
                  {closeWarningInfo.activeAssets > 0 && closeWarningInfo.openTasks > 0 && ' et '}
                  {closeWarningInfo.openTasks > 0 && (
                    <strong>{closeWarningInfo.openTasks} {closeWarningInfo.openTasks === 1 ? 'tache ouverte' : 'taches ouvertes'}</strong>
                  )}
                  .
                </p>
                <p>Voulez-vous vraiment fermer ce site ?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingSubmitData(null)}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmCloseAndSubmit}>
              Fermer le site
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
