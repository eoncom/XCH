import { apiClient } from '../api-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface BackupMetadata {
  id: string;
  type: 'full' | 'site';
  filename: string;
  size: number;
  createdAt: string;
  siteName?: string;
  siteCode?: string;
  recordCounts?: Record<string, number>;
}

export interface BackupListResponse {
  backups: BackupMetadata[];
  total: number;
}

export interface BackupResult {
  success: boolean;
  message: string;
  backup?: BackupMetadata;
}

export interface RestoreResult {
  success: boolean;
  message: string;
  siteId?: string;
  siteName?: string;
  counts?: Record<string, number>;
}

export const backupApi = {
  /** Create a full backup (database + MinIO files) */
  createFull: () =>
    apiClient.post<BackupResult>('/api/backup/full'),

  /** Create a site-specific backup — returns ZIP as blob download */
  createSiteBackup: async (siteId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/api/backup/site/${siteId}`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Échec du backup site');
    }

    // Download the ZIP file
    const blob = await response.blob();
    const filename = response.headers.get('content-disposition')
      ?.match(/filename="(.+)"/)?.[1] || `backup-site-${siteId}.zip`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /** Restore a site from a backup ZIP */
  restoreSite: (file: File) =>
    apiClient.upload<RestoreResult>('/api/backup/site/restore', file),

  /** List all available backups */
  list: () =>
    apiClient.get<BackupListResponse>('/api/backup/list'),

  /** Download a backup file by ID */
  downloadBackup: async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/api/backup/${id}/download`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Échec du téléchargement');
    }

    const blob = await response.blob();
    const filename = response.headers.get('content-disposition')
      ?.match(/filename="(.+)"/)?.[1] || `backup-${id}`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /** Delete a backup by ID */
  deleteBackup: (id: string) =>
    apiClient.delete<{ success: boolean; message: string }>(`/api/backup/${id}`),
};
