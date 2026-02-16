import { Module } from '@nestjs/common';
import { FloorPlansService } from './floor-plans.service';
import { FloorPlansController } from './floor-plans.controller';
import { DatabaseModule } from '../../config/database.module';
import { StorageService } from '../../common/services/storage.service';
import { SiteAccessModule } from '../site-access/site-access.module';

@Module({
  imports: [DatabaseModule, SiteAccessModule],
  controllers: [FloorPlansController],
  providers: [FloorPlansService, StorageService],
  exports: [FloorPlansService],
})
export class FloorPlansModule {}
