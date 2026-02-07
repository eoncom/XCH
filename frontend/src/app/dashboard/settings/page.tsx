'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Building2, Plug, Save, Sun, Moon, Monitor, Palette, Database, AlertTriangle, RefreshCw } from 'lucide-react';
import { useTheme } from 'next-themes';
import { apiClient } from '@/lib/api-client';
import { toast } from 'react-hot-toast';

interface TenantConfig {
  name: string;
  subdomain: string;
  config: {
    domain?: string;
    timezone?: string;
    language?: string;
  };
}

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const [isSaving, setIsSaving] = useState(false);
  const [tenantData, setTenantData] = useState<TenantConfig | null>(null);
  const [isLoadingTenant, setIsLoadingTenant] = useState(true);

  // Form state for tenant config
  const [orgName, setOrgName] = useState('');
  const [domain, setDomain] = useState('');
  const [timezone, setTimezone] = useState('Europe/Paris');
  const [language, setLanguage] = useState('Français');

  // Demo data management
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Load tenant data on mount
  useEffect(() => {
    const loadTenant = async () => {
      try {
        const tenant = await apiClient.get<TenantConfig>('/api/tenants/current');
        setTenantData(tenant);
        setOrgName(tenant.name || 'Mon Organisation');
        setDomain(tenant.config?.domain || tenant.subdomain || 'xch.local');
        setTimezone(tenant.config?.timezone || 'Europe/Paris');
        setLanguage(tenant.config?.language || 'Français');
      } catch (error) {
        console.error('Failed to load tenant:', error);
        toast.error('Erreur lors du chargement des paramètres');
      } finally {
        setIsLoadingTenant(false);
      }
    };

    loadTenant();
  }, []);

  const handleSaveProfile = () => {
    setIsSaving(true);
    // Simulate save
    setTimeout(() => {
      setIsSaving(false);
      toast.success('Profil enregistré avec succès');
    }, 1000);
  };

  const handleSaveTenant = async () => {
    if (user?.role !== 'ADMIN') return;

    setIsSaving(true);
    try {
      await apiClient.patch('/api/tenants/current', {
        name: orgName,
        config: {
          ...tenantData?.config,
          domain,
          timezone,
          language,
        },
      });
      toast.success('Organisation mise à jour avec succès');
    } catch (error) {
      console.error('Failed to update tenant:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadDemo = async () => {
    if (user?.role !== 'ADMIN') return;

    setIsLoadingDemo(true);
    try {
      const result = await apiClient.post<{ message: string; stats: any }>('/api/seed/demo');
      toast.success(`${result.message}\n${result.stats.sites} sites, ${result.stats.assets} assets, ${result.stats.tasks} tasks`);
    } catch (error) {
      console.error('Failed to load demo data:', error);
      toast.error('Erreur lors du chargement des données démo');
    } finally {
      setIsLoadingDemo(false);
    }
  };

  const handleResetData = async () => {
    if (user?.role !== 'ADMIN' || !showResetConfirm) return;

    setIsResetting(true);
    try {
      await apiClient.post('/api/seed/reset');
      toast.success('Toutes les données ont été supprimées (admin préservé)');
      setShowResetConfirm(false);
    } catch (error) {
      console.error('Failed to reset data:', error);
      toast.error('Erreur lors de la réinitialisation');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Paramètres</h1>
        <p className="text-muted-foreground">
          Gérez votre profil et les paramètres de l'application
        </p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="mr-2 h-4 w-4" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Palette className="mr-2 h-4 w-4" />
            Apparence
          </TabsTrigger>
          <TabsTrigger value="tenant">
            <Building2 className="mr-2 h-4 w-4" />
            Organisation
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <Plug className="mr-2 h-4 w-4" />
            Intégrations
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations personnelles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom complet</Label>
                  <Input id="name" defaultValue={user?.name} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    defaultValue={user?.email}
                    disabled
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    defaultValue={user?.phone}
                    placeholder="+33 6 12 34 56 78"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Rôle</Label>
                  <Input id="role" defaultValue={user?.role} disabled />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={isSaving} data-testid="save-profile-btn">
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Password Change */}
          <Card>
            <CardHeader>
              <CardTitle>Modifier le mot de passe</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Mot de passe actuel</Label>
                <Input id="currentPassword" type="password" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                <Input id="newPassword" type="password" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">
                  Confirmer le mot de passe
                </Label>
                <Input id="confirmPassword" type="password" />
              </div>

              <div className="flex justify-end">
                <Button data-testid="update-password-btn">
                  <Save className="mr-2 h-4 w-4" />
                  Mettre à jour le mot de passe
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Thème</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Choisissez le thème de l'interface utilisateur
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <button
                    onClick={() => setTheme('light')}
                    className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                      theme === 'light'
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground/50'
                    }`}
                  >
                    <div className="h-16 w-16 rounded-lg bg-white border border-gray-200 flex items-center justify-center mb-3 shadow-sm">
                      <Sun className="h-8 w-8 text-yellow-500" />
                    </div>
                    <span className="font-medium">Clair</span>
                    <span className="text-xs text-muted-foreground mt-1">Mode jour</span>
                  </button>

                  <button
                    onClick={() => setTheme('dark')}
                    className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                      theme === 'dark'
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground/50'
                    }`}
                  >
                    <div className="h-16 w-16 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center mb-3 shadow-sm">
                      <Moon className="h-8 w-8 text-slate-400" />
                    </div>
                    <span className="font-medium">Sombre</span>
                    <span className="text-xs text-muted-foreground mt-1">Mode nuit</span>
                  </button>

                  <button
                    onClick={() => setTheme('system')}
                    className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                      theme === 'system'
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground/50'
                    }`}
                  >
                    <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-white to-slate-900 border border-gray-300 flex items-center justify-center mb-3 shadow-sm">
                      <Monitor className="h-8 w-8 text-gray-600" />
                    </div>
                    <span className="font-medium">Système</span>
                    <span className="text-xs text-muted-foreground mt-1">Auto</span>
                  </button>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Prévisualisation</h4>
                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                      <span className="text-primary-foreground font-bold">XCH</span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Exemple de carte</p>
                      <p className="text-sm text-muted-foreground">Texte secondaire</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm">Bouton primaire</Button>
                    <Button size="sm" variant="outline">Secondaire</Button>
                    <Button size="sm" variant="ghost">Ghost</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tenant Tab */}
        <TabsContent value="tenant" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations de l'organisation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingTenant ? (
                <p className="text-sm text-muted-foreground">Chargement...</p>
              ) : (
                <>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="orgName">Nom de l'organisation</Label>
                      <Input
                        id="orgName"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        disabled={user?.role !== 'ADMIN'}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="domain">Domaine</Label>
                      <Input
                        id="domain"
                        value={domain}
                        onChange={(e) => setDomain(e.target.value)}
                        disabled={user?.role !== 'ADMIN'}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="timezone">Fuseau horaire</Label>
                      <Input
                        id="timezone"
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        disabled={user?.role !== 'ADMIN'}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="language">Langue</Label>
                      <Input
                        id="language"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        disabled={user?.role !== 'ADMIN'}
                      />
                    </div>
                  </div>

                  {user?.role === 'ADMIN' && (
                    <div className="flex justify-end">
                      <Button onClick={handleSaveTenant} disabled={isSaving}>
                        <Save className="mr-2 h-4 w-4" />
                        {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {user?.role === 'ADMIN' && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Gestion des utilisateurs</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Gérez les utilisateurs de votre organisation
                  </p>
                  <Button asChild>
                    <a href="/dashboard/users">
                      <User className="mr-2 h-4 w-4" />
                      Gérer les utilisateurs
                    </a>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Données de démonstration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Charger données démo</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Charge un jeu de données complet (sites, assets, racks, tasks) pour tester l'application.
                        Opération idempotente (peut être relancée sans risque).
                      </p>
                      <Button
                        onClick={handleLoadDemo}
                        disabled={isLoadingDemo}
                        variant="default"
                        data-testid="load-demo-data-btn"
                      >
                        {isLoadingDemo ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Chargement...
                          </>
                        ) : (
                          <>
                            <Database className="mr-2 h-4 w-4" />
                            Charger données démo
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-2 flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-4 w-4" />
                        Zone dangereuse
                      </h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Supprime TOUTES les données (sites, assets, racks, tasks, etc.).
                        Votre compte admin et tenant seront préservés.
                      </p>

                      {!showResetConfirm ? (
                        <Button
                          onClick={() => setShowResetConfirm(true)}
                          variant="destructive"
                          disabled={isResetting}
                          data-testid="reset-data-btn"
                        >
                          <AlertTriangle className="mr-2 h-4 w-4" />
                          Réinitialiser toutes les données
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-destructive">
                            Êtes-vous sûr ? Cette action est irréversible.
                          </p>
                          <div className="flex gap-2">
                            <Button
                              onClick={handleResetData}
                              variant="destructive"
                              disabled={isResetting}
                              data-testid="confirm-reset-btn"
                            >
                              {isResetting ? (
                                <>
                                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                  Suppression...
                                </>
                              ) : (
                                'Confirmer la suppression'
                              )}
                            </Button>
                            <Button
                              onClick={() => setShowResetConfirm(false)}
                              variant="outline"
                              disabled={isResetting}
                            >
                              Annuler
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>NetBox</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="netboxUrl">URL NetBox</Label>
                  <Input
                    id="netboxUrl"
                    placeholder="https://netbox.example.com"
                    disabled={user?.role !== 'ADMIN'}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="netboxToken">Token API</Label>
                  <Input
                    id="netboxToken"
                    type="password"
                    placeholder="••••••••••••"
                    disabled={user?.role !== 'ADMIN'}
                  />
                </div>
              </div>

              {user?.role === 'ADMIN' && (
                <div className="flex justify-end gap-2">
                  <Button variant="outline">Tester la connexion</Button>
                  <Button>
                    <Save className="mr-2 h-4 w-4" />
                    Enregistrer
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Uptime Kuma</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="kumaUrl">URL Uptime Kuma</Label>
                  <Input
                    id="kumaUrl"
                    placeholder="https://uptime.example.com"
                    disabled={user?.role !== 'ADMIN'}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="kumaToken">Token API</Label>
                  <Input
                    id="kumaToken"
                    type="password"
                    placeholder="••••••••••••"
                    disabled={user?.role !== 'ADMIN'}
                  />
                </div>
              </div>

              {user?.role === 'ADMIN' && (
                <div className="flex justify-end gap-2">
                  <Button variant="outline">Tester la connexion</Button>
                  <Button>
                    <Save className="mr-2 h-4 w-4" />
                    Enregistrer
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
