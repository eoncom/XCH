'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Database, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  assetModelsApi,
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
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState<string | null>(null);

  const { data: vendors = [], isLoading } = useQuery<VendorCatalogDescriptor[]>({
    queryKey: ['asset-models-import-vendors'],
    queryFn: () => assetModelsApi.listVendors(),
    enabled: open,
    staleTime: 5 * 60_000,
  });

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
      onImported();
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Catalogues fabricants</DialogTitle>
          <DialogDescription>
            Pré-remplissez votre catalogue de modèles avec les specs officielles des fabricants
            (conso électrique, poids, hauteur U, couverture WiFi, etc.). Chaque modèle importé
            reste <strong>éditable et supprimable</strong> comme n&apos;importe quel modèle manuel.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
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

        <p className="text-xs text-muted-foreground border-t pt-3">
          Un fabricant manque&nbsp;? Déposez son catalogue JSON dans{' '}
          <code className="text-[10.5px]">backend/src/modules/asset-models/templates/</code>{' '}
          et inscrivez-le dans le registre du service <code>VendorTemplatesService</code>.
        </p>
      </DialogContent>
    </Dialog>
  );
}
