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

// ============================================================================
// Track D.1 step 7 — async Bull v3 + dry-run frontend types
// ============================================================================

/** Request body for POST /backup/estimate and POST /backup/full (v2 async). */
export interface BackupOptions {
  dbOnly?: boolean;
}

/** Request body for POST /backup/full/restore JSON-mode (async). */
export interface RestoreOptions {
  backupId?: string;
  dryRun?: boolean;
}

/** POST /backup/estimate response. */
export interface EstimateResponse {
  dataBytes: number;
  filesBytes: number;
  totalBytes: number;
  fileCount: number;
  freeBytes: number;
  ok: boolean;
}

/** POST /backup/full | /backup/full/restore | /backup/site/:id async 202 response. */
export interface BackupJobEnqueued {
  enqueued: boolean;
  jobId: string;
}

/** Progress payload emitted by BackupProcessor via job.progress(). */
export interface BackupJobProgress {
  phase: string;
  percent: number;
  current: number;
  total: number;
  message: string;
}

/** Dry-run report shape (kind: 'dry-run' result). */
export interface DryRunReport {
  wouldCreate: Record<string, number>;
  wouldUpdate: Record<string, number>;
  wouldSkip: Record<string, number>;
  missingFiles: string[];
  invalidChecksums: string[];
  totalSize: number;
  estimatedDurationSec: number;
}

/** Discriminated result returned by `result` of a completed restore job. */
export type RestoreFullV2JobResult =
  | { kind: 'dry-run'; report: DryRunReport }
  | { kind: 'applied'; message: string; counts: Record<string, number>; siteIds: string[] }
  | { kind: 'delegated-v1'; message: string; counts: Record<string, number>; siteIds: string[] };

/** GET /backup/jobs/:jobId response. */
export interface BackupJobStatus {
  state: 'waiting' | 'active' | 'completed' | 'failed';
  progress: BackupJobProgress;
  result?: unknown; // BackupResult (v2 backup) | RestoreFullV2JobResult (restore)
  error?: string;
}

export const backupApi = {
  // -------- Track D.1 step 7 — async endpoints --------

  /**
   * Pre-flight size estimate for a backup run.
   * POST /api/backup/estimate
   */
  estimate: (options: BackupOptions = {}) =>
    apiClient.post<EstimateResponse>('/api/backup/estimate', options),

  /**
   * Create a full backup — async by default (returns 202 + jobId).
   * Caller should poll `getJobStatus(jobId)` for progress.
   *
   * Legacy synchronous fallback via header `X-Backup-Sync: 1` is NOT exposed
   * here ; if Redis is unreachable, operators can issue the request directly
   * via `curl -H 'X-Backup-Sync: 1' …` (CLI escape hatch).
   */
  createFullAsync: (options: BackupOptions = {}) =>
    apiClient.post<BackupJobEnqueued>('/api/backup/full', options),

  /** Async site backup — 202 + jobId. */
  createSiteBackupAsync: (siteId: string) =>
    apiClient.post<BackupJobEnqueued>(`/api/backup/site/${siteId}`),

  /**
   * Restore from an existing catalog entry (JSON path) — async via Bull v3.
   * `dryRun: true` returns a {@link DryRunReport} ; `dryRun: false` actually
   * applies the restore via {@link upsertByNaturalKey} on the live DB.
   */
  restoreFullAsync: (options: RestoreOptions) =>
    apiClient.post<BackupJobEnqueued>('/api/backup/full/restore', options),

  /**
   * Poll the status of a previously enqueued backup-jobs job.
   * Returns `{state, progress, result?, error?}`.
   * 404 NotFoundException if the jobId is unknown to Bull.
   */
  getJobStatus: (jobId: string) =>
    apiClient.get<BackupJobStatus>(`/api/backup/jobs/${encodeURIComponent(jobId)}`),

  // -------- Legacy v1 endpoints (kept for sync fallback + multipart) --------

  /**
   * Legacy synchronous full backup — kept for completeness, but the UI
   * uses `createFullAsync` + polling. Useful if Redis is down.
   * @deprecated Use createFullAsync + useBackupJob hook.
   */
  createFull: () =>
    apiClient.post<BackupResult>('/api/backup/full'),

  /** Create a site-specific backup — returns ZIP as blob download */
  createSiteBackup: async (siteId: string): Promise<void> => {
    const response = await fetchBinary(`/api/backup/site/${siteId}`, {
      method: 'POST',
      headers: { 'X-Backup-Sync': '1' }, // force legacy inline ZIP stream
    });
    const blob = await response.blob();
    triggerBlobDownload(blob, response, `backup-site-${siteId}.zip`);
  },

  /** Restore a site from a backup ZIP */
  restoreSite: (file: File) =>
    apiClient.upload<RestoreResult>('/api/backup/site/restore', file),

  /**
   * Restore a full backup from a ZIP — multipart upload, **sync v1 path**.
   * For async + dry-run support, use `restoreFullAsync({backupId, dryRun})`.
   */
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
