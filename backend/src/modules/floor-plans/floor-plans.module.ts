import { Module } from '@nestjs/common';
import { FloorPlansService } from './floor-plans.service';
import { FloorPlansController } from './floor-plans.controller';
import { DatabaseModule } from '../../config/database.module';
import { StorageService } from '../../common/services/storage.service';
@Module({
  imports: [DatabaseModule],
  controllers: [FloorPlansController],
  providers: [FloorPlansService, StorageService],
  exports: [FloorPlansService],
})
export class FloorPlansModule {}
