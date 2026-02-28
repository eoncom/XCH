'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, X, Save, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface InlineEditCardProps {
  title: string;
  icon?: LucideIcon;
  canEdit?: boolean;
  children: React.ReactNode;
  editContent?: React.ReactNode;
  onSave?: () => Promise<void>;
  onCancel?: () => void;
  onEdit?: () => void;
  className?: string;
}

export function InlineEditCard({
  title,
  icon: Icon,
  canEdit = false,
  children,
  editContent,
  onSave,
  onCancel,
  onEdit,
  className,
}: InlineEditCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave();
      setIsEditing(false);
    } catch {
      // Error handling is done by the caller (toast, etc.)
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    onCancel?.();
  };

  const handleEdit = () => {
    onEdit?.();
    setIsEditing(true);
  };

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5" />}
          {title}
        </CardTitle>
        {canEdit && editContent && !isEditing && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleEdit}
            className="h-8 w-8"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          <>
            {editContent}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className="h-4 w-4 mr-1" />
                Annuler
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Enregistrer
              </Button>
            </div>
          </>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
