import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { StorageService } from '../../common/services/storage.service';

@Module({
  controllers: [TasksController],
  providers: [TasksService, StorageService],
  exports: [TasksService],
})
export class TasksModule {}
