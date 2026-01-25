'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { tasksApi } from '@/lib/api/tasks';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Calendar,
  User,
  MapPin,
  Package,
  CheckCircle2,
  Circle,
  Plus,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import type { Task, TaskStatus, TaskPriority, ChecklistItem } from '@/types';

const taskStatusLabels: Record<TaskStatus, string> = {
  TODO: 'À faire',
  IN_PROGRESS: 'En cours',
  BLOCKED: 'Bloqué',
  DONE: 'Terminé',
  CANCELLED: 'Annulé',
};

const taskStatusColors = {
  TODO: 'secondary',
  IN_PROGRESS: 'default',
  BLOCKED: 'error',
  DONE: 'success',
  CANCELLED: 'secondary',
} as const;

const taskPriorityColors = {
  LOW: 'secondary',
  MEDIUM: 'default',
  HIGH: 'warning',
  URGENT: 'error',
} as const;

const taskPriorityLabels: Record<TaskPriority, string> = {
  LOW: 'Faible',
  MEDIUM: 'Moyenne',
  HIGH: 'Haute',
  URGENT: 'Urgente',
};

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState('');

  const { data: task, isLoading } = useQuery<Task>({
    queryKey: ['task', id],
    queryFn: () => tasksApi.getById(id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => tasksApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      router.push('/dashboard/tasks');
    },
  });

  const updateChecklistMutation = useMutation({
    mutationFn: (checklist: ChecklistItem[]) =>
      tasksApi.updateChecklist(id, checklist),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', id] });
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate();
    setShowDeleteDialog(false);
  };

  const toggleChecklistItem = (itemId: string) => {
    if (!task?.checklist) return;

    const updatedChecklist = task.checklist.map((item) =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );

    updateChecklistMutation.mutate(updatedChecklist);
  };

  const addChecklistItem = () => {
    if (!task || !newChecklistItem.trim()) return;

    const newItem: ChecklistItem = {
      id: `temp-${Date.now()}`,
      text: newChecklistItem,
      checked: false,
      order: (task.checklist?.length || 0) + 1,
    };

    const updatedChecklist = [...(task.checklist || []), newItem];
    updateChecklistMutation.mutate(updatedChecklist);
    setNewChecklistItem('');
  };

  const deleteChecklistItem = (itemId: string) => {
    if (!task?.checklist) return;

    const updatedChecklist = task.checklist.filter((item) => item.id !== itemId);
    updateChecklistMutation.mutate(updatedChecklist);
  };

  if (isLoading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  if (!task) {
    return <div className="text-center py-12">Tâche non trouvée</div>;
  }

  const completedItems = task.checklist?.filter((item) => item.checked).length || 0;
  const totalItems = task.checklist?.length || 0;
  const progress = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/tasks">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{task.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={taskStatusColors[task.status]}>
                {taskStatusLabels[task.status]}
              </Badge>
              <Badge variant={taskPriorityColors[task.priority]}>
                {taskPriorityLabels[task.priority]}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/dashboard/tasks/${id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Modifier
            </Link>
          </Button>
          <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Supprimer
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Description */}
          {task.description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {task.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Checklist */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Checklist</CardTitle>
                  {totalItems > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {completedItems} / {totalItems} complétés ({Math.round(progress)}%)
                    </p>
                  )}
                </div>
              </div>
              {totalItems > 0 && (
                <div className="w-full bg-muted rounded-full h-2 mt-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {task.checklist?.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 group"
                >
                  <button
                    onClick={() => toggleChecklistItem(item.id)}
                    className="flex-shrink-0"
                  >
                    {item.checked ? (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                  <span
                    className={`flex-1 ${
                      item.checked ? 'line-through text-muted-foreground' : ''
                    }`}
                  >
                    {item.text || (item as any).title || 'Sans titre'}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteChecklistItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {/* Add new item */}
              <div className="flex gap-2 mt-4">
                <Input
                  placeholder="Ajouter un élément..."
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addChecklistItem();
                    }
                  }}
                />
                <Button onClick={addChecklistItem} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle>Détails</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {task.dueDate && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Échéance</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(task.dueDate).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              )}

              {task.assignedUser && (
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Assigné à</p>
                    <p className="text-sm text-muted-foreground">
                      {task.assignedUser.name}
                    </p>
                  </div>
                </div>
              )}

              {task.site && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Site</p>
                    <Link
                      href={`/dashboard/sites/${task.site.id}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {task.site.name}
                    </Link>
                  </div>
                </div>
              )}

              {task.asset && (
                <div className="flex items-start gap-3">
                  <Package className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Équipement</p>
                    <Link
                      href={`/dashboard/assets/${task.asset.id}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {task.asset.manufacturer} {task.asset.model}
                    </Link>
                  </div>
                </div>
              )}

              {task.ticketLink && (
                <div className="flex items-start gap-3">
                  <ExternalLink className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Ticket lié</p>
                    <a
                      href={task.ticketLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Ouvrir le ticket
                    </a>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer la tâche &quot;{task.title}&quot; ?
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
