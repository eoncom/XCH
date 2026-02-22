// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
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
import { floorPlansApi } from '@/lib/api/floor-plans';
import { sitesApi } from '@/lib/api/sites';
import { showToast } from '@/lib/toast';
import { ArrowLeft, Upload, Loader2, Info } from 'lucide-react';
import Link from 'next/link';
import type { Site, FloorPlan } from '@/types';

const floorPlanSchema = z.object({
  siteId: z.string().min(1, 'Le site est requis'),
  title: z.string().min(1, 'Le nom est requis'),
  floor: z.string().optional(),
  building: z.string().optional(),
  notes: z.string().optional(),
});

type FloorPlanFormData = z.infer<typeof floorPlanSchema>;

export default function EditFloorPlanPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  // Récupérer plan existant
  const { data: floorPlan, isLoading: loadingPlan } = useQuery<FloorPlan>({
    queryKey: ['floor-plan', params.id],
    queryFn: () => floorPlansApi.getById(params.id as string),
  });

  const { data: sites } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: sitesApi.getAll,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FloorPlanFormData>({
    resolver: zodResolver(floorPlanSchema),
    values: floorPlan
      ? {
          siteId: floorPlan.siteId || '',
          title: floorPlan.title,
          floor: floorPlan.floor || '',
          building: floorPlan.building || '',
          notes: floorPlan.notes || '',
        }
      : undefined,
  });

  // Afficher preview du fichier existant
  useEffect(() => {
    if (floorPlan?.fileUrl && !filePreview) {
      setFilePreview(floorPlan.fileUrl);
    }
  }, [floorPlan, filePreview]);

  const updateMutation = useMutation({
    mutationFn: (formData: FormData) =>
      floorPlansApi.update(params.id as string, formData),
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: ['floor-plans'] });
      queryClient.invalidateQueries({ queryKey: ['floor-plan', params.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      if (plan.siteId) {
        queryClient.invalidateQueries({ queryKey: ['sites', plan.siteId] });
      }
      showToast.success('Plan mis à jour avec succès');
      router.push(`/dashboard/floor-plans/${params.id}`);
    },
    onError: () => {
      showToast.error('Erreur lors de la mise à jour du plan');
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
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

      // Create preview for images
      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreview(reader.result as string);
        };
        reader.readAsDataURL(selectedFile);
      } else {
        setFilePreview(null);
      }
    }
  };

  const onSubmit = (data: FloorPlanFormData) => {
    const formData = new FormData();
    formData.append('siteId', data.siteId);
    formData.append('title', data.title);
    if (data.floor) formData.append('floor', data.floor);
    if (data.building) formData.append('building', data.building);
    if (data.notes) formData.append('notes', data.notes);

    // Ajouter fichier seulement si nouveau fichier uploadé
    if (file) {
      formData.append('file', file);
    }

    updateMutation.mutate(formData);
  };

  if (loadingPlan) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!floorPlan) {
    return (
      <div className="text-center py-12 text-muted-foreground">Plan non trouvé</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/floor-plans/${params.id}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Modifier le plan</h1>
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
                  <Label htmlFor="siteId">
                    Site <span className="text-red-600">*</span>
                  </Label>
                  <Select
                    value={watch('siteId')}
                    onValueChange={(value) => setValue('siteId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un site" />
                    </SelectTrigger>
                    <SelectContent>
                      {sites?.map((site) => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.code} - {site.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.siteId && (
                    <p className="text-sm text-red-600">{errors.siteId.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">
                    Nom du plan <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    id="title"
                    {...register('title')}
                    placeholder="Ex: Datacenter - Étage 3"
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
                    <Input
                      id="building"
                      {...register('building')}
                      placeholder="Ex: Bâtiment A"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="floor">Étage</Label>
                    <Input
                      id="floor"
                      {...register('floor')}
                      placeholder="Ex: RDC"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Fichier (optionnel en édition) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Fichier du plan
                  <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">Optionnel</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="file">Nouveau fichier (remplace l&apos;existant)</Label>
                  <p className="text-xs text-muted-foreground mb-1">
                    PNG, JPG, PDF (max 10 MB)
                  </p>
                  <div className="flex items-center gap-3">
                    <Input
                      id="file"
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,application/pdf"
                      onChange={handleFileChange}
                      className="cursor-pointer"
                    />
                    {file && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFile(null);
                          setFilePreview(floorPlan.fileUrl || null);
                        }}
                      >
                        Annuler
                      </Button>
                    )}
                  </div>
                </div>
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
                  onClick={() => router.push(`/dashboard/floor-plans/${params.id}`)}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  data-testid="save-floor-plan-btn"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Enregistrer
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
                  {filePreview.endsWith('.pdf') || !filePreview.startsWith('data:') ? (
                    <div className="flex flex-col items-center justify-center py-20">
                      <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                      <p className="text-muted-foreground font-medium">
                        {file ? file.name : floorPlan.originalFilename || 'Plan existant'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Fichier PDF</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden bg-muted/30">
                      <img
                        src={filePreview}
                        alt="Aperçu du plan"
                        className="w-full h-auto object-contain max-h-[70vh]"
                      />
                    </div>
                  )}
                  {file && (
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <p>Nouveau : {file.name}</p>
                      <p>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20">
                  <Upload className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Aucun aperçu disponible</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Uploadez un fichier image pour voir l&apos;aperçu
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
