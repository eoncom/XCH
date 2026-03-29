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
import { User, Building2, Plug, Save, Sun, Moon, Monitor, Palette, Database, AlertTriangle, RefreshCw, Info, ExternalLink, Key, Image, PaintBucket, ShieldAlert, Plus, Trash2, ToggleLeft, Blocks, Tags, RotateCcw, Check, ShieldCheck, Copy, Loader2, HardDrive, Download, Upload, Archive, FileArchive, Network } from 'lucide-react';
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
import { authApi } from '@/lib/api/auth';
import { integrationsApi, type IntegrationConfigResponse } from '@/lib/api/integrations';
import { backupApi, type BackupMetadata } from '@/lib/api/backup';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OrganizationTab } from './organization-tab';

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

function SecurityTabContent() {
  const { user } = useAuthStore();
  const [totpEnabled, setTotpEnabled] = useState(user?.totpEnabled || false);
  const [setupStep, setSetupStep] = useState<'idle' | 'qr' | 'verify' | 'backup' | 'done'>('idle');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [showDisable, setShowDisable] = useState(false);
  const [error, setError] = useState('');

  const handleStartSetup = async () => {
    setIsSettingUp(true);
    setError('');
    try {
      const data = await authApi.setup2FA();
      setQrCodeDataUrl(data.qrCodeDataUrl);
      setTotpSecret(data.secret);
      setSetupStep('qr');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la configuration');
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleVerifySetup = async () => {
    setIsVerifying(true);
    setError('');
    try {
      const data = await authApi.verifySetup(verifyCode);
      if (data.backupCodes) {
        setBackupCodes(data.backupCodes);
        setSetupStep('backup');
        setTotpEnabled(true);
      }
    } catch (err: any) {
      setError(err.message || 'Code invalide');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisable = async () => {
    setIsDisabling(true);
    setError('');
    try {
      await authApi.disable2FA(disablePassword);
      setTotpEnabled(false);
      setShowDisable(false);
      setDisablePassword('');
      toast.success('Double authentification désactivée');
    } catch (err: any) {
      setError(err.message || 'Mot de passe incorrect');
    } finally {
      setIsDisabling(false);
    }
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    toast.success('Codes copiés dans le presse-papier');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Double authentification (2FA)
        </CardTitle>
        <CardDescription>
          Protégez votre compte avec un code temporaire généré par une application d'authentification (Google Authenticator, Microsoft Authenticator, etc.)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status */}
        <div className="flex items-center justify-between p-4 rounded-lg border">
          <div className="flex items-center gap-3">
            <div className={cn(
              'h-10 w-10 rounded-lg flex items-center justify-center',
              totpEnabled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'
            )}>
              <ShieldCheck className={cn('h-5 w-5', totpEnabled ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')} />
            </div>
            <div>
              <p className="font-medium">
                {totpEnabled ? 'Double authentification activée' : 'Double authentification désactivée'}
              </p>
              <p className="text-sm text-muted-foreground">
                {totpEnabled
                  ? 'Votre compte est protégé par un code TOTP'
                  : 'Activez la 2FA pour renforcer la sécurité de votre compte'}
              </p>
            </div>
          </div>
          <Badge variant={totpEnabled ? 'default' : 'secondary'}>
            {totpEnabled ? 'Actif' : 'Inactif'}
          </Badge>
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">
            {error}
          </div>
        )}

        {/* Setup flow */}
        {!totpEnabled && setupStep === 'idle' && (
          <Button onClick={handleStartSetup} disabled={isSettingUp}>
            {isSettingUp ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" />
            )}
            Activer la double authentification
          </Button>
        )}

        {setupStep === 'qr' && (
          <div className="space-y-4">
            <div className="p-4 border rounded-lg space-y-4">
              <h4 className="font-medium">1. Scannez le QR code</h4>
              <p className="text-sm text-muted-foreground">
                Ouvrez votre application d'authentification et scannez le QR code ci-dessous.
              </p>
              <div className="flex justify-center">
                {qrCodeDataUrl && (
                  <img src={qrCodeDataUrl} alt="QR Code TOTP" className="w-48 h-48 rounded-lg border" />
                )}
              </div>
              {totpSecret && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Ou entrez manuellement cette clé :</p>
                  <code className="text-sm font-mono bg-muted px-3 py-1 rounded select-all">
                    {totpSecret}
                  </code>
                </div>
              )}
            </div>

            <div className="p-4 border rounded-lg space-y-4">
              <h4 className="font-medium">2. Entrez le code de vérification</h4>
              <p className="text-sm text-muted-foreground">
                Saisissez le code à 6 chiffres affiché dans votre application.
              </p>
              <div className="flex gap-3">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-40 text-center text-lg tracking-widest font-mono"
                  autoComplete="one-time-code"
                />
                <Button
                  onClick={handleVerifySetup}
                  disabled={isVerifying || verifyCode.length !== 6}
                >
                  {isVerifying ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Vérifier
                </Button>
              </div>
            </div>

            <Button variant="ghost" onClick={() => { setSetupStep('idle'); setError(''); }}>
              Annuler
            </Button>
          </div>
        )}

        {setupStep === 'backup' && (
          <div className="space-y-4">
            <div className="p-4 border rounded-lg border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10 space-y-4">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <Check className="h-5 w-5" />
                <h4 className="font-medium">Double authentification activée !</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Sauvegardez ces codes de récupération dans un endroit sûr. Chaque code ne peut être utilisé qu'une seule fois en cas de perte de votre appareil.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code, i) => (
                  <code key={i} className="text-sm font-mono bg-muted px-3 py-2 rounded text-center">
                    {code}
                  </code>
                ))}
              </div>
              <Button variant="outline" onClick={copyBackupCodes}>
                <Copy className="mr-2 h-4 w-4" />
                Copier les codes
              </Button>
            </div>
            <Button onClick={() => setSetupStep('done')}>
              J'ai sauvegardé mes codes
            </Button>
          </div>
        )}

        {/* Disable 2FA */}
        {totpEnabled && setupStep !== 'qr' && setupStep !== 'backup' && (
          <div className="space-y-4">
            {!showDisable ? (
              <Button variant="outline" onClick={() => setShowDisable(true)}>
                Désactiver la double authentification
              </Button>
            ) : (
              <div className="p-4 border rounded-lg border-destructive/30 space-y-4">
                <h4 className="font-medium text-destructive">Désactiver la 2FA</h4>
                <p className="text-sm text-muted-foreground">
                  Confirmez votre mot de passe pour désactiver la double authentification.
                </p>
                <div className="flex gap-3">
                  <Input
                    type="password"
                    placeholder="Mot de passe actuel"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    className="max-w-xs"
                  />
                  <Button
                    variant="destructive"
                    onClick={handleDisable}
                    disabled={isDisabling || !disablePassword}
                  >
                    {isDisabling ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Désactiver
                  </Button>
                  <Button variant="ghost" onClick={() => { setShowDisable(false); setDisablePassword(''); setError(''); }}>
                    Annuler
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WarrantyThresholdsSection({ tenantData, setTenantData }: { tenantData: TenantConfig | null; setTenantData: (data: TenantConfig | null) => void }) {
  const queryClient = useQueryClient();
  const [warningDays, setWarningDays] = useState(90);
  const [criticalDays, setCriticalDays] = useState(30);
  const [isSaving, setIsSaving] = useState(false);

  // Load from tenant config
  useEffect(() => {
    if (tenantData?.config?.warrantyAlertThresholds) {
      const thresholds = tenantData.config.warrantyAlertThresholds;
      setWarningDays(thresholds.warning ?? 90);
      setCriticalDays(thresholds.critical ?? 30);
    }
  }, [tenantData]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiClient.patch('/api/tenants/current', {
        config: {
          ...tenantData?.config,
          warrantyAlertThresholds: {
            warning: warningDays,
            critical: criticalDays,
          },
        },
      });
      // Update local state
      setTenantData(tenantData ? {
        ...tenantData,
        config: {
          ...tenantData.config,
          warrantyAlertThresholds: { warning: warningDays, critical: criticalDays },
        },
      } : null);
      queryClient.invalidateQueries({ queryKey: ['tenant-branding'] });
      toast.success('Seuils de garantie mis à jour');
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5" />
          Alertes garantie
        </CardTitle>
        <CardDescription>
          Configurez les seuils d'alerte pour la fin de garantie des équipements. Les alertes apparaissent sur le dashboard, la liste et le détail des équipements.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="warrantyWarning" className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-amber-500" />
              Seuil alerte jaune (jours)
            </Label>
            <Input
              id="warrantyWarning"
              type="number"
              min={1}
              max={365}
              value={warningDays}
              onChange={(e) => setWarningDays(parseInt(e.target.value) || 90)}
            />
            <p className="text-xs text-muted-foreground">
              Alerte jaune quand la garantie expire dans moins de {warningDays} jours
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="warrantyCritical" className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-orange-500" />
              Seuil alerte orange (jours)
            </Label>
            <Input
              id="warrantyCritical"
              type="number"
              min={1}
              max={365}
              value={criticalDays}
              onChange={(e) => setCriticalDays(parseInt(e.target.value) || 30)}
            />
            <p className="text-xs text-muted-foreground">
              Alerte orange quand la garantie expire dans moins de {criticalDays} jours
            </p>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0" />
            Les équipements avec une garantie expirée sont toujours affichés en rouge, quel que soit le seuil.
            {warningDays <= criticalDays && (
              <span className="text-amber-600 font-medium ml-1">
                ⚠ Le seuil jaune doit être supérieur au seuil orange.
              </span>
            )}
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Enregistrer les seuils
          </Button>
        </div>
      </CardContent>
    </Card>
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
  const [monitoringType, setMonitoringType] = useState('');
  const [kumaUrl, setKumaUrl] = useState('');
  const [kumaToken, setKumaToken] = useState('');
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [isSavingIntegration, setIsSavingIntegration] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ provider: string; success: boolean; message: string } | null>(null);

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

  // Backup state
  const [backupList, setBackupList] = useState<BackupMetadata[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [isCreatingFullBackup, setIsCreatingFullBackup] = useState(false);
  const [isCreatingSiteBackup, setIsCreatingSiteBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDeletingBackup, setIsDeletingBackup] = useState<string | null>(null);
  const [selectedBackupSiteId, setSelectedBackupSiteId] = useState('');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreFullFile, setRestoreFullFile] = useState<File | null>(null);
  const [isRestoringFull, setIsRestoringFull] = useState(false);
  const [isCleaningStorage, setIsCleaningStorage] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [availableSites, setAvailableSites] = useState<{ id: string; name: string; code: string }[]>([]);

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

    const loadIntegrationConfig = async () => {
      try {
        const config = await integrationsApi.getConfig();
        if (config.netbox?.url) setNetboxUrl(config.netbox.url);
        if (config.netbox?.tokenSet) setNetboxToken(config.netbox.tokenHint);
        // Load monitoring config (new format first, then legacy)
        if (config.monitoring?.type) setMonitoringType(config.monitoring.type);
        else if (config.uptimeKuma?.url) setMonitoringType('uptime_kuma');
        if (config.monitoring?.url || config.uptimeKuma?.url) setKumaUrl(config.monitoring?.url || config.uptimeKuma?.url || '');
        if (config.monitoring?.passwordSet || config.monitoring?.apiKeySet || config.uptimeKuma?.passwordSet) {
          setKumaToken(config.monitoring?.apiKeyHint || config.monitoring?.passwordHint || config.uptimeKuma?.passwordHint || '');
        }
      } catch (error) {
        // Integration config may not exist yet, ignore
        console.debug('No integration config found');
      }
    };

    loadTenant();
    loadIntegrationConfig();
  }, []);

  // Load backup list + sites for backup tab
  const loadBackups = async () => {
    setIsLoadingBackups(true);
    try {
      const data = await backupApi.list();
      setBackupList(data.backups || []);
    } catch (error) {
      console.error('Failed to load backups:', error);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  const loadSitesForBackup = async () => {
    try {
      const data = await apiClient.get<{ data: { id: string; name: string; code: string }[] }>('/api/sites');
      setAvailableSites(data.data || data as any || []);
    } catch (error) {
      console.debug('Failed to load sites for backup:', error);
    }
  };

  const handleCreateFullBackup = async () => {
    setIsCreatingFullBackup(true);
    try {
      const result = await backupApi.createFull();
      toast.success(result.message || 'Backup complet créé avec succès');
      loadBackups();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création du backup');
    } finally {
      setIsCreatingFullBackup(false);
    }
  };

  const handleCreateSiteBackup = async () => {
    if (!selectedBackupSiteId) {
      toast.error('Veuillez sélectionner un site');
      return;
    }
    setIsCreatingSiteBackup(true);
    try {
      await backupApi.createSiteBackup(selectedBackupSiteId);
      toast.success('Backup du site téléchargé');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du backup du site');
    } finally {
      setIsCreatingSiteBackup(false);
    }
  };

  const handleRestoreSite = async () => {
    if (!restoreFile) {
      toast.error('Veuillez sélectionner un fichier ZIP');
      return;
    }
    setIsRestoring(true);
    try {
      const result = await backupApi.restoreSite(restoreFile);
      toast.success(result.message || `Site "${result.siteName}" restauré avec succès`);
      setRestoreFile(null);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la restauration');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleRestoreFull = async () => {
    if (!restoreFullFile) {
      toast.error('Veuillez sélectionner un fichier ZIP de backup complet');
      return;
    }
    setIsRestoringFull(true);
    try {
      const result = await backupApi.restoreFull(restoreFullFile);
      toast.success(result.message || 'Restauration complète effectuée');
      setRestoreFullFile(null);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la restauration complète');
    } finally {
      setIsRestoringFull(false);
    }
  };

  const handleDeleteBackup = async (id: string) => {
    setIsDeletingBackup(id);
    try {
      await backupApi.deleteBackup(id);
      toast.success('Backup supprimé');
      setBackupList((prev) => prev.filter((b) => b.id !== id));
      setShowDeleteConfirm(null);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression');
    } finally {
      setIsDeletingBackup(null);
    }
  };

  const handleDownloadBackup = (id: string) => {
    try {
      backupApi.downloadBackup(id);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du téléchargement');
    }
  };

  const handleCleanupStorage = async () => {
    setIsCleaningStorage(true);
    try {
      const result = await backupApi.cleanupStorage();
      if (result.deleted.length > 0) {
        toast.success(`${result.deleted.length} fichier(s) orphelin(s) supprimé(s)`);
      } else {
        toast.success('Aucun fichier orphelin trouvé — le stockage est propre');
      }
      if (result.errors.length > 0) {
        toast.error(`${result.errors.length} erreur(s) lors du nettoyage`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du nettoyage du stockage');
    } finally {
      setIsCleaningStorage(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

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
    setTestResult(null);
    try {
      let provider: string;
      if (integration === 'NetBox') {
        provider = 'netbox';
      } else {
        // Use the selected monitoring provider type, or fallback to 'monitoring'
        provider = monitoringType || 'monitoring';
      }
      const result = await integrationsApi.testConnection(provider as any);
      setTestResult({ provider: integration, success: result.success, message: result.message });
      if (result.success) {
        toast.success(`${integration} : ${result.message}`);
      } else {
        toast.error(`${integration} : ${result.message}`);
      }
    } catch (error: any) {
      const msg = error?.message || 'Erreur de connexion';
      setTestResult({ provider: integration, success: false, message: msg });
      toast.error(`${integration} : ${msg}`);
    } finally {
      setIsTesting(null);
    }
  };

  const handleSaveIntegration = async (provider: 'netbox' | 'monitoring') => {
    setIsSavingIntegration(provider);
    try {
      const data: Record<string, any> = {};
      if (provider === 'netbox') {
        data.netbox = {
          url: netboxUrl,
          // Only send token if it doesn't look like a masked value
          token: netboxToken.startsWith('****') ? '' : netboxToken,
        };
      } else {
        data.monitoring = {
          type: monitoringType,
          url: kumaUrl,
          // API key / password
          ...(monitoringType === 'gatus'
            ? { apiKey: kumaToken.startsWith('****') ? '' : kumaToken }
            : { password: kumaToken.startsWith('****') ? '' : kumaToken }),
        };
      }
      const result = await integrationsApi.saveConfig(data);
      // Update local state with masked values from server
      if (provider === 'netbox') {
        if (result.netbox?.tokenSet) setNetboxToken(result.netbox.tokenHint);
      } else {
        if (result.monitoring?.url) setKumaUrl(result.monitoring.url);
        if (result.monitoring?.apiKeySet) setKumaToken(result.monitoring.apiKeyHint);
        else if (result.monitoring?.passwordSet) setKumaToken(result.monitoring.passwordHint);
      }
      const providerLabel = provider === 'netbox' ? 'NetBox'
        : monitoringType === 'gatus' ? 'Gatus' : 'Uptime Kuma';
      toast.success(`Configuration ${providerLabel} enregistrée`);
    } catch (error: any) {
      toast.error(`Erreur : ${error?.message || 'Impossible de sauvegarder'}`);
    } finally {
      setIsSavingIntegration(null);
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

      <Tabs defaultValue="profile" className="w-full" onValueChange={(val) => {
        if (val === 'backup') { loadBackups(); loadSitesForBackup(); }
      }}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="profile">
            <User className="mr-2 h-4 w-4" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="security">
            <ShieldCheck className="mr-2 h-4 w-4" />
            Sécurité
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Palette className="mr-2 h-4 w-4" />
            Apparence
          </TabsTrigger>
          {user?.role === 'ADMIN' && (
            <TabsTrigger value="org-structure">
              <Network className="mr-2 h-4 w-4" />
              Structure
            </TabsTrigger>
          )}
          {user?.role === 'ADMIN' && (
            <TabsTrigger value="tenant">
              <Building2 className="mr-2 h-4 w-4" />
              Tenant
            </TabsTrigger>
          )}
          {user?.role === 'ADMIN' && (
            <TabsTrigger value="sso">
              <Key className="mr-2 h-4 w-4" />
              SSO
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
          {user?.role === 'ADMIN' && (
            <TabsTrigger value="backup">
              <HardDrive className="mr-2 h-4 w-4" />
              Sauvegardes
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

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <SecurityTabContent />
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

        {/* Organization Structure Tab */}
        <TabsContent value="org-structure" className="space-y-6">
          <OrganizationTab />
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
            <WarrantyThresholdsSection tenantData={tenantData} setTenantData={setTenantData} />
          )}

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

        {/* SSO Tab */}
        <TabsContent value="sso" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Single Sign-On (SSO)
              </CardTitle>
              <CardDescription>
                Configurez l'authentification SSO via OpenID Connect pour permettre à vos utilisateurs de se connecter avec leur compte existant.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SsoConfigSection />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Backup Tab */}
        {user?.role === 'ADMIN' && (
          <TabsContent value="backup" className="space-y-6">

            {/* Section A — Créer une sauvegarde */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Archive className="h-5 w-5" />
                  Créer une sauvegarde
                </CardTitle>
                <CardDescription>
                  Sauvegardez l'intégralité de votre base de données ou exportez un site spécifique.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Full backup */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Backup complet</h4>
                    <p className="text-sm text-muted-foreground">
                      Base de données + fichiers MinIO (plans, photos, QR codes)
                    </p>
                  </div>
                  <Button
                    onClick={handleCreateFullBackup}
                    disabled={isCreatingFullBackup}
                  >
                    {isCreatingFullBackup ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Database className="mr-2 h-4 w-4" />
                    )}
                    {isCreatingFullBackup ? 'Création en cours...' : 'Lancer le backup'}
                  </Button>
                </div>

                {/* Site backup */}
                <div className="p-4 border rounded-lg space-y-3">
                  <div>
                    <h4 className="font-medium">Backup d&apos;un site</h4>
                    <p className="text-sm text-muted-foreground">
                      Exporter un site avec tous ses assets, plans, tâches et fichiers en ZIP.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Select value={selectedBackupSiteId || undefined} onValueChange={setSelectedBackupSiteId}>
                      <SelectTrigger className="w-full max-w-sm">
                        <SelectValue placeholder="Sélectionner un site..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSites.map((site) => (
                          <SelectItem key={site.id} value={site.id}>
                            {site.code} — {site.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      onClick={handleCreateSiteBackup}
                      disabled={isCreatingSiteBackup || !selectedBackupSiteId}
                    >
                      {isCreatingSiteBackup ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      Exporter ZIP
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section B — Sauvegardes disponibles */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileArchive className="h-5 w-5" />
                      Sauvegardes disponibles
                    </CardTitle>
                    <CardDescription>
                      Liste des backups stockés sur le serveur (MinIO).
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadBackups} disabled={isLoadingBackups}>
                    <RefreshCw className={`mr-2 h-3 w-3 ${isLoadingBackups ? 'animate-spin' : ''}`} />
                    Actualiser
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingBackups ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Chargement...
                  </div>
                ) : backupList.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <HardDrive className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>Aucune sauvegarde disponible</p>
                    <p className="text-xs mt-1">Créez votre premier backup ci-dessus.</p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-sm min-w-[600px]">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-medium">Nom</th>
                          <th className="text-left p-3 font-medium">Type</th>
                          <th className="text-left p-3 font-medium">Date</th>
                          <th className="text-left p-3 font-medium">Taille</th>
                          <th className="text-right p-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {backupList.map((backup) => (
                          <tr key={backup.id} className="hover:bg-muted/30">
                            <td className="p-3">
                              <span className="font-mono text-xs">{backup.filename}</span>
                            </td>
                            <td className="p-3">
                              <Badge variant={backup.type === 'full' ? 'default' : 'secondary'}>
                                {backup.type === 'full' ? 'Complet' : 'Site'}
                              </Badge>
                              {backup.siteName && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  {backup.siteName}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-muted-foreground">
                              {new Date(backup.createdAt).toLocaleString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="p-3 text-muted-foreground">
                              {formatFileSize(backup.size)}
                            </td>
                            <td className="p-3 text-right space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownloadBackup(backup.id)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              {showDeleteConfirm === backup.id ? (
                                <span className="inline-flex items-center gap-1">
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDeleteBackup(backup.id)}
                                    disabled={isDeletingBackup === backup.id}
                                  >
                                    {isDeletingBackup === backup.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      'Confirmer'
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowDeleteConfirm(null)}
                                  >
                                    Annuler
                                  </Button>
                                </span>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setShowDeleteConfirm(backup.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Section C — Restaurer un site */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Restaurer un site
                </CardTitle>
                <CardDescription>
                  Importez un fichier ZIP de backup pour restaurer un site avec toutes ses données.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label htmlFor="restore-file" className="sr-only">Fichier ZIP de backup</Label>
                    <Input
                      id="restore-file"
                      type="file"
                      accept=".zip"
                      onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                      className="cursor-pointer"
                    />
                  </div>
                  <Button
                    onClick={handleRestoreSite}
                    disabled={isRestoring || !restoreFile}
                    variant="outline"
                  >
                    {isRestoring ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {isRestoring ? 'Restauration...' : 'Restaurer'}
                  </Button>
                </div>
                {restoreFile && (
                  <p className="text-xs text-muted-foreground">
                    Fichier sélectionné : <span className="font-mono">{restoreFile.name}</span> ({formatFileSize(restoreFile.size)})
                  </p>
                )}
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    La restauration crée un nouveau site avec les données du backup.
                    Les identifiants internes sont régénérés pour éviter les conflits.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Section D — Restaurer un backup complet */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Restaurer un backup complet
                </CardTitle>
                <CardDescription>
                  Importez un fichier ZIP de backup complet pour restaurer tous les sites et données.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label htmlFor="restore-full-file" className="sr-only">Fichier ZIP de backup complet</Label>
                    <Input
                      id="restore-full-file"
                      type="file"
                      accept=".zip"
                      onChange={(e) => setRestoreFullFile(e.target.files?.[0] || null)}
                      className="cursor-pointer"
                    />
                  </div>
                  <Button
                    onClick={handleRestoreFull}
                    disabled={isRestoringFull || !restoreFullFile}
                    variant="outline"
                  >
                    {isRestoringFull ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {isRestoringFull ? 'Restauration...' : 'Restaurer'}
                  </Button>
                </div>
                {restoreFullFile && (
                  <p className="text-xs text-muted-foreground">
                    Fichier sélectionné : <span className="font-mono">{restoreFullFile.name}</span> ({formatFileSize(restoreFullFile.size)})
                  </p>
                )}
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-700 dark:text-red-400">
                    La restauration complète importe tous les sites du backup.
                    Les sites existants (même code) seront ignorés. Les fichiers (plans, pièces jointes) sont restaurés.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Section E — Nettoyage du stockage */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5" />
                  Nettoyage du stockage
                </CardTitle>
                <CardDescription>
                  Supprime les fichiers orphelins dans le stockage MinIO (fichiers sans référence en base de données).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Button
                    onClick={handleCleanupStorage}
                    disabled={isCleaningStorage}
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/30"
                  >
                    {isCleaningStorage ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    {isCleaningStorage ? 'Nettoyage en cours...' : 'Nettoyer les fichiers orphelins'}
                  </Button>
                </div>
                <div className="flex items-start gap-2 p-3 bg-muted/50 border rounded-lg">
                  <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Les fichiers (plans, pièces jointes) qui n&apos;ont plus de référence dans la base de données seront supprimés.
                    Un nettoyage automatique avec un délai de grâce de 24h est également effectué chaque nuit.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
