'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { tasksApi } from '@/lib/api/tasks';
import { Plus, Calendar, User, AlertCircle, Clock, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import type { Task, TaskStatus, TaskPriority } from '@/types';

function isTaskOverdue(task: Task): boolean {
  if (!task.dueDate) return false;
  if (task.status === 'DONE' || task.status === 'CANCELLED') return false;
  return new Date(task.dueDate) < new Date();
}

function isTaskDueSoon(task: Task): boolean {
  if (!task.dueDate) return false;
  if (task.status === 'DONE' || task.status === 'CANCELLED') return false;
  const now = new Date();
  const dueDate = new Date(task.dueDate);
  if (dueDate < now) return false; // already overdue
  const diffMs = dueDate.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= 2;
}

const taskStatusLabels: Record<TaskStatus, string> = {
  TODO: 'À faire',
  IN_PROGRESS: 'En cours',
  BLOCKED: 'Bloqué',
  DONE: 'Terminé',
  CANCELLED: 'Annulé',
};

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

const kanbanColumns: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'];

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onDrop: (taskId: string, newStatus: TaskStatus) => void;
}

function KanbanColumn({ status, tasks, onTaskClick, onDrop }: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      onDrop(taskId, status);
    }
  };

  return (
    <div className="flex-1 min-w-[300px]">
      <div className="mb-4">
        <h3 className="font-semibold text-lg flex items-center justify-between">
          {taskStatusLabels[status]}
          <span className="text-sm text-muted-foreground">({tasks.length})</span>
        </h3>
      </div>

      <div
        data-testid={`kanban-column-${status}`}
        className={`space-y-3 min-h-[500px] p-3 rounded-lg transition-colors ${
          isDragOver ? 'bg-muted' : 'bg-muted/20'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
        ))}
      </div>
    </div>
  );
}

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

function TaskCard({ task, onClick }: TaskCardProps) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('taskId', task.id);
  };

  const completedItems = task.checklist?.filter((item) => item.checked).length || 0;
  const totalItems = task.checklist?.length || 0;
  const overdue = isTaskOverdue(task);
  const dueSoon = isTaskDueSoon(task);

  return (
    <Card
      data-testid="task-card"
      className={`cursor-move hover:shadow-md transition-shadow ${
        overdue ? 'border-red-400 dark:border-red-600 bg-red-50/50 dark:bg-red-950/20' :
        dueSoon ? 'border-amber-400 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-950/20' : ''
      }`}
      draggable
      onDragStart={handleDragStart}
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium flex-1">{task.title}</h4>
          <Badge variant={taskPriorityColors[task.priority]}>
            {taskPriorityLabels[task.priority]}
          </Badge>
        </div>

        {overdue && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 rounded px-2 py-1">
            <Clock className="h-3 w-3" />
            En retard — échéance {new Date(task.dueDate!).toLocaleDateString('fr-FR')}
          </div>
        )}

        {dueSoon && !overdue && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 rounded px-2 py-1">
            <AlertTriangle className="h-3 w-3" />
            Échéance proche — {new Date(task.dueDate!).toLocaleDateString('fr-FR')}
          </div>
        )}

        {task.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {task.dueDate && !overdue && !dueSoon && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(task.dueDate).toLocaleDateString('fr-FR')}
            </div>
          )}

          {task.assignedUser && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {task.assignedUser.name}
            </div>
          )}

          {task.status === 'BLOCKED' && (
            <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
              <AlertCircle className="h-3 w-3" />
              Bloqué
            </div>
          )}
        </div>

        {totalItems > 0 && (
          <div className="text-xs text-muted-foreground">
            Checklist: {completedItems}/{totalItems}
          </div>
        )}

        {task.site && (
          <div className="text-xs text-muted-foreground">
            Site: {task.site.name}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function TasksPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: tasks, isLoading } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.getAll(),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      tasksApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const handleTaskClick = (task: Task) => {
    router.push(`/dashboard/tasks/${task.id}`);
  };

  const handleDrop = (taskId: string, newStatus: TaskStatus) => {
    updateStatusMutation.mutate({ id: taskId, status: newStatus });
  };

  const getTasksByStatus = (status: TaskStatus): Task[] => {
    return tasks?.filter((task) => task.status === status) || [];
  };

  const overdueTasks = tasks?.filter(isTaskOverdue) || [];
  const blockedTasks = tasks?.filter((t) => t.status === 'BLOCKED') || [];
  const dueSoonTasks = tasks?.filter(isTaskDueSoon) || [];

  if (isLoading) {
    return <div className="text-center">Chargement des tâches...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tâches</h1>
          <p className="text-muted-foreground">Gérez vos tâches et interventions</p>
        </div>
        <Button asChild data-testid="create-task-btn">
          <Link href="/dashboard/tasks/new">
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle tâche
          </Link>
        </Button>
      </div>

      {/* Alert banners */}
      {(overdueTasks.length > 0 || blockedTasks.length > 0 || dueSoonTasks.length > 0) && (
        <div className="flex flex-wrap gap-3">
          {overdueTasks.length > 0 && (
            <div className="flex items-center gap-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg px-4 py-2 text-sm font-medium">
              <Clock className="h-4 w-4" />
              {overdueTasks.length} tâche{overdueTasks.length > 1 ? 's' : ''} en retard
            </div>
          )}
          {blockedTasks.length > 0 && (
            <div className="flex items-center gap-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg px-4 py-2 text-sm font-medium">
              <AlertCircle className="h-4 w-4" />
              {blockedTasks.length} tâche{blockedTasks.length > 1 ? 's' : ''} bloquée{blockedTasks.length > 1 ? 's' : ''}
            </div>
          )}
          {dueSoonTasks.length > 0 && (
            <div className="flex items-center gap-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-lg px-4 py-2 text-sm font-medium">
              <AlertTriangle className="h-4 w-4" />
              {dueSoonTasks.length} tâche{dueSoonTasks.length > 1 ? 's' : ''} — échéance dans moins de 48h
            </div>
          )}
        </div>
      )}

      {/* Kanban Board */}
      <div data-testid="kanban-board" className="flex gap-6 overflow-x-auto pb-4">
        {kanbanColumns.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={getTasksByStatus(status)}
            onTaskClick={handleTaskClick}
            onDrop={handleDrop}
          />
        ))}
      </div>

      {tasks?.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Aucune tâche</p>
        </div>
      )}
    </div>
  );
}
