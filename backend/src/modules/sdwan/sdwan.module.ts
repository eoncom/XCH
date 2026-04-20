import { Module } from '@nestjs/common';
import { SdwanController } from './sdwan.controller';
import { SdwanService } from './sdwan.service';

@Module({
  controllers: [SdwanController],
  providers: [SdwanService],
  exports: [SdwanService],
})
export class SdwanModule {}
