import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { StorageService } from '../../common/services/storage.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { SiteAccessModule } from '../site-access/site-access.module';
import { memoryStorage } from 'multer';
import { attachmentFileFilter } from '../../common/utils/upload-security';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB
      },
      fileFilter: attachmentFileFilter,
    }),
    SiteAccessModule,
  ],
  controllers: [TasksController],
  providers: [TasksService, StorageService, AuditLogService],
  exports: [TasksService],
})
export class TasksModule {}
