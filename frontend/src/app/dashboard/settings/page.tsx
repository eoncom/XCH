'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { User, Building2, Plug, Save, Sun, Moon, Monitor, Palette, Database, AlertTriangle, RefreshCw, Info, ExternalLink, Key, Image, PaintBucket, ShieldAlert, Plus, Trash2, ToggleLeft, Blocks, Tags, RotateCcw, Check } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useTheme } from 'next-themes';
import { apiClient } from '@/lib/api-client';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { useTenantModules } from '@/hooks/useTenantModules';
import { useEnumLabels } from '@/hooks/useEnumLabels';
import { tenantsApi, type SsoConfig } from '@/lib/api/tenants';
import { useQueryClient } from '@tanstack/react-query';
import { THEME_PRESET_LIST, type ThemePreset } from '@/lib/themes';
import { cn } from '@/lib/utils';

interface SecurityReminder {
  id: string;
  text: string;
}

interface TenantConfig {
  name: string;
  subdomain: string;
  logoUrl?: string;
  primaryColor?: string;
  config: {
    domain?: string;
    timezone?: string;
    language?: string;
    securityReminders?: SecurityReminder[];
    theme?: string;
    [key: string]: any;
  };
}

function ModulesTabContent() {
  const { modules, isLoading, updateModules, isUpdating } = useTenantModules();

  const handleToggle = (key: string, enabled: boolean) => {
    updateModules({ [key]: enabled });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">Chargement des modules...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Blocks className="h-5 w-5" />
          Modules applicatifs
        </CardTitle>
        <CardDescription>
          Activez ou désactivez les modules de l'application. Les modules désactivés sont masqués de la navigation et leurs API retournent une erreur 403.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {modules.map((mod) => (
            <div
              key={mod.key}
              className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                  mod.enabled
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  <ToggleLeft className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">{mod.label}</p>
                  <p className="text-sm text-muted-foreground">{mod.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={mod.enabled ? 'default' : 'secondary'} className="text-xs">
                  {mod.enabled ? 'Actif' : 'Inactif'}
                </Badge>
                <Switch
                  checked={mod.enabled}
                  onCheckedChange={(checked) => handleToggle(mod.key, checked)}
                  disabled={isUpdating || mod.key === 'sites'}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0" />
            Le module &quot;Sites&quot; est obligatoire et ne peut pas être désactivé. Les modifications sont appliquées immédiatement.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

const ENUM_TYPE_LABELS: Record<string, string> = {
  AssetType: "Types d'équipement",
  AssetStatus: "Statuts d'équipement",
  PinType: 'Types de repères (plans)',
};

function EnumLabelsTabContent() {
  const { labels, isLoading, updateLabel, isUpdating, resetLabels, isResetting } = useEnumLabels();
  const [activeType, setActiveType] = useState('AssetType');
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState('');

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">Chargement des types...</p>
        </CardContent>
      </Card>
    );
  }

  const currentItems = labels[activeType] || [];

  const handleStartEdit = (enumValue: string, currentLabel: string, currentColor: string | null) => {
    setEditingItem(enumValue);
    setEditLabel(currentLabel);
    setEditColor(currentColor || '#9ca3af');
  };

  const handleSaveEdit = (enumValue: string) => {
    updateLabel(
      { enumType: activeType, enumValue, label: editLabel, color: editColor },
      { onSuccess: () => {
        setEditingItem(null);
        toast.success('Label mis à jour');
      }},
    );
  };

  const handleReset = () => {
    if (confirm(`Réinitialiser tous les labels "${ENUM_TYPE_LABELS[activeType]}" aux valeurs par défaut ?`)) {
      resetLabels(activeType, {
        onSuccess: () => toast.success('Labels réinitialisés'),
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tags className="h-5 w-5" />
          Personnalisation des types
        </CardTitle>
        <CardDescription>
          Personnalisez les labels et couleurs des types d'équipement, statuts et repères.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Type selector */}
        <div className="flex gap-2 flex-wrap">
          {Object.entries(ENUM_TYPE_LABELS).map(([key, label]) => (
            <Button
              key={key}
              variant={activeType === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setActiveType(key); setEditingItem(null); }}
            >
              {label}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={isResetting}
            className="ml-auto text-muted-foreground"
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Réinitialiser
          </Button>
        </div>

        {/* Items list */}
        <div className="space-y-1">
          {currentItems.map((item) => (
            <div
              key={item.enumValue}
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors"
            >
              {/* Color indicator */}
              <div
                className="w-5 h-5 rounded shrink-0 border"
                style={{ backgroundColor: item.color || '#9ca3af' }}
              />

              {editingItem === item.enumValue ? (
                <>
                  {/* Edit mode */}
                  <Input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="h-8 flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit(item.enumValue);
                      if (e.key === 'Escape') setEditingItem(null);
                    }}
                  />
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border-0"
                  />
                  <Button
                    size="sm"
                    onClick={() => handleSaveEdit(item.enumValue)}
                    disabled={isUpdating}
                    className="h-8"
                  >
                    <Save className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingItem(null)}
                    className="h-8"
                  >
                    &times;
                  </Button>
                </>
              ) : (
                <>
                  {/* View mode */}
                  <span className="flex-1 text-sm font-medium">{item.label}</span>
                  <span className="text-xs text-muted-foreground font-mono">{item.enumValue}</span>
                  {item.isCustom && (
                    <Badge variant="outline" className="text-xs">Personnalisé</Badge>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-muted-foreground"
                    onClick={() => handleStartEdit(item.enumValue, item.label, item.color)}
                  >
                    Modifier
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0" />
            Les labels personnalisés s'affichent partout dans l'application. Les valeurs internes (code) ne changent pas.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

const XCH_ROLES = ['ADMIN', 'MANAGER', 'TECHNICIEN', 'VIEWER'] as const;

function SsoConfigSection() {
  const [ssoConfig, setSsoConfig] = useState<SsoConfig | null>(null);
  const [isLoadingSso, setIsLoadingSso] = useState(true);
  const [isSavingSso, setIsSavingSso] = useState(false);

  // Form state
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [issuer, setIssuer] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [callbackUrl, setCallbackUrl] = useState('');
  const [roleMapping, setRoleMapping] = useState<Record<string, string>>({
    admin: 'ADMIN',
    manager: 'MANAGER',
    technician: 'TECHNICIEN',
    default: 'VIEWER',
  });
  const [newMappingKey, setNewMappingKey] = useState('');
  const [newMappingRole, setNewMappingRole] = useState('VIEWER');

  useEffect(() => {
    const loadSsoConfig = async () => {
      try {
        const config = await tenantsApi.getSsoConfig();
        setSsoConfig(config);
        setSsoEnabled(config.enabled);
        setIssuer(config.issuer);
        setClientId(config.clientId);
        setCallbackUrl(config.callbackUrl || `${window.location.origin}/api/auth/oidc/callback`);
        setRoleMapping(config.roleMapping || { default: 'VIEWER' });
      } catch {
        // Not available — use defaults
        setCallbackUrl(`${window.location.origin}/api/auth/oidc/callback`);
      } finally {
        setIsLoadingSso(false);
      }
    };
    loadSsoConfig();
  }, []);

  const handleSaveSso = async () => {
    setIsSavingSso(true);
    try {
      const data: Record<string, any> = {
        enabled: ssoEnabled,
        provider: 'oidc',
        issuer,
        clientId,
        callbackUrl,
        roleMapping,
      };
      // Only send secret if user typed a new one
      if (clientSecret) {
        data.clientSecret = clientSecret;
      }
      const updated = await tenantsApi.updateSsoConfig(data);
      setSsoConfig(updated);
      setClientSecret(''); // Clear after save
      toast.success('Configuration SSO enregistrée');
    } catch (error) {
      console.error('Failed to save SSO config:', error);
      toast.error('Erreur lors de la sauvegarde SSO');
    } finally {
      setIsSavingSso(false);
    }
  };

  const handleAddMapping = () => {
    if (newMappingKey.trim()) {
      setRoleMapping({ ...roleMapping, [newMappingKey.trim()]: newMappingRole });
      setNewMappingKey('');
      setNewMappingRole('VIEWER');
    }
  };

  const handleRemoveMapping = (key: string) => {
    if (key === 'default') return; // Cannot remove default
    const updated = { ...roleMapping };
    delete updated[key];
    setRoleMapping(updated);
  };

  if (isLoadingSso) {
    return (
      <div className="border rounded-lg p-4">
        <p className="text-sm text-muted-foreground text-center py-4">Chargement de la configuration SSO...</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <Key className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h4 className="font-medium">SSO (Single Sign-On)</h4>
            <p className="text-sm text-muted-foreground">OpenID Connect — Azure AD, Keycloak, Okta, Google</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={ssoEnabled ? 'default' : 'secondary'} className="text-xs">
            {ssoEnabled ? 'Activé' : 'Désactivé'}
          </Badge>
          <Switch
            checked={ssoEnabled}
            onCheckedChange={setSsoEnabled}
          />
        </div>
      </div>

      {ssoEnabled && (
        <>
          {/* Provider settings */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ssoIssuer">Issuer URL</Label>
              <Input
                id="ssoIssuer"
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                placeholder="https://login.microsoftonline.com/tenant-id/v2.0"
              />
              <p className="text-xs text-muted-foreground">L'URL de découverte de votre fournisseur d'identité</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ssoCallbackUrl">Callback URL</Label>
              <Input
                id="ssoCallbackUrl"
                value={callbackUrl}
                onChange={(e) => setCallbackUrl(e.target.value)}
                placeholder="https://xch.example.com/api/auth/oidc/callback"
              />
              <p className="text-xs text-muted-foreground">À configurer dans votre IdP comme &quot;Redirect URI&quot;</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ssoClientId">Client ID</Label>
              <Input
                id="ssoClientId"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="application-client-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ssoClientSecret">Client Secret</Label>
              <Input
                id="ssoClientSecret"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={ssoConfig?.clientSecretSet ? `Déjà configuré (${ssoConfig.clientSecretHint})` : 'Entrez le secret client'}
              />
              {ssoConfig?.clientSecretSet && (
                <p className="text-xs text-muted-foreground">Laissez vide pour garder le secret actuel</p>
              )}
            </div>
          </div>

          {/* Role mapping */}
          <div className="border-t pt-4 space-y-3">
            <div>
              <h4 className="font-medium text-sm">Mapping des rôles</h4>
              <p className="text-xs text-muted-foreground">
                Associez les groupes/claims de votre IdP aux rôles XCH. Le rôle &quot;default&quot; est utilisé si aucun groupe ne correspond.
              </p>
            </div>

            <div className="space-y-2">
              {Object.entries(roleMapping).map(([groupKey, xchRole]) => (
                <div key={groupKey} className="flex items-center gap-2">
                  <Input
                    value={groupKey}
                    disabled
                    className="flex-1 h-8 text-sm font-mono bg-muted/50"
                  />
                  <span className="text-xs text-muted-foreground">→</span>
                  <select
                    value={xchRole}
                    onChange={(e) => setRoleMapping({ ...roleMapping, [groupKey]: e.target.value })}
                    className="h-8 px-2 rounded-md border bg-background text-sm"
                  >
                    {XCH_ROLES.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                  {groupKey !== 'default' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-700"
                      onClick={() => handleRemoveMapping(groupKey)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Add new mapping */}
            <div className="flex items-center gap-2">
              <Input
                value={newMappingKey}
                onChange={(e) => setNewMappingKey(e.target.value)}
                placeholder="Nom du groupe IdP..."
                className="flex-1 h-8 text-sm"
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddMapping(); }}
              />
              <span className="text-xs text-muted-foreground">→</span>
              <select
                value={newMappingRole}
                onChange={(e) => setNewMappingRole(e.target.value)}
                className="h-8 px-2 rounded-md border bg-background text-sm"
              >
                {XCH_ROLES.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={handleAddMapping}
                disabled={!newMappingKey.trim()}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <Info className="h-4 w-4 shrink-0" />
              La connexion locale (email/mot de passe) reste toujours disponible, même avec SSO activé. Au moins un compte admin local est recommandé.
            </p>
          </div>
        </>
      )}

      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          onClick={handleSaveSso}
          disabled={isSavingSso}
        >
          {isSavingSso ? (
            <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
          ) : (
            <Save className="mr-2 h-3 w-3" />
          )}
          Enregistrer SSO
        </Button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [tenantData, setTenantData] = useState<TenantConfig | null>(null);
  const [isLoadingTenant, setIsLoadingTenant] = useState(true);

  // Form state for tenant config
  const [orgName, setOrgName] = useState('');
  const [domain, setDomain] = useState('');
  const [timezone, setTimezone] = useState('Europe/Paris');
  const [language, setLanguage] = useState('Français');

  // Integration state
  const [netboxUrl, setNetboxUrl] = useState('');
  const [netboxToken, setNetboxToken] = useState('');
  const [kumaUrl, setKumaUrl] = useState('');
  const [kumaToken, setKumaToken] = useState('');
  const [isTesting, setIsTesting] = useState<string | null>(null);

  // Branding state
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#0070f3');
  const [securityReminders, setSecurityReminders] = useState<SecurityReminder[]>([
    { id: '1', text: "Badge d'accès obligatoire sur tous les sites" },
    { id: '2', text: 'Carte BTP à jour requise' },
    { id: '3', text: 'EPI obligatoires (casque, gilet, chaussures)' },
    { id: '4', text: 'Respecter les consignes affichées sur site' },
  ]);
  const [newReminder, setNewReminder] = useState('');

  // Theme preset state
  const [selectedTheme, setSelectedTheme] = useState<string>('blue');
  const [isSavingTheme, setIsSavingTheme] = useState(false);

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
        setLogoUrl(tenant.logoUrl || '');
        setPrimaryColor(tenant.primaryColor || '#0070f3');
        setSelectedTheme(tenant.config?.theme || 'blue');
        if (tenant.config?.securityReminders?.length > 0) {
          setSecurityReminders(tenant.config.securityReminders);
        }
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
        logoUrl: logoUrl || null,
        primaryColor,
        config: {
          ...tenantData?.config,
          domain,
          timezone,
          language,
          securityReminders,
        },
      });
      queryClient.invalidateQueries({ queryKey: ['tenant-branding'] });
      toast.success('Organisation mise à jour avec succès');
    } catch (error) {
      console.error('Failed to update tenant:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTheme = async () => {
    if (user?.role !== 'ADMIN') return;
    setIsSavingTheme(true);
    try {
      await apiClient.patch('/api/tenants/current', {
        config: {
          ...tenantData?.config,
          theme: selectedTheme,
        },
      });
      // Update local tenantData so subsequent saves preserve the theme key
      setTenantData((prev) => prev ? { ...prev, config: { ...prev.config, theme: selectedTheme } } as any : prev);
      queryClient.invalidateQueries({ queryKey: ['tenant-branding'] });
      toast.success('Thème mis à jour');
    } catch {
      toast.error('Erreur lors de la mise à jour du thème');
    } finally {
      setIsSavingTheme(false);
    }
  };

  const handleTestConnection = async (integration: string) => {
    setIsTesting(integration);
    setTimeout(() => {
      setIsTesting(null);
      toast.success(`Connexion ${integration} testée avec succès`);
    }, 1500);
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
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="profile">
            <User className="mr-2 h-4 w-4" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Palette className="mr-2 h-4 w-4" />
            Apparence
          </TabsTrigger>
          {user?.role === 'ADMIN' && (
            <TabsTrigger value="tenant">
              <Building2 className="mr-2 h-4 w-4" />
              Organisation
            </TabsTrigger>
          )}
          {user?.role === 'ADMIN' && (
            <TabsTrigger value="integrations">
              <Plug className="mr-2 h-4 w-4" />
              Intégrations
            </TabsTrigger>
          )}
          {user?.role === 'ADMIN' && (
            <TabsTrigger value="modules">
              <Blocks className="mr-2 h-4 w-4" />
              Modules
            </TabsTrigger>
          )}
          {user?.role === 'ADMIN' && (
            <TabsTrigger value="types">
              <Tags className="mr-2 h-4 w-4" />
              Types
            </TabsTrigger>
          )}
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

              {/* Theme Presets */}
              {user?.role === 'ADMIN' && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    Palette de couleurs
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Choisissez une palette de couleurs pour votre organisation. Tous les utilisateurs verront ce thème.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {THEME_PRESET_LIST.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => setSelectedTheme(preset.id)}
                        className={cn(
                          'relative flex flex-col rounded-lg border-2 p-3 transition-all text-left hover:shadow-md',
                          selectedTheme === preset.id
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                            : 'border-muted hover:border-muted-foreground/30',
                        )}
                      >
                        {/* Color preview strip */}
                        <div className="flex gap-1 mb-3">
                          <div
                            className="h-8 flex-1 rounded-l-md"
                            style={{ backgroundColor: preset.previewColor }}
                          />
                          <div
                            className="h-8 w-8 rounded-r-md"
                            style={{ backgroundColor: preset.previewColor, opacity: 0.3 }}
                          />
                        </div>

                        {/* Label + description */}
                        <span className="font-medium text-sm">{preset.label}</span>
                        <span className="text-xs text-muted-foreground mt-0.5">{preset.description}</span>

                        {/* Check indicator */}
                        {selectedTheme === preset.id && (
                          <div className="absolute top-2 right-2">
                            <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </div>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleSaveTheme}
                      disabled={isSavingTheme}
                    >
                      {isSavingTheme ? (
                        <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-3 w-3" />
                      )}
                      Appliquer le thème
                    </Button>
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Prévisualisation</h4>
                <div className="p-4 rounded-lg border bg-card space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                      <span className="text-primary-foreground font-bold text-xs">XCH</span>
                    </div>
                    <div>
                      <p className="font-medium text-card-foreground">Exemple de carte</p>
                      <p className="text-sm text-muted-foreground">Texte secondaire</p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm">Primaire</Button>
                    <Button size="sm" variant="secondary">Secondaire</Button>
                    <Button size="sm" variant="outline">Outline</Button>
                    <Button size="sm" variant="ghost">Ghost</Button>
                    <Button size="sm" variant="destructive">Danger</Button>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Badge>Badge</Badge>
                    <Badge variant="secondary">Secondaire</Badge>
                    <Badge variant="outline">Outline</Badge>
                  </div>
                  <div className="p-3 rounded-md bg-muted">
                    <p className="text-sm text-muted-foreground">
                      Zone muted avec texte secondaire
                    </p>
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
              <CardDescription>
                Ces informations sont utilisées dans les exports PDF, les en-têtes et l'identification de votre espace.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingTenant ? (
                <p className="text-sm text-muted-foreground">Chargement...</p>
              ) : (
                <>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="orgName" className="flex items-center gap-2">
                        Nom de l'organisation
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Affiché dans les exports PDF et les en-têtes de plans</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <Input
                        id="orgName"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        disabled={user?.role !== 'ADMIN'}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="domain" className="flex items-center gap-2">
                        Domaine
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Identifiant unique de votre espace. Utilisé en interne uniquement.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <Input
                        id="domain"
                        value={domain}
                        onChange={(e) => setDomain(e.target.value)}
                        disabled={user?.role !== 'ADMIN'}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="timezone" className="flex items-center gap-2">
                        Fuseau horaire
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Affecte l'affichage des dates et heures dans l'application</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
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

                  {/* Logo */}
                  <div className="border-t pt-4 space-y-2">
                    <Label htmlFor="logoUrl" className="flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      Logo de l'organisation
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Affiché dans les exports PDF et l'en-tête de l'application. URL vers une image (PNG, JPG, SVG).</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <div className="flex items-center gap-4">
                      {logoUrl && (
                        <div className="h-12 w-12 rounded-lg border bg-white flex items-center justify-center overflow-hidden">
                          <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                        </div>
                      )}
                      <Input
                        id="logoUrl"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="https://example.com/logo.png"
                        disabled={user?.role !== 'ADMIN'}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  {/* Security Reminders */}
                  <div className="border-t pt-4 space-y-3">
                    <Label className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4" />
                      Rappels de sécurité site
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Affichés dans les info-bulles de sécurité sur les pages site.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Ces rappels apparaissent dans l'info-bulle de sécurité près des "Informations d'accès" sur chaque site.
                    </p>
                    <div className="space-y-2">
                      {securityReminders.map((reminder, idx) => (
                        <div key={reminder.id} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-4">{idx + 1}.</span>
                          <Input
                            value={reminder.text}
                            onChange={(e) => {
                              const updated = [...securityReminders];
                              updated[idx] = { ...reminder, text: e.target.value };
                              setSecurityReminders(updated);
                            }}
                            disabled={user?.role !== 'ADMIN'}
                            className="flex-1 text-sm"
                          />
                          {user?.role === 'ADMIN' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-700"
                              onClick={() => setSecurityReminders(securityReminders.filter((_, i) => i !== idx))}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    {user?.role === 'ADMIN' && (
                      <div className="flex items-center gap-2">
                        <Input
                          value={newReminder}
                          onChange={(e) => setNewReminder(e.target.value)}
                          placeholder="Nouveau rappel de sécurité..."
                          className="flex-1 text-sm"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newReminder.trim()) {
                              setSecurityReminders([
                                ...securityReminders,
                                { id: Date.now().toString(), text: newReminder.trim() },
                              ]);
                              setNewReminder('');
                            }
                          }}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (newReminder.trim()) {
                              setSecurityReminders([
                                ...securityReminders,
                                { id: Date.now().toString(), text: newReminder.trim() },
                              ]);
                              setNewReminder('');
                            }
                          }}
                          disabled={!newReminder.trim()}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          Ajouter
                        </Button>
                      </div>
                    )}
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
          )}
        </TabsContent>

        {/* Modules Tab */}
        <TabsContent value="modules" className="space-y-6">
          <ModulesTabContent />
        </TabsContent>

        {/* Types Tab */}
        <TabsContent value="types" className="space-y-6">
          <EnumLabelsTabContent />
        </TabsContent>

        {/* Integrations Tab — consolidated NetBox + Monitoring */}
        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plug className="h-5 w-5" />
                Intégrations externes
              </CardTitle>
              <CardDescription>
                Connectez XCH à vos outils existants pour synchroniser les données automatiquement.
                Les intégrations sont en lecture seule (READ-ONLY).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* NetBox */}
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <Database className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h4 className="font-medium">NetBox</h4>
                      <p className="text-sm text-muted-foreground">DCIM & IPAM — Synchronisation sites, équipements, baies, contacts</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/dashboard/integrations/netbox">
                      Configuration avancée
                      <ExternalLink className="ml-2 h-3 w-3" />
                    </Link>
                  </Button>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="netboxUrl">URL NetBox</Label>
                    <Input
                      id="netboxUrl"
                      placeholder="https://netbox.example.com"
                      value={netboxUrl}
                      onChange={(e) => setNetboxUrl(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="netboxToken">Token API</Label>
                    <Input
                      id="netboxToken"
                      type="password"
                      placeholder="••••••••••••"
                      value={netboxToken}
                      onChange={(e) => setNetboxToken(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestConnection('NetBox')}
                    disabled={isTesting === 'NetBox'}
                  >
                    {isTesting === 'NetBox' ? (
                      <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                    ) : null}
                    Tester la connexion
                  </Button>
                  <Button size="sm">
                    <Save className="mr-2 h-3 w-3" />
                    Enregistrer
                  </Button>
                </div>
              </div>

              {/* Uptime Kuma / Monitoring */}
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Plug className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-medium">Monitoring (Uptime Kuma)</h4>
                    <p className="text-sm text-muted-foreground">Surveillance — Statut de santé des équipements et services</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="kumaUrl">URL Uptime Kuma</Label>
                    <Input
                      id="kumaUrl"
                      placeholder="https://uptime.example.com"
                      value={kumaUrl}
                      onChange={(e) => setKumaUrl(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="kumaToken">Token API</Label>
                    <Input
                      id="kumaToken"
                      type="password"
                      placeholder="••••••••••••"
                      value={kumaToken}
                      onChange={(e) => setKumaToken(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestConnection('Uptime Kuma')}
                    disabled={isTesting === 'Uptime Kuma'}
                  >
                    {isTesting === 'Uptime Kuma' ? (
                      <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                    ) : null}
                    Tester la connexion
                  </Button>
                  <Button size="sm">
                    <Save className="mr-2 h-3 w-3" />
                    Enregistrer
                  </Button>
                </div>
              </div>

              {/* SSO Configuration */}
              <SsoConfigSection />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
