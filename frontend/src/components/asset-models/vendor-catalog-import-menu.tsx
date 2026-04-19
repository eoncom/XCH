'use client';

import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Database, Download, Loader2, Upload, FileJson, Trash2, Package } from 'lucide-react';
import { toast } from 'sonner';
import {
  assetModelsApi,
  type StoredCatalog,
  type VendorCatalogDescriptor,
} from '@/lib/api/asset-models';

interface Props {
  onImported: () => void;
}

/**
 * Dialog-driven picker for vendor catalog imports.
 * Populated from GET /api/asset-models/import/vendors so new vendors added
 * backend-side (Cisco, Aruba, HP, Canon, Yealink, Starlink, …) appear
 * automatically without a frontend redeploy.
 */
export function VendorCatalogImportMenu({ onImported }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: vendors = [], isLoading } = useQuery<VendorCatalogDescriptor[]>({
    queryKey: ['asset-models-import-vendors'],
    queryFn: () => assetModelsApi.listVendors(),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  // v1.4.x — list of already-imported catalog "packs" for this tenant
  const { data: storedCatalogs = [], refetch: refetchCatalogs } = useQuery<StoredCatalog[]>({
    queryKey: ['asset-models-stored-catalogs'],
    queryFn: () => assetModelsApi.listCatalogs(),
    enabled: open,
    staleTime: 30_000,
  });

  const refreshAll = () => {
    refetchCatalogs();
    queryClient.invalidateQueries({ queryKey: ['asset-models-stored-catalogs'] });
    onImported();
  };

  const handleDownloadCatalog = (cat: StoredCatalog) => {
    // Same-origin endpoint → browser downloads with cookie auth
    window.open(assetModelsApi.downloadCatalogUrl(cat.id), '_blank');
  };

  const handleDeleteCatalog = async (cat: StoredCatalog) => {
    const alsoModels = confirm(
      `Supprimer le catalogue "${cat.vendor}" (${cat.itemCount} modèles) ?\n\n` +
        `OK = supprimer aussi les ${cat.itemCount} modèles importés (seulement ceux qui n'ont aucun équipement lié).\n` +
        `Annuler = garder les modèles, supprimer juste la référence au pack.`,
    );
    const t = toast.loading('Suppression du catalogue…');
    try {
      const res = await assetModelsApi.deleteCatalog(cat.id, alsoModels);
      toast.success(
        alsoModels
          ? `Catalogue "${cat.vendor}" supprimé · ${res.deletedModelsCount} modèle(s) supprimé(s).`
          : `Catalogue "${cat.vendor}" supprimé — modèles conservés.`,
        { id: t, duration: 6000 },
      );
      refreshAll();
    } catch (e: any) {
      toast.error(e?.message || 'Échec de la suppression', { id: t });
    }
  };

  /**
   * Upload a JSON catalog chosen by the operator. Parses client-side for early
   * validation + a preview count so the confirm dialog says something useful.
   * Server re-validates + upserts idempotently.
   */
  const handleFileSelected = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (10 Mo max).');
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      toast.error('Impossible de lire le fichier.');
      return;
    }
    let catalog: any;
    try {
      catalog = JSON.parse(text);
    } catch {
      toast.error('JSON invalide. Vérifiez la syntaxe.');
      return;
    }

    // Client-side shape detection for the confirm dialog
    const fortinetCount =
      (catalog?.fortiap?.length || 0) +
      (catalog?.fortiswitch?.length || 0) +
      (catalog?.fortigate?.length || 0);
    const genericCount = Array.isArray(catalog?.items) ? catalog.items.length : 0;
    const total = fortinetCount || genericCount;
    if (total === 0) {
      toast.error(
        "Aucun modèle détecté dans le fichier. Le JSON doit contenir soit `items: [...]`, soit des tableaux Fortinet (fortiap / fortiswitch / fortigate).",
      );
      return;
    }
    const vendorHint =
      catalog?.vendor ||
      (fortinetCount > 0 ? 'Fortinet' : 'Catalogue personnalisé');

    const ok = confirm(
      `Importer ${total} modèle(s) depuis ce fichier ?\n\n` +
        `Fabricant détecté : ${vendorHint}.\n` +
        `Les modèles existants portant le même nom seront mis à jour. Vos notes personnalisées sont préservées.`,
    );
    if (!ok) return;

    setUploading(true);
    const t = toast.loading(`Import du catalogue ${vendorHint}…`);
    try {
      const res = await assetModelsApi.uploadCatalog(catalog);
      toast.success(
        `${res.vendor} : ${res.created} créé(s), ${res.updated} mis à jour${res.skipped > 0 ? `, ${res.skipped} ignoré(s)` : ''}.`,
        { id: t, duration: 8000 },
      );
      if (res.errors.length) {
        toast.error(`${res.errors.length} erreur(s) — voir la console`, { duration: 6000 });
        // eslint-disable-next-line no-console
        console.table(res.errors);
      }
      refreshAll();
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Échec de l'import du fichier", { id: t });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const runImport = async (v: VendorCatalogDescriptor) => {
    const ok = confirm(
      `Importer le catalogue ${v.label} ?\n\n` +
        `~${v.modelCount} modèle(s) vont être ajoutés ou mis à jour. Les modèles ` +
        `existants conservent leurs notes personnalisées.`,
    );
    if (!ok) return;
    setRunning(v.key);
    const t = toast.loading(`Import du catalogue ${v.label}…`);
    try {
      const res = await assetModelsApi.importVendor(v.key);
      toast.success(
        `${v.label} : ${res.created} créé(s), ${res.updated} mis à jour${res.skipped > 0 ? `, ${res.skipped} ignoré(s)` : ''}.`,
        { id: t, duration: 8000 },
      );
      if (res.errors.length) {
        toast.error(`${res.errors.length} erreur(s) — voir la console`, { duration: 6000 });
        // eslint-disable-next-line no-console
        console.table(res.errors);
      }
      refreshAll();
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Échec de l'import", { id: t });
    } finally {
      setRunning(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" title="Importer un catalogue fabricant pré-configuré">
          <Database className="h-4 w-4 mr-1" />
          Importer un catalogue fabricant
        </Button>
      </DialogTrigger>
      {/* v1.4.x fix — the dialog body was overflowing the viewport so users
          couldn't scroll to "Voir le schéma JSON attendu" at the bottom.
          Use a flex column with a scrollable middle region instead of relying
          on the inner list's max-height. */}
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2 flex-shrink-0">
          <DialogTitle>Catalogues fabricants</DialogTitle>
          <DialogDescription>
            Pré-remplissez votre catalogue de modèles avec les specs officielles des fabricants
            (conso électrique, poids, hauteur U, couverture WiFi, etc.). Chaque modèle importé
            reste <strong>éditable et supprimable</strong> comme n&apos;importe quel modèle manuel.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 flex-1 overflow-y-auto space-y-4">

        {/* v1.4.x — Catalogues déjà importés dans le tenant */}
        {storedCatalogs.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Catalogues importés ({storedCatalogs.length})</p>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              Chaque import crée un pack que vous pouvez télécharger (pour sauvegarde / partage) ou supprimer.
            </p>
            <div className="space-y-1.5">
              {storedCatalogs.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center gap-3 p-2.5 border rounded-md bg-muted/20"
                >
                  <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{cat.vendor}</span>
                      {cat.version && (
                        <span className="text-xs text-muted-foreground">v{cat.version}</span>
                      )}
                      {cat.builtIn && (
                        <Badge variant="secondary" className="text-[10px] h-5">Intégré</Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] h-5">
                        {cat.itemCount} modèles
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Importé le {new Date(cat.importedAt).toLocaleDateString('fr-FR')} à{' '}
                      {new Date(cat.importedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownloadCatalog(cat)}
                    title="Télécharger le pack JSON"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteCatalog(cat)}
                    title="Supprimer le catalogue"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="border-t my-3" />
            <p className="text-sm font-medium">Importer un nouveau catalogue</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…
          </div>
        ) : (
          <div className="space-y-2">
            {vendors.map((v) => {
              const disabled = v.status === 'planned' || running !== null;
              return (
                <div
                  key={v.key}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-sm font-semibold">
                    {v.label.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{v.label}</span>
                      {v.status === 'available' ? (
                        <Badge variant="default" className="text-[10px] h-5">
                          {v.modelCount} modèles
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] h-5 border-amber-400 text-amber-700 dark:text-amber-400">
                          Bientôt
                        </Badge>
                      )}
                      {v.version && (
                        <span className="text-xs text-muted-foreground">v{v.version}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{v.description}</p>
                  </div>
                  <Button
                    variant={v.status === 'available' ? 'default' : 'ghost'}
                    size="sm"
                    disabled={disabled}
                    onClick={() => runImport(v)}
                  >
                    {running === v.key ? (
                      <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Import…</>
                    ) : (
                      <><Download className="h-3.5 w-3.5 mr-1.5" /> Importer</>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Upload zone — operator-provided JSON catalog */}
        <div className="border-t pt-3 space-y-2">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <FileJson className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Importer depuis un fichier JSON</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Votre fabricant n&apos;est pas dans la liste&nbsp;? Uploadez un catalogue{' '}
                JSON (schéma générique <code>items: [...]</code> ou bundle Fortinet-native).
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Taille max&nbsp;: 10 Mo. Chaque item doit avoir au minimum <code>name</code> et <code>type</code>.
              </p>
            </div>
            <Button
              variant="default"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Import…</>
              ) : (
                <><Upload className="h-3.5 w-3.5 mr-1.5" /> Choisir un fichier</>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelected(f);
              }}
            />
          </div>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">Voir le schéma JSON attendu</summary>
            <pre className="mt-2 p-2 bg-muted/50 rounded text-[10.5px] overflow-x-auto">{`{
  "vendor": "Cisco",                 // optionnel, déduit sinon
  "version": "1.0",
  "sources": ["https://cisco.com/ds.pdf"],
  "items": [
    {
      "name": "C9200-24T",           // OBLIGATOIRE
      "manufacturer": "Cisco",
      "type": "SWITCH",              // OBLIGATOIRE (WIFI_AP, SWITCH, FIREWALL, ...)
      "powerConsumption": 54,        // Watts
      "weight": 3.6,                 // kg
      "defaultUHeight": 1,
      "wifiCoverageRadius": 20,      // m, pour WIFI_AP uniquement
      "wifiFrequency": "DUAL",       // 2.4GHz | 5GHz | 6GHz | DUAL | TRI
      "wifiAntennaType": "OMNI",
      "wifiTxPowerDbm": 23,
      "notes": "Optionnel — sinon généré auto."
    }
  ]
}`}</pre>
            <p className="mt-2">
              Les bundles Fortinet-native (avec <code>fortiap</code>/<code>fortiswitch</code>/<code>fortigate</code>){' '}
              sont aussi acceptés directement.
            </p>
          </details>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
