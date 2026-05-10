'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
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
import { Plus, Calendar, User, AlertCircle, Clock, AlertTriangle, Search, X, ClipboardList, LayoutGrid, List, Columns, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Pagination, type PaginationMeta } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { ExportMenu } from '@/components/ui/export-menu';
import { exportTasks } from '@/lib/export-utils';
import { usePermissions } from '@/hooks/usePermissions';
import { showToast } from '@/lib/toast';
import { mapApiErrorToFr } from '@/lib/error-messages';
import { ErrorState } from '@/components/ui/error-state';
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

import { taskStatusLabels, taskStatusColors, taskPriorityLabels, taskPriorityColors } from '@/lib/status-labels';

const kanbanColumns: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'];

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  /** Server-side total for this status (drives the column header count). */
  total: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  onTaskClick: (task: Task) => void;
  onDrop: (taskId: string, newStatus: TaskStatus) => void;
}

function KanbanColumn({
  status,
  tasks,
  total,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onTaskClick,
  onDrop,
}: KanbanColumnProps) {
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

  // Header count uses the server-side `total` (B2 fix). Previously the
  // column header showed `tasks.length` over the first page of a single
  // paginated /api/tasks fetch, hiding TODO/IN_PROGRESS items behind 25
  // recent DONE entries.
  const remaining = Math.max(0, total - tasks.length);

  return (
    <div className="flex-1 min-w-[300px]">
      <div className="mb-4">
        <h3 className="font-semibold text-lg flex items-center justify-between">
          {taskStatusLabels[status]}
          <span className="text-sm text-muted-foreground">({total})</span>
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
        {hasNextPage && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage
              ? 'Chargement...'
              : `Charger plus (${remaining} restant${remaining > 1 ? 'es' : ''})`}
          </Button>
        )}
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
  // v1.4 — click-to-filter from the alert banners. 'overdue' | 'dueSoon' | null
  const [specialFilter, setSpecialFilter] = useState<'overdue' | 'dueSoon' | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'grid'>('kanban');
  const [sortField, setSortField] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { canCreate } = usePermissions();

  // The list/grid views drive off this paginated query. The Kanban view is
  // additionally driven by 4 independent useInfiniteQuery below (one per
  // status) so each column has its own server-side total + load-more (B2 fix,
  // test 2026-05-09). We keep this query enabled even in Kanban mode because
  // the alert banners at the top (overdueTasks, dueSoonTasks, blockedTasks)
  // still derive from `filteredTasks` and would show 0 otherwise.
  const { data: response, isLoading, isError, error, refetch } = useQuery<{ data: Task[]; meta: PaginationMeta }>({
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
    placeholderData: keepPreviousData,
  });
  const tasks = response?.data ?? [];
  const meta = response?.meta;

  // ── B2 fix: per-status Kanban queries ────────────────────────────────────
  // Each Kanban column owns its own paginated fetch so the column header
  // shows the **server-side total** (not array.length-on-page-1) and the body
  // can load more pages on demand. Filters (priority/site/assignedTo/search)
  // are applied server-side so each column only fetches relevant rows.
  // The kanban view ignores the page-level statusFilter dropdown — it always
  // shows all four status columns; column-level filtering is the whole point.
  const kanbanFilters = {
    priority: priorityFilter !== 'all' ? priorityFilter : undefined,
    siteId: siteFilter !== 'all' ? siteFilter : undefined,
    assignedTo: assignedFilter !== 'all' ? assignedFilter : undefined,
    search: search || undefined,
  };
  const kanbanEnabled = viewMode === 'kanban';
  const kanbanPageSize = 25;

  const todoQuery = useInfiniteQuery({
    queryKey: ['tasks', 'kanban', 'TODO', kanbanFilters],
    queryFn: ({ pageParam }) =>
      tasksApi.getAllPaginated({ ...kanbanFilters, status: 'TODO', page: pageParam, pageSize: kanbanPageSize }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    enabled: kanbanEnabled,
  });
  const inProgressQuery = useInfiniteQuery({
    queryKey: ['tasks', 'kanban', 'IN_PROGRESS', kanbanFilters],
    queryFn: ({ pageParam }) =>
      tasksApi.getAllPaginated({ ...kanbanFilters, status: 'IN_PROGRESS', page: pageParam, pageSize: kanbanPageSize }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    enabled: kanbanEnabled,
  });
  const blockedQuery = useInfiniteQuery({
    queryKey: ['tasks', 'kanban', 'BLOCKED', kanbanFilters],
    queryFn: ({ pageParam }) =>
      tasksApi.getAllPaginated({ ...kanbanFilters, status: 'BLOCKED', page: pageParam, pageSize: kanbanPageSize }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    enabled: kanbanEnabled,
  });
  const doneQuery = useInfiniteQuery({
    queryKey: ['tasks', 'kanban', 'DONE', kanbanFilters],
    queryFn: ({ pageParam }) =>
      tasksApi.getAllPaginated({ ...kanbanFilters, status: 'DONE', page: pageParam, pageSize: kanbanPageSize }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    enabled: kanbanEnabled,
  });
  const kanbanQueries: Record<TaskStatus, typeof todoQuery> = {
    TODO: todoQuery,
    IN_PROGRESS: inProgressQuery,
    BLOCKED: blockedQuery,
    DONE: doneQuery,
    // CANCELLED isn't surfaced in the Kanban board (cf kanbanColumns).
    CANCELLED: doneQuery,
  };

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, statusFilter, priorityFilter, siteFilter, assignedFilter]);

  const { data: sites } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: () => sitesApi.getAll(),
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
    if (specialFilter === 'overdue' && !isTaskOverdue(task)) return false;
    if (specialFilter === 'dueSoon' && !isTaskDueSoon(task)) return false;
    return true;
  }) || [];

  const sortedTasks = useMemo(() => {
    if (!sortField) return filteredTasks;
    return [...filteredTasks].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';
      switch (sortField) {
        case 'title': valA = a.title; valB = b.title; break;
        case 'priority':
          const prioOrder: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
          valA = prioOrder[a.priority] ?? 99;
          valB = prioOrder[b.priority] ?? 99;
          return sortDir === 'asc' ? valA - valB : valB - valA;
        case 'status':
          const statusOrder: Record<string, number> = { BLOCKED: 0, TODO: 1, IN_PROGRESS: 2, DONE: 3, CANCELLED: 4 };
          valA = statusOrder[a.status] ?? 99;
          valB = statusOrder[b.status] ?? 99;
          return sortDir === 'asc' ? valA - valB : valB - valA;
        case 'assignedUser': valA = a.assignedUser?.name || ''; valB = b.assignedUser?.name || ''; break;
        case 'site': valA = a.site?.name || ''; valB = b.site?.name || ''; break;
        case 'dueDate':
          valA = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
          valB = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
          return sortDir === 'asc' ? valA - valB : valB - valA;
      }
      const cmp = String(valA).localeCompare(String(valB), 'fr', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredTasks, sortField, sortDir]);

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

  const hasFilters = search || statusFilter !== 'all' || priorityFilter !== 'all' || siteFilter !== 'all' || assignedFilter !== 'all' || specialFilter !== null;
  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setSiteFilter('all');
    setAssignedFilter('all');
    setSpecialFilter(null);
  };

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      tasksApi.update(id, { status }),
    // S6 PR4 — optimistic Kanban: move the card immediately, rollback on
    // server failure. Multiple cached query variants (page/filter combos)
    // need the same patch to avoid the card snapping back when the user
    // changes filters during the inflight request.
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      // Multiple cached query variants share the ['tasks', ...] prefix:
      //   - useQuery list/grid → { data: Task[], meta }
      //   - useInfiniteQuery kanban (per status) → { pages: [{data,meta}], pageParams }
      // Patch both shapes so the dragged card moves immediately under the new
      // column without snapping back to its old position before invalidation.
      const snapshots = queryClient.getQueriesData<unknown>({ queryKey: ['tasks'] });
      snapshots.forEach(([key, old]) => {
        if (!old || typeof old !== 'object') return;
        const o = old as {
          data?: Task[];
          meta?: PaginationMeta;
          pages?: Array<{ data: Task[]; meta: PaginationMeta }>;
          pageParams?: unknown[];
        };
        if (Array.isArray(o.data)) {
          queryClient.setQueryData(key, {
            ...o,
            data: o.data.map((t) => (t.id === id ? { ...t, status } : t)),
          });
          return;
        }
        if (Array.isArray(o.pages)) {
          queryClient.setQueryData(key, {
            ...o,
            pages: o.pages.map((page) => ({
              ...page,
              data: page.data.map((t) => (t.id === id ? { ...t, status } : t)),
            })),
          });
        }
      });
      return { snapshots };
    },
    onError: (err, _vars, ctx) => {
      ctx?.snapshots?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      showToast.error(mapApiErrorToFr(err));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const handleTaskClick = (task: Task) => {
    router.push(`/dashboard/tasks/${task.id}`);
  };

  const handleDrop = (taskId: string, newStatus: TaskStatus) => {
    updateStatusMutation.mutate({ id: taskId, status: newStatus });
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

  if (isError) {
    return (
      <ErrorState
        title="Impossible de charger les tâches"
        error={error}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tâches</h1>
          <p className="text-muted-foreground">Gérez vos tâches et interventions ({filteredTasks.length}{hasFilters ? ` / ${tasks?.length || 0}` : ''})</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 border rounded-lg p-1">
            <Button variant={viewMode === 'kanban' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('kanban')} title="Kanban">
              <Columns className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('grid')} title="Grille">
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')} title="Liste">
              <List className="h-4 w-4" />
            </Button>
          </div>
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

      {/* Alert banners — clickable to filter the Kanban / list view.
          v1.4: toggling the same banner clears the filter (second click = réinit). */}
      {(overdueTasks.length > 0 || blockedTasks.length > 0 || dueSoonTasks.length > 0) && (
        <div className="flex flex-wrap gap-3">
          {overdueTasks.length > 0 && (
            <button
              type="button"
              onClick={() => setSpecialFilter(specialFilter === 'overdue' ? null : 'overdue')}
              title="Cliquer pour filtrer sur les tâches en retard"
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all cursor-pointer',
                'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50',
                specialFilter === 'overdue' && 'ring-2 ring-red-500 ring-offset-2 ring-offset-background',
              )}
            >
              <Clock className="h-4 w-4" />
              {overdueTasks.length} tâche{overdueTasks.length > 1 ? 's' : ''} en retard
              {specialFilter === 'overdue' && <span className="ml-1 text-xs opacity-75">(filtré)</span>}
            </button>
          )}
          {blockedTasks.length > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'BLOCKED' ? 'all' : 'BLOCKED')}
              title="Cliquer pour filtrer sur les tâches bloquées"
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all cursor-pointer',
                'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50',
                statusFilter === 'BLOCKED' && 'ring-2 ring-red-500 ring-offset-2 ring-offset-background',
              )}
            >
              <AlertCircle className="h-4 w-4" />
              {blockedTasks.length} tâche{blockedTasks.length > 1 ? 's' : ''} bloquée{blockedTasks.length > 1 ? 's' : ''}
              {statusFilter === 'BLOCKED' && <span className="ml-1 text-xs opacity-75">(filtré)</span>}
            </button>
          )}
          {dueSoonTasks.length > 0 && (
            <button
              type="button"
              onClick={() => setSpecialFilter(specialFilter === 'dueSoon' ? null : 'dueSoon')}
              title="Cliquer pour filtrer sur les tâches dont l'échéance approche"
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all cursor-pointer',
                'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50',
                specialFilter === 'dueSoon' && 'ring-2 ring-amber-500 ring-offset-2 ring-offset-background',
              )}
            >
              <AlertTriangle className="h-4 w-4" />
              {dueSoonTasks.length} tâche{dueSoonTasks.length > 1 ? 's' : ''} — échéance dans moins de 48h
              {specialFilter === 'dueSoon' && <span className="ml-1 text-xs opacity-75">(filtré)</span>}
            </button>
          )}
        </div>
      )}

      {/* Kanban / List / Grid */}
      {viewMode === 'kanban' && (
        <div data-testid="kanban-board" className="flex gap-6 overflow-x-auto pb-4">
          {kanbanColumns.map((status) => {
            const query = kanbanQueries[status];
            const items: Task[] = query.data?.pages.flatMap((p) => p.data) ?? [];
            const total = query.data?.pages[0]?.meta.total ?? 0;
            return (
              <KanbanColumn
                key={status}
                status={status}
                tasks={items}
                total={total}
                hasNextPage={query.hasNextPage ?? false}
                isFetchingNextPage={query.isFetchingNextPage ?? false}
                onLoadMore={() => query.fetchNextPage()}
                onTaskClick={handleTaskClick}
                onDrop={handleDrop}
              />
            );
          })}
        </div>
      )}

      {viewMode === 'list' && (
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('title')}>
                    <span className="inline-flex items-center">Titre<SortIcon field="title" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('priority')}>
                    <span className="inline-flex items-center">Priorité<SortIcon field="priority" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('status')}>
                    <span className="inline-flex items-center">Statut<SortIcon field="status" /></span>
                  </TableHead>
                  <TableHead className="hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort('assignedUser')}>
                    <span className="inline-flex items-center">Assigné à<SortIcon field="assignedUser" /></span>
                  </TableHead>
                  <TableHead className="hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort('site')}>
                    <span className="inline-flex items-center">Site<SortIcon field="site" /></span>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell cursor-pointer select-none" onClick={() => toggleSort('dueDate')}>
                    <span className="inline-flex items-center">Date limite<SortIcon field="dueDate" /></span>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTasks.map((task) => {
                  const overdue = isTaskOverdue(task);
                  return (
                    <TableRow key={task.id} className={overdue ? 'bg-red-50/50 dark:bg-red-950/20' : ''}>
                      <TableCell className="font-medium">
                        <Link href={`/dashboard/tasks/${task.id}`} className="hover:underline">
                          {task.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={taskPriorityColors[task.priority] as 'secondary' | 'default' | 'warning' | 'error'}>
                          {taskPriorityLabels[task.priority]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={taskStatusColors[task.status] as 'secondary' | 'default' | 'warning' | 'error' | 'success'}>
                          {taskStatusLabels[task.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {task.assignedUser?.name || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {task.site?.name || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {task.dueDate ? (
                          <span className={overdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                            {new Date(task.dueDate).toLocaleDateString('fr-FR')}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/tasks/${task.id}`}>Voir</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {viewMode === 'grid' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTasks.map((task) => {
            const overdue = isTaskOverdue(task);
            const dueSoon = isTaskDueSoon(task);
            return (
              <Card
                key={task.id}
                className={`hover:shadow-md transition-shadow cursor-pointer ${
                  overdue ? 'border-red-400 dark:border-red-600' :
                  dueSoon ? 'border-amber-400 dark:border-amber-600' : ''
                }`}
                onClick={() => handleTaskClick(task)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base flex-1">{task.title}</CardTitle>
                    <Badge variant={taskPriorityColors[task.priority] as 'secondary' | 'default' | 'warning' | 'error'}>
                      {taskPriorityLabels[task.priority]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <Badge variant={taskStatusColors[task.status] as 'secondary' | 'default' | 'warning' | 'error' | 'success'}>
                      {taskStatusLabels[task.status]}
                    </Badge>
                  </div>
                  {task.assignedUser && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      {task.assignedUser.name}
                    </div>
                  )}
                  {task.site && (
                    <div className="text-muted-foreground text-xs">
                      Site: {task.site.name}
                    </div>
                  )}
                  {task.dueDate && (
                    <div className={`flex items-center gap-1.5 text-xs ${overdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-muted-foreground'}`}>
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(task.dueDate).toLocaleDateString('fr-FR')}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
