'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { providersApi } from '@/lib/api/providers';
import { Plus, Search, Eye, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import type { Provider, ProviderType } from '@/types';
import { toast } from 'sonner';

const providerTypeLabels: Record<ProviderType, string> = {
  TELECOM: 'Télécom',
  INTERNET: 'Internet',
  CLOUD: 'Cloud',
  HOSTING: 'Hébergement',
  SECURITY: 'Sécurité',
  NETWORK: 'Réseau',
  MAINTENANCE: 'Maintenance',
  ENERGY: 'Énergie',
  CUSTOM: 'Personnalisé',
  OTHER: 'Autre',
};

const providerTypeColors: Record<ProviderType, string> = {
  TELECOM: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  INTERNET: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  CLOUD: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  HOSTING: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  SECURITY: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  NETWORK: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  MAINTENANCE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  ENERGY: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  CUSTOM: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  OTHER: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

export default function ProvidersPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: providers, isLoading, error } = useQuery<Provider[]>({
    queryKey: ['providers'],
    queryFn: providersApi.getAll,
    retry: false, // Don't retry on auth errors
  });

  const deleteMutation = useMutation({
    mutationFn: providersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      toast.success('Fournisseur supprimé avec succès');
      setDeleteId(null);
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de la suppression: ${error.message}`);
    },
  });

  const filteredProviders = providers?.filter((provider) => {
    const matchesSearch =
      provider.name.toLowerCase().includes(search.toLowerCase()) ||
      provider.contact?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'ALL' || provider.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
    }
  };

  if (isLoading) {
    return <div className="text-center py-12">Chargement des fournisseurs...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">
          Erreur lors du chargement des fournisseurs
        </p>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : 'Erreur inconnue'}
        </p>
        <Button
          onClick={() => router.push('/login')}
          className="mt-4"
        >
          Se reconnecter
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Fournisseurs</h1>
          <p className="text-muted-foreground">Gérez vos fournisseurs de services</p>
        </div>
        <Button asChild data-testid="create-provider-btn">
          <Link href="/dashboard/providers/new">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau fournisseur
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom ou contact..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Type de fournisseur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les types</SelectItem>
                <SelectItem value="TELECOM">Télécom</SelectItem>
                <SelectItem value="INTERNET">Internet</SelectItem>
                <SelectItem value="CLOUD">Cloud</SelectItem>
                <SelectItem value="HOSTING">Hébergement</SelectItem>
                <SelectItem value="OTHER">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredProviders && filteredProviders.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProviders.map((provider) => (
                  <TableRow key={provider.id} data-testid="provider-row">
                    <TableCell className="font-medium">{provider.name}</TableCell>
                    <TableCell>
                      <Badge className={providerTypeColors[provider.type]}>
                        {providerTypeLabels[provider.type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {provider.contact || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          data-testid="view-provider-btn"
                        >
                          <Link href={`/dashboard/providers/${provider.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          data-testid="edit-provider-btn"
                        >
                          <Link href={`/dashboard/providers/${provider.id}/edit`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(provider.id)}
                          data-testid="delete-provider-btn"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Aucun fournisseur trouvé</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce fournisseur ? Cette action est
              irréversible.
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
