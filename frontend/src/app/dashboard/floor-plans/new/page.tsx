// @ts-nocheck
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useDelegation } from '@/contexts/DelegationContext';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EntitySelectCombobox } from '@/components/ui/entity-select-combobox';
import { floorPlansApi } from '@/lib/api/floor-plans';
import type { PdfInspectResult } from '@/lib/api/floor-plans';
import { sitesApi } from '@/lib/api/sites';
import { showToast } from '@/lib/toast';
import { ArrowLeft, Upload, Info, FileText, Loader2, Check } from 'lucide-react';
import Link from 'next/link';
import type { Site } from '@/types';

const floorPlanSchema = z.object({
  siteId: z.string().min(1, 'Le site est requis'),
  title: z.string().min(1, 'Le nom est requis'),
  floor: z.string().optional(),
  building: z.string().optional(),
  notes: z.string().optional(),
});

type FloorPlanFormData = z.infer<typeof floorPlanSchema>;

export default function NewFloorPlanPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  // PDF multi-page state
  const [pdfInfo, setPdfInfo] = useState<PdfInspectResult | null>(null);
  const [selectedPage, setSelectedPage] = useState<number>(1);
  const [inspectingPdf, setInspectingPdf] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FloorPlanFormData>({
    resolver: zodResolver(floorPlanSchema),
  });

  // Phase 6.5 cascade audit: only show sites from the active delegation.
  const { currentDelegation } = useDelegation();
  const activeDelegationId = currentDelegation?.delegationId;
  const { data: sites } = useQuery<Site[]>({
    queryKey: ['sites', { delegationId: activeDelegationId }],
    queryFn: () => sitesApi.getAll({ delegationId: activeDelegationId }),
  });

  const createMutation = useMutation({
    mutationFn: ({ formData, page }: { formData: FormData; page?: number }) =>
      floorPlansApi.create(formData, page),
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: ['floor-plans'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      if (plan.siteId) {
        queryClient.invalidateQueries({ queryKey: ['sites', plan.siteId] });
      }
      showToast.success('Plan créé avec succès');
      router.push(`/dashboard/floor-plans/${plan.id}`);
    },
    onError: () => {
      showToast.error('Erreur lors de la création du plan');
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(selectedFile.type)) {
      showToast.error('Format de fichier invalide. Formats acceptés: PNG, JPG, PDF');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      showToast.error('Fichier trop volumineux. Taille maximale: 10MB');
      return;
    }

    setFile(selectedFile);
    setPdfInfo(null);
    setSelectedPage(1);

    // Create preview for images
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    } else if (selectedFile.type === 'application/pdf') {
      setFilePreview(null);

      // Inspect PDF to get page count and thumbnails
      setInspectingPdf(true);
      try {
        const result = await floorPlansApi.inspectPdf(selectedFile);
        setPdfInfo(result);
        setSelectedPage(1);

        // If single page, use thumbnail as preview
        if (result.pageCount === 1 && result.pages.length > 0) {
          setFilePreview(result.pages[0].thumbnail);
        }
      } catch (err) {
        showToast.error('Impossible d\'analyser le PDF. Le fichier sera converti automatiquement.');
      } finally {
        setInspectingPdf(false);
      }
    } else {
      setFilePreview(null);
    }
  };

  const onSubmit = (data: FloorPlanFormData) => {
    if (!file) {
      showToast.error('Veuillez sélectionner un fichier');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('siteId', data.siteId);
    formData.append('name', data.title); // Backend expects 'name' not 'title'
    if (data.floor) formData.append('floor', data.floor);
    if (data.building) formData.append('building', data.building);
    if (data.notes) formData.append('notes', data.notes);

    // Pass selected page for PDF files
    const page = file.type === 'application/pdf' ? selectedPage : undefined;
    createMutation.mutate({ formData, page });
  };

  const siteId = watch('siteId');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/floor-plans">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Nouveau plan de sol</h1>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Formulaire - 2 colonnes */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Section 1: Identification (obligatoire) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Identification
                  <span className="text-xs font-normal text-red-500 bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded">Obligatoire</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="siteId">Site <span className="text-red-600">*</span></Label>
                  <EntitySelectCombobox
                    id="siteId"
                    ariaLabel="Site concerné par le plan"
                    options={(sites || []).map((site) => ({
                      value: site.id,
                      label: site.name,
                      searchText: `${site.name} ${site.code ?? ''}`.trim(),
                    }))}
                    value={siteId || null}
                    onChange={(v) => setValue('siteId', v ?? '')}
                    clearable={false}
                    placeholder="Sélectionner un site"
                    searchPlaceholder="Rechercher un site..."
                  />
                  {errors.siteId && (
                    <p className="text-sm text-red-600">{errors.siteId.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Nom du plan <span className="text-red-600">*</span></Label>
                  <Input
                    id="title"
                    {...register('title')}
                    placeholder="Ex: RDC - Zone principale"
                  />
                  {errors.title && (
                    <p className="text-sm text-red-600">{errors.title.message}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Localisation (optionnel) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Localisation
                  <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">Optionnel</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="building">Bâtiment</Label>
                    <Input id="building" {...register('building')} placeholder="Ex: Bâtiment A" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="floor">Étage</Label>
                    <Input id="floor" {...register('floor')} placeholder="Ex: RDC" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Fichier (obligatoire) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Fichier du plan
                  <span className="text-xs font-normal text-red-500 bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded">Obligatoire</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="file">Image ou PDF <span className="text-red-600">*</span></Label>
                  <Input
                    id="file"
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,application/pdf"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground">
                    Formats acceptés : PNG, JPG, PDF (max 10 MB).
                    Les PDF sont automatiquement convertis en image.
                  </p>
                </div>

                {/* PDF inspecting spinner */}
                {inspectingPdf && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyse du PDF en cours...
                  </div>
                )}

                {/* PDF multi-page selector */}
                {pdfInfo && pdfInfo.pageCount > 1 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-500" />
                      <p className="text-sm font-medium">
                        PDF de {pdfInfo.pageCount} pages — choisissez la page à utiliser
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
                      {pdfInfo.pages.map((p) => (
                        <button
                          key={p.page}
                          type="button"
                          onClick={() => {
                            setSelectedPage(p.page);
                            setFilePreview(p.thumbnail);
                          }}
                          className={`relative border-2 rounded-lg overflow-hidden transition-all hover:border-blue-400 ${
                            selectedPage === p.page
                              ? 'border-blue-500 ring-2 ring-blue-200'
                              : 'border-muted'
                          }`}
                        >
                          <img
                            src={p.thumbnail}
                            alt={`Page ${p.page}`}
                            className="w-full h-auto"
                          />
                          <div className={`absolute bottom-0 left-0 right-0 text-center text-xs py-1 ${
                            selectedPage === p.page
                              ? 'bg-blue-500 text-white'
                              : 'bg-black/50 text-white'
                          }`}>
                            {selectedPage === p.page && <Check className="h-3 w-3 inline mr-1" />}
                            Page {p.page}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Section 4: Notes (optionnel) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Notes
                  <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">Optionnel</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="notes">Informations complémentaires</Label>
                  <Textarea
                    id="notes"
                    {...register('notes')}
                    placeholder="Notes additionnelles sur le plan..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                Les champs marqués <span className="text-red-500">*</span> sont obligatoires
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/dashboard/floor-plans')}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={createMutation.isPending || !file || inspectingPdf}>
                  <Upload className="mr-2 h-4 w-4" />
                  {createMutation.isPending ? 'Upload...' : 'Créer le plan'}
                </Button>
              </div>
            </div>
          </form>
        </div>

        {/* Aperçu - 3 colonnes */}
        <div className="lg:col-span-3">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Aperçu</CardTitle>
            </CardHeader>
            <CardContent>
              {filePreview ? (
                <div className="space-y-3">
                  <div className="border rounded-lg overflow-hidden bg-muted/30">
                    <img
                      src={filePreview}
                      alt="Aperçu"
                      className="w-full h-auto object-contain max-h-[70vh]"
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <p>
                      Fichier : {file?.name}
                      {pdfInfo && pdfInfo.pageCount > 1 && ` (page ${selectedPage}/${pdfInfo.pageCount})`}
                    </p>
                    <p>{((file?.size || 0) / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
              ) : file ? (
                <div className="flex flex-col items-center justify-center py-20">
                  {inspectingPdf ? (
                    <>
                      <Loader2 className="h-10 w-10 text-muted-foreground mb-3 animate-spin" />
                      <p className="text-muted-foreground font-medium">Analyse du PDF...</p>
                    </>
                  ) : (
                    <>
                      <FileText className="h-10 w-10 text-muted-foreground mb-3" />
                      <p className="text-muted-foreground font-medium">Fichier PDF sélectionné</p>
                      <p className="text-sm text-muted-foreground mt-1">{file.name}</p>
                      {pdfInfo && pdfInfo.pageCount === 1 && (
                        <p className="text-xs text-green-600 mt-2">1 page — conversion automatique</p>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20">
                  <Upload className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">
                    Sélectionnez un fichier pour voir l&apos;aperçu
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    L&apos;image du plan apparaîtra ici
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
