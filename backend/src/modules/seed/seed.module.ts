import { Module } from '@nestjs/common';
import { SeedController } from './seed.controller';
import { SeedService } from './seed.service';
import { PrismaClient } from '@prisma/client';

@Module({
  controllers: [SeedController],
  providers: [SeedService, PrismaClient],
  exports: [SeedService],
})
export class SeedModule {}
