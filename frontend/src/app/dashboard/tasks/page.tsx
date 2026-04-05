'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { tasksApi } from '@/lib/api/tasks';
import { sitesApi } from '@/lib/api/sites';
import { usersApi } from '@/lib/api/users';
import { Plus, Calendar, User, AlertCircle, Clock, AlertTriangle, Search, X, ClipboardList } from 'lucide-react';
import { Pagination, type PaginationMeta } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { ExportMenu } from '@/components/ui/export-menu';
import { exportTasks } from '@/lib/export-utils';
import { usePermissions } from '@/hooks/usePermissions';
import Link from 'next/link';
import type { Task, TaskStatus, TaskPriority, Site } from '@/types';

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

import { taskStatusLabels, taskPriorityLabels, taskPriorityColors } from '@/lib/status-labels';

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
          <Badge variant={taskPriorityColors[task.priority] as 'secondary' | 'default' | 'warning' | 'error'}>
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [assignedFilter, setAssignedFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { canCreate } = usePermissions();

  const { data: response, isLoading } = useQuery<{ data: Task[]; meta: PaginationMeta }>({
    queryKey: ['tasks', { page, pageSize, status: statusFilter, priority: priorityFilter, siteId: siteFilter, assignedTo: assignedFilter, search }],
    queryFn: () => tasksApi.getAllPaginated({
      page,
      pageSize,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      priority: priorityFilter !== 'all' ? priorityFilter : undefined,
      siteId: siteFilter !== 'all' ? siteFilter : undefined,
      assignedTo: assignedFilter !== 'all' ? assignedFilter : undefined,
      search: search || undefined,
    }),
  });
  const tasks = response?.data ?? [];
  const meta = response?.meta;

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, statusFilter, priorityFilter, siteFilter, assignedFilter]);

  const { data: sites } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: sitesApi.getAll,
  });

  const { data: usersList = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll({ pageSize: 100 }),
  });

  // Apply filters
  const filteredTasks = tasks.filter((task) => {
    if (search) {
      const s = search.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(s);
      const matchDesc = task.description?.toLowerCase().includes(s);
      const matchUser = task.assignedUser?.name?.toLowerCase().includes(s);
      if (!matchTitle && !matchDesc && !matchUser) return false;
    }
    if (statusFilter !== 'all' && task.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
    if (siteFilter !== 'all' && task.siteId !== siteFilter) return false;
    if (assignedFilter !== 'all' && task.assignedTo !== assignedFilter) return false;
    return true;
  }) || [];

  const hasFilters = search || statusFilter !== 'all' || priorityFilter !== 'all' || siteFilter !== 'all' || assignedFilter !== 'all';
  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setSiteFilter('all');
    setAssignedFilter('all');
  };

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
    return filteredTasks.filter((task) => task.status === status);
  };

  const handleExport = (format: 'excel' | 'pdf' | 'csv' | 'json') => {
    if (!filteredTasks.length) return;

    const exportData = filteredTasks.map((task) => ({
      title: task.title,
      status: taskStatusLabels[task.status] || task.status,
      priority: taskPriorityLabels[task.priority] || task.priority,
      siteName: task.site?.name || '',
      assignedTo: task.assignedUser?.name || '',
      dueDate: task.dueDate ? new Date(task.dueDate).toLocaleDateString('fr-FR') : '',
      createdAt: task.createdAt ? new Date(task.createdAt).toLocaleDateString('fr-FR') : '',
    }));
    exportTasks(exportData, format);
  };

  const overdueTasks = filteredTasks.filter(isTaskOverdue);
  const blockedTasks = filteredTasks.filter((t) => t.status === 'BLOCKED');
  const dueSoonTasks = filteredTasks.filter(isTaskDueSoon);

  if (isLoading) {
    return <div className="text-center">Chargement des tâches...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tâches</h1>
          <p className="text-muted-foreground">Gérez vos tâches et interventions ({filteredTasks.length}{hasFilters ? ` / ${tasks?.length || 0}` : ''})</p>
        </div>
        <div className="flex items-center gap-4">
          <ExportMenu
            onExport={handleExport}
            disabled={!filteredTasks.length}
            label="Exporter"
          />
          {canCreate('tasks') && (
            <Button asChild data-testid="create-task-btn">
              <Link href="/dashboard/tasks/new">
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle tâche
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="grid gap-4 md:grid-cols-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(taskStatusLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Toutes les priorités" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les priorités</SelectItem>
            {Object.entries(taskPriorityLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={siteFilter} onValueChange={setSiteFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Tous les sites" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les sites</SelectItem>
            {sites?.map((site) => (
              <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assignedFilter} onValueChange={setAssignedFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Tous les utilisateurs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les utilisateurs</SelectItem>
            {usersList.map((user) => (
              <SelectItem key={user.id} value={user.id}>{user.name || user.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" onClick={clearFilters} className="flex items-center gap-2">
            <X className="h-4 w-4" />
            Effacer les filtres
          </Button>
        )}
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

      {meta && <Pagination meta={meta} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}

      {filteredTasks.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title={hasFilters ? 'Aucune tâche ne correspond aux filtres' : 'Aucune tâche'}
          description={hasFilters ? 'Essayez de modifier vos filtres de recherche' : undefined}
        />
      )}
    </div>
  );
}
