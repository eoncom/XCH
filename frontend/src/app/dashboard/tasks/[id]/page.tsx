'use client';

import { use, useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { tasksApi } from '@/lib/api/tasks';
import { ResyncExpenseButton } from '@/components/expenses/ResyncExpenseButton';
import { usePermissions } from '@/hooks/usePermissions';
import { Attachments } from '@/components/Attachments';
import { InlineEditCard } from '@/components/InlineEditCard';
import { showToast } from '@/lib/toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  taskStatusLabels as centralTaskStatusLabels,
  taskStatusColors as centralTaskStatusColors,
  taskPriorityLabels as centralTaskPriorityLabels,
  taskPriorityColors as centralTaskPriorityColors,
} from '@/lib/status-labels';
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
  MessageSquare,
  Send,
  Pencil,
  Bot,
  Receipt,
} from 'lucide-react';
import Link from 'next/link';
import type { Task, TaskStatus, TaskPriority, TaskComment, ChecklistItem } from '@/types';

// Validation schema pour nouveaux items checklist
const checklistItemSchema = z.object({
  text: z.string().min(1, 'Le texte est requis').max(200, 'Maximum 200 caractères'),
});

// Use centralized labels from status-labels.ts
const taskStatusLabels = centralTaskStatusLabels as Record<TaskStatus, string>;
const taskStatusColors = centralTaskStatusColors as Record<TaskStatus, string>;
const taskPriorityLabels = centralTaskPriorityLabels as Record<TaskPriority, string>;
const taskPriorityColors = centralTaskPriorityColors as Record<TaskPriority, string>;

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffHour < 24) return `Il y a ${diffHour}h`;
  if (diffDay < 7) return `Il y a ${diffDay}j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: diffDay > 365 ? 'numeric' : undefined });
}

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { canUpdate, canDelete } = usePermissions();
  const [showDeleteItemDialog, setShowDeleteItemDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Inline edit state
  const [editDescription, setEditDescription] = useState('');

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => tasksApi.update(id, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      showToast.success('Mise à jour réussie');
    },
    onError: (error: Error) => {
      showToast.error(`Erreur: ${error.message}`);
      throw error;
    },
  });

  // Comment state
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [showDeleteCommentDialog, setShowDeleteCommentDialog] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const { data: task, isLoading, error } = useQuery<Task>({
    queryKey: ['task', id],
    queryFn: () => tasksApi.getById(id),
    retry: (failureCount, err: any) => {
      const status = err?.response?.status ?? err?.status;
      if (status === 404 || status === 403) return false;
      return failureCount < 2;
    },
  });

  const { data: comments = [] } = useQuery<TaskComment[]>({
    queryKey: ['task-comments', id],
    queryFn: () => tasksApi.getComments(id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => tasksApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      showToast.success('Tâche supprimée avec succès');
      router.push('/dashboard/tasks');
    },
    onError: () => {
      showToast.error('Erreur lors de la suppression de la tâche');
    },
  });

  const updateChecklistMutation = useMutation({
    mutationFn: (checklist: ChecklistItem[]) =>
      tasksApi.updateChecklist(id, checklist),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      showToast.success('Checklist mise à jour');
    },
    onError: () => {
      showToast.error('Erreur lors de la mise à jour');
    },
  });

  // Comment mutations
  const createCommentMutation = useMutation({
    mutationFn: (text: string) => tasksApi.createComment(id, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', id] });
      setNewComment('');
      showToast.success('Commentaire ajouté');
    },
    onError: () => {
      showToast.error("Erreur lors de l'ajout du commentaire");
    },
  });

  const updateCommentMutation = useMutation({
    mutationFn: ({ commentId, text }: { commentId: string; text: string }) =>
      tasksApi.updateComment(id, commentId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', id] });
      setEditingCommentId(null);
      setEditingCommentText('');
      showToast.success('Commentaire modifié');
    },
    onError: () => {
      showToast.error('Erreur lors de la modification');
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => tasksApi.deleteComment(id, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', id] });
      setShowDeleteCommentDialog(false);
      setCommentToDelete(null);
      showToast.success('Commentaire supprimé');
    },
    onError: () => {
      showToast.error('Erreur lors de la suppression');
    },
  });

  // Auto-scroll to bottom when new comments are added
  useEffect(() => {
    if (comments.length > 0) {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments.length]);

  const handleDelete = () => {
    deleteMutation.mutate();
    setShowDeleteDialog(false);
  };

  const toggleChecklistItem = (itemId: string) => {
    if (!task?.checklist) return;

    const validChecklist = task.checklist.filter(
      (item): item is ChecklistItem =>
        item && typeof item === 'object' && !Array.isArray(item) && 'id' in item
    );

    const updatedChecklist = validChecklist.map((item) =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );

    updateChecklistMutation.mutate(updatedChecklist);
  };

  const addChecklistItem = () => {
    if (!task) return;

    const validation = checklistItemSchema.safeParse({ text: newChecklistItem.trim() });

    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || 'Erreur de validation';
      setValidationError(errorMessage);
      showToast.error(errorMessage);
      return;
    }

    setValidationError(null);

    const validChecklist = (task.checklist || []).filter(
      (item): item is ChecklistItem =>
        item && typeof item === 'object' && !Array.isArray(item) && 'id' in item
    );

    const newItem: ChecklistItem = {
      id: `temp-${Date.now()}`,
      text: validation.data.text,
      checked: false,
      order: validChecklist.length + 1,
    };

    const updatedChecklist = [...validChecklist, newItem];
    updateChecklistMutation.mutate(updatedChecklist);
    setNewChecklistItem('');
  };

  const handleDeleteItemClick = (itemId: string) => {
    setItemToDelete(itemId);
    setShowDeleteItemDialog(true);
  };

  const confirmDeleteItem = () => {
    if (!task?.checklist || !itemToDelete) return;

    const validChecklist = task.checklist.filter(
      (item): item is ChecklistItem =>
        item && typeof item === 'object' && !Array.isArray(item) && 'id' in item
    );

    const updatedChecklist = validChecklist.filter((item) => item.id !== itemToDelete);
    updateChecklistMutation.mutate(updatedChecklist);

    setShowDeleteItemDialog(false);
    setItemToDelete(null);
  };

  const handleSubmitComment = () => {
    const trimmed = newComment.trim();
    if (!trimmed) return;
    createCommentMutation.mutate(trimmed);
  };

  const handleSaveEditComment = () => {
    if (!editingCommentId || !editingCommentText.trim()) return;
    updateCommentMutation.mutate({
      commentId: editingCommentId,
      text: editingCommentText.trim(),
    });
  };

  if (isLoading) {
    return <div className="text-center py-12">Chargement...</div>;
  }

  if (error || !task) {
    // ADR-021 — 404 cross-delegation ou ressource supprimée.
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-muted-foreground">
          Tâche introuvable ou inaccessible. Le lien que vous avez suivi est
          peut-être périmé, ou cette tâche appartient à un site auquel vous
          n'avez pas accès.
        </p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/tasks">
            <ArrowLeft className="mr-2 h-4 w-4" /> Retour à la liste
          </Link>
        </Button>
      </div>
    );
  }

  // Filter out invalid checklist items for display and calculations
  const validChecklist = task.checklist?.filter(
    (item): item is ChecklistItem =>
      item && typeof item === 'object' && !Array.isArray(item) && 'id' in item
  ) || [];
  const completedItems = validChecklist.filter((item) => item.checked).length;
  const totalItems = validChecklist.length;
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
              {canUpdate('tasks', task?.siteId) ? (
                <Select
                  value={task.status}
                  onValueChange={(value) => updateMutation.mutate({ status: value })}
                  disabled={updateMutation.isPending}
                >
                  <SelectTrigger className="w-[140px] h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(taskStatusLabels) as [TaskStatus, string][]).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant={taskStatusColors[task.status]}>
                  {taskStatusLabels[task.status]}
                </Badge>
              )}
              <Badge variant={taskPriorityColors[task.priority]}>
                {taskPriorityLabels[task.priority]}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {canUpdate('tasks', task?.siteId) && (
            <Button variant="outline" asChild data-testid="edit-task-btn">
              <Link href={`/dashboard/tasks/${id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Modifier
              </Link>
            </Button>
          )}
          {canDelete('tasks', task?.siteId) && (
            <Button variant="destructive" onClick={() => setShowDeleteDialog(true)} data-testid="delete-task-btn">
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </Button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Description */}
          <InlineEditCard
            title="Description"
            canEdit={canUpdate('tasks', task?.siteId)}
            onEdit={() => setEditDescription(task.description || '')}
            onSave={async () => {
              await updateMutation.mutateAsync({ description: editDescription || null });
            }}
            onCancel={() => setEditDescription(task.description || '')}
            editContent={
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Ajouter une description..."
                rows={6}
              />
            }
          >
            {task.description ? (
              <p className="text-muted-foreground whitespace-pre-wrap">{task.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">Aucune description</p>
            )}
          </InlineEditCard>

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
              {validChecklist.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 group"
                >
                  <button
                    onClick={() => canUpdate('tasks', task?.siteId) && toggleChecklistItem(item.id)}
                    className="flex-shrink-0"
                    disabled={updateChecklistMutation.isPending}
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
                    {item.text || 'Sans titre'}
                  </span>
                  {canUpdate('tasks', task?.siteId) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteItemClick(item.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      disabled={updateChecklistMutation.isPending}
                      data-testid="delete-checklist-item-btn"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              {/* Add new item */}
              {canUpdate('tasks', task?.siteId) && (
                <div className="space-y-2 mt-4">
                  <div className="flex gap-2">
                    <Input
                      data-testid="checklist-input"
                      placeholder="Ajouter un élément..."
                      value={newChecklistItem}
                      onChange={(e) => {
                        setNewChecklistItem(e.target.value);
                        setValidationError(null);
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          addChecklistItem();
                        }
                      }}
                      disabled={updateChecklistMutation.isPending}
                      className={validationError ? 'border-red-500' : ''}
                    />
                    <Button
                      onClick={addChecklistItem}
                      size="icon"
                      data-testid="add-checklist-btn"
                      disabled={updateChecklistMutation.isPending}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {validationError && (
                    <p className="text-sm text-red-600">{validationError}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Comments */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                <CardTitle>
                  Commentaires
                  {comments.length > 0 && (
                    <span className="text-muted-foreground font-normal ml-2">
                      ({comments.length})
                    </span>
                  )}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {/* Comment list */}
              <div className="space-y-4 mb-4 max-h-[500px] overflow-y-auto">
                {comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucun commentaire. Soyez le premier !
                  </p>
                ) : (
                  comments.map((comment) => (
                    <div
                      key={comment.id}
                      className={`flex gap-3 group ${
                        comment.isSystem ? 'bg-muted/50 rounded-lg p-3 -mx-1' : ''
                      }`}
                    >
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        {comment.isSystem ? (
                          <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                            <Bot className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-medium text-primary">
                              {comment.author?.name?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-medium">
                            {comment.isSystem ? 'Système' : comment.author?.name || 'Inconnu'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(comment.createdAt)}
                          </span>
                          {comment.updatedAt !== comment.createdAt && (
                            <span className="text-xs text-muted-foreground italic">
                              (modifié)
                            </span>
                          )}
                        </div>

                        {editingCommentId === comment.id ? (
                          <div className="mt-1 space-y-2">
                            <Textarea
                              value={editingCommentText}
                              onChange={(e) => setEditingCommentText(e.target.value)}
                              className="min-h-[60px] text-sm"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={handleSaveEditComment}
                                disabled={updateCommentMutation.isPending || !editingCommentText.trim()}
                              >
                                {updateCommentMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingCommentId(null);
                                  setEditingCommentText('');
                                }}
                              >
                                Annuler
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-0.5">
                            {comment.text}
                          </p>
                        )}
                      </div>

                      {/* Actions (only for non-system, non-editing) */}
                      {!comment.isSystem && editingCommentId !== comment.id && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setEditingCommentId(comment.id);
                              setEditingCommentText(comment.text);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setCommentToDelete(comment.id);
                              setShowDeleteCommentDialog(true);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={commentsEndRef} />
              </div>

              {/* Add comment form */}
              <div className="flex gap-2 pt-3 border-t">
                <Textarea
                  placeholder="Ajouter un commentaire..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      handleSubmitComment();
                    }
                  }}
                  className="min-h-[60px] text-sm resize-none"
                  disabled={createCommentMutation.isPending}
                />
                <Button
                  size="icon"
                  onClick={handleSubmitComment}
                  disabled={createCommentMutation.isPending || !newComment.trim()}
                  className="flex-shrink-0 self-end"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Ctrl+Entrée pour envoyer
              </p>
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

              {(task.ticketUrl || task.ticketRef) && (
                <div className="flex items-start gap-3">
                  <ExternalLink className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Ticket lié</p>
                    {task.ticketRef && (
                      <p className="text-sm font-mono text-muted-foreground">{task.ticketRef}</p>
                    )}
                    {task.ticketStatus && (
                      <Badge variant="secondary" className="mt-1">{task.ticketStatus}</Badge>
                    )}
                    {task.ticketUrl && (
                      <a
                        href={task.ticketUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline block mt-1"
                      >
                        Ouvrir le ticket
                      </a>
                    )}
                  </div>
                </div>
              )}

              {(task.estimatedCost || task.actualCost) && (
                <div className="flex items-start gap-3">
                  <Receipt className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">Coûts</p>
                      {/* ADR-011 — Resync visible only when an Expense is linked
                          (Task.expenseId set). Click recalculates the Expense
                          totalAmount from current task.actualCost / estimatedCost. */}
                      {(task as any).expenseId && canUpdate('tasks', task.siteId) && (
                        <ResyncExpenseButton
                          resyncFn={() => tasksApi.resyncExpense(id)}
                          currency={task.costCurrency || 'EUR'}
                          invalidateKeys={[['expenses'], ['task', id]]}
                          size="sm"
                        >
                          Sync dépense
                        </ResyncExpenseButton>
                      )}
                    </div>
                    {task.estimatedCost != null && (
                      <p className="text-sm text-muted-foreground">
                        Estimé : {Number(task.estimatedCost).toLocaleString('fr-FR')} {task.costCurrency || 'EUR'}
                      </p>
                    )}
                    {task.actualCost != null && (
                      <p className="text-sm text-muted-foreground">
                        Réel : {Number(task.actualCost).toLocaleString('fr-FR')} {task.costCurrency || 'EUR'}
                      </p>
                    )}
                    {(task as any).expenseId && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Dépense liée — montant figé à la création (ADR-011).
                      </p>
                    )}
                  </div>
                </div>
              )}

              {task.completedAt && (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Complétée le</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(task.completedAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              )}

              {task.creator && (
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Créé par</p>
                    <p className="text-sm text-muted-foreground">
                      {task.creator.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(task.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <Attachments
                entityId={id}
                entityType="tasks"
                apiModule={tasksApi}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete task confirmation dialog */}
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

      {/* Delete checklist item confirmation dialog */}
      <Dialog open={showDeleteItemDialog} onOpenChange={setShowDeleteItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer cet élément de la checklist ?
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteItemDialog(false);
                setItemToDelete(null);
              }}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteItem}
              disabled={updateChecklistMutation.isPending}
              data-testid="confirm-delete-item-btn"
            >
              {updateChecklistMutation.isPending ? 'Suppression...' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete comment confirmation dialog */}
      <Dialog open={showDeleteCommentDialog} onOpenChange={setShowDeleteCommentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le commentaire</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer ce commentaire ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteCommentDialog(false);
                setCommentToDelete(null);
              }}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => commentToDelete && deleteCommentMutation.mutate(commentToDelete)}
              disabled={deleteCommentMutation.isPending}
            >
              {deleteCommentMutation.isPending ? 'Suppression...' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
