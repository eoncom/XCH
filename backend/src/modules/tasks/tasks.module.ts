import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { StorageService } from '../../common/services/storage.service';
import { memoryStorage } from 'multer';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(), // Store files in memory for processing
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max file size
      },
    }),
  ],
  controllers: [TasksController],
  providers: [TasksService, StorageService],
  exports: [TasksService],
})
export class TasksModule {}
