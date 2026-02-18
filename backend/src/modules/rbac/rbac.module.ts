import { Module, Global } from '@nestjs/common';
import { newEnforcer } from 'casbin';
import TypeORMAdapter from 'typeorm-adapter';
import { join } from 'path';
import { readFileSync } from 'fs';

@Global()
@Module({
  providers: [
    {
      provide: 'CASBIN_ENFORCER',
      useFactory: async () => {
        // Parse DATABASE_URL to avoid TypeORM URL parsing issues
        const dbUrl = new URL(process.env.DATABASE_URL);
        const adapter = await TypeORMAdapter.newAdapter({
          type: 'postgres',
          host: dbUrl.hostname,
          port: parseInt(dbUrl.port) || 5432,
          username: decodeURIComponent(dbUrl.username),
          password: decodeURIComponent(dbUrl.password),
          database: dbUrl.pathname.replace('/', ''),
        });

        const modelPath = join(__dirname, '../../../casbin/model.conf');
        const enforcer = await newEnforcer(modelPath, adapter);

        await enforcer.loadPolicy();

        // Auto-reload policies from CSV if DB table is empty (e.g. after prisma db push)
        const allPolicies = await enforcer.getPolicy();
        if (allPolicies.length === 0) {
          console.log('⚠️  Casbin policies empty in DB - reloading from policy.csv...');
          const policyPath = join(__dirname, '../../../casbin/policy.csv');
          try {
            const csvContent = readFileSync(policyPath, 'utf-8');
            const lines = csvContent.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
            let count = 0;
            for (const line of lines) {
              const parts = line.split(',').map(p => p.trim());
              if (parts[0] === 'p' && parts.length >= 4) {
                const [, sub, obj, act, domain] = parts;
                await enforcer.addPolicy(sub, obj, act, domain || '*');
                count++;
              }
            }
            await enforcer.savePolicy();
            console.log(`✅ Reloaded ${count} Casbin policies from CSV`);
          } catch (err) {
            console.error('❌ Failed to reload policies from CSV:', err.message);
          }
        }

        console.log(`✅ Casbin RBAC initialized (${allPolicies.length || 'reloaded'} policies)`);
        return enforcer;
      },
    },
  ],
  exports: ['CASBIN_ENFORCER'],
})
export class RbacModule {}
