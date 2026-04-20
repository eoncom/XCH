// @ts-nocheck - Temporary fix for Radix UI + React 19 type incompatibility
'use client';

import { useRouter } from 'next/navigation';
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
import { EntitySelectCombobox } from '@/components/ui/entity-select-combobox';
import { tasksApi } from '@/lib/api/tasks';
import { sitesApi } from '@/lib/api/sites';
import { assetsApi } from '@/lib/api/assets';
import { usersApi } from '@/lib/api/users';
import { ArrowLeft, Info } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { TaskStatus, TaskPriority, Site, Asset, User, CreateTaskDto } from '@/types';
import { useDelegation } from '@/contexts/DelegationContext';

const taskStatusLabels: Record<TaskStatus, string> = {
  TODO: 'À faire',
  IN_PROGRESS: 'En cours',
  BLOCKED: 'Bloquée',
  DONE: 'Terminée',
  CANCELLED: 'Annulée',
};

const taskPriorityLabels: Record<TaskPriority, string> = {
  LOW: 'Basse',
  MEDIUM: 'Moyenne',
  HIGH: 'Haute',
  URGENT: 'Urgente',
};

const taskSchema = z.object({
  title: z.string().min(1, 'Le titre est requis'),
  description: z.string().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  siteId: z.string().min(1, 'Le site est requis'),
  assetId: z.string().optional(),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(),
  ticketUrl: z.string().optional(),
  ticketRef: z.string().optional(),
});

type TaskFormData = z.infer<typeof taskSchema>;

export default function NewTaskPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const defaultSiteId = searchParams.get('siteId') || undefined;
  const defaultAssetId = searchParams.get('assetId') || undefined;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      status: 'TODO',
      priority: 'MEDIUM',
      siteId: defaultSiteId,
      assetId: defaultAssetId,
    },
  });

  // Phase 6.5 cascade audit: scope the Selects to the active delegation so the
  // user doesn't see sites/assets/users they can't actually use for this task.
  const { currentDelegation } = useDelegation();
  const activeDelegationId = currentDelegation?.delegationId;

  const { data: sites } = useQuery<Site[]>({
    queryKey: ['sites', { delegationId: activeDelegationId }],
    queryFn: () => sitesApi.getAll({ delegationId: activeDelegationId }),
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll(),
  });

  // Assets are loaded lazily — once the user has picked a site. Fetch is
  // scoped to that site so hors-portée assets never appear.
  const watchedSiteId = watch('siteId');
  const { data: assets } = useQuery<Asset[]>({
    queryKey: ['assets', { siteId: watchedSiteId }],
    queryFn: () => assetsApi.getAll({ siteId: watchedSiteId }),
    enabled: !!watchedSiteId,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateTaskDto) => tasksApi.create(data),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      if (task.siteId) {
        queryClient.invalidateQueries({ queryKey: ['sites', task.siteId] });
      }
      router.push(`/dashboard/tasks/${task.id}`);
    },
  });

  const onSubmit = (data: TaskFormData) => {
    const taskData = {
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : undefined,
    };
    createMutation.mutate(taskData);
  };

  const status = watch('status');
  const priority = watch('priority');
  const siteId = watch('siteId');
  const assetId = watch('assetId');
  const assignedTo = watch('assignedTo');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/tasks">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Nouvelle tâche</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Section 1: Tâche (obligatoire) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Tâche
              <span className="text-xs font-normal text-red-500 bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded">Obligatoire</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titre <span className="text-red-500">*</span></Label>
              <Input id="title" {...register('title')} placeholder="Ex: Installation switch principal" />
              {errors.title && <p className="text-sm text-red-600">{errors.title.message}</p>}
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Statut <span className="text-red-500">*</span></Label>
                <Select value={status} onValueChange={(value) => setValue('status', value as TaskStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(taskStatusLabels).map(([value, label]) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priorité <span className="text-red-500">*</span></Label>
                <Select value={priority} onValueChange={(value) => setValue('priority', value as TaskPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(taskPriorityLabels).map(([value, label]) => (<SelectItem key={value} value={value}>{label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="siteId">Site <span className="text-red-500">*</span></Label>
                <EntitySelectCombobox
                  id="siteId"
                  ariaLabel="Site concerné par la tâche"
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
                {errors.siteId && <p className="text-sm text-red-600">{errors.siteId.message}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Description (optionnel) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Description
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">Optionnel</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea id="description" {...register('description')} placeholder="Détails de la tâche, étapes à suivre..." rows={4} />
          </CardContent>
        </Card>

        {/* Section 3: Affectation & Suivi (optionnel) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Affectation & Suivi
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">Optionnel</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assetId">Équipement lié</Label>
                <EntitySelectCombobox
                  id="assetId"
                  ariaLabel="Équipement concerné (optionnel)"
                  options={(assets || []).map((asset) => ({
                    value: asset.id,
                    label: `${asset.name || asset.type} ${asset.serialNumber ? `— ${asset.serialNumber}` : ''}`.trim(),
                    searchText: [asset.name, asset.type, asset.manufacturer, asset.model, asset.serialNumber]
                      .filter(Boolean)
                      .join(' '),
                  }))}
                  value={assetId || null}
                  onChange={(v) => setValue('assetId', v ?? '')}
                  placeholder="Aucun équipement"
                  searchPlaceholder="Rechercher un équipement..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignedTo">Assigné à</Label>
                <EntitySelectCombobox
                  id="assignedTo"
                  ariaLabel="Utilisateur assigné (optionnel)"
                  options={(users || []).map((user) => ({
                    value: user.id,
                    label: `${user.name} (${user.email})`,
                    searchText: `${user.name} ${user.email}`,
                  }))}
                  value={assignedTo || null}
                  onChange={(v) => setValue('assignedTo', v ?? '')}
                  placeholder="Non assigné"
                  searchPlaceholder="Rechercher un utilisateur..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Date d'échéance</Label>
                <Input id="dueDate" type="date" {...register('dueDate')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ticketRef">Réf. ticket</Label>
                <Input id="ticketRef" {...register('ticketRef')} placeholder="Ex: GLPI-1234, JIRA-567" />
                <p className="text-xs text-muted-foreground">Référence du ticket dans le système externe</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ticketUrl">Lien ticket externe</Label>
                <Input id="ticketUrl" type="url" {...register('ticketUrl')} placeholder="https://ticketing.example.com/ticket/123" />
                <p className="text-xs text-muted-foreground">URL vers le ticket (GLPI, Jira, etc.)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Info className="h-4 w-4" />
            Les champs marqués <span className="text-red-500">*</span> sont obligatoires
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => router.push('/dashboard/tasks')}>Annuler</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Création...' : 'Créer la tâche'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
