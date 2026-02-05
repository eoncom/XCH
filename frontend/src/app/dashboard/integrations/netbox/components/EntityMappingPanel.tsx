'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { integrationsApi } from '@/lib/api/integrations';
import { GripVertical, X, Save, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { IntegrationMapping } from '@/types';

interface SourceItem {
  id: string;
  label: string;
  count?: number;
}

interface TargetItem {
  id: string;
  label: string;
  color?: string;
}

interface EntityMappingPanelProps {
  provider: string;
  entityType: string;
  title: string;
  sourceLabel: string;
  targetLabel: string;
  sourceItems: SourceItem[];
  targetItems: TargetItem[];
  isLoading?: boolean;
}

interface LocalMapping {
  sourceId: string;
  sourceLabel: string;
  targetId: string;
  targetLabel: string;
}

// Draggable source item component
function DraggableSourceItem({
  item,
  isMapped,
}: {
  item: SourceItem;
  isMapped: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `source-${item.id}`,
    data: { item },
    disabled: isMapped,
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        flex items-center gap-2 p-3 rounded-lg border bg-card
        ${isMapped ? 'opacity-50 cursor-not-allowed' : 'cursor-grab hover:border-primary'}
        ${isDragging ? 'opacity-50' : ''}
      `}
    >
      <button
        {...listeners}
        {...attributes}
        className={`touch-none ${isMapped ? 'cursor-not-allowed' : 'cursor-grab'}`}
        disabled={isMapped}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <span className="flex-1 font-medium">{item.label}</span>
      {item.count !== undefined && (
        <Badge variant="secondary" className="text-xs">
          {item.count}
        </Badge>
      )}
      {isMapped && (
        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
          Mappe
        </Badge>
      )}
    </div>
  );
}

// Drag overlay component (shown while dragging)
function DragOverlayItem({ item }: { item: SourceItem }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg border-2 border-primary bg-card shadow-lg">
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      <span className="flex-1 font-medium">{item.label}</span>
    </div>
  );
}

// Droppable target item component
function DroppableTargetItem({
  item,
  mappedItems,
  onRemoveMapping,
}: {
  item: TargetItem;
  mappedItems: LocalMapping[];
  onRemoveMapping: (sourceId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `target-${item.id}`,
    data: { item },
  });

  const itemMappings = mappedItems.filter((m) => m.targetId === item.id);

  return (
    <div
      ref={setNodeRef}
      className={`
        p-4 rounded-lg border-2 border-dashed transition-colors
        ${isOver ? 'border-primary bg-primary/5' : 'border-muted'}
      `}
    >
      <div className="flex items-center gap-2 mb-2">
        {item.color && (
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: item.color }}
          />
        )}
        <span className="font-medium">{item.label}</span>
      </div>

      {itemMappings.length > 0 ? (
        <div className="flex flex-wrap gap-2 mt-2">
          {itemMappings.map((mapping) => (
            <Badge
              key={mapping.sourceId}
              variant="secondary"
              className="flex items-center gap-1 pr-1"
            >
              {mapping.sourceLabel}
              <button
                onClick={() => onRemoveMapping(mapping.sourceId)}
                className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Deposer un element ici
        </p>
      )}
    </div>
  );
}

export function EntityMappingPanel({
  provider,
  entityType,
  title,
  sourceLabel,
  targetLabel,
  sourceItems,
  targetItems,
  isLoading: isLoadingItems = false,
}: EntityMappingPanelProps) {
  const queryClient = useQueryClient();
  const [localMappings, setLocalMappings] = useState<LocalMapping[]>([]);
  const [activeItem, setActiveItem] = useState<SourceItem | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Load existing mappings
  const { data: existingMappings, isLoading: isLoadingMappings } = useQuery({
    queryKey: ['integrations', 'mapping', provider, entityType],
    queryFn: () => integrationsApi.mapping.get(provider, entityType),
  });

  // Initialize local mappings from existing mappings
  useEffect(() => {
    if (existingMappings && existingMappings.length > 0) {
      const mappings: LocalMapping[] = existingMappings.map((m: IntegrationMapping) => ({
        sourceId: m.externalId,
        sourceLabel: m.externalLabel,
        targetId: m.targetId,
        targetLabel: targetItems.find((t) => t.id === m.targetId)?.label || m.targetId,
      }));
      setLocalMappings(mappings);
      setHasUnsavedChanges(false);
    }
  }, [existingMappings, targetItems]);

  // Save mappings mutation
  const saveMutation = useMutation({
    mutationFn: () => {
      const mappingsToSave = localMappings.map((m) => ({
        externalId: m.sourceId,
        externalLabel: m.sourceLabel,
        targetType: entityType,
        targetId: m.targetId,
      }));
      return integrationsApi.mapping.save(provider, entityType, mappingsToSave);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['integrations', 'mapping', provider, entityType],
      });
      setHasUnsavedChanges(false);
      toast.success('Mappings enregistres avec succes');
    },
    onError: (error: Error) => {
      toast.error('Erreur lors de la sauvegarde', {
        description: error.message,
      });
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    const item = event.active.data.current?.item as SourceItem;
    setActiveItem(item);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveItem(null);

    const { active, over } = event;

    if (!over) return;

    const sourceItem = active.data.current?.item as SourceItem;
    const targetItem = over.data.current?.item as TargetItem;

    if (!sourceItem || !targetItem) return;

    // Check if already mapped
    const existingMapping = localMappings.find((m) => m.sourceId === sourceItem.id);
    if (existingMapping) return;

    // Add new mapping
    const newMapping: LocalMapping = {
      sourceId: sourceItem.id,
      sourceLabel: sourceItem.label,
      targetId: targetItem.id,
      targetLabel: targetItem.label,
    };

    setLocalMappings((prev) => [...prev, newMapping]);
    setHasUnsavedChanges(true);
  };

  const handleRemoveMapping = (sourceId: string) => {
    setLocalMappings((prev) => prev.filter((m) => m.sourceId !== sourceId));
    setHasUnsavedChanges(true);
  };

  const mappedSourceIds = new Set(localMappings.map((m) => m.sourceId));

  const isLoading = isLoadingItems || isLoadingMappings;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (sourceItems.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 text-muted-foreground">
            <AlertCircle className="h-5 w-5" />
            <p>Aucun element source disponible pour le mapping</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg">{title}</CardTitle>
        {hasUnsavedChanges && (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300">
            Modifications non enregistrees
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid md:grid-cols-2 gap-8">
            {/* Source Column */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                {sourceLabel}
                <Badge variant="secondary" className="text-xs">
                  {sourceItems.length}
                </Badge>
              </h4>
              <div className="space-y-2">
                {sourceItems.map((item) => (
                  <DraggableSourceItem
                    key={item.id}
                    item={item}
                    isMapped={mappedSourceIds.has(item.id)}
                  />
                ))}
              </div>
            </div>

            {/* Center Arrow (hidden on mobile) */}
            <div className="hidden md:flex items-center justify-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
            </div>

            {/* Target Column */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                {targetLabel}
                <Badge variant="secondary" className="text-xs">
                  {targetItems.length}
                </Badge>
              </h4>
              <div className="space-y-3">
                {targetItems.map((item) => (
                  <DroppableTargetItem
                    key={item.id}
                    item={item}
                    mappedItems={localMappings}
                    onRemoveMapping={handleRemoveMapping}
                  />
                ))}
              </div>
            </div>
          </div>

          <DragOverlay>
            {activeItem && <DragOverlayItem item={activeItem} />}
          </DragOverlay>
        </DndContext>

        {/* Hint */}
        <div className="mt-6 p-4 rounded-lg bg-muted/50 text-center">
          <p className="text-sm text-muted-foreground">
            Glissez les elements de gauche vers les cibles de droite pour creer un mapping
          </p>
        </div>

        {/* Save Button */}
        <div className="mt-6 flex justify-end">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!hasUnsavedChanges || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Enregistrer les mappings
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
