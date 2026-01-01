'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { tasksApi } from '@/lib/api/tasks';
import { Plus, Calendar, User, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import type { Task, TaskStatus, TaskPriority } from '@/types';

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

  return (
    <Card
      className="cursor-move hover:shadow-md transition-shadow"
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

        {task.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {task.dueDate && (
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
            <div className="flex items-center gap-1 text-red-600">
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
    queryFn: tasksApi.getAll,
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
        <Button asChild>
          <Link href="/dashboard/tasks/new">
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle tâche
          </Link>
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-6 overflow-x-auto pb-4">
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
