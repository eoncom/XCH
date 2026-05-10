'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { contactsApi, contactTypesApi } from '@/lib/api/contacts';
import { organizationApi, type Delegation } from '@/lib/api/organization';
import { ScopeBadge } from '@/components/ui/scope-selector';
import { Plus, Search, Eye, Pencil, Trash2, Users, Settings, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Pagination, type PaginationMeta } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { ExportMenu } from '@/components/ui/export-menu';
import { exportContacts } from '@/lib/export-utils';
import { usePermissions } from '@/hooks/usePermissions';
import Link from 'next/link';
import type { Contact, ContactType, ContactCategory } from '@/types';
import { toast } from 'sonner';

const categoryLabels: Record<ContactCategory, string> = {
  PROVIDER: 'Fournisseurs',
  INTERNAL: 'Internes',
  PARTNER: 'Partenaires',
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

export default function ContactsPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [scopeFilter, setScopeFilter] = useState<string>('ALL');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { canCreate, canUpdate, canDelete, isManagerOrAbove, isSuperAdmin } = usePermissions();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: orgTree = [] } = useQuery<Delegation[]>({
    queryKey: ['organization-tree'],
    queryFn: () => organizationApi.getTree(),
    staleTime: 60_000,
  });

  // Parse scope filter: "ALL" | "GLOBAL" | "DELEGATION:id" | "SITE:id"
  const parsedScope = (() => {
    if (scopeFilter.startsWith('DELEGATION:')) {
      return { delegationId: scopeFilter.split(':')[1], siteId: undefined };
    }
    if (scopeFilter.startsWith('SITE:')) {
      return { delegationId: undefined, siteId: scopeFilter.split(':')[1] };
    }
    return { delegationId: undefined, siteId: undefined };
  })();
  const includeGlobal = scopeFilter === 'ALL' || scopeFilter === 'GLOBAL' ? true : undefined;

  const { data: response, isLoading, error } = useQuery<{ data: Contact[]; meta: PaginationMeta }>({
    queryKey: ['contacts', { search, categoryFilter, typeFilter, scopeFilter, page, pageSize }],
    queryFn: () => contactsApi.getAllPaginated({
      search: search || undefined,
      category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
      typeId: typeFilter !== 'ALL' ? typeFilter : undefined,
      delegationId: parsedScope.delegationId,
      siteId: parsedScope.siteId,
      includeGlobal,
      page,
      pageSize,
    }),
    retry: false,
    placeholderData: keepPreviousData,
  });
  const contacts = response?.data ?? [];
  const meta = response?.meta;

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, categoryFilter, typeFilter, scopeFilter]);

  const { data: contactTypes } = useQuery<ContactType[]>({
    queryKey: ['contact-types'],
    queryFn: () => contactTypesApi.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: contactsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact supprimé avec succès');
      setDeleteId(null);
    },
    onError: (error: Error) => {
      toast.error(`Erreur lors de la suppression: ${error.message}`);
    },
  });

  const filteredContacts = contacts.filter((contact) => {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      contact.name.toLowerCase().includes(searchLower) ||
      contact.email?.toLowerCase().includes(searchLower) ||
      contact.company?.toLowerCase().includes(searchLower);
    const matchesCategory =
      categoryFilter === 'ALL' || contact.type?.category === categoryFilter;
    const matchesType =
      typeFilter === 'ALL' || contact.typeId === typeFilter;
    return matchesSearch && matchesCategory && matchesType;
  });

  // Filter available types by current category filter
  const filteredTypes = contactTypes?.filter(
    (t) => categoryFilter === 'ALL' || t.category === categoryFilter
  );

  const sortedContacts = useMemo(() => {
    if (!sortField) return filteredContacts;
    return [...filteredContacts].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';
      switch (sortField) {
        case 'name': valA = a.name; valB = b.name; break;
        case 'type': valA = a.type?.name || ''; valB = b.type?.name || ''; break;
        case 'company': valA = a.company || ''; valB = b.company || ''; break;
        case 'email': valA = a.email || ''; valB = b.email || ''; break;
        case 'phone': valA = a.phone || a.mobile || ''; valB = b.phone || b.mobile || ''; break;
        case 'status':
          valA = a.isActive ? 0 : 1; valB = b.isActive ? 0 : 1;
          return sortDir === 'asc' ? valA - valB : valB - valA;
      }
      const cmp = String(valA).localeCompare(String(valB), 'fr', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredContacts, sortField, sortDir]);

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50" />;
    return sortDir === 'asc'
      ? <ArrowUp className="ml-1 h-3 w-3" />
      : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  const handleExport = (format: 'excel' | 'pdf' | 'csv' | 'json') => {
    if (!filteredContacts.length) return;

    const exportData = filteredContacts.map((contact) => ({
      name: contact.name,
      email: contact.email || '',
      phone: contact.phone || contact.mobile || '',
      company: contact.company || '',
      category: contact.type?.category ? categoryLabels[contact.type.category as ContactCategory] || contact.type.category : '',
      type: contact.type?.name || '',
      active: contact.isActive ? 'Oui' : 'Non',
    }));
    exportContacts(exportData, format);
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
    }
  };

  if (isLoading) {
    return <div className="text-center py-12">Chargement des contacts...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">
          Erreur lors du chargement des contacts
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
          <h1 className="text-3xl font-bold">Contacts</h1>
          <p className="text-muted-foreground">
            Annuaire : fournisseurs, internes, partenaires, équipes techniques et d&apos;urgence
          </p>
        </div>
        <div className="flex items-center gap-4">
          <ExportMenu
            onExport={handleExport}
            disabled={!filteredContacts.length}
            label="Exporter"
          />
          <div className="flex gap-2">
            {isManagerOrAbove && (
              <Button variant="outline" asChild>
                <Link href="/dashboard/contacts/types">
                  <Settings className="mr-2 h-4 w-4" />
                  Types
                </Link>
              </Button>
            )}
            {canCreate('contacts') && (
              <Button asChild data-testid="create-contact-btn">
                <Link href="/dashboard/contacts/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Nouveau contact
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Category tabs */}
      <Tabs value={categoryFilter} onValueChange={(value) => {
        setCategoryFilter(value);
        setTypeFilter('ALL');
      }}>
        <TabsList>
          <TabsTrigger value="ALL">
            <Users className="mr-2 h-4 w-4" />
            Tous
          </TabsTrigger>
          <TabsTrigger value="PROVIDER">Fournisseurs</TabsTrigger>
          <TabsTrigger value="INTERNAL">Internes</TabsTrigger>
          <TabsTrigger value="PARTNER">Partenaires</TabsTrigger>
          <TabsTrigger value="TECHNICAL">Technique</TabsTrigger>
          <TabsTrigger value="EMERGENCY">Urgence</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, email ou entreprise..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Type de contact" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous les types</SelectItem>
            {filteredTypes?.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                <div className="flex items-center gap-2">
                  {type.color && (
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: type.color }}
                    />
                  )}
                  {type.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={scopeFilter} onValueChange={setScopeFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Portée" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Toutes les portées</SelectItem>
            <SelectItem value="GLOBAL">Global (tenant)</SelectItem>
            {orgTree.map((del) => (
              <SelectItem key={del.id} value={`DELEGATION:${del.id}`}>
                Délégation {del.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="pt-6">
          {filteredContacts && filteredContacts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('name')}>
                    <span className="inline-flex items-center">Nom<SortIcon field="name" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('type')}>
                    <span className="inline-flex items-center">Type<SortIcon field="type" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('company')}>
                    <span className="inline-flex items-center">Entreprise<SortIcon field="company" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('email')}>
                    <span className="inline-flex items-center">Email<SortIcon field="email" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('phone')}>
                    <span className="inline-flex items-center">Téléphone<SortIcon field="phone" /></span>
                  </TableHead>
                  <TableHead>Portée</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('status')}>
                    <span className="inline-flex items-center">Statut<SortIcon field="status" /></span>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedContacts.map((contact) => (
                  <TableRow key={contact.id} data-testid="contact-row">
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell>
                      <Badge
                        className="whitespace-nowrap"
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
                        {contact.type?.name || 'Non défini'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {contact.company || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {contact.email ? (
                        <a
                          href={`mailto:${contact.email}`}
                          className="hover:underline text-primary"
                        >
                          {contact.email}
                        </a>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {contact.phone || contact.mobile || '-'}
                    </TableCell>
                    <TableCell>
                      <ScopeBadge delegationId={contact.delegationId} siteId={contact.siteId} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={contact.isActive ? 'success' : 'secondary'}>
                        {contact.isActive ? 'Actif' : 'Inactif'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          data-testid="view-contact-btn"
                        >
                          <Link href={`/dashboard/contacts/${contact.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        {canUpdate('contacts') && (isSuperAdmin || contact.delegationId) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                            data-testid="edit-contact-btn"
                          >
                            <Link href={`/dashboard/contacts/${contact.id}/edit`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                        )}
                        {canDelete('contacts') && (isSuperAdmin || contact.delegationId) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(contact.id)}
                            data-testid="delete-contact-btn"
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
            <EmptyState
              icon={Users}
              title="Aucun contact trouvé"
              description={search || categoryFilter !== 'ALL' || typeFilter !== 'ALL' || scopeFilter !== 'ALL'
                ? 'Essayez de modifier vos filtres de recherche'
                : 'Commencez par ajouter un nouveau contact'}
              action={!search && categoryFilter === 'ALL' && typeFilter === 'ALL' && scopeFilter === 'ALL' && canCreate('contacts')
                ? { label: 'Nouveau contact', href: '/dashboard/contacts/new', icon: Plus }
                : undefined}
            />
          )}
        </CardContent>
      </Card>

      {meta && <Pagination meta={meta} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce contact ? Cette action est
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
