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
import { contactsApi } from '@/lib/api/contacts';
import { usePermissions } from '@/hooks/usePermissions';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Calendar,
  Clock,
  Mail,
  Phone,
  Smartphone,
  Building2,
  UserCircle,
  FileText,
  Power,
} from 'lucide-react';
import Link from 'next/link';
import type { Contact, ContactCategory } from '@/types';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

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

export default function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { canUpdate, canDelete } = usePermissions();

  const { data: contact, isLoading } = useQuery<Contact>({
    queryKey: ['contact', id],
    queryFn: () => contactsApi.getById(id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => contactsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact supprime avec succes');
      router.push('/dashboard/contacts');
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de la suppression: ${error.message}`);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: () => contactsApi.setActive(id, !contact?.isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', id] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(
        contact?.isActive
          ? 'Contact desactive avec succes'
          : 'Contact active avec succes'
      );
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate();
    setShowDeleteDialog(false);
  };

  if (isLoading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  if (!contact) {
    toast.error('Contact non trouve');
    router.push('/dashboard/contacts');
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/contacts">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{contact.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {contact.company && (
                <span className="text-muted-foreground">{contact.company}</span>
              )}
            </div>
          </div>
          <Badge
            style={
              contact.type?.color
                ? {
                    backgroundColor: `${contact.type.color}20`,
                    color: contact.type.color,
                    borderColor: `${contact.type.color}40`,
                  }
                : undefined
            }
            variant={contact.type?.color ? 'outline' : 'secondary'}
          >
            {contact.type?.name || 'Non defini'}
          </Badge>
          {contact.type?.category && (
            <Badge className={categoryColors[contact.type.category]}>
              {categoryLabels[contact.type.category]}
            </Badge>
          )}
          <Badge variant={contact.isActive ? 'success' : 'secondary'}>
            {contact.isActive ? 'Actif' : 'Inactif'}
          </Badge>
        </div>
        <div className="flex gap-2">
          {canUpdate('contacts') && (
            <Button
              variant="outline"
              onClick={() => toggleActiveMutation.mutate()}
              disabled={toggleActiveMutation.isPending}
            >
              <Power className="mr-2 h-4 w-4" />
              {contact.isActive ? 'Desactiver' : 'Activer'}
            </Button>
          )}
          {canUpdate('contacts') && (
            <Button variant="outline" asChild data-testid="edit-contact-btn">
              <Link href={`/dashboard/contacts/${id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Modifier
              </Link>
            </Button>
          )}
          {canDelete('contacts') && (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              data-testid="delete-contact-btn"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </Button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Contact info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Coordonnees
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {contact.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p>
                    <a
                      href={`mailto:${contact.email}`}
                      className="text-primary hover:underline"
                    >
                      {contact.email}
                    </a>
                  </p>
                </div>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Telephone fixe</label>
                  <p>
                    <a
                      href={`tel:${contact.phone}`}
                      className="text-primary hover:underline"
                    >
                      {contact.phone}
                    </a>
                  </p>
                </div>
              </div>
            )}
            {contact.mobile && (
              <div className="flex items-center gap-3">
                <Smartphone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Mobile</label>
                  <p>
                    <a
                      href={`tel:${contact.mobile}`}
                      className="text-primary hover:underline"
                    >
                      {contact.mobile}
                    </a>
                  </p>
                </div>
              </div>
            )}
            {!contact.email && !contact.phone && !contact.mobile && (
              <p className="text-muted-foreground text-sm">Aucune coordonnee renseignee</p>
            )}
          </CardContent>
        </Card>

        {/* Company & Role */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Entreprise et role
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {contact.company && (
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Entreprise</label>
                  <p className="text-lg">{contact.company}</p>
                </div>
              </div>
            )}
            {contact.role && (
              <div className="flex items-center gap-3">
                <UserCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Role / Fonction</label>
                  <p className="text-lg">{contact.role}</p>
                </div>
              </div>
            )}
            {!contact.company && !contact.role && (
              <p className="text-muted-foreground text-sm">Aucune information entreprise</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      {contact.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Informations systeme</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <label className="text-sm font-medium text-muted-foreground">Cree le</label>
                <p className="text-sm">
                  {format(new Date(contact.createdAt), 'dd MMMM yyyy a HH:mm', {
                    locale: fr,
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Modifie le
                </label>
                <p className="text-sm">
                  {format(new Date(contact.updatedAt), 'dd MMMM yyyy a HH:mm', {
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
              Etes-vous sur de vouloir supprimer le contact &quot;{contact.name}&quot; ?
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
