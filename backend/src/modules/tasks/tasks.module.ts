import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { StorageService } from '../../common/services/storage.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { ExpensesModule } from '../expenses/expenses.module';
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
    // ADR-011: TasksController calls ExpensesService.createFromTask / resyncExpense
    ExpensesModule,
  ],
  controllers: [TasksController],
  providers: [TasksService, StorageService, AuditLogService],
  exports: [TasksService],
})
export class TasksModule {}
