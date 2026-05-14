/**
 * AuditLog action names emitted by the XCH backup module.
 *
 * Centralized to prevent regression when bumping the backup format
 * version. Origin: v2.2.1 hotfix (commit 6d9ead9, PR #71) extended the
 * `listBackups` filter from the v1 'BACKUP_FULL' string to include
 * 'BACKUP_FULL_V2'. Without this constant, a future v3 bump would
 * silently repeat the same trap — catalog hides newly-formatted backups
 * because filter arrays drift in 4+ call sites.
 *
 * Track D.2 Step 0.5 — see ADR-026 §5.
 */
export const BACKUP_AUDIT_ACTIONS = [
  'BACKUP_FULL',
  'BACKUP_FULL_V2',
  'BACKUP_SITE',
  'BACKUP_SITE_V2',
  'RESTORE_FULL',
  'RESTORE_FULL_V2',
  'RESTORE_SITE',
  // STORAGE_CLEANUP is emitted by the backup module's cleanupOrphanedStorage
  // cron, but operates on the `xch-storage` bucket (user assets — floor plans,
  // attachments), NOT on `xch-backups`. Included here because the action is
  // written via `logBackupAction` from this module ; semantically broader than
  // backup. Future refactor (D.3) may relocate to its own STORAGE_AUDIT_ACTIONS
  // constant if the storage cleanup grows independent enough.
  'STORAGE_CLEANUP',
] as const;

export type BackupAuditAction = (typeof BACKUP_AUDIT_ACTIONS)[number];

/**
 * Subset of {@link BACKUP_AUDIT_ACTIONS} that produce a catalog-listable
 * backup row (each has an associated ZIP in MinIO xch-backups).
 *
 * RESTORE_* actions are excluded — they consume backups but don't
 * produce catalog rows.
 *
 * Used by listBackups, downloadBackup, deleteBackup, and cleanupOldBackups
 * to filter AuditLog rows.
 */
export const BACKUP_CATALOG_ACTIONS = [
  'BACKUP_FULL',
  'BACKUP_FULL_V2',
  'BACKUP_SITE',
  'BACKUP_SITE_V2',
] as const satisfies readonly BackupAuditAction[];

export type BackupCatalogAction = (typeof BACKUP_CATALOG_ACTIONS)[number];
