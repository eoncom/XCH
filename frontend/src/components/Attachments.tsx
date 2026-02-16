'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, Download, Trash2, FileIcon, Loader2 } from 'lucide-react';
import { showToast } from '@/lib/toast';

interface Attachment {
  id: string;
  filename: string;
  originalFilename: string;
  size: number;
  mimetype: string;
  description?: string;
  category?: string;
  uploadedAt: string;
  url: string;
}

interface AttachmentsProps {
  entityId: string;
  entityType: 'assets' | 'tasks' | 'racks' | 'sites';
  apiModule: {
    uploadAttachment: (id: string, formData: FormData) => Promise<Attachment>;
    listAttachments: (id: string) => Promise<Attachment[]>;
    deleteAttachment: (id: string, attachmentId: string) => Promise<void>;
  };
}

export function Attachments({ entityId, entityType, apiModule }: AttachmentsProps) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('other');

  // Fetch attachments
  const { data: attachments = [], isLoading } = useQuery<Attachment[]>({
    queryKey: [entityType, entityId, 'attachments'],
    queryFn: () => apiModule.listAttachments(entityId),
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => apiModule.uploadAttachment(entityId, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [entityType, entityId, 'attachments'] });
      showToast.success('Fichier uploadé avec succès');
      setFile(null);
      setDescription('');
      setCategory('other');
      // Reset file input
      const fileInput = document.getElementById('attachment-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    },
    onError: () => {
      showToast.error('Erreur lors de l\'upload du fichier');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) => apiModule.deleteAttachment(entityId, attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [entityType, entityId, 'attachments'] });
      showToast.success('Fichier supprimé avec succès');
    },
    onError: () => {
      showToast.error('Erreur lors de la suppression du fichier');
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024;
      if (selectedFile.size > maxSize) {
        showToast.error('Fichier trop volumineux. Taille maximale: 10MB');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = () => {
    if (!file) {
      showToast.error('Veuillez sélectionner un fichier');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    if (description) formData.append('description', description);
    if (category) formData.append('category', category);

    uploadMutation.mutate(formData);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      {/* Upload section — compact grid */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 space-y-1">
            <Label htmlFor="attachment-file" className="text-xs">Fichier (max 10MB)</Label>
            <Input
              id="attachment-file"
              type="file"
              onChange={handleFileChange}
              className="cursor-pointer h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="category" className="text-xs">Catégorie</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="spec">Spécifications</SelectItem>
                <SelectItem value="invoice">Facture</SelectItem>
                <SelectItem value="photo">Photo</SelectItem>
                <SelectItem value="report">Rapport</SelectItem>
                <SelectItem value="manual">Manuel</SelectItem>
                <SelectItem value="other">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-3 items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor="description" className="text-xs">Description (optionnel)</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description du document..."
              className="h-9"
            />
          </div>
          <Button
            data-testid="upload-attachment-btn"
            onClick={handleUpload}
            disabled={!file || uploadMutation.isPending}
            size="sm"
          >
            {uploadMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Uploader
          </Button>
        </div>
        {file && (
          <p className="text-xs text-muted-foreground">
            {file.name} ({formatFileSize(file.size)})
          </p>
        )}
      </div>

      {/* Attachments list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : attachments.length === 0 ? (
        <p className="text-center text-muted-foreground py-6 text-sm">
          Aucun document
        </p>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileIcon className="h-6 w-6 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{attachment.originalFilename}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatFileSize(attachment.size)}</span>
                    <span>·</span>
                    <span>{formatDate(attachment.uploadedAt)}</span>
                    {attachment.category && (
                      <>
                        <span>·</span>
                        <span className="capitalize">{attachment.category}</span>
                      </>
                    )}
                    {attachment.description && (
                      <>
                        <span>·</span>
                        <span className="truncate">{attachment.description}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  data-testid="download-attachment-btn"
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(attachment.url, '_blank')}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  data-testid="delete-attachment-btn"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm('Êtes-vous sûr de vouloir supprimer ce fichier ?')) {
                      deleteMutation.mutate(attachment.id);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
