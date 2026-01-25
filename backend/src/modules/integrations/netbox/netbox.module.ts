import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { NetboxService } from './netbox.service';
import { NetboxController } from './netbox.controller';
import { NetboxSyncService } from './netbox-sync.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    ConfigModule,
  ],
  controllers: [NetboxController],
  providers: [NetboxService, NetboxSyncService],
  exports: [NetboxService, NetboxSyncService],
})
export class NetboxModule {}
