import { Module } from '@nestjs/common';
import { ConnectivityService } from './connectivity.service';
import { ConnectivityController } from './connectivity.controller';

@Module({
  controllers: [ConnectivityController],
  providers: [ConnectivityService],
  exports: [ConnectivityService],
})
export class ConnectivityModule {}
