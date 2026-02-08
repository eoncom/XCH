import { Module } from '@nestjs/common';
import { SiteAccessService } from './site-access.service';
import { SiteAccessController } from './site-access.controller';

@Module({
  controllers: [SiteAccessController],
  providers: [SiteAccessService],
  exports: [SiteAccessService],
})
export class SiteAccessModule {}
