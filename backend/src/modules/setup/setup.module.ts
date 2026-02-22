import { Module } from '@nestjs/common';
import { SetupController } from './setup.controller';
import { SetupService } from './setup.service';
import { SeedModule } from '../seed/seed.module';

@Module({
  imports: [SeedModule],
  controllers: [SetupController],
  providers: [SetupService],
})
export class SetupModule {}
