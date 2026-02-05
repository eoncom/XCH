'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { contactTypesApi } from '@/lib/api/contacts';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Lock,
  Palette,
  Tag,
} from 'lucide-react';
import Link from 'next/link';
import type { ContactType, ContactCategory } from '@/types';
import { toast } from 'sonner';

const categoryLabels: Record<ContactCategory, string> = {
  PROVIDER: 'Fournisseur',
  INTERNAL: 'Interne',
  PARTNER: 'Partenaire',
  TECHNICAL: 'Technique',
  EMERGENCY: 'Urgence',
};

const categoryColors: Record<ContactCategory, string> = {
  PROVIDER: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  INTERNAL: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  PARTNER: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  TECHNICAL: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  EMERGENCY: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const categories: ContactCategory[] = [
  'PROVIDER',
  'INTERNAL',
  'PARTNER',
  'TECHNICAL',
  'EMERGENCY',
];

const defaultColors = [
  '#3B82F6', // blue
  '#10B981', // green
  '#8B5CF6', // purple
  '#F59E0B', // amber
  '#EF4444', // red
  '#06B6D4', // cyan
  '#EC4899', // pink
  '#6366F1', // indigo
  '#F97316', // orange
  '#14B8A6', // teal
];

const contactTypeSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(50, 'Le nom ne peut pas depasser 50 caracteres'),
  category: z.enum(['PROVIDER', 'INTERNAL', 'PARTNER', 'TECHNICAL', 'EMERGENCY'], {
    required_error: 'La categorie est requise',
  }),
  color: z.string().optional().or(z.literal('')),
  icon: z.string().max(50).optional().or(z.literal('')),
});

type ContactTypeFormData = z.infer<typeof contactTypeSchema>;

export default function ContactTypesPage() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editingType, setEditingType] = useState<ContactType | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: contactTypes, isLoading } = useQuery<ContactType[]>({
    queryKey: ['contact-types'],
    queryFn: () => contactTypesApi.getAll(),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<ContactTypeFormData>({
    resolver: zodResolver(contactTypeSchema),
    defaultValues: {
      name: '',
      category: 'PROVIDER',
      color: '#3B82F6',
      icon: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: ContactTypeFormData) =>
      contactTypesApi.create({
        name: data.name,
        category: data.category,
        color: data.color || undefined,
        icon: data.icon || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-types'] });
      toast.success('Type de contact cree avec succes');
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de la creation: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ContactTypeFormData> }) =>
      contactTypesApi.update(id, {
        ...data,
        color: data.color || undefined,
        icon: data.icon || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-types'] });
      toast.success('Type de contact mis a jour avec succes');
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de la mise a jour: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: contactTypesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-types'] });
      toast.success('Type de contact supprime avec succes');
      setDeleteId(null);
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de la suppression: ${error.message}`);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      contactTypesApi.update(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-types'] });
      toast.success('Statut mis a jour');
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const handleOpenCreate = () => {
    setEditingType(null);
    reset({
      name: '',
      category: 'PROVIDER',
      color: '#3B82F6',
      icon: '',
    });
    setShowDialog(true);
  };

  const handleOpenEdit = (type: ContactType) => {
    setEditingType(type);
    reset({
      name: type.name,
      category: type.category,
      color: type.color || '#3B82F6',
      icon: type.icon || '',
    });
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingType(null);
    reset();
  };

  const onSubmit = (data: ContactTypeFormData) => {
    if (editingType) {
      // System types: only color and icon can be updated
      if (editingType.isSystem) {
        updateMutation.mutate({
          id: editingType.id,
          data: { color: data.color, icon: data.icon },
        });
      } else {
        updateMutation.mutate({ id: editingType.id, data });
      }
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
    }
  };

  const color = watch('color');
  const category = watch('category');

  if (isLoading) {
    return <div className="text-center py-12">Chargement des types de contacts...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/contacts">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Types de contacts</h1>
            <p className="text-muted-foreground">
              Gerez les types et categories de contacts
            </p>
          </div>
        </div>
        <Button onClick={handleOpenCreate} data-testid="create-type-btn">
          <Plus className="mr-2 h-4 w-4" />
          Nouveau type
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Types existants
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contactTypes && contactTypes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Categorie</TableHead>
                  <TableHead>Couleur</TableHead>
                  <TableHead>Icone</TableHead>
                  <TableHead>Systeme</TableHead>
                  <TableHead>Actif</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contactTypes.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {type.color && (
                          <span
                            className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: type.color }}
                          />
                        )}
                        {type.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={categoryColors[type.category]}>
                        {categoryLabels[type.category]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {type.color ? (
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block w-6 h-6 rounded border"
                            style={{ backgroundColor: type.color }}
                          />
                          <code className="text-xs text-muted-foreground">{type.color}</code>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {type.icon || '-'}
                    </TableCell>
                    <TableCell>
                      {type.isSystem ? (
                        <Badge variant="outline" className="gap-1">
                          <Lock className="h-3 w-3" />
                          Systeme
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          toggleActiveMutation.mutate({
                            id: type.id,
                            isActive: !type.isActive,
                          })
                        }
                        disabled={toggleActiveMutation.isPending}
                      >
                        <Badge variant={type.isActive ? 'success' : 'secondary'}>
                          {type.isActive ? 'Actif' : 'Inactif'}
                        </Badge>
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(type)}
                          data-testid="edit-type-btn"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {!type.isSystem && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(type.id)}
                            data-testid="delete-type-btn"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Tag className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Aucun type de contact</p>
              <Button onClick={handleOpenCreate} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Creer un type
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingType ? `Modifier "${editingType.name}"` : 'Nouveau type de contact'}
            </DialogTitle>
            <DialogDescription>
              {editingType?.isSystem
                ? 'Type systeme : seuls la couleur et l\'icone sont modifiables.'
                : editingType
                ? 'Modifiez les proprietes du type de contact.'
                : 'Creez un nouveau type de contact pour classifier vos contacts.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom *</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="Nom du type"
                disabled={editingType?.isSystem}
              />
              {errors.name && (
                <p className="text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categorie *</Label>
              <Select
                value={category}
                onValueChange={(value) => setValue('category', value as ContactCategory)}
                disabled={editingType?.isSystem}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selectionner une categorie" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      <div className="flex items-center gap-2">
                        <Badge className={`${categoryColors[cat]} text-[10px] px-1.5 py-0`}>
                          {categoryLabels[cat]}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-sm text-red-600">{errors.category.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Couleur
                </div>
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="color"
                  type="color"
                  {...register('color')}
                  className="w-12 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={color || ''}
                  onChange={(e) => setValue('color', e.target.value)}
                  placeholder="#3B82F6"
                  className="flex-1"
                />
              </div>
              <div className="flex gap-1.5 mt-2">
                {defaultColors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                      color === c ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setValue('color', c)}
                    title={c}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="icon">Icone (optionnel)</Label>
              <Input
                id="icon"
                {...register('icon')}
                placeholder="Ex: phone, building, wrench..."
              />
              <p className="text-xs text-muted-foreground">
                Nom d'icone Lucide (optionnel)
              </p>
            </div>

            {/* Preview */}
            <div className="border rounded-md p-4 bg-muted/30">
              <Label className="text-xs text-muted-foreground mb-2 block">Apercu</Label>
              <div className="flex items-center gap-2">
                <Badge
                  style={
                    color
                      ? {
                          backgroundColor: `${color}20`,
                          color: color,
                          borderColor: `${color}40`,
                        }
                      : undefined
                  }
                  variant={color ? 'outline' : 'secondary'}
                >
                  {watch('name') || 'Nom du type'}
                </Badge>
                <Badge className={categoryColors[category]}>
                  {categoryLabels[category]}
                </Badge>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Enregistrement...'
                  : editingType
                  ? 'Enregistrer'
                  : 'Creer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Etes-vous sur de vouloir supprimer ce type de contact ? Les contacts
              associes a ce type ne pourront plus etre filtres par ce type.
              Cette action est irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
