'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { ArrowLeft, Upload } from 'lucide-react';
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

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FloorPlanFormData>({
    resolver: zodResolver(floorPlanSchema),
  });

  const { data: sites } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: sitesApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: (formData: FormData) => floorPlansApi.create(formData),
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

    createMutation.mutate(formData);
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
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Informations du plan</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="siteId">Site <span className="text-red-600">*</span></Label>
                  <Select value={siteId} onValueChange={(value) => setValue('siteId', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un site" />
                    </SelectTrigger>
                    <SelectContent>
                      {sites?.map((site) => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.siteId && (
                    <p className="text-sm text-red-600">{errors.siteId.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Nom du plan <span className="text-red-600">*</span></Label>
                  <Input
                    id="title"
                    {...register('title')}
                    placeholder="RDC - Zone principale"
                  />
                  {errors.title && (
                    <p className="text-sm text-red-600">{errors.title.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="building">Bâtiment</Label>
                    <Input id="building" {...register('building')} placeholder="A" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="floor">Étage</Label>
                    <Input id="floor" {...register('floor')} placeholder="RDC" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    {...register('notes')}
                    placeholder="Informations supplémentaires"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="file">Fichier <span className="text-red-600">*</span></Label>
                  <Input
                    id="file"
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,application/pdf"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground">
                    Formats acceptés: PNG, JPG, PDF (max 10MB)
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/dashboard/floor-plans')}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || !file}>
                    <Upload className="mr-2 h-4 w-4" />
                    {createMutation.isPending ? 'Upload...' : 'Créer'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
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
                    <p>Fichier : {file?.name}</p>
                    <p>{((file?.size || 0) / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
              ) : file ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground font-medium">Fichier PDF sélectionné</p>
                  <p className="text-sm text-muted-foreground mt-1">{file.name}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20">
                  <Upload className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">
                    Sélectionnez un fichier pour voir l'aperçu
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    L'image du plan apparaîtra ici
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
