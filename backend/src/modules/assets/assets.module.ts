import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { QRCodeService } from '../../common/services/qrcode.service';
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
    // ADR-011: AssetsController calls ExpensesService.createFromAsset / resyncExpense
    ExpensesModule,
  ],
  controllers: [AssetsController],
  providers: [AssetsService, QRCodeService, StorageService, AuditLogService],
  exports: [AssetsService],
})
export class AssetsModule {}
