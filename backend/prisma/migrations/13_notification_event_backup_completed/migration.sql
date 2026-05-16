-- =============================================================================
-- 13_notification_event_backup_completed — Notification wiring backup success
--
-- Track E.4 PR1 Pass 9 — ajout valeur enum `BACKUP_COMPLETED` au type
-- `NotificationEventType`. Permet à BackupProcessor.@OnQueueCompleted()
-- d'émettre une notification post-succès via le NotificationEmitter
-- existant (pattern ADR-020).
--
-- Pas de breaking — ALTER TYPE ADD VALUE est additive et ne touche pas
-- les rows existantes.
-- =============================================================================

-- 1. Extension enum NotificationEventType ------------------------------------
-- Pattern Postgres : `ALTER TYPE ... ADD VALUE IF NOT EXISTS 'X'` est
-- transactionnel-safe depuis PG 12 (xch-deploy = 15.8). Pas de DDL lock long.
ALTER TYPE "NotificationEventType" ADD VALUE IF NOT EXISTS 'BACKUP_COMPLETED';
