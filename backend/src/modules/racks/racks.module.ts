import { Module } from '@nestjs/common';
import { RacksService } from './racks.service';
import { RacksController } from './racks.controller';
import { StorageService } from '../../common/services/storage.service';
import { SiteAccessModule } from '../site-access/site-access.module';

@Module({
  imports: [SiteAccessModule],
  controllers: [RacksController],
  providers: [RacksService, StorageService],
  exports: [RacksService],
})
export class RacksModule {}
