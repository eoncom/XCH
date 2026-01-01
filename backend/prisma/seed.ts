import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default tenant
  const tenant = await prisma.tenant.upsert({
    where: { subdomain: 'idf' },
    update: {},
    create: {
      name: 'Délégation Île-de-France',
      subdomain: 'idf',
      status: 'ACTIVE',
      primaryColor: '#0070f3',
    },
  });
  console.log(`✅ Tenant created: ${tenant.name} (${tenant.id})`);

  // Create admin user
  const passwordHash = await bcrypt.hash('admin', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@xch.local' },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@xch.local',
      passwordHash,
      name: 'Administrateur',
      role: 'ADMIN',
      active: true,
      authProvider: 'local',
    },
  });
  console.log(`✅ Admin user created: ${admin.email}`);

  // Create test users
  const users = [
    { email: 'manager@xch.local', name: 'Manager Test', role: 'MANAGER' },
    { email: 'tech@xch.local', name: 'Technicien Test', role: 'TECHNICIEN' },
    { email: 'viewer@xch.local', name: 'Viewer Test', role: 'VIEWER' },
  ];

  for (const userData of users) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        tenantId: tenant.id,
        email: userData.email,
        passwordHash,
        name: userData.name,
        role: userData.role as any,
        active: true,
        authProvider: 'local',
      },
    });
    console.log(`✅ User created: ${user.email} (${user.role})`);
  }

  console.log('\n🎉 Seeding completed!');
  console.log('\n📝 Test credentials:');
  console.log('Email: admin@xch.local | Password: admin (ADMIN)');
  console.log('Email: manager@xch.local | Password: admin (MANAGER)');
  console.log('Email: tech@xch.local | Password: admin (TECHNICIEN)');
  console.log('Email: viewer@xch.local | Password: admin (VIEWER)');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
