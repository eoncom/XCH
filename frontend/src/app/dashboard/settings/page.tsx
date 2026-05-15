'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { usePermissions } from '@/hooks/usePermissions';
import { rightLabel } from '@/lib/labels';
import { NotificationsConfigPanel } from './notifications/NotificationsConfigPanel';
import { useAppearance } from '@/components/AppearanceProvider';
import {
  appearanceApi,
  type AppearanceTheme,
  type UpdateTenantAppearanceInput,
  type UpdateUserAppearanceInput,
} from '@/lib/api/appearance';
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
import { Skeleton, CardSkeleton } from '@/components/ui/skeleton';
import { User, Building2, Plug, Save, Sun, Moon, Monitor, Palette, Database, AlertTriangle, RefreshCw, Info, ExternalLink, Key, Image, PaintBucket, ShieldAlert, Plus, Trash2, ToggleLeft, Blocks, Tags, RotateCcw, Check, ShieldCheck, Copy, Loader2, HardDrive, Download, Upload, Archive, FileArchive, Network, X, Bell, Zap, Lock } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useTheme } from 'next-themes';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import Link from 'next/link';
import { useTenantModules } from '@/hooks/useTenantModules';
import { useEnumLabels } from '@/hooks/useEnumLabels';
import { tenantsApi, type SsoConfig } from '@/lib/api/tenants';
import { useQueryClient } from '@tanstack/react-query';
import { THEME_PRESET_LIST, type ThemePreset } from '@/lib/themes';
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
import { cn } from '@/lib/utils';
import { authApi } from '@/lib/api/auth';
import { integrationsApi, type IntegrationConfigResponse } from '@/lib/api/integrations';
import {
  backupApi,
  type BackupMetadata,
  type EstimateResponse,
  type DryRunReport,
  type RestoreFullV2JobResult,
} from '@/lib/api/backup';
import { useBackupJob } from '@/hooks/useBackupJob';
import { Progress } from '@/components/ui/progress';
import { assetModelsApi, type AssetModel, type CreateAssetModelData } from '@/lib/api/asset-models';
import { VendorCatalogImportMenu } from '@/components/asset-models/vendor-catalog-import-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OrganizationTab } from './organization-tab';
import { MyDelegationTab } from './my-delegation-tab';
import { useDelegation } from '@/contexts/DelegationContext';

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
      <CardSkeleton />
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
          Activez ou désactivez les modules de l&apos;application. Les modules désactivés sont masqués de la navigation et leurs API retournent une erreur 403.
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
  const {
    isLoading,
    updateLabel,
    isUpdating,
    resetLabels,
    isResetting,
    getAllLabelsForType,
    createValue,
    isCreating,
    deleteValue,
    isDeleting,
  } = useEnumLabels();
  const [activeType, setActiveType] = useState('AssetType');
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState('');
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('#9ca3af');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <CardSkeleton />
    );
  }

  const currentItems = getAllLabelsForType(activeType);

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
    setShowResetDialog(true);
  };

  const confirmReset = () => {
    resetLabels(activeType, {
      onSuccess: () => toast.success('Labels réinitialisés'),
    });
    setShowResetDialog(false);
  };

  const resetAddForm = () => {
    setShowAddForm(false);
    setNewValue('');
    setNewLabel('');
    setNewColor('#9ca3af');
  };

  const handleCreate = async () => {
    const trimmedValue = newValue.trim();
    const trimmedLabel = newLabel.trim();
    if (!trimmedValue || !trimmedLabel) {
      toast.error('La valeur et le label sont requis');
      return;
    }
    if (!/^[A-Z][A-Z0-9_]*$/.test(trimmedValue)) {
      toast.error('La valeur doit être en UPPER_SNAKE_CASE (ex: MY_VALUE)');
      return;
    }
    try {
      await createValue({
        enumType: activeType,
        enumValue: trimmedValue,
        label: trimmedLabel,
        color: newColor,
      });
      toast.success('Valeur créée');
      resetAddForm();
    } catch (err: any) {
      const status = err?.response?.status || err?.status;
      if (status === 409) {
        toast.error('Cette valeur existe déjà');
      } else {
        toast.error(err?.message || 'Erreur lors de la création');
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteValue(id);
      toast.success('Valeur supprimée');
      setDeleteConfirmId(null);
    } catch (err: any) {
      const status = err?.response?.status || err?.status;
      if (status === 409) {
        toast.error('Impossible de supprimer : cette valeur est utilisée par des enregistrements existants');
      } else {
        toast.error(err?.message || 'Erreur lors de la suppression');
      }
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
          Personnalisez les labels et couleurs des types d&apos;équipement, statuts et repères.
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
              onClick={() => { setActiveType(key); setEditingItem(null); resetAddForm(); }}
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
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors",
                !item.isActive && "opacity-50",
              )}
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
                  {item.isHidden && (
                    <Badge variant="secondary" className="text-xs">Masqué</Badge>
                  )}
                  {item.isBuiltIn ? (
                    <Badge variant="outline" className="text-xs border-blue-300 text-blue-600">Système</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs border-green-300 text-green-600">Personnalisé</Badge>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-muted-foreground"
                    onClick={() => handleStartEdit(item.enumValue, item.label, item.color)}
                  >
                    Modifier
                  </Button>
                  {!item.isBuiltIn && item.id && (
                    deleteConfirmId === item.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8 text-xs"
                          disabled={isDeleting}
                          onClick={() => handleDelete(item.id!)}
                        >
                          {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirmer'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8"
                          onClick={() => setDeleteConfirmId(null)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteConfirmId(item.id!)}
                        title="Supprimer cette valeur"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add new value form */}
        {showAddForm ? (
          <div className="p-4 rounded-lg border border-dashed border-primary/40 bg-primary/5 space-y-3">
            <p className="text-sm font-medium">Ajouter une valeur</p>
            <div className="flex gap-3 flex-wrap items-end">
              <div className="space-y-1">
                <Label className="text-xs">Valeur (UPPER_SNAKE_CASE)</Label>
                <Input
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                  placeholder="EX: MY_VALUE"
                  className="h-8 w-48 font-mono text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') resetAddForm();
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Label</Label>
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Mon label"
                  className="h-8 w-48"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') resetAddForm();
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Couleur</Label>
                <input
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border"
                />
              </div>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={isCreating}
                className="h-8"
              >
                {isCreating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
                Créer
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={resetAddForm}
                className="h-8"
              >
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(true)}
            className="w-full border-dashed"
          >
            <Plus className="mr-1 h-3 w-3" />
            Ajouter une valeur
          </Button>
        )}

        <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0" />
            Les labels personnalisés s&apos;affichent partout dans l&apos;application. Les valeurs internes (code) ne changent pas.
          </p>
        </div>
      </CardContent>

      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la réinitialisation</AlertDialogTitle>
            <AlertDialogDescription>
              Réinitialiser tous les labels &laquo;&nbsp;{ENUM_TYPE_LABELS[activeType]}&nbsp;&raquo; aux valeurs par défaut ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmReset}
            >
              Réinitialiser
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// AUTH_MODEL v2: MANAGE > WRITE > READ (phase 5 refactor). The OIDC strategy
// (backend/src/modules/auth/strategies/oidc.strategy.ts) accepts both new
// MANAGE/WRITE/READ labels and legacy ADMIN/MANAGER/TECHNICIEN/VIEWER for
// backward compat, but the SSO UI should emit the v2 labels directly.
const XCH_ROLES = ['MANAGE', 'WRITE', 'READ'] as const;

const XCH_ROLE_LABELS: Record<string, string> = {
  MANAGE: 'Administrateur (MANAGE)',
  WRITE: 'Éditeur (WRITE)',
  READ: 'Lecteur (READ)',
};

const SCOPE_TYPES = [
  { value: '', label: 'Aucune portée' },
  { value: 'DELEGATION', label: 'Délégation' },
  { value: 'SITE', label: 'Site' },
] as const;

interface ScopeEntry {
  type: 'DELEGATION' | 'SITE';
  id?: string;
}

interface RoleMappingEntry {
  role: string;
  scopes: ScopeEntry[];
}

/**
 * Normalize mapping entries: supports both legacy string format and new object format.
 * Legacy:  { "admin": "ADMIN" }
 * New:     { "admin": { "role": "ADMIN", "scopes": [{ "type": "DELEGATION", "id": "xxx" }] } }
 */
function normalizeMapping(raw: Record<string, any>): Record<string, RoleMappingEntry> {
  const result: Record<string, RoleMappingEntry> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') {
      result[key] = { role: value, scopes: [] };
    } else if (typeof value === 'object' && value.role) {
      result[key] = { role: value.role, scopes: value.scopes || [] };
    }
  }
  return result;
}

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
  const [roleMapping, setRoleMapping] = useState<Record<string, RoleMappingEntry>>({
    admin: { role: 'MANAGE', scopes: [] },
    manager: { role: 'MANAGE', scopes: [] },
    technician: { role: 'WRITE', scopes: [] },
    default: { role: 'READ', scopes: [] },
  });
  const [newMappingKey, setNewMappingKey] = useState('');
  const [newMappingRole, setNewMappingRole] = useState('READ');

  // Load org tree for scope selectors
  const [orgTree, setOrgTree] = useState<any[]>([]);
  useEffect(() => {
    import('@/lib/api/organization').then(({ organizationApi }) => {
      organizationApi.getTree().then(setOrgTree).catch(() => {});
    });
  }, []);

  useEffect(() => {
    const loadSsoConfig = async () => {
      try {
        const config = await tenantsApi.getSsoConfig();
        setSsoConfig(config);
        setSsoEnabled(config.enabled);
        setIssuer(config.issuer);
        setClientId(config.clientId);
        setCallbackUrl(config.callbackUrl || `${window.location.origin}/api/auth/oidc/callback`);
        if (config.roleMapping) {
          setRoleMapping(normalizeMapping(config.roleMapping));
        }
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
      setRoleMapping({ ...roleMapping, [newMappingKey.trim()]: { role: newMappingRole, scopes: [] } });
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

  const updateMappingRole = (key: string, role: string) => {
    setRoleMapping({ ...roleMapping, [key]: { ...roleMapping[key], role } });
  };

  const addScopeToMapping = (key: string) => {
    const entry = roleMapping[key];
    setRoleMapping({
      ...roleMapping,
      [key]: { ...entry, scopes: [...entry.scopes, { type: 'DELEGATION' }] },
    });
  };

  const updateScope = (key: string, scopeIndex: number, scopeType: string, scopeId?: string) => {
    const entry = roleMapping[key];
    const newScopes = [...entry.scopes];
    if (!scopeType) {
      // Remove scope
      newScopes.splice(scopeIndex, 1);
    } else {
      newScopes[scopeIndex] = { type: scopeType as ScopeEntry['type'], ...(scopeId ? { id: scopeId } : {}) };
    }
    setRoleMapping({ ...roleMapping, [key]: { ...entry, scopes: newScopes } });
  };

  const removeScopeFromMapping = (key: string, scopeIndex: number) => {
    const entry = roleMapping[key];
    const newScopes = entry.scopes.filter((_, i) => i !== scopeIndex);
    setRoleMapping({ ...roleMapping, [key]: { ...entry, scopes: newScopes } });
  };

  // Build flat list for scope selectors (tree is now flat delegation list)
  const delegations = orgTree || [];

  if (isLoadingSso) {
    return (
      <div className="border rounded-lg p-4 space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-2/3" />
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
          <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
        </div>
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
              <p className="text-xs text-muted-foreground">L&apos;URL de découverte de votre fournisseur d&apos;identité</p>
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

          {/* Role + Scope mapping */}
          <div className="border-t pt-4 space-y-3">
            <div>
              <h4 className="font-medium text-sm">Mapping des rôles et portées</h4>
              <p className="text-xs text-muted-foreground">
                Associez les groupes/claims de votre IdP aux rôles et portées XCH. Le &quot;default&quot; est utilisé si aucun groupe ne correspond.
              </p>
            </div>

            <div className="space-y-3">
              {Object.entries(roleMapping).map(([groupKey, entry]) => (
                <div key={groupKey} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={groupKey}
                      disabled
                      className="flex-1 h-8 text-sm font-mono bg-muted/50"
                    />
                    <span className="text-xs text-muted-foreground">→</span>
                    <select
                      value={entry.role}
                      onChange={(e) => updateMappingRole(groupKey, e.target.value)}
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

                  {/* Scopes for this group */}
                  <div className="pl-4 space-y-1.5">
                    {entry.scopes.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">Aucune portée (accès selon le rôle seul)</p>
                    )}
                    {entry.scopes.map((scope, si) => (
                      <div key={si} className="flex items-center gap-2">
                        <select
                          value={scope.type}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateScope(groupKey, si, val, '');
                          }}
                          className="h-7 px-2 rounded border bg-background text-xs"
                        >
                          {SCOPE_TYPES.filter(s => s.value).map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>

                        {scope.type === 'DELEGATION' && (
                          <select
                            value={scope.id || ''}
                            onChange={(e) => updateScope(groupKey, si, 'DELEGATION', e.target.value)}
                            className="h-7 px-2 rounded border bg-background text-xs flex-1"
                          >
                            <option value="">-- Choisir --</option>
                            {delegations.map((d: any) => (
                              <option key={d.id} value={d.id}>{d.code} - {d.name}</option>
                            ))}
                          </select>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeScopeFromMapping(groupKey, si)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => addScopeToMapping(groupKey)}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Portée
                    </Button>
                  </div>
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
  const { user, checkSession } = useAuthStore();
  const { isAdmin, isSuperAdmin } = usePermissions();

  // Personal 2FA state
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

  // Tenant security config (ADMIN only)
  const [securityConfig, setSecurityConfig] = useState<{ require2FA: boolean; sessionTimeout: string; refreshTokenLifetime: string } | null>(null);
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);

  // Sync totpEnabled from user store
  useEffect(() => {
    setTotpEnabled(user?.totpEnabled || false);
  }, [user?.totpEnabled]);

  // Load tenant security config
  useEffect(() => {
    if (isAdmin) {
      tenantsApi.getSecurityConfig().then(setSecurityConfig).catch(() => {});
    }
  }, [isAdmin]);

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
        checkSession();
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
      checkSession();
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

  const handleSaveSecurityConfig = async () => {
    if (!securityConfig) return;
    setIsSavingSecurity(true);
    try {
      const updated = await tenantsApi.updateSecurityConfig(securityConfig);
      setSecurityConfig(updated);
      toast.success('Configuration sécurité enregistrée');
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSavingSecurity(false);
    }
  };

  const SESSION_OPTIONS = [
    { value: '5m', label: '5 minutes' },
    { value: '15m', label: '15 minutes' },
    { value: '30m', label: '30 minutes' },
    { value: '1h', label: '1 heure' },
    { value: '4h', label: '4 heures' },
    { value: '8h', label: '8 heures' },
    { value: '24h', label: '24 heures' },
  ];

  const REFRESH_OPTIONS = [
    { value: '1d', label: '1 jour' },
    { value: '7d', label: '7 jours' },
    { value: '14d', label: '14 jours' },
    { value: '30d', label: '30 jours' },
  ];

  return (
    <div className="space-y-6">
      {/* Personal 2FA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Double authentification (2FA)
          </CardTitle>
          <CardDescription>
            Protégez votre compte avec un code temporaire (Google Authenticator, Microsoft Authenticator, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status */}
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <div className={cn(
                'h-10 w-10 rounded-lg flex items-center justify-center',
                totpEnabled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
              )}>
                <ShieldCheck className={cn('h-5 w-5', totpEnabled ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400')} />
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
            <Badge variant={totpEnabled ? 'default' : 'destructive'} className={totpEnabled ? 'bg-green-600' : ''}>
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
                  Ouvrez votre application d&apos;authentification et scannez le QR code ci-dessous.
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
                  <Button onClick={handleVerifySetup} disabled={isVerifying || verifyCode.length !== 6}>
                    {isVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                    Vérifier
                  </Button>
                </div>
              </div>
              <Button variant="ghost" onClick={() => { setSetupStep('idle'); setError(''); }}>Annuler</Button>
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
                  Sauvegardez ces codes de récupération dans un endroit sûr. Chaque code ne peut être utilisé qu&apos;une seule fois.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((code, i) => (
                    <code key={i} className="text-sm font-mono bg-muted px-3 py-2 rounded text-center">{code}</code>
                  ))}
                </div>
                <Button variant="outline" onClick={copyBackupCodes}>
                  <Copy className="mr-2 h-4 w-4" /> Copier les codes
                </Button>
              </div>
              <Button onClick={() => setSetupStep('done')}>J&apos;ai sauvegardé mes codes</Button>
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
                  <p className="text-sm text-muted-foreground">Confirmez votre mot de passe pour désactiver.</p>
                  <div className="flex gap-3">
                    <Input type="password" placeholder="Mot de passe actuel" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} className="max-w-xs" />
                    <Button variant="destructive" onClick={handleDisable} disabled={isDisabling || !disablePassword}>
                      {isDisabling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Désactiver
                    </Button>
                    <Button variant="ghost" onClick={() => { setShowDisable(false); setDisablePassword(''); setError(''); }}>Annuler</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tenant Security Config — super-admin only (tenant-wide policy) */}
      {isSuperAdmin && securityConfig && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Politique de sécurité du tenant
            </CardTitle>
            <CardDescription>
              Configuration globale de la sécurité pour tous les utilisateurs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 2FA mandatory */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium text-sm">2FA obligatoire</p>
                <p className="text-xs text-muted-foreground">
                  Tous les utilisateurs devront activer la double authentification
                </p>
              </div>
              <Switch
                checked={securityConfig.require2FA}
                onCheckedChange={(v) => setSecurityConfig({ ...securityConfig, require2FA: v })}
              />
            </div>

            {/* Session timeout */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Expiration de session</Label>
                <select
                  value={securityConfig.sessionTimeout}
                  onChange={(e) => setSecurityConfig({ ...securityConfig, sessionTimeout: e.target.value })}
                  className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                >
                  {SESSION_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">Durée avant déconnexion automatique (inactivité)</p>
              </div>
              <div className="space-y-2">
                <Label>Durée du jeton de rafraîchissement</Label>
                <select
                  value={securityConfig.refreshTokenLifetime}
                  onChange={(e) => setSecurityConfig({ ...securityConfig, refreshTokenLifetime: e.target.value })}
                  className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                >
                  {REFRESH_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">Durée maximale avant de devoir se reconnecter</p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button size="sm" onClick={handleSaveSecurityConfig} disabled={isSavingSecurity}>
                {isSavingSecurity ? <RefreshCw className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
                Enregistrer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
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
          Configurez les seuils d&apos;alerte pour la fin de garantie des équipements. Les alertes apparaissent sur le dashboard, la liste et le détail des équipements.
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

// ========== ELECTRICITY CONFIG TAB ==========

function ElectricityConfigTab() {
  const [costPerKwh, setCostPerKwh] = useState<string>('0.20');
  const [currency, setCurrency] = useState<string>('EUR');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    tenantsApi.getElectricityConfig()
      .then((cfg) => {
        setCostPerKwh(String(cfg.costPerKwh ?? 0.20));
        setCurrency(cfg.currency || 'EUR');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await tenantsApi.updateElectricityConfig({
        costPerKwh: parseFloat(costPerKwh) || 0,
        currency,
      });
      toast.success('Configuration électricité mise à jour');
    } catch {
      toast.error("Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          Configuration électricité
        </CardTitle>
        <CardDescription>
          Tarif kWh utilisé pour estimer la consommation et les coûts électriques par site.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-10 w-full" /></div>
            <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-10 w-full" /></div>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="costPerKwh">Coût par kWh</Label>
                <Input
                  id="costPerKwh"
                  type="number"
                  step="0.001"
                  min="0"
                  value={costPerKwh}
                  onChange={(e) => setCostPerKwh(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Ex: 0.20 pour 20 centimes le kWh</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Devise</Label>
                <Input
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  placeholder="EUR"
                />
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Enregistrer
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ========== ASSET MODELS TAB ==========

function AssetModelsTabContent() {
  const queryClient = useQueryClient();
  const { getLabelsForType } = useEnumLabels();
  const assetTypeOptions = getLabelsForType('AssetType');
  const [models, setModels] = useState<AssetModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  // v1.4.x — filters for the catalog table
  const [filterType, setFilterType] = useState<string>('all');
  const [filterManufacturer, setFilterManufacturer] = useState<string>('all');
  const [filterSearch, setFilterSearch] = useState<string>('');
  const [formData, setFormData] = useState<CreateAssetModelData>({
    name: '', type: '', manufacturer: '', pricingMode: 'ONE_TIME',
    acquisitionPrice: undefined, monthlyPrice: undefined, currency: 'EUR',
    powerConsumption: undefined, weight: undefined, defaultUHeight: undefined, notes: '',
    wifiCoverageRadius: undefined, wifiFrequency: undefined,
    wifiAntennaType: undefined, wifiTxPowerDbm: undefined,
  });
  const [saving, setSaving] = useState(false);

  const loadModels = async () => {
    setLoading(true);
    try {
      const res = await assetModelsApi.getAll({ pageSize: 200 });
      setModels(res.data);
    } catch { toast.error('Erreur chargement modèles'); }
    setLoading(false);
  };

  useEffect(() => { loadModels(); }, []);

  const resetForm = () => {
    setFormData({ name: '', type: '', manufacturer: '', pricingMode: 'ONE_TIME',
      acquisitionPrice: undefined, monthlyPrice: undefined, currency: 'EUR',
      powerConsumption: undefined, weight: undefined, defaultUHeight: undefined, notes: '',
      wifiCoverageRadius: undefined, wifiFrequency: undefined,
      wifiAntennaType: undefined, wifiTxPowerDbm: undefined });
    setShowAddForm(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.type) { toast.error('Nom et type requis'); return; }
    setSaving(true);
    try {
      if (editingId) {
        await assetModelsApi.update(editingId, formData);
        toast.success('Modèle mis à jour');
      } else {
        await assetModelsApi.create(formData);
        toast.success('Modèle créé');
      }
      resetForm();
      loadModels();
    } catch (e: any) {
      toast.error(e?.message || 'Erreur');
    }
    setSaving(false);
  };

  const handleEdit = (model: AssetModel) => {
    setEditingId(model.id);
    setFormData({
      name: model.name, type: model.type, manufacturer: model.manufacturer || '',
      pricingMode: model.pricingMode, acquisitionPrice: model.acquisitionPrice ?? undefined,
      monthlyPrice: model.monthlyPrice ?? undefined, currency: model.currency,
      powerConsumption: model.powerConsumption ?? undefined, weight: model.weight ?? undefined,
      defaultUHeight: model.defaultUHeight ?? undefined, notes: model.notes || '',
      wifiCoverageRadius: (model as any).wifiCoverageRadius ?? undefined,
      wifiFrequency: (model as any).wifiFrequency ?? undefined,
      wifiAntennaType: (model as any).wifiAntennaType ?? undefined,
      wifiTxPowerDbm: (model as any).wifiTxPowerDbm ?? undefined,
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await assetModelsApi.delete(id);
      toast.success('Modèle supprimé');
      setDeleteConfirmId(null);
      loadModels();
    } catch (e: any) {
      toast.error(e?.message || 'Impossible de supprimer ce modèle');
      setDeleteConfirmId(null);
    }
  };

  const formatPrice = (model: AssetModel) => {
    if (model.pricingMode === 'MONTHLY' && model.monthlyPrice) {
      return `${model.monthlyPrice} ${model.currency}/mois`;
    }
    if (model.acquisitionPrice) {
      return `${model.acquisitionPrice} ${model.currency}`;
    }
    return '-';
  };

  if (loading) {
    return <CardSkeleton />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />Modèles d&apos;équipement</CardTitle>
            <CardDescription>Catalogue de modèles avec prix pré-définis. Lors de la création d&apos;un asset, sélectionner un modèle pré-remplit les champs.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <VendorCatalogImportMenu onImported={loadModels} />
            <Button onClick={() => { resetForm(); setShowAddForm(true); }} size="sm">
              <Plus className="h-4 w-4 mr-1" />{editingId ? 'Modifier' : 'Ajouter un modèle'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {showAddForm && (
          <div className="mb-6 p-4 border rounded-lg bg-muted/30 space-y-4">
            <h4 className="font-medium">{editingId ? 'Modifier le modèle' : 'Nouveau modèle'}</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Nom *</Label>
                <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="HP LaserJet Pro M404n" />
              </div>
              <div>
                <Label>Fabricant</Label>
                <Input value={formData.manufacturer || ''} onChange={(e) => setFormData({...formData, manufacturer: e.target.value})} placeholder="HP" />
              </div>
              <div>
                <Label>Type *</Label>
                <Select
                  value={formData.type || ''}
                  onValueChange={(v) => setFormData({ ...formData, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {assetTypeOptions.map((opt) => (
                      <SelectItem key={opt.enumValue} value={opt.enumValue}>
                        {opt.label || opt.enumValue}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Mode tarification</Label>
                <Select value={formData.pricingMode || 'ONE_TIME'} onValueChange={(v) => setFormData({...formData, pricingMode: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ONE_TIME">Achat unique</SelectItem>
                    <SelectItem value="MONTHLY">Mensuel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{formData.pricingMode === 'MONTHLY' ? 'Prix mensuel' : 'Prix d\'achat'}</Label>
                <Input type="number" min="0" step="0.01"
                  value={formData.pricingMode === 'MONTHLY' ? (formData.monthlyPrice ?? '') : (formData.acquisitionPrice ?? '')}
                  onChange={(e) => {
                    const val = e.target.value ? parseFloat(e.target.value) : undefined;
                    if (formData.pricingMode === 'MONTHLY') setFormData({...formData, monthlyPrice: val});
                    else setFormData({...formData, acquisitionPrice: val});
                  }}
                  placeholder="0.00" />
              </div>
              <div>
                <Label>Devise</Label>
                <Input value={formData.currency || 'EUR'} onChange={(e) => setFormData({...formData, currency: e.target.value})} />
              </div>
              <div>
                <Label>Consommation (W)</Label>
                <Input type="number" min="0" value={formData.powerConsumption ?? ''} onChange={(e) => setFormData({...formData, powerConsumption: e.target.value ? parseFloat(e.target.value) : undefined})} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Poids (kg)</Label>
                <Input type="number" min="0" step="0.1" value={formData.weight ?? ''} onChange={(e) => setFormData({...formData, weight: e.target.value ? parseFloat(e.target.value) : undefined})} />
              </div>
              <div>
                <Label>Hauteur U par défaut</Label>
                <Input type="number" min="1" value={formData.defaultUHeight ?? ''} onChange={(e) => setFormData({...formData, defaultUHeight: e.target.value ? parseInt(e.target.value) : undefined})} />
              </div>
              <div>
                <Label>Notes</Label>
                <Input value={formData.notes || ''} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
              </div>
            </div>

            {/* v1.4.x — Couverture WiFi (affichée uniquement pour le type WIFI_AP).
                 Les valeurs pré-remplissent l'asset lors de sa création et sont
                 utilisées par la heatmap Wi-Fi sur les plans d'étage. */}
            {formData.type === 'WIFI_AP' && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-1">Couverture WiFi (valeurs par défaut)</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Pré-remplit l&apos;équipement créé à partir de ce modèle et pilote l&apos;affichage
                  de la zone de couverture sur les plans de sol.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Rayon de couverture (m)</Label>
                    <Input type="number" min="0" step="0.5"
                      value={formData.wifiCoverageRadius ?? ''}
                      onChange={(e) => setFormData({ ...formData, wifiCoverageRadius: e.target.value ? parseFloat(e.target.value) : undefined })}
                      placeholder="15" />
                  </div>
                  <div>
                    <Label>Fréquence</Label>
                    <Select value={formData.wifiFrequency || ''} onValueChange={(v) => setFormData({ ...formData, wifiFrequency: v || undefined })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2.4GHz">2.4 GHz</SelectItem>
                        <SelectItem value="5GHz">5 GHz</SelectItem>
                        <SelectItem value="6GHz">6 GHz (WiFi 6E)</SelectItem>
                        <SelectItem value="DUAL">Dual-band (2.4 + 5)</SelectItem>
                        <SelectItem value="TRI">Tri-band (2.4 + 5 + 6)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Type d&apos;antenne</Label>
                    <Select value={formData.wifiAntennaType || ''} onValueChange={(v) => setFormData({ ...formData, wifiAntennaType: v || undefined })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OMNI">Omnidirectionnelle</SelectItem>
                        <SelectItem value="DIRECTIONAL">Directionnelle</SelectItem>
                        <SelectItem value="SECTOR">Sectorielle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Puissance (dBm)</Label>
                    <Input type="number" min="0" max="30"
                      value={formData.wifiTxPowerDbm ?? ''}
                      onChange={(e) => setFormData({ ...formData, wifiTxPowerDbm: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                      placeholder="20" />
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} size="sm">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                {editingId ? 'Mettre à jour' : 'Créer'}
              </Button>
              <Button variant="outline" onClick={resetForm} size="sm">
                <X className="h-4 w-4 mr-1" />Annuler
              </Button>
            </div>
          </div>
        )}

        {models.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Aucun modèle d&apos;équipement. Cliquez sur &quot;Ajouter un modèle&quot; pour commencer.</p>
        ) : (() => {
          // Manufacturers & types derived from the current catalog for the filter dropdowns
          const manufacturers = Array.from(new Set(models.map(m => m.manufacturer).filter(Boolean) as string[])).sort();
          const types = Array.from(new Set(models.map(m => m.type))).sort();
          const term = filterSearch.trim().toLowerCase();
          const filtered = models.filter(m => {
            if (filterType !== 'all' && m.type !== filterType) return false;
            if (filterManufacturer !== 'all' && m.manufacturer !== filterManufacturer) return false;
            if (term) {
              const hay = `${m.name} ${m.manufacturer || ''} ${m.notes || ''}`.toLowerCase();
              if (!hay.includes(term)) return false;
            }
            return true;
          }).sort((a, b) => {
            const man = (a.manufacturer || '').localeCompare(b.manufacturer || '');
            if (man !== 0) return man;
            const typeCmp = a.type.localeCompare(b.type);
            if (typeCmp !== 0) return typeCmp;
            return a.name.localeCompare(b.name);
          });
          return (
          <>
          <div className="mb-3 grid grid-cols-1 md:grid-cols-4 gap-2">
            <Input
              placeholder="Rechercher (nom, fabricant, notes)…"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
            />
            <Select value={filterManufacturer} onValueChange={setFilterManufacturer}>
              <SelectTrigger><SelectValue placeholder="Fabricant" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les fabricants</SelectItem>
                {manufacturers.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {types.map(t => {
                  const opt = assetTypeOptions.find((o: any) => o.enumValue === t);
                  return <SelectItem key={t} value={t}>{opt?.label || t}</SelectItem>;
                })}
              </SelectContent>
            </Select>
            <div className="flex items-center text-sm text-muted-foreground gap-1">
              <span>{filtered.length} / {models.length} modèle{models.length > 1 ? 's' : ''}</span>
              {(filterType !== 'all' || filterManufacturer !== 'all' || term) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-7 text-xs"
                  onClick={() => { setFilterType('all'); setFilterManufacturer('all'); setFilterSearch(''); }}
                >
                  <X className="h-3 w-3 mr-1" /> Effacer
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  const url = assetModelsApi.exportPackUrl({
                    manufacturer: filterManufacturer !== 'all' ? filterManufacturer : undefined,
                    type: filterType !== 'all' ? filterType : undefined,
                  });
                  window.open(url, '_blank');
                }}
                title="Télécharger le catalogue (filtré) au format JSON"
              >
                <Download className="h-3 w-3 mr-1" /> Exporter JSON
              </Button>
            </div>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Nom</th>
                  <th className="text-left p-3 font-medium">Fabricant</th>
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-left p-3 font-medium">Prix</th>
                  <th className="text-left p-3 font-medium">Watts</th>
                  <th className="text-left p-3 font-medium">U</th>
                  <th className="text-left p-3 font-medium">Assets</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-muted-foreground py-6">Aucun modèle ne correspond aux filtres.</td></tr>
                )}
                {filtered.map((model) => (
                  <tr key={model.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 font-medium">{model.name}</td>
                    <td className="p-3 text-muted-foreground">{model.manufacturer || '-'}</td>
                    <td className="p-3"><Badge variant="secondary">{model.type}</Badge></td>
                    <td className="p-3">{formatPrice(model)}</td>
                    <td className="p-3">{model.powerConsumption ? `${model.powerConsumption}W` : '-'}</td>
                    <td className="p-3">{model.defaultUHeight ?? '-'}</td>
                    <td className="p-3">{model._count?.assets ?? 0}</td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(model)}>
                          <Palette className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive"
                          onClick={() => setDeleteConfirmId(model.id)}
                          disabled={!!(model._count?.assets && model._count.assets > 0)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
          );
        })()}
      </CardContent>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce modèle ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible. Le modèle sera supprimé du catalogue.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// Tabs that the URL ?tab= deep-link is allowed to land on. Anything else
// falls back to the default 'profile' tab.
const VALID_TAB_VALUES = new Set([
  'profile', 'security', 'appearance', 'org-structure', 'my-delegation',
  'tenant', 'sso', 'modules', 'types', 'models', 'electricity', 'backup',
  'notifications',
]);

export default function SettingsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAdmin, isManagerOrAbove, isSuperAdmin, canManage, role: permRole } = usePermissions();
  const { delegations: userDelegations } = useDelegation();

  // Controlled tab so the page can be deep-linked from elsewhere
  // (e.g. bell icon in /dashboard/notifications → ?tab=notifications).
  const initialTab = (() => {
    const qp = searchParams?.get('tab');
    return qp && VALID_TAB_VALUES.has(qp) ? qp : 'profile';
  })();
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  // Reflect tab changes in the URL without triggering a navigation, so reload
  // and back-button keep the right tab. Skip updating when value matches the
  // existing query param to avoid a useless replace().
  useEffect(() => {
    const qp = searchParams?.get('tab');
    if (qp === activeTab) return;
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (activeTab === 'profile') params.delete('tab');
    else params.set('tab', activeTab);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // If the URL tab param changes externally (back/forward), follow it.
  useEffect(() => {
    const qp = searchParams?.get('tab');
    const next = qp && VALID_TAB_VALUES.has(qp) ? qp : 'profile';
    if (next !== activeTab) setActiveTab(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Profile "Rôle" field: show the highest right the user holds across ALL his
  // delegations (not the active one), i18n-translated. SuperAdmin wins.
  const profileRightLabel = (() => {
    if (isSuperAdmin) return 'Super Admin';
    const rank: Record<string, number> = { MANAGE: 3, WRITE: 2, READ: 1 };
    const best = userDelegations.reduce<string | null>((acc, d) => {
      if (!acc) return d.right;
      return (rank[d.right] ?? 0) > (rank[acc] ?? 0) ? d.right : acc;
    }, null);
    return rightLabel(best || permRole);
  })();
  // Tab visible if user has MANAGE on ANY delegation (not just the active one)
  const hasAnyManage = userDelegations.some((d) => d.right === 'MANAGE');
  const { theme, setTheme } = useTheme();
  // User-level theme preference (persisted via PATCH /api/users/me/appearance).
  // We keep next-themes' `theme` as a fallback for the very first render before
  // `userAppearance` resolves, and call `reloadAppearance()` after each update
  // so AppearanceProvider re-applies the new theme via setTheme on its end.
  const { appearance: userAppearance, reload: reloadAppearance } = useAppearance();
  const [savingUserTheme, setSavingUserTheme] = useState(false);
  const userThemeLocked = userAppearance ? userAppearance.allowUserOverride === false : false;
  const activeUserTheme: AppearanceTheme = (userAppearance?.theme ?? (theme as AppearanceTheme | undefined) ?? 'system');
  const setUserTheme = async (next: AppearanceTheme) => {
    if (savingUserTheme || userThemeLocked) return;
    setSavingUserTheme(true);
    try {
      // Optimistic UX: flip next-themes immediately so the page reacts without
      // waiting for the round-trip; reloadAppearance() will reconcile after.
      setTheme(next);
      await appearanceApi.updateMine({ source: 'custom', theme: next });
      await reloadAppearance();
    } catch (e: any) {
      toast.error(e?.message || 'Erreur lors de la mise à jour du thème');
    } finally {
      setSavingUserTheme(false);
    }
  };
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [tenantData, setTenantData] = useState<TenantConfig | null>(null);
  const [isLoadingTenant, setIsLoadingTenant] = useState(true);

  // Form state for tenant config
  const [orgName, setOrgName] = useState('');
  const [domain, setDomain] = useState('');
  const [timezone, setTimezone] = useState('Europe/Paris');
  const [language, setLanguage] = useState('Français');

  // Integration state (NetBox only — ADR-016 native monitoring)
  const [netboxUrl, setNetboxUrl] = useState('');
  const [netboxToken, setNetboxToken] = useState('');
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
  // Track D.2 Step 4.5 — async multipart upload restore (replaces the
  // legacy sync v1 path once X-Backup-Sync is removed in v2.4.0).
  const [uploadBackupFile, setUploadBackupFile] = useState<File | null>(null);
  const [uploadSidecarFile, setUploadSidecarFile] = useState<File | null>(null);
  const [isCleaningStorage, setIsCleaningStorage] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [availableSites, setAvailableSites] = useState<{ id: string; name: string; code: string }[]>([]);

  // Track D.1 step 7 — async backup/restore via Bull v3 + dry-run preview
  /** Active backup-jobs jobId — drives the useBackupJob polling hook. */
  const [currentBackupJobId, setCurrentBackupJobId] = useState<string | null>(null);
  /** Pre-flight estimate for the create-full dialog. */
  const [backupEstimate, setBackupEstimate] = useState<EstimateResponse | null>(null);
  const [isFetchingEstimate, setIsFetchingEstimate] = useState(false);
  /** Backup options toggled in the pre-launch dialog. */
  const [backupDbOnly, setBackupDbOnly] = useState(false);
  /** Track D.2 — encrypt the backup ZIP (AES-256-GCM streaming). */
  const [backupEncrypt, setBackupEncrypt] = useState(false);
  /** Track D.2 — server-driven capability flags (loaded once on mount). */
  const [backupCapabilities, setBackupCapabilities] = useState<{ encryption: boolean } | null>(null);
  /** Track D.2 Step 4 — cross-tenant restore: target delegation id in caller tenant. */
  const [restoreTargetDelegationId, setRestoreTargetDelegationId] = useState<string>('');
  const [restoreCrossTenant, setRestoreCrossTenant] = useState(false);
  const [availableDelegations, setAvailableDelegations] = useState<{ id: string; label: string }[]>([]);
  /** Selected catalog backup for async restore + dry-run preview. */
  const [selectedRestoreBackupId, setSelectedRestoreBackupId] = useState<string | null>(null);
  const [restoreDryRun, setRestoreDryRun] = useState(true); // safe default
  /** Dry-run report shown after a completed dry-run job. */
  const [dryRunReport, setDryRunReport] = useState<DryRunReport | null>(null);

  // Subscribe to the active job's status (polls every 2s, stops on completed/failed).
  const backupJob = useBackupJob(currentBackupJobId);

  /**
   * Local strings table for the Track D.1 backup UI. Extracted to ease a
   * future i18n migration without touching the JSX tree.
   */
  const T = {
    estimateBtn: 'Calculer la taille estimée',
    estimateLoading: 'Calcul en cours…',
    estimateLabels: {
      data: 'Données métier (DB)',
      files: 'Fichiers MinIO',
      total: 'Total estimé',
      fileCount: 'Nombre de fichiers',
      diskFree: 'Espace disque disponible',
    },
    estimateInsufficient: 'Espace disque insuffisant pour le backup (besoin × 1.2 + 512 MB).',
    dbOnlyToggle: 'Base de données seule (skip MinIO)',
    encryptToggle: 'Chiffrer le backup (AES-256-GCM)',
    encryptDisabled: 'Chiffrement indisponible (clé maître non configurée serveur)',
    launchBackup: 'Lancer la sauvegarde',
    backupInProgress: 'Sauvegarde en cours…',
    backupCompleted: 'Sauvegarde terminée',
    backupFailed: 'Échec de la sauvegarde',
    jobUnknown: 'Job introuvable (Redis peut avoir perdu la trace)',
    dryRunToggle: 'Aperçu seulement (dry-run)',
    dryRunInfo:
      'Le dry-run probe les clés naturelles contre la DB sans rien écrire, ' +
      'et liste ce qui serait créé ou conservé.',
    confirmApply: 'Confirmer l’application réelle',
    dryRunHeaders: {
      table: 'Table',
      wouldCreate: 'À créer',
      wouldSkip: 'À conserver (existe déjà)',
    },
    dryRunIssues: {
      missing: 'Fichiers manquants dans l’archive',
      invalid: 'Checksums sha256 invalides',
      none: 'Aucun',
    },
  } as const;

  /** Fetch pre-flight backup size estimate. Called when the user toggles
   * `dbOnly` or opens the create-backup card. */
  const fetchEstimate = async (dbOnly: boolean): Promise<void> => {
    setIsFetchingEstimate(true);
    try {
      const est = await backupApi.estimate({ dbOnly });
      setBackupEstimate(est);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du calcul de l’estimation');
    } finally {
      setIsFetchingEstimate(false);
    }
  };

  // Load tenant data on mount
  useEffect(() => {
    const loadTenant = async () => {
      try {
        const tenant = await apiClient.get<TenantConfig>('/api/tenants/current');
        setTenantData(tenant);
        setOrgName(tenant.name || 'Mon Organisation');
        // ADR-018 — domain/timezone/language used to live in tenant.config
        // (never read by backend). They're now sourced from subdomain only.
        setDomain(tenant.subdomain || 'xch.local');
        setTimezone('Europe/Paris');
        setLanguage('Français');
        setLogoUrl(tenant.logoUrl || '');
        setPrimaryColor(tenant.primaryColor || '#0070f3');
        // ADR-018 — branding.theme/securityReminders surfaced via the assembled
        // config shape (TenantBranding + TenantSecurityReminder relations).
        setSelectedTheme(((tenant.config as any)?.branding?.theme) || 'blue');
        const reminders = (tenant.config as any)?.branding?.securityReminders;
        if (Array.isArray(reminders) && reminders.length > 0) {
          setSecurityReminders(reminders);
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

  /**
   * Track D.1 step 7 — enqueue an async backup job on the Bull v3
   * `backup-jobs` queue. Returns 202 + jobId ; the `useBackupJob` hook
   * picks up the jobId and starts polling for progress.
   */
  const handleCreateFullBackup = async () => {
    setIsCreatingFullBackup(true);
    try {
      const enqueued = await backupApi.createFullAsync({
        dbOnly: backupDbOnly,
        encrypt: backupEncrypt,
      });
      setCurrentBackupJobId(enqueued.jobId);
      setDryRunReport(null); // clear any previous dry-run report
      toast.success(`Sauvegarde lancée (job ${enqueued.jobId})`);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création du backup');
    } finally {
      setIsCreatingFullBackup(false);
    }
  };

  /**
   * Track D.1 step 7 — enqueue an async restore job from a catalog backup.
   * `dryRun: true` (safe default) returns a `DryRunReport` ; user must
   * explicitly re-submit with `dryRun: false` to actually apply.
   */
  const handleRestoreFullAsync = async (backupId: string, dryRun: boolean) => {
    setIsRestoringFull(true);
    try {
      // Track D.2 Step 4 — pass targetDelegationId for cross-tenant
      // restore mode. Empty string = same-tenant restore (default).
      const targetDelegationId = restoreCrossTenant && restoreTargetDelegationId
        ? restoreTargetDelegationId
        : undefined;
      const enqueued = await backupApi.restoreFullAsync({
        backupId,
        dryRun,
        targetDelegationId,
      });
      setCurrentBackupJobId(enqueued.jobId);
      setDryRunReport(null);
      toast.success(
        dryRun
          ? `Aperçu (dry-run) lancé (job ${enqueued.jobId})`
          : `Restauration lancée (job ${enqueued.jobId})`,
      );
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la restauration');
    } finally {
      setIsRestoringFull(false);
    }
  };

  // Watch the active job for terminal states. On completion : refresh
  // catalog + show toast (or capture dry-run report for inline display).
  // On failure : surface error message.
  useEffect(() => {
    if (!backupJob.status) return;
    if (backupJob.isCompleted) {
      const result = backupJob.result as
        | { kind?: 'dry-run' | 'applied' | 'delegated-v1'; report?: DryRunReport; message?: string }
        | undefined;
      if (result?.kind === 'dry-run' && result.report) {
        setDryRunReport(result.report);
        toast.success('Aperçu (dry-run) calculé — revoyez le diff ci-dessous');
      } else {
        toast.success(result?.message || T.backupCompleted);
      }
      loadBackups();
    } else if (backupJob.isFailed || backupJob.isUnknown) {
      const msg = backupJob.isUnknown ? T.jobUnknown : backupJob.error || T.backupFailed;
      toast.error(msg);
    }
  }, [backupJob.isCompleted, backupJob.isFailed, backupJob.isUnknown]); // eslint-disable-line react-hooks/exhaustive-deps

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

  /**
   * Track D.2 Step 4.5 — async multipart upload restore. Streams the
   * ZIP (+ optional sidecar) to the backend tmp dir, enqueues a Bull
   * `restore-full` job, and hands off to the same `useBackupJob` poll
   * machinery as the catalog-restore path. Cross-tenant + dry-run
   * options are honored.
   */
  const handleRestoreFromUpload = async () => {
    if (!uploadBackupFile) {
      toast.error('Veuillez sélectionner un fichier .zip à restaurer');
      return;
    }
    setIsRestoringFull(true);
    try {
      const targetDelegationId = restoreCrossTenant && restoreTargetDelegationId
        ? restoreTargetDelegationId
        : undefined;
      const enqueued = await backupApi.restoreFullFromUpload(
        uploadBackupFile,
        uploadSidecarFile,
        { dryRun: restoreDryRun, targetDelegationId },
      );
      setCurrentBackupJobId(enqueued.jobId);
      setDryRunReport(null);
      toast.success(
        restoreDryRun
          ? `Aperçu (dry-run) lancé depuis l'upload (job ${enqueued.jobId})`
          : `Restauration lancée depuis l'upload (job ${enqueued.jobId})`,
      );
      // Reset file inputs — the user can re-select if needed after the job.
      setUploadBackupFile(null);
      setUploadSidecarFile(null);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du restore depuis upload');
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
    // Tenant-wide settings are super-admin only (backend: PATCH /tenants/current
    // with class-level @SkipDelegation + @RequireManage).
    if (!isSuperAdmin) return;

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
    if (!isSuperAdmin) return;
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
      const result = await integrationsApi.testConnection('netbox');
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

  const handleSaveIntegration = async (provider: 'netbox') => {
    setIsSavingIntegration(provider);
    try {
      const data: Record<string, any> = {
        netbox: {
          url: netboxUrl,
          // Only send token if it doesn't look like a masked value
          token: netboxToken.startsWith('****') ? '' : netboxToken,
        },
      };
      const result = await integrationsApi.saveConfig(data);
      if (result.netbox?.tokenSet) setNetboxToken(result.netbox.tokenHint);
      toast.success('Configuration NetBox enregistrée');
    } catch (error: any) {
      toast.error(`Erreur : ${error?.message || 'Impossible de sauvegarder'}`);
    } finally {
      setIsSavingIntegration(null);
    }
  };

  const handleLoadDemo = async () => {
    if (!isSuperAdmin) return;

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
    if (!isSuperAdmin || !showResetConfirm) return;

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
          Gérez votre profil et les paramètres de l&apos;application
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val);
          if (val === 'backup') {
            loadBackups();
            loadSitesForBackup();
            // Track D.2 — fetch server capabilities once per tab open.
            // Cheaper than a useEffect (only loads when user navigates to
            // the backup tab) and keeps the toggle state honest after a
            // restart (e.g. XCH_MASTER_KEY added without a page refresh).
            backupApi.capabilities()
              .then(setBackupCapabilities)
              .catch(() => setBackupCapabilities({ encryption: false }));
            // Track D.2 Step 4 — load delegations for cross-tenant
            // restore target picker. Backend enforces "must belong to
            // caller's tenant" — endpoint already scopes by tenantId.
            apiClient.get<{ data: Array<{ id: string; name?: string; label?: string; slug?: string }> }>(
              '/api/delegations',
            )
              .then((res) => {
                const list = (res?.data ?? []).map((d) => ({
                  id: d.id,
                  label: d.name ?? d.label ?? d.slug ?? d.id,
                }));
                setAvailableDelegations(list);
              })
              .catch(() => setAvailableDelegations([]));
          }
        }}
        className="w-full"
      >
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
          {isSuperAdmin && (
            <TabsTrigger value="org-structure">
              <Network className="mr-2 h-4 w-4" />
              Structure
            </TabsTrigger>
          )}
          {hasAnyManage && !isSuperAdmin && (
            <TabsTrigger value="my-delegation">
              <Building2 className="mr-2 h-4 w-4" />
              Ma délégation
            </TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="tenant">
              <Building2 className="mr-2 h-4 w-4" />
              Tenant
            </TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="sso">
              <Key className="mr-2 h-4 w-4" />
              SSO
            </TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="modules">
              <Blocks className="mr-2 h-4 w-4" />
              Modules
            </TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="types">
              <Tags className="mr-2 h-4 w-4" />
              Types
            </TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="models">
              <Database className="mr-2 h-4 w-4" />
              Modèles
            </TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="electricity">
              <Zap className="mr-2 h-4 w-4" />
              Électricité
            </TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="backup">
              <HardDrive className="mr-2 h-4 w-4" />
              Sauvegardes
            </TabsTrigger>
          )}
          {isManagerOrAbove && (
            <TabsTrigger value="notifications">
              <Bell className="mr-2 h-4 w-4" />
              Notifications
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
                  <Input id="role" value={profileRightLabel} disabled readOnly />
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
                {/* autoComplete="current-password" but defaultValue empty & a hidden
                    dummy field prevents Chrome from auto-filling the value while
                    still offering the password manager action on submit. */}
                <input type="text" name="prevent-autofill" autoComplete="username" className="hidden" readOnly />
                <Input id="currentPassword" type="password" autoComplete="current-password" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                <Input id="newPassword" type="password" autoComplete="new-password" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">
                  Confirmer le mot de passe
                </Label>
                <Input id="confirmPassword" type="password" autoComplete="new-password" />
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
          {isLoadingTenant ? (
            <Card>
              <CardHeader><Skeleton className="h-6 w-24" /></CardHeader>
              <CardContent className="space-y-6">
                <Skeleton className="h-4 w-2/3" />
                <div className="grid grid-cols-3 gap-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-32 w-full rounded-lg" />
                  ))}
                </div>
                {isAdmin && (
                  <div className="border-t pt-4 space-y-4">
                    <Skeleton className="h-5 w-40" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {Array.from({ length: 7 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 w-full rounded-lg" />
                      ))}
                    </div>
                  </div>
                )}
                <div className="border-t pt-4 space-y-3">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-32 w-full rounded-lg" />
                </div>
              </CardContent>
            </Card>
          ) : (
          <Card>
            <CardHeader>
              <CardTitle>Thème</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Choisissez le thème de l&apos;interface utilisateur
                </p>
                {userThemeLocked && (
                  <p className="text-xs text-muted-foreground">
                    Thème verrouillé par l&apos;administrateur — vous ne pouvez pas le modifier.
                  </p>
                )}
                <div className="grid grid-cols-3 gap-4">
                  <button
                    onClick={() => setUserTheme('light')}
                    disabled={savingUserTheme || userThemeLocked}
                    className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      activeUserTheme === 'light'
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground/50'
                    }`}
                  >
                    {/* Theme picker swatches: hardcoded light/dark colors are intentional —
                        each swatch previews what the named theme looks like. */}
                    <div className="h-16 w-16 rounded-lg bg-white border border-gray-200 flex items-center justify-center mb-3 shadow-sm">
                      <Sun className="h-8 w-8 text-yellow-500" />
                    </div>
                    <span className="font-medium">Clair</span>
                    <span className="text-xs text-muted-foreground mt-1">Mode jour</span>
                  </button>

                  <button
                    onClick={() => setUserTheme('dark')}
                    disabled={savingUserTheme || userThemeLocked}
                    className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      activeUserTheme === 'dark'
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground/50'
                    }`}
                  >
                    {/* See comment above on the light swatch — same rationale. */}
                    <div className="h-16 w-16 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center mb-3 shadow-sm">
                      <Moon className="h-8 w-8 text-slate-400" />
                    </div>
                    <span className="font-medium">Sombre</span>
                    <span className="text-xs text-muted-foreground mt-1">Mode nuit</span>
                  </button>

                  <button
                    onClick={() => setUserTheme('system')}
                    disabled={savingUserTheme || userThemeLocked}
                    className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      activeUserTheme === 'system'
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
              {isAdmin && (
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
          )}

          {/* v1.4 — Source + tenant override controls (ADR-010) */}
          <AppearancePreferencesCard />
          {isSuperAdmin && <TenantAppearanceCard />}
        </TabsContent>

        {/* Organization Structure Tab — super admin only */}
        <TabsContent value="org-structure" className="space-y-6">
          <OrganizationTab />
        </TabsContent>

        {/* My Delegation Tab — local MANAGE users */}
        <TabsContent value="my-delegation" className="space-y-6">
          <MyDelegationTab />
        </TabsContent>

        {/* Tenant Tab */}
        <TabsContent value="tenant" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations de l&apos;organisation</CardTitle>
              <CardDescription>
                Ces informations sont utilisées dans les exports PDF, les en-têtes et l&apos;identification de votre espace.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingTenant ? (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-10 w-full" /></div>
                    <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
                    <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="orgName" className="flex items-center gap-2">
                        Nom de l&apos;organisation
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
                        disabled={!isAdmin}
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
                        disabled={!isAdmin}
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
                              <p className="text-xs">Affecte l&apos;affichage des dates et heures dans l&apos;application</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <Input
                        id="timezone"
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        disabled={!isAdmin}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="language">Langue</Label>
                      <Input
                        id="language"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        disabled={!isAdmin}
                      />
                    </div>
                  </div>

                  {/* Logo */}
                  <div className="border-t pt-4 space-y-2">
                    <Label htmlFor="logoUrl" className="flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      Logo de l&apos;organisation
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Affiché dans les exports PDF et l&apos;en-tête de l&apos;application. URL vers une image (PNG, JPG, SVG).</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <div className="flex items-center gap-4">
                      {logoUrl && (
                        // Logos are typically transparent/light — keep white bg in both themes,
                        // add a ring in dark mode so the swatch reads against the dark canvas.
                        <div className="h-12 w-12 rounded-lg border bg-white dark:ring-1 dark:ring-border flex items-center justify-center overflow-hidden">
                          <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                        </div>
                      )}
                      <Input
                        id="logoUrl"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="URL d'une image hébergée (PNG / SVG) — laissez vide pour n'afficher que le nom"
                        disabled={!isAdmin}
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
                      Ces rappels apparaissent dans l&apos;info-bulle de sécurité près des &quot;Informations d&apos;accès&quot; sur chaque site.
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
                            disabled={!isAdmin}
                            className="flex-1 text-sm"
                          />
                          {isAdmin && (
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
                    {isAdmin && (
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

                  {isAdmin && (
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

          {isAdmin && (
            <WarrantyThresholdsSection tenantData={tenantData} setTenantData={setTenantData} />
          )}

          {isAdmin && (
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
                      Charge un jeu de données complet (sites, assets, racks, tasks) pour tester l&apos;application.
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

        {/* Models Tab */}
        <TabsContent value="models" className="space-y-6">
          <AssetModelsTabContent />
        </TabsContent>

        {/* Electricity Tab */}
        <TabsContent value="electricity" className="space-y-6">
          <ElectricityConfigTab />
        </TabsContent>

        {/* Notifications Tab — phase 6 fix: was a link to /dashboard/settings/notifications
            (asChild + <a>), which broke the in-tab continuity (separate route, page-level
            "Retour" header). Now rendered inline via the shared NotificationsConfigPanel. */}
        {isManagerOrAbove && (
          <TabsContent value="notifications" className="space-y-6">
            <NotificationsConfigPanel embedded />
          </TabsContent>
        )}

        {/* SSO Tab */}
        <TabsContent value="sso" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Single Sign-On (SSO)
              </CardTitle>
              <CardDescription>
                Configurez l&apos;authentification SSO via OpenID Connect pour permettre à vos utilisateurs de se connecter avec leur compte existant.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SsoConfigSection />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Backup Tab — super-admin only (tenant-wide data) */}
        {isSuperAdmin && (
          <TabsContent value="backup" className="space-y-6">

            {/* Section A — Créer une sauvegarde */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Archive className="h-5 w-5" />
                  Créer une sauvegarde
                </CardTitle>
                <CardDescription>
                  Sauvegardez l&apos;intégralité de votre base de données ou exportez un site spécifique.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Full backup */}
                <div className="p-4 border rounded-lg space-y-4">
                  <div>
                    <h4 className="font-medium">Backup complet</h4>
                    <p className="text-sm text-muted-foreground">
                      Toutes les données métier (sites, équipements, baies, plans,
                      tâches, dépenses, budgets) + fichiers référencés (plans, pièces
                      jointes, photos).
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      Les fichiers orphelins du stockage objet (sans référence en base)
                      ne sont pas inclus.
                    </p>
                  </div>

                  {/* Track D.1 step 7 — pre-launch estimate + dbOnly toggle */}
                  {/* Track D.2 step 2 — encrypt toggle (server-driven via capabilities) */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="backup-db-only"
                        checked={backupDbOnly}
                        onCheckedChange={(v) => {
                          setBackupDbOnly(v);
                          setBackupEstimate(null); // invalidate stale estimate
                        }}
                        disabled={!!currentBackupJobId}
                      />
                      <Label htmlFor="backup-db-only" className="text-sm">
                        {T.dbOnlyToggle}
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="backup-encrypt"
                        checked={backupEncrypt}
                        onCheckedChange={setBackupEncrypt}
                        disabled={
                          !!currentBackupJobId ||
                          // Greyed out until capabilities have loaded OR
                          // when the server reports encryption unavailable
                          // (XCH_MASTER_KEY unset). The backend rejects with
                          // 412 either way ; greying out is the friendly UX.
                          backupCapabilities === null ||
                          backupCapabilities.encryption === false
                        }
                      />
                      <Label htmlFor="backup-encrypt" className="text-sm flex items-center gap-1">
                        <Lock className="h-3 w-3" />
                        {T.encryptToggle}
                      </Label>
                      {backupCapabilities?.encryption === false && (
                        <span className="text-xs text-muted-foreground italic">
                          ({T.encryptDisabled})
                        </span>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchEstimate(backupDbOnly)}
                      disabled={isFetchingEstimate || !!currentBackupJobId}
                    >
                      {isFetchingEstimate ? (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      ) : (
                        <HardDrive className="mr-2 h-3 w-3" />
                      )}
                      {isFetchingEstimate ? T.estimateLoading : T.estimateBtn}
                    </Button>
                  </div>

                  {backupEstimate && (
                    <div className="text-sm bg-muted/30 rounded-md p-3 space-y-1">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                        <span>{T.estimateLabels.data}</span>
                        <span className="text-right tabular-nums">{formatFileSize(backupEstimate.dataBytes)}</span>
                        <span>{T.estimateLabels.files}</span>
                        <span className="text-right tabular-nums">{formatFileSize(backupEstimate.filesBytes)}</span>
                        <span className="font-medium text-foreground">{T.estimateLabels.total}</span>
                        <span className="text-right tabular-nums font-medium text-foreground">
                          {formatFileSize(backupEstimate.totalBytes)}
                        </span>
                        <span>{T.estimateLabels.fileCount}</span>
                        <span className="text-right tabular-nums">{backupEstimate.fileCount}</span>
                        <span>{T.estimateLabels.diskFree}</span>
                        <span className="text-right tabular-nums">{formatFileSize(backupEstimate.freeBytes)}</span>
                      </div>
                      {!backupEstimate.ok && (
                        <p className="text-xs text-destructive font-medium pt-1">
                          {T.estimateInsufficient}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      onClick={handleCreateFullBackup}
                      disabled={
                        isCreatingFullBackup ||
                        !!currentBackupJobId ||
                        (backupEstimate !== null && !backupEstimate.ok)
                      }
                    >
                      {isCreatingFullBackup || (currentBackupJobId && backupJob.isRunning) ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Database className="mr-2 h-4 w-4" />
                      )}
                      {currentBackupJobId && backupJob.isRunning
                        ? T.backupInProgress
                        : T.launchBackup}
                    </Button>
                  </div>
                </div>

                {/* Track D.1 step 7 — Active job progress panel */}
                {currentBackupJobId && backupJob.status && (
                  <div className="p-4 border rounded-lg space-y-3 bg-muted/20">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1 flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          Job {currentBackupJobId} —{' '}
                          <span className="text-muted-foreground font-normal">
                            {backupJob.status.progress.phase}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {backupJob.status.progress.message ||
                            `${backupJob.status.progress.current} / ${backupJob.status.progress.total}`}
                        </p>
                      </div>
                      <span className="text-sm tabular-nums font-mono">
                        {backupJob.status.progress.percent}%
                      </span>
                    </div>
                    <Progress value={backupJob.status.progress.percent} className="h-2" />
                    {(backupJob.isCompleted || backupJob.isFailed) && (
                      <div className="flex justify-end pt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCurrentBackupJobId(null);
                            setDryRunReport(null);
                          }}
                        >
                          <X className="mr-1 h-3 w-3" /> Fermer
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Track D.1 step 7 — Dry-run report (after a dry-run job completes) */}
                {dryRunReport && (
                  <div className="p-4 border rounded-lg space-y-3 bg-muted/10">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        Aperçu de la restauration (dry-run)
                      </h4>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!selectedRestoreBackupId) {
                            toast.error('Aucun backup sélectionné pour la confirmation');
                            return;
                          }
                          handleRestoreFullAsync(selectedRestoreBackupId, false);
                        }}
                        disabled={!selectedRestoreBackupId || isRestoringFull}
                      >
                        {T.confirmApply}
                      </Button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-left">
                          <tr>
                            <th className="p-2 font-medium">{T.dryRunHeaders.table}</th>
                            <th className="p-2 font-medium text-right">
                              {T.dryRunHeaders.wouldCreate}
                            </th>
                            <th className="p-2 font-medium text-right">
                              {T.dryRunHeaders.wouldSkip}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...new Set([
                            ...Object.keys(dryRunReport.wouldCreate),
                            ...Object.keys(dryRunReport.wouldSkip),
                          ])].sort().map((table) => (
                            <tr key={table} className="border-t">
                              <td className="p-2 font-mono">{table}</td>
                              <td className="p-2 text-right tabular-nums">
                                {dryRunReport.wouldCreate[table] ?? 0}
                              </td>
                              <td className="p-2 text-right tabular-nums">
                                {dryRunReport.wouldSkip[table] ?? 0}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {(dryRunReport.missingFiles.length > 0 ||
                      dryRunReport.invalidChecksums.length > 0) && (
                      <div className="text-xs space-y-1 pt-2 border-t">
                        <p className="text-muted-foreground">
                          <span className="font-medium">{T.dryRunIssues.missing}</span> :{' '}
                          {dryRunReport.missingFiles.length || T.dryRunIssues.none}
                        </p>
                        <p className="text-muted-foreground">
                          <span className="font-medium">{T.dryRunIssues.invalid}</span> :{' '}
                          {dryRunReport.invalidChecksums.length || T.dryRunIssues.none}
                        </p>
                      </div>
                    )}
                  </div>
                )}

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
                              {backup.encrypted && (
                                <span
                                  className="ml-2 inline-flex items-center"
                                  title="Backup chiffré (AES-256-GCM)"
                                >
                                  <Lock className="h-3 w-3 text-muted-foreground" />
                                </span>
                              )}
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
                  Restaurez depuis un backup existant (catalogue MinIO, async + dry-run preview)
                  ou importez un fichier ZIP externe (multipart, sync v1).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Track D.1 step 7 — async path from catalog entry with dry-run */}
                <div className="space-y-3 p-3 border rounded-lg bg-muted/10">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <FileArchive className="h-4 w-4" />
                    Depuis un backup existant (async + dry-run)
                  </h4>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Select
                      value={selectedRestoreBackupId || undefined}
                      onValueChange={setSelectedRestoreBackupId}
                    >
                      <SelectTrigger className="w-full max-w-md">
                        <SelectValue placeholder="Sélectionner un backup du catalogue…" />
                      </SelectTrigger>
                      <SelectContent>
                        {backupList
                          .filter((b) => b.type === 'full')
                          .map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.filename} ({formatFileSize(b.size)})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="restore-dry-run"
                        checked={restoreDryRun}
                        onCheckedChange={setRestoreDryRun}
                        disabled={isRestoringFull || !!currentBackupJobId}
                      />
                      <Label htmlFor="restore-dry-run" className="text-sm">
                        {T.dryRunToggle}
                      </Label>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground italic">{T.dryRunInfo}</p>

                  {/* Track D.2 Step 4 — cross-tenant restore (delegationId remap) */}
                  <div className="space-y-2 border-t pt-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="restore-cross-tenant"
                        checked={restoreCrossTenant}
                        onCheckedChange={(v) => {
                          setRestoreCrossTenant(v);
                          if (!v) setRestoreTargetDelegationId('');
                        }}
                        disabled={isRestoringFull || !!currentBackupJobId}
                      />
                      <Label htmlFor="restore-cross-tenant" className="text-sm">
                        Restore cross-tenant (remap delegationId)
                      </Label>
                    </div>
                    {restoreCrossTenant && (
                      <div className="space-y-2 pl-8">
                        <Select
                          value={restoreTargetDelegationId || undefined}
                          onValueChange={setRestoreTargetDelegationId}
                        >
                          <SelectTrigger className="w-full max-w-md">
                            <SelectValue placeholder="Sélectionner la délégation cible…" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableDelegations.map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground italic max-w-md">
                          Les utilisateurs du tenant source ne sont pas importés.
                          Les utilisateurs du tenant cible auront accès aux
                          données migrées via la délégation choisie. La
                          propriété (createdBy, assignedTo, authorId) est
                          réécrite vers l&apos;admin qui lance le restore — la trace
                          audit est préservée même si vos droits évoluent.
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={() => {
                        if (!selectedRestoreBackupId) {
                          toast.error('Sélectionnez un backup du catalogue');
                          return;
                        }
                        handleRestoreFullAsync(selectedRestoreBackupId, restoreDryRun);
                      }}
                      disabled={
                        isRestoringFull ||
                        !!currentBackupJobId ||
                        !selectedRestoreBackupId
                      }
                    >
                      {isRestoringFull ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      {restoreDryRun ? 'Lancer le dry-run' : 'Lancer la restauration'}
                    </Button>
                  </div>
                </div>

                {/* Track D.2 Step 4.5 — async multipart upload restore.
                    Replaces the legacy sync v1 path; the sync path (with
                    `X-Backup-Sync: 1` header) is deprecated in v2.3.0 and
                    will be removed in v2.4.0. Encrypted backups MUST
                    upload BOTH the .zip AND its sidecar JSON. */}
                <div className="space-y-3 p-3 border rounded-lg bg-muted/10">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Depuis un fichier ZIP local (async, recommandé)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="upload-backup-file" className="text-xs">
                        Archive .zip (obligatoire)
                      </Label>
                      <Input
                        id="upload-backup-file"
                        type="file"
                        accept=".zip"
                        onChange={(e) => setUploadBackupFile(e.target.files?.[0] || null)}
                        className="cursor-pointer mt-1"
                        disabled={isRestoringFull || !!currentBackupJobId}
                      />
                    </div>
                    <div>
                      <Label htmlFor="upload-sidecar-file" className="text-xs flex items-center gap-1">
                        <Lock className="h-3 w-3" />
                        Sidecar .enc.json (si chiffré)
                      </Label>
                      <Input
                        id="upload-sidecar-file"
                        type="file"
                        accept=".json"
                        onChange={(e) => setUploadSidecarFile(e.target.files?.[0] || null)}
                        className="cursor-pointer mt-1"
                        disabled={isRestoringFull || !!currentBackupJobId}
                      />
                    </div>
                  </div>
                  {uploadBackupFile && (
                    <p className="text-xs text-muted-foreground">
                      Backup : <span className="font-mono">{uploadBackupFile.name}</span> ({formatFileSize(uploadBackupFile.size)})
                      {uploadSidecarFile && (
                        <>
                          {' · '}Sidecar : <span className="font-mono">{uploadSidecarFile.name}</span>
                        </>
                      )}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground italic">
                    L&apos;upload utilise le toggle dry-run et la section
                    cross-tenant ci-dessus. Pour un backup chiffré (AES-256-GCM),
                    joignez aussi son sidecar JSON — sans, le serveur retournera
                    une erreur explicite.
                  </p>
                  <div className="flex justify-end">
                    <Button
                      onClick={handleRestoreFromUpload}
                      disabled={
                        isRestoringFull ||
                        !!currentBackupJobId ||
                        !uploadBackupFile
                      }
                    >
                      {isRestoringFull ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      {isRestoringFull
                        ? 'Upload en cours…'
                        : restoreDryRun
                        ? "Lancer le dry-run (upload)"
                        : 'Lancer la restauration (upload)'}
                    </Button>
                  </div>
                </div>

                {/* Legacy sync v1 path — preserved for the X-Backup-Sync
                    deprecation window. Will be removed in v2.4.0. */}
                <details className="space-y-3 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">
                    Chemin legacy sync v1 (déprécié, retrait v2.4.0)
                  </summary>
                  <div className="space-y-2 pt-2 pl-4 border-l">
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
                        size="sm"
                      >
                        {isRestoringFull ? (
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        ) : (
                          <Upload className="mr-2 h-3 w-3" />
                        )}
                        Restaurer (sync v1)
                      </Button>
                    </div>
                    {restoreFullFile && (
                      <p>
                        Fichier sélectionné : <span className="font-mono">{restoreFullFile.name}</span> ({formatFileSize(restoreFullFile.size)})
                      </p>
                    )}
                  </div>
                </details>

                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-700 dark:text-red-400">
                    La restauration complète importe tous les sites du backup.
                    Les sites existants (même code) sont conservés tels quels (skip-if-exists).
                    Les fichiers (plans, pièces jointes) sont restaurés. <strong>Utilisez le
                    dry-run sur un tenant peuplé pour visualiser le diff avant application.</strong>
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

// ============================================================================
// APPEARANCE CARDS (v1.4 — ADR-010)
// ============================================================================

function AppearancePreferencesCard() {
  const { appearance, reload } = useAppearance();
  const [saving, setSaving] = useState(false);

  if (!appearance) return <CardSkeleton />;

  const isLocked = !appearance.allowUserOverride;
  const source = appearance.source;

  const resetToInherit = async () => {
    setSaving(true);
    try {
      await appearanceApi.updateMine({ source: 'inherit' });
      await reload();
      toast.success('Préférence réinitialisée — vous suivez maintenant la valeur tenant');
    } catch (e: any) {
      toast.error(e?.message || 'Échec de la réinitialisation');
    } finally {
      setSaving(false);
    }
  };

  const persistCustom = async (patch: UpdateUserAppearanceInput) => {
    setSaving(true);
    try {
      await appearanceApi.updateMine({ source: 'custom', ...patch });
      await reload();
      toast.success('Préférence mise à jour');
    } catch (e: any) {
      toast.error(e?.message || 'Échec de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Mes préférences
          {isLocked ? (
            <Badge variant="outline" className="border-destructive/50 text-destructive">
              Verrouillé par l&apos;administrateur
            </Badge>
          ) : source === 'custom' ? (
            <Badge variant="default">Personnalisé</Badge>
          ) : (
            <Badge variant="secondary">Hérité du tenant</Badge>
          )}
        </CardTitle>
        <CardDescription>
          {isLocked
            ? "L'administrateur a verrouillé l'apparence globale. Vous ne pouvez pas personnaliser cette section."
            : source === 'custom'
              ? 'Vos choix personnels écrasent les valeurs par défaut définies par l\'administrateur.'
              : 'Vos choix suivent les valeurs par défaut définies par l\'administrateur.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Thème effectif</Label>
            <div className="text-sm text-muted-foreground">
              {appearance.theme === 'dark'
                ? 'Sombre'
                : appearance.theme === 'light'
                  ? 'Clair'
                  : 'Système'}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Densité</Label>
            <Select
              value={appearance.density}
              disabled={isLocked || saving}
              onValueChange={(v) =>
                persistCustom({ density: v as 'compact' | 'comfortable' })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comfortable">Confortable</SelectItem>
                <SelectItem value="compact">Compacte</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {!isLocked && source === 'custom' && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={resetToInherit} disabled={saving}>
              Réinitialiser à la valeur tenant
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TenantAppearanceCard() {
  const { appearance, reload } = useAppearance();
  const [saving, setSaving] = useState(false);

  if (!appearance) return <CardSkeleton />;
  const tenant = appearance.tenant;

  const save = async (patch: UpdateTenantAppearanceInput) => {
    setSaving(true);
    try {
      await appearanceApi.updateTenant(patch);
      await reload();
      toast.success('Apparence tenant mise à jour');
    } catch (e: any) {
      toast.error(e?.message || 'Échec de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apparence tenant (défaut)</CardTitle>
        <CardDescription>
          Définissez les valeurs par défaut appliquées à tous les utilisateurs qui héritent.
          Désactivez l&apos;option d&apos;override si vous voulez imposer un thème unique.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Thème par défaut</Label>
            <Select
              value={tenant.theme}
              disabled={saving}
              onValueChange={(v) => save({ theme: v as 'light' | 'dark' | 'system' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">Système (auto)</SelectItem>
                <SelectItem value="light">Clair</SelectItem>
                <SelectItem value="dark">Sombre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Densité par défaut</Label>
            <Select
              value={tenant.density}
              disabled={saving}
              onValueChange={(v) => save({ density: v as 'compact' | 'comfortable' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comfortable">Confortable</SelectItem>
                <SelectItem value="compact">Compacte</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tenant-primary-color">Couleur primaire</Label>
            <div className="flex items-center gap-2">
              <Input
                id="tenant-primary-color"
                type="color"
                value={tenant.primaryColor}
                disabled={saving}
                onChange={(e) => save({ primaryColor: e.target.value })}
                className="w-16 h-10 cursor-pointer p-1"
              />
              <span className="text-sm text-muted-foreground font-mono">
                {tenant.primaryColor}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <div>
            <p className="font-medium">Autoriser les préférences personnelles</p>
            <p className="text-sm text-muted-foreground">
              Si désactivé, tous les utilisateurs suivent obligatoirement les valeurs tenant.
            </p>
          </div>
          <Button
            variant={tenant.allowUserOverride ? 'default' : 'outline'}
            disabled={saving}
            onClick={() => save({ allowUserOverride: !tenant.allowUserOverride })}
          >
            {tenant.allowUserOverride ? 'Activé' : 'Désactivé'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
