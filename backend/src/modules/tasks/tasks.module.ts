import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { StorageService } from '../../common/services/storage.service';
import { SiteAccessModule } from '../site-access/site-access.module';
import { memoryStorage } from 'multer';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
    SiteAccessModule,
  ],
  controllers: [TasksController],
  providers: [TasksService, StorageService],
  exports: [TasksService],
})
export class TasksModule {}
