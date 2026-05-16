import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditPurgeService } from './audit-purge.cron';

@Module({
  controllers: [AuditController],
  // Track E.4 Pass 9 — AuditPurgeService cron mensuel rétention 1 an (D4.3).
  // Dry-run par défaut (AUDIT_PURGE_DRY_RUN=true) jusqu'à validation opérateur.
  providers: [AuditService, AuditPurgeService],
  exports: [AuditService],
})
export class AuditModule {}
