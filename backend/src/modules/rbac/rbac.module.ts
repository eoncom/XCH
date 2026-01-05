import { Module, Global } from '@nestjs/common';
import { newEnforcer } from 'casbin';
import { TypeORMAdapter } from 'typeorm-adapter';
import { join } from 'path';

@Global()
@Module({
  providers: [
    {
      provide: 'CASBIN_ENFORCER',
      useFactory: async () => {
        const adapter = await TypeORMAdapter.newAdapter({
          type: 'postgres',
          url: process.env.DATABASE_URL,
        });

        const modelPath = join(__dirname, '../../../casbin/model.conf');
        const enforcer = await newEnforcer(modelPath, adapter);

        await enforcer.loadPolicy();

        console.log('✅ Casbin RBAC initialized');
        return enforcer;
      },
    },
  ],
  exports: ['CASBIN_ENFORCER'],
})
export class RbacModule {}
