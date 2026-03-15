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

export interface CleanupResult {
  deleted: string[];
  skipped: string[];
  errors: string[];
}

/**
 * Fetch a binary response with 401 retry (token refresh).
 * apiClient.fetch() always parses JSON — this handles blob downloads.
 */
async function fetchBinary(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const config: RequestInit = {
    ...options,
    credentials: 'include',
  };

  let response = await fetch(`${API_URL}${url}`, config);

  // Handle 401 — try refreshing the token
  if (response.status === 401 && typeof window !== 'undefined') {
    const refreshRes = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    if (refreshRes.ok) {
      // Retry with new token
      response = await fetch(`${API_URL}${url}`, config);
    } else {
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error('Session expirée');
    }
  }

  if (!response.ok) {
    // Try to parse error as JSON, fallback to status text
    const contentType = response.headers.get('content-type') || '';
    let message = response.statusText;
    if (contentType.includes('application/json')) {
      const error = await response.json().catch(() => ({}));
      message = error.message || message;
    }
    throw new Error(message || `Erreur ${response.status}`);
  }

  return response;
}

/** Trigger a file download via direct URL (preserves user-gesture context) */
function triggerDirectDownload(url: string, fallbackName: string): void {
  const a = document.createElement('a');
  a.href = `${API_URL}${url}`;
  a.download = fallbackName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** Trigger a file download from a Blob response */
function triggerBlobDownload(blob: Blob, response: Response, fallbackName: string): void {
  const filename = response.headers.get('content-disposition')
    ?.match(/filename="(.+)"/)?.[1] || fallbackName;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Delay revocation to give browser time to start download
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export const backupApi = {
  /** Create a full backup (database + MinIO files) */
  createFull: () =>
    apiClient.post<BackupResult>('/api/backup/full'),

  /** Create a site-specific backup — returns ZIP as blob download */
  createSiteBackup: async (siteId: string): Promise<void> => {
    const response = await fetchBinary(`/api/backup/site/${siteId}`, {
      method: 'POST',
    });
    const blob = await response.blob();
    triggerBlobDownload(blob, response, `backup-site-${siteId}.zip`);
  },

  /** Restore a site from a backup ZIP */
  restoreSite: (file: File) =>
    apiClient.upload<RestoreResult>('/api/backup/site/restore', file),

  /** Restore a full backup from a ZIP */
  restoreFull: (file: File) =>
    apiClient.upload<RestoreResult>('/api/backup/full/restore', file),

  /** List all available backups */
  list: () =>
    apiClient.get<BackupListResponse>('/api/backup/list'),

  /** Download a backup file by ID — uses direct URL (cookie-auth, same-origin) */
  downloadBackup: (id: string): void => {
    triggerDirectDownload(`/api/backup/${id}/download`, `backup-${id}.zip`);
  },

  /** Delete a backup by ID */
  deleteBackup: (id: string) =>
    apiClient.delete<{ success: boolean; message: string }>(`/api/backup/${id}`),

  /** Clean up orphaned files in storage (files with no DB reference) */
  cleanupStorage: () =>
    apiClient.post<CleanupResult>('/api/backup/cleanup-storage'),
};
