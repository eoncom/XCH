import { Module } from '@nestjs/common';
import { SeedController } from './seed.controller';
import { SeedService } from './seed.service';
import { PrismaClient } from '@prisma/client';
import { TestEnvOnlyGuard } from '../../common/guards/test-env-only.guard';

@Module({
  controllers: [SeedController],
  providers: [SeedService, PrismaClient, TestEnvOnlyGuard],
  exports: [SeedService],
})
export class SeedModule {}
