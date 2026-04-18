import { Module } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { AuditLogService } from '../../common/services/audit-log.service';

@Module({
  controllers: [TenantsController],
  providers: [TenantsService, AuditLogService],
  exports: [TenantsService],
})
export class TenantsModule {}
