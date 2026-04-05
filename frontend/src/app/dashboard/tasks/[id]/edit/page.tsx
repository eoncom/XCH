// @ts-nocheck - Temporary fix for Radix UI + React 19 type incompatibility
'use client';

import { useParams, useRouter } from 'next/navigation';
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
import { tasksApi } from '@/lib/api/tasks';
import { sitesApi } from '@/lib/api/sites';
import { assetsApi } from '@/lib/api/assets';
import { usersApi } from '@/lib/api/users';
import { ArrowLeft, Info } from 'lucide-react';
import Link from 'next/link';
import type { Task, TaskStatus, TaskPriority, Site, Asset, User, UpdateTaskDto } from '@/types';

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

export default function EditTaskPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const taskId = params.id as string;

  const { data: task, isLoading } = useQuery<Task>({
    queryKey: ['task', taskId],
    queryFn: () => tasksApi.getById(taskId),
  });

  const { data: sites } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: sitesApi.getAll,
  });

  const { data: assets } = useQuery<Asset[]>({
    queryKey: ['assets'],
    queryFn: () => assetsApi.getAll(),
  });

  const { data: usersResponse } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll(),
  });
  const users = usersResponse?.data;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    values: task
      ? {
          title: task.title,
          description: task.description || '',
          status: task.status,
          priority: task.priority,
          siteId: task.siteId || '',
          assetId: task.assetId || '',
          assignedTo: task.assignedTo || '',
          dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
          ticketUrl: task.ticketUrl || '',
          ticketRef: task.ticketRef || '',
        }
      : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateTaskDto) => tasksApi.update(taskId, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (result.siteId) {
        queryClient.invalidateQueries({ queryKey: ['sites', result.siteId] });
      }
      router.push(`/dashboard/tasks/${taskId}`);
    },
  });

  const onSubmit = (data: TaskFormData) => {
    const taskData = {
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : undefined,
      assignedTo: data.assignedTo || null,
      assetId: data.assetId || null,
    };
    updateMutation.mutate(taskData);
  };

  const status = watch('status');
  const priority = watch('priority');
  const siteId = watch('siteId');
  const assetId = watch('assetId');
  const assignedTo = watch('assignedTo');

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/tasks/${taskId}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Modifier la tâche</h1>
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
                <Select value={siteId} onValueChange={(value) => setValue('siteId', value)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un site" /></SelectTrigger>
                  <SelectContent>
                    {sites?.map((site) => (<SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>))}
                  </SelectContent>
                </Select>
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
                <Select value={assetId} onValueChange={(value) => setValue('assetId', value === 'none' ? '' : value)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un équipement" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {assets?.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.name || asset.type} - {asset.manufacturer || ''} {asset.model || asset.serialNumber || asset.id.substring(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignedTo">Assigné à</Label>
                <Select value={assignedTo} onValueChange={(value) => setValue('assignedTo', value === 'none' ? '' : value)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un utilisateur" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non assigné</SelectItem>
                    {users?.map((user) => (<SelectItem key={user.id} value={user.id}>{user.name} ({user.email})</SelectItem>))}
                  </SelectContent>
                </Select>
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
            <Button type="button" variant="outline" onClick={() => router.push(`/dashboard/tasks/${taskId}`)}>Annuler</Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
