import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { DatabaseModule } from './config/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { SitesModule } from './modules/sites/sites.module';
import { AssetsModule } from './modules/assets/assets.module';
import { RacksModule } from './modules/racks/racks.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { FloorPlansModule } from './modules/floor-plans/floor-plans.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { SeedModule } from './modules/seed/seed.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),

    // Redis Queue
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
    }),

    // Database (Prisma)
    DatabaseModule,

    // Core modules
    AuthModule,
    RbacModule,
    TenantsModule,
    UsersModule,

    // Business modules
    SitesModule,
    AssetsModule,
    RacksModule,
    TasksModule,
    FloorPlansModule,
    IntegrationsModule,
    SeedModule,
  ],
})
export class AppModule {}
