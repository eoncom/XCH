import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Request body for `POST /backup/full/restore` (v2 — JSON path, no upload).
 *
 * Two restore sources :
 *  - JSON `{ backupId }` — restore from a backup already stored in MinIO
 *    `xch-backups` (catalog row).
 *  - multipart `file` (legacy controller path) — upload + restore, kept
 *    behind a parallel endpoint for one-shot recoveries.
 *
 * `dryRun` is the safety net for the first restore on a populated tenant :
 * the pipeline runs end-to-end (extract + checksum verify + table parse)
 * but skips all Prisma + MinIO writes, returning a `DryRunReportResponseDto`.
 */
export class RestoreOptionsDto {
  @ApiProperty({
    required: false,
    description:
      'Backup catalog row id (see `GET /backup/list`). Required for the ' +
      'JSON restore path. Ignored when multipart `file` is provided.',
  })
  @IsString()
  @IsOptional()
  backupId?: string;

  @ApiProperty({
    required: false,
    default: false,
    description:
      'When true, the pipeline runs end-to-end but skips Prisma + MinIO ' +
      'writes. Returns a DryRunReportResponseDto with the projected diff.',
  })
  @IsBoolean()
  @IsOptional()
  dryRun?: boolean;

  @ApiProperty({
    required: false,
    description:
      'Track D.2 — Cross-tenant restore. When set, the source delegation ' +
      'is remapped to this target delegation: every restored row that holds ' +
      'a delegationId (Site, Asset, Contact, BillingEntity, Expense, Budget) ' +
      'is coerced to the target. Ownership FK (Task.createdBy/assignedTo, ' +
      'TaskComment.authorId, Expense.createdBy) is rewritten to the caller ' +
      "user id — preserves audit traceability even if the caller's manage " +
      'rights are revoked later. Users from the source backup are NOT ' +
      'imported (collision avoidance). Permission gate: caller must have ' +
      'manage on the target delegation, AND it must belong to the caller ' +
      'tenant. See ADR-026 §3.',
  })
  @IsUUID()
  @IsOptional()
  targetDelegationId?: string;
}
