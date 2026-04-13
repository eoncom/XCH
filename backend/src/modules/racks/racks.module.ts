import { Module } from '@nestjs/common';
import { RacksService } from './racks.service';
import { RacksController } from './racks.controller';
import { StorageService } from '../../common/services/storage.service';
import { AuditLogService } from '../../common/services/audit-log.service';
@Module({
  imports: [],
  controllers: [RacksController],
  providers: [RacksService, StorageService, AuditLogService],
  exports: [RacksService],
})
export class RacksModule {}
