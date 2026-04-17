'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Building2,
  UserPlus,
  Database,
  Rocket,
  Shield,
  Eye,
  EyeOff,
} from 'lucide-react';
import { setupApi, type SetupStatus, type SetupData } from '@/lib/api/setup';

const STEPS = [
  { id: 'welcome', title: 'Bienvenue', icon: Rocket },
  { id: 'organization', title: 'Organisation', icon: Building2 },
  { id: 'admin', title: 'Administrateur', icon: UserPlus },
  { id: 'options', title: 'Options', icon: Database },
  { id: 'summary', title: 'Lancement', icon: Shield },
];

export default function SetupPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Form data
  const [formData, setFormData] = useState<SetupData>({
    organizationName: '',
    subdomain: '',
    timezone: 'Europe/Paris',
    language: 'Français',
    primaryColor: '#0070f3',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    adminPhone: '',
    loadDemoData: true,
  });

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Check setup status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const result = await setupApi.getStatus();
        setStatus(result);
        if (!result.needsSetup) {
          router.replace('/login');
        }
      } catch (error) {
        console.error('Failed to check setup status:', error);
      } finally {
        setIsLoading(false);
      }
    };
    checkStatus();
  }, [router]);

  const updateField = (field: keyof SetupData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error on change
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.organizationName.trim()) {
        newErrors.organizationName = 'Le nom est requis';
      }
      if (!formData.subdomain.trim()) {
        newErrors.subdomain = 'L\'identifiant est requis';
      } else if (!/^[a-z0-9-]+$/.test(formData.subdomain)) {
        newErrors.subdomain = 'Uniquement des lettres minuscules, chiffres et tirets';
      }
    }

    if (step === 2) {
      if (!formData.adminName.trim()) {
        newErrors.adminName = 'Le nom est requis';
      }
      if (!formData.adminEmail.trim()) {
        newErrors.adminEmail = 'L\'email est requis';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.adminEmail)) {
        newErrors.adminEmail = 'Email invalide';
      }
      if (!formData.adminPassword) {
        newErrors.adminPassword = 'Le mot de passe est requis';
      } else if (formData.adminPassword.length < 8) {
        newErrors.adminPassword = 'Minimum 8 caractères';
      } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(formData.adminPassword)) {
        newErrors.adminPassword = 'Doit contenir au moins une majuscule, une minuscule et un chiffre';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const goNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const goBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSetupError('');

    try {
      await setupApi.initialize(formData);
      setSetupComplete(true);
    } catch (error: any) {
      const message = error?.message || error?.response?.data?.message || 'Erreur lors de la configuration';
      setSetupError(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Vérification du statut...</p>
        </div>
      </div>
    );
  }

  if (!status?.needsSetup) {
    return null; // Will redirect to /login
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
          <Building2 className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold">Configuration XCH</h1>
        <p className="text-muted-foreground">
          Assistant de configuration initiale
        </p>
      </div>

      {/* Progress bar */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((step, idx) => {
          const StepIcon = step.icon;
          const isActive = idx === currentStep;
          const isDone = idx < currentStep || setupComplete;
          return (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all ${
                  isDone
                    ? 'bg-primary border-primary text-primary-foreground'
                    : isActive
                    ? 'border-primary text-primary bg-primary/10'
                    : 'border-muted text-muted-foreground'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <StepIcon className="h-4 w-4" />
                )}
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`w-8 h-0.5 mx-1 transition-colors ${
                    idx < currentStep ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Étape {currentStep + 1}/{STEPS.length} — {STEPS[currentStep].title}
      </p>

      {/* Step content */}
      <Card>
        {/* Step 0: Welcome */}
        {currentStep === 0 && (
          <>
            <CardHeader>
              <CardTitle>Bienvenue sur XCH</CardTitle>
              <CardDescription>
                Cet assistant va configurer votre instance en quelques étapes simples.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Services détectés :</h4>
                {status?.services.map((svc) => (
                  <div key={svc.name} className="flex items-center gap-3 p-3 rounded-lg border">
                    {svc.status === 'ok' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                    )}
                    <div>
                      <p className="font-medium">{svc.name}</p>
                      {svc.message && (
                        <p className="text-sm text-red-500">{svc.message}</p>
                      )}
                    </div>
                    <Badge variant={svc.status === 'ok' ? 'default' : 'destructive'} className="ml-auto text-xs">
                      {svc.status === 'ok' ? 'Connecté' : 'Erreur'}
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-sm text-blue-700 dark:text-blue-300">
                Aucun tenant n'est configuré. Cliquez sur &quot;Commencer&quot; pour créer votre organisation.
              </div>
            </CardContent>
          </>
        )}

        {/* Step 1: Organization */}
        {currentStep === 1 && (
          <>
            <CardHeader>
              <CardTitle>Votre organisation</CardTitle>
              <CardDescription>
                Informations de base de votre instance XCH.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Nom de l'organisation *</Label>
                <Input
                  id="orgName"
                  value={formData.organizationName}
                  onChange={(e) => updateField('organizationName', e.target.value)}
                  placeholder="Mon Organisation"
                />
                {errors.organizationName && (
                  <p className="text-sm text-red-500">{errors.organizationName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="subdomain">Identifiant unique *</Label>
                <Input
                  id="subdomain"
                  value={formData.subdomain}
                  onChange={(e) => updateField('subdomain', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="mon-organisation"
                />
                <p className="text-xs text-muted-foreground">
                  Lettres minuscules, chiffres et tirets uniquement.
                </p>
                {errors.subdomain && (
                  <p className="text-sm text-red-500">{errors.subdomain}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Fuseau horaire</Label>
                  <Input
                    id="timezone"
                    value={formData.timezone}
                    onChange={(e) => updateField('timezone', e.target.value)}
                    placeholder="Europe/Paris"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Langue</Label>
                  <Input
                    id="language"
                    value={formData.language}
                    onChange={(e) => updateField('language', e.target.value)}
                    placeholder="Français"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Couleur principale</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.primaryColor}
                    onChange={(e) => updateField('primaryColor', e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border-0"
                  />
                  <div className="flex gap-2">
                    {['#0070f3', '#7c3aed', '#059669', '#dc2626', '#ea580c', '#0891b2'].map((color) => (
                      <button
                        key={color}
                        onClick={() => updateField('primaryColor', color)}
                        className={`w-7 h-7 rounded-full border-2 transition-all ${
                          formData.primaryColor === color ? 'border-foreground scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 2: Admin */}
        {currentStep === 2 && (
          <>
            <CardHeader>
              <CardTitle>Compte administrateur</CardTitle>
              <CardDescription>
                Ce sera le premier compte avec un accès total à l'application.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adminName">Nom complet *</Label>
                <Input
                  id="adminName"
                  value={formData.adminName}
                  onChange={(e) => updateField('adminName', e.target.value)}
                  placeholder="Jean Admin"
                />
                {errors.adminName && (
                  <p className="text-sm text-red-500">{errors.adminName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminEmail">Email *</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  value={formData.adminEmail}
                  onChange={(e) => updateField('adminEmail', e.target.value)}
                  placeholder="admin@example.com"
                />
                {errors.adminEmail && (
                  <p className="text-sm text-red-500">{errors.adminEmail}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminPassword">Mot de passe *</Label>
                <div className="relative">
                  <Input
                    id="adminPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.adminPassword}
                    onChange={(e) => updateField('adminPassword', e.target.value)}
                    placeholder="Minimum 8 caractères"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.adminPassword && (
                  <p className="text-sm text-red-500">{errors.adminPassword}</p>
                )}
                {formData.adminPassword && (
                  <div className="flex items-center gap-2 text-xs">
                    <div
                      className={`h-1 flex-1 rounded ${
                        formData.adminPassword.length >= 12 ? 'bg-green-500' :
                        formData.adminPassword.length >= 8 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                    />
                    <span className="text-muted-foreground">
                      {formData.adminPassword.length >= 12 ? 'Fort' :
                       formData.adminPassword.length >= 8 ? 'Acceptable' : 'Trop court'}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminPhone">Téléphone (optionnel)</Label>
                <Input
                  id="adminPhone"
                  type="tel"
                  value={formData.adminPhone}
                  onChange={(e) => updateField('adminPhone', e.target.value)}
                  placeholder="+33 6 12 34 56 78"
                />
              </div>

              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-sm text-amber-700 dark:text-amber-300">
                Ce compte sera le seul administrateur initial. Vous pourrez en ajouter d'autres après la configuration.
              </div>
            </CardContent>
          </>
        )}

        {/* Step 3: Options */}
        {currentStep === 3 && (
          <>
            <CardHeader>
              <CardTitle>Options</CardTitle>
              <CardDescription>
                Personnalisez votre installation initiale.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start gap-4 p-4 rounded-lg border">
                <Checkbox
                  id="loadDemo"
                  checked={formData.loadDemoData}
                  onCheckedChange={(checked) => updateField('loadDemoData', checked === true)}
                />
                <div className="space-y-1">
                  <Label htmlFor="loadDemo" className="font-medium cursor-pointer">
                    Charger les données de démonstration
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Crée 6 sites, 100+ équipements, des tâches et contacts pour découvrir l'application.
                    Supprimable à tout moment depuis les paramètres.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                <p className="font-medium mb-1">Modules activés par défaut :</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {['Sites', 'Équipements', 'Baies', 'Tâches', 'Plans', 'Contacts', 'QR Codes'].map((mod) => (
                    <Badge key={mod} variant="secondary" className="text-xs">{mod}</Badge>
                  ))}
                </div>
                <p className="mt-2 text-xs">
                  Vous pourrez activer/désactiver les modules depuis Paramètres &gt; Modules.
                </p>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 4: Summary & Launch */}
        {currentStep === 4 && !setupComplete && (
          <>
            <CardHeader>
              <CardTitle>Récapitulatif</CardTitle>
              <CardDescription>
                Vérifiez les informations avant de lancer la configuration.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Organisation</span>
                  <span className="font-medium">{formData.organizationName}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Identifiant</span>
                  <span className="font-mono text-sm">{formData.subdomain}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Fuseau / Langue</span>
                  <span className="text-sm">{formData.timezone} / {formData.language}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Admin</span>
                  <span className="text-sm">{formData.adminName} ({formData.adminEmail})</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-muted-foreground">Données démo</span>
                  <Badge variant={formData.loadDemoData ? 'default' : 'secondary'}>
                    {formData.loadDemoData ? 'Oui' : 'Non'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-muted-foreground">Couleur</span>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded" style={{ backgroundColor: formData.primaryColor }} />
                    <span className="font-mono text-xs">{formData.primaryColor}</span>
                  </div>
                </div>
              </div>

              {setupError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-sm text-red-700 dark:text-red-300">
                  {setupError}
                </div>
              )}
            </CardContent>
          </>
        )}

        {/* Setup complete */}
        {setupComplete && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <CardTitle>Configuration terminée !</CardTitle>
              <CardDescription>
                Votre instance XCH est prête à l'emploi.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 space-y-2 text-sm">
                <p className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <CheckCircle2 className="h-4 w-4" /> Organisation &quot;{formData.organizationName}&quot; créée
                </p>
                <p className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <CheckCircle2 className="h-4 w-4" /> Administrateur {formData.adminEmail} créé
                </p>
                {formData.loadDemoData && (
                  <p className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <CheckCircle2 className="h-4 w-4" /> Données de démonstration chargées
                  </p>
                )}
              </div>

              <div className="text-center">
                <Button size="lg" onClick={() => router.push('/login')} className="mt-4">
                  Accéder à XCH
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {/* Navigation buttons */}
        {!setupComplete && (
          <div className="px-6 pb-6 flex justify-between">
            {currentStep > 0 ? (
              <Button variant="outline" onClick={goBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour
              </Button>
            ) : (
              <div />
            )}

            {currentStep < STEPS.length - 1 ? (
              <Button onClick={goNext}>
                {currentStep === 0 ? 'Commencer' : 'Suivant'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Configuration...
                  </>
                ) : (
                  <>
                    <Rocket className="mr-2 h-4 w-4" />
                    Lancer la configuration
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
