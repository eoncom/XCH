'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { providersApi } from '@/lib/api/providers';
import { ArrowLeft, Edit, Trash2, Calendar, Clock } from 'lucide-react';
import Link from 'next/link';
import type { Provider, ProviderType } from '@/types';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const providerTypeLabels: Record<ProviderType, string> = {
  TELECOM: 'Télécom',
  INTERNET: 'Internet',
  CLOUD: 'Cloud',
  HOSTING: 'Hébergement',
  OTHER: 'Autre',
};

const providerTypeColors: Record<ProviderType, string> = {
  TELECOM: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  INTERNET: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  CLOUD: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  HOSTING: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  OTHER: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

export default function ProviderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: provider, isLoading } = useQuery<Provider>({
    queryKey: ['provider', id],
    queryFn: () => providersApi.getById(id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => providersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      toast.success('Fournisseur supprimé avec succès');
      router.push('/dashboard/providers');
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de la suppression: ${error.message}`);
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate();
    setShowDeleteDialog(false);
  };

  if (isLoading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  if (!provider) {
    toast.error('Fournisseur non trouvé');
    router.push('/dashboard/providers');
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/providers">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{provider.name}</h1>
            <p className="text-muted-foreground">Détails du fournisseur</p>
          </div>
          <Badge className={providerTypeColors[provider.type]}>
            {providerTypeLabels[provider.type]}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild data-testid="edit-provider-btn">
            <Link href={`/dashboard/providers/${id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Modifier
            </Link>
          </Button>
          <Button
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
            data-testid="delete-provider-btn"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Supprimer
          </Button>
        </div>
      </div>

      {/* Informations */}
      <Card>
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Nom</label>
              <p className="text-lg">{provider.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Type</label>
              <div className="mt-1">
                <Badge className={providerTypeColors[provider.type]}>
                  {providerTypeLabels[provider.type]}
                </Badge>
              </div>
            </div>
          </div>

          {provider.contact && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Contact</label>
              <p className="text-lg">{provider.contact}</p>
            </div>
          )}

          {provider.notes && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Notes</label>
              <p className="text-sm mt-1 whitespace-pre-wrap">{provider.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Informations système</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <label className="text-sm font-medium text-muted-foreground">Créé le</label>
                <p className="text-sm">
                  {format(new Date(provider.createdAt), 'dd MMMM yyyy à HH:mm', {
                    locale: fr,
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Modifié le
                </label>
                <p className="text-sm">
                  {format(new Date(provider.updatedAt), 'dd MMMM yyyy à HH:mm', {
                    locale: fr,
                  })}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le fournisseur &quot;{provider.name}&quot; ?
              Cette action est irréversible.
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
