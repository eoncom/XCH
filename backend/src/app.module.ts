import { Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { XchThrottlerGuard } from './common/guards/xch-throttler.guard';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { DelegationGuard } from './common/guards/delegation.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './config/database.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { SitesModule } from './modules/sites/sites.module';
import { AssetsModule } from './modules/assets/assets.module';
import { RacksModule } from './modules/racks/racks.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { FloorPlansModule } from './modules/floor-plans/floor-plans.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { ContactTypesModule } from './modules/contact-types/contact-types.module';
import { UserDelegationsModule } from './modules/user-delegations/user-delegations.module';
import { AccessOverridesModule } from './modules/access-overrides/access-overrides.module';
import { BillingEntitiesModule } from './modules/billing-entities/billing-entities.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { SeedModule } from './modules/seed/seed.module';
import { SetupModule } from './modules/setup/setup.module';
import { AdminModule } from './modules/admin/admin.module';
import { BackupModule } from './modules/backup/backup.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AssetModelsModule } from './modules/asset-models/asset-models.module';
import { BudgetsModule } from './modules/budgets/budgets.module';
import { ConnectivityModule } from './modules/connectivity/connectivity.module';
import { SdwanModule } from './modules/sdwan/sdwan.module';
import { ConsumptionModule } from './modules/consumption/consumption.module';
import { SearchModule } from './modules/search/search.module';
import { AuditModule } from './modules/audit/audit.module';
import { MonitorsApiModule } from './modules/monitoring/monitors-api.module';

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

    // Scheduled tasks (cron jobs)
    ScheduleModule.forRoot(),

    // Database (Prisma)
    DatabaseModule,

    // Crypto (ADR-019 secrets at-rest + token hashing) — @Global, doit
    // être importé avant les modules qui l'injectent.
    CryptoModule,

    // Core modules
    AuthModule,
    TenantsModule,
    UsersModule,

    // Business modules
    OrganizationModule,
    SitesModule,
    AssetsModule,
    RacksModule,
    TasksModule,
    FloorPlansModule,
    ContactsModule,
    ContactTypesModule,
    IntegrationsModule,
    UserDelegationsModule,
    AccessOverridesModule,
    BillingEntitiesModule,
    ExpensesModule,
    SeedModule,
    SetupModule,
    AdminModule,
    BackupModule,
    NotificationsModule,
    AssetModelsModule,
    BudgetsModule,
    ConnectivityModule,
    SdwanModule,
    ConsumptionModule,
    SearchModule,
    AuditModule,
    MonitorsApiModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: XchThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: DelegationGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
  ],
})
export class AppModule {}
