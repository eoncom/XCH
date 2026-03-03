import { Module } from '@nestjs/common';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { StorageService } from '../../common/services/storage.service';

@Module({
  controllers: [BackupController],
  providers: [BackupService, StorageService],
  exports: [BackupService],
})
export class BackupModule {}
