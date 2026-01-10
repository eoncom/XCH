import { PrismaClient, UserRole, SiteStatus, AssetType, AssetStatus, TaskStatus, TaskPriority, RackType, RackStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // 1. Create default tenant
  const tenant = await prisma.tenant.upsert({
    where: { subdomain: 'demo' },
    update: {},
    create: {
      id: 'tenant_default',
      name: 'XCH Demo',
      subdomain: 'demo',
      status: 'ACTIVE',
      primaryColor: '#0070f3',
    },
  });
  console.log('✅ Tenant created:', tenant.name);

  // 2. Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'admin@xch.demo'
      }
    },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@xch.demo',
      passwordHash: adminPassword,
      name: 'Administrateur',
      role: UserRole.ADMIN,
      active: true,
      phone: '+33 6 12 34 56 78',
    },
  });
  console.log('✅ Admin user created:', admin.email);

  // 3. Create manager user
  const managerPassword = await bcrypt.hash('manager123', 10);
  const manager = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'manager@xch.demo'
      }
    },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'manager@xch.demo',
      passwordHash: managerPassword,
      name: 'Chef de Projet',
      role: UserRole.MANAGER,
      active: true,
      phone: '+33 6 23 45 67 89',
    },
  });
  console.log('✅ Manager user created:', manager.email);

  // 4. Create technician user
  const techPassword = await bcrypt.hash('tech123', 10);
  const tech = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'tech@xch.demo'
      }
    },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'tech@xch.demo',
      passwordHash: techPassword,
      name: 'Technicien Terrain',
      role: UserRole.TECHNICIEN,
      active: true,
      phone: '+33 6 34 56 78 90',
    },
  });
  console.log('✅ Technician user created:', tech.email);

  // 5. Create 3 demo sites (without coordinates for now - requires PostGIS)
  const site1 = await prisma.site.create({
    data: {
      tenantId: tenant.id,
      code: 'PAR-001',
      name: 'Chantier Paris La Défense',
      status: SiteStatus.ACTIVE,
      address: '1 Parvis de la Défense',
      city: 'Paris La Défense',
      postalCode: '92800',
      country: 'France',
      contacts: [
        {
          name: 'Jean Dupont',
          phone: '+33 6 11 22 33 44',
          email: 'jean.dupont@defense.fr',
          role: 'Chef de chantier',
          isPrimary: true
        }
      ],
      healthStatus: 'OK',
      lastHealthCheck: new Date(),
      notes: 'Site principal - Tour de bureaux 15 étages',
    },
  });
  console.log('✅ Site 1 created:', site1.name);

  const site2 = await prisma.site.create({
    data: {
      tenantId: tenant.id,
      code: 'LYN-002',
      name: 'Chantier Lyon Part-Dieu',
      status: SiteStatus.ACTIVE,
      address: '129 Rue Servient',
      city: 'Lyon',
      postalCode: '69003',
      country: 'France',
      contacts: [
        {
          name: 'Marie Martin',
          phone: '+33 6 55 66 77 88',
          email: 'marie.martin@partdieu.fr',
          role: 'Responsable IT',
          isPrimary: true
        }
      ],
      healthStatus: 'WARNING',
      lastHealthCheck: new Date(),
      notes: 'Site secondaire - Centre commercial rénové',
    },
  });
  console.log('✅ Site 2 created:', site2.name);

  const site3 = await prisma.site.create({
    data: {
      tenantId: tenant.id,
      code: 'MRS-003',
      name: 'Chantier Marseille Vieux-Port',
      status: SiteStatus.PREPARATION,
      address: '7 Quai du Port',
      city: 'Marseille',
      postalCode: '13002',
      country: 'France',
      contacts: [
        {
          name: 'Pierre Bernard',
          phone: '+33 6 99 88 77 66',
          email: 'pierre.bernard@vieuxport.fr',
          role: 'Coordinateur',
          isPrimary: true
        }
      ],
      healthStatus: 'UNKNOWN',
      notes: 'Site en préparation - Déploiement prévu mars 2026',
    },
  });
  console.log('✅ Site 3 created:', site3.name);

  // 6. Create racks for site 1 and 2
  const rack1 = await prisma.rack.create({
    data: {
      tenantId: tenant.id,
      siteId: site1.id,
      name: 'RACK-A1',
      serialNumber: 'RK-2024-001',
      model: 'Dell PowerEdge R740',
      manufacturer: 'Dell',
      heightU: 42,
      rackType: RackType.FLOOR_STANDING,
      status: RackStatus.IN_SERVICE,
      location: 'Salle serveur - Étage 1',
      notes: 'Baie principale - réseau et serveurs',
    },
  });
  console.log('✅ Rack 1 created:', rack1.name);

  const rack2 = await prisma.rack.create({
    data: {
      tenantId: tenant.id,
      siteId: site2.id,
      name: 'RACK-B1',
      serialNumber: 'RK-2024-002',
      model: 'APC NetShelter SX',
      manufacturer: 'APC',
      heightU: 24,
      rackType: RackType.ENCLOSED_CABINET,
      status: RackStatus.IN_SERVICE,
      location: 'Local technique RDC',
      notes: 'Baie réseau principale',
    },
  });
  console.log('✅ Rack 2 created:', rack2.name);

  // 7. Create assets for each site
  // Site 1 assets
  const printer1 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site1.id,
      type: AssetType.PRINTER,
      model: 'HP LaserJet Pro M404dn',
      manufacturer: 'HP',
      serialNumber: 'HP-2024-001',
      inventoryTag: 'PAR-PRINT-001',
      status: AssetStatus.IN_SERVICE,
      locationText: 'Bureau 302',
      networkInfo: {
        ip: '10.1.1.50',
        mac: '00:1A:2B:3C:4D:50',
        hostname: 'printer-par-302',
        vlan: 'VLAN-10'
      },
      purchaseDate: new Date('2024-01-15'),
      warrantyEnd: new Date('2027-01-15'),
      notes: 'Imprimante étage 3',
    },
  });

  const ipad1 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site1.id,
      type: AssetType.IPAD,
      model: 'iPad Pro 12.9"',
      manufacturer: 'Apple',
      serialNumber: 'IPAD-2024-001',
      inventoryTag: 'PAR-IPAD-001',
      status: AssetStatus.IN_SERVICE,
      locationText: 'Accueil',
      notes: 'Tablette de contrôle accès',
    },
  });

  const switch1 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site1.id,
      rackId: rack1.id,
      type: AssetType.SWITCH,
      model: 'Cisco Catalyst 2960-X',
      manufacturer: 'Cisco',
      serialNumber: 'CSC-2024-001',
      inventoryTag: 'PAR-SW-001',
      status: AssetStatus.IN_SERVICE,
      rackPositionU: 1,
      rackHeightU: 1,
      networkInfo: {
        ip: '10.1.1.1',
        mac: '00:1A:2B:3C:4D:01',
        hostname: 'sw-paris-core'
      },
      purchaseDate: new Date('2024-02-01'),
      warrantyEnd: new Date('2029-02-01'),
      notes: 'Switch core site Paris',
    },
  });

  const server1 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site1.id,
      rackId: rack1.id,
      type: AssetType.SERVER,
      model: 'Dell PowerEdge R740',
      manufacturer: 'Dell',
      serialNumber: 'DELL-2024-001',
      inventoryTag: 'PAR-SRV-001',
      status: AssetStatus.IN_SERVICE,
      rackPositionU: 10,
      rackHeightU: 2,
      networkInfo: {
        ip: '10.1.1.10',
        mac: '00:1A:2B:3C:4D:10',
        hostname: 'srv-paris-app01'
      },
      purchaseDate: new Date('2024-03-01'),
      warrantyEnd: new Date('2029-03-01'),
      powerConsumption: 550,
      notes: 'Serveur applicatif principal',
    },
  });

  // Site 2 assets
  const printer2 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site2.id,
      type: AssetType.PRINTER,
      model: 'HP OfficeJet Pro 9025',
      manufacturer: 'HP',
      serialNumber: 'HP-2024-002',
      inventoryTag: 'LYN-PRINT-001',
      status: AssetStatus.IN_SERVICE,
      locationText: 'Open space RDC',
      networkInfo: {
        ip: '10.2.1.50',
        mac: '00:1A:2B:3C:5D:50',
        hostname: 'printer-lyon-rdc'
      },
      notes: 'Imprimante multifonction',
    },
  });

  const switch2 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site2.id,
      rackId: rack2.id,
      type: AssetType.SWITCH,
      model: 'HPE Aruba 2930F',
      manufacturer: 'HPE',
      serialNumber: 'HPE-2024-001',
      inventoryTag: 'LYN-SW-001',
      status: AssetStatus.IN_SERVICE,
      rackPositionU: 1,
      rackHeightU: 1,
      networkInfo: {
        ip: '10.2.1.1',
        mac: '00:1A:2B:3C:5D:01',
        hostname: 'sw-lyon-core'
      },
      notes: 'Switch principal Lyon',
    },
  });

  const accessPoint1 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site2.id,
      type: AssetType.ACCESS_POINT,
      model: 'Ubiquiti UniFi AP AC Pro',
      manufacturer: 'Ubiquiti',
      serialNumber: 'UBI-2024-001',
      inventoryTag: 'LYN-AP-001',
      status: AssetStatus.IN_SERVICE,
      locationText: 'Plafond Hall',
      networkInfo: {
        ip: '10.2.1.100',
        mac: '00:1A:2B:3C:5D:A0',
        hostname: 'ap-lyon-hall'
      },
      notes: 'WiFi public',
    },
  });

  // Site 3 assets (en transit)
  const ipad2 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site3.id,
      type: AssetType.IPAD,
      model: 'iPad Air 5',
      manufacturer: 'Apple',
      serialNumber: 'IPAD-2024-002',
      inventoryTag: 'MRS-IPAD-001',
      status: AssetStatus.IN_TRANSIT,
      notes: 'En cours de livraison',
    },
  });

  console.log('✅ Assets created: 9 total');

  // 8. Create tasks
  const task1 = await prisma.task.create({
    data: {
      tenantId: tenant.id,
      siteId: site1.id,
      assetId: switch1.id,
      title: 'Configuration VLAN switch principal',
      description: 'Configurer les VLANs 10, 20, 30 sur le switch core Paris',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      assignedTo: tech.id,
      createdBy: manager.id,
      dueDate: new Date('2026-01-15'),
      checklist: [
        { id: '1', text: 'Créer VLAN 10 (Bureaux)', checked: true, order: 1 },
        { id: '2', text: 'Créer VLAN 20 (Serveurs)', checked: true, order: 2 },
        { id: '3', text: 'Créer VLAN 30 (Invités)', checked: false, order: 3 },
        { id: '4', text: 'Tester routing inter-VLAN', checked: false, order: 4 }
      ],
    },
  });

  const task2 = await prisma.task.create({
    data: {
      tenantId: tenant.id,
      siteId: site1.id,
      assetId: printer1.id,
      title: 'Installer drivers imprimante HP',
      description: 'Déployer les drivers HP sur les 15 postes de l\'étage 3',
      status: TaskStatus.DONE,
      priority: TaskPriority.MEDIUM,
      assignedTo: tech.id,
      createdBy: manager.id,
      dueDate: new Date('2026-01-10'),
      completedAt: new Date('2026-01-09'),
    },
  });

  const task3 = await prisma.task.create({
    data: {
      tenantId: tenant.id,
      siteId: site2.id,
      assetId: switch2.id,
      title: 'Vérification câblage réseau',
      description: 'Contrôler tous les ports du switch et identifier ceux non utilisés',
      status: TaskStatus.TODO,
      priority: TaskPriority.LOW,
      assignedTo: tech.id,
      createdBy: manager.id,
      dueDate: new Date('2026-01-20'),
    },
  });

  const task4 = await prisma.task.create({
    data: {
      tenantId: tenant.id,
      siteId: site3.id,
      title: 'Préparation site Marseille',
      description: 'Inventaire complet du matériel à déployer sur le nouveau site',
      status: TaskStatus.TODO,
      priority: TaskPriority.URGENT,
      assignedTo: manager.id,
      createdBy: admin.id,
      dueDate: new Date('2026-01-12'),
      checklist: [
        { id: '1', text: 'Commander 2 racks 42U', checked: false, order: 1 },
        { id: '2', text: 'Commander switches (3x)', checked: false, order: 2 },
        { id: '3', text: 'Commander serveurs (2x)', checked: false, order: 3 },
        { id: '4', text: 'Planifier installation', checked: false, order: 4 }
      ],
    },
  });

  console.log('✅ Tasks created: 4 total');

  // 9. Create a provider
  const provider1 = await prisma.provider.create({
    data: {
      tenantId: tenant.id,
      name: 'TechNet Solutions',
      type: 'INTEGRATOR',
      contacts: [
        {
          name: 'Sophie Leroy',
          phone: '+33 1 23 45 67 89',
          email: 'sophie.leroy@technet.fr',
          role: 'Account Manager'
        }
      ],
      availability: {
        schedules: 'Lun-Ven 8h-18h',
        sla: '4h intervention critique',
        interventionDelay: '24h standard'
      },
      notes: 'Prestataire principal pour intégration matériel réseau',
    },
  });

  console.log('✅ Provider created:', provider1.name);

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📋 Demo Users:');
  console.log('  Admin:      admin@xch.demo / admin123');
  console.log('  Manager:    manager@xch.demo / manager123');
  console.log('  Technician: tech@xch.demo / tech123');
  console.log('\n📍 Sites:');
  console.log('  - Paris La Défense (ACTIVE) - 4 assets, 2 tasks');
  console.log('  - Lyon Part-Dieu (ACTIVE) - 3 assets, 1 task');
  console.log('  - Marseille Vieux-Port (PREPARATION) - 1 asset, 1 task');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
