import { Module, Global, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Global()
@Module({
  providers: [
    {
      provide: 'PRISMA_CLIENT',
      useFactory: () => {
        const prisma = new PrismaClient({
          log: ['error', 'warn'],
        });
        return prisma;
      },
    },
  ],
  exports: ['PRISMA_CLIENT'],
})
export class DatabaseModule implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject('PRISMA_CLIENT') private readonly prisma: PrismaClient) {}

  async onModuleInit() {
    await this.prisma.$connect();
    console.log('✅ Database connected');
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}

// Custom decorator for injecting Prisma
export { PrismaClient };
