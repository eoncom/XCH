import { PrismaClient, UserRole, SiteStatus, AssetType, AssetStatus, TaskStatus, TaskPriority, RackType, RackStatus, ContactCategory } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting comprehensive demo seed...');

  // ── CLEANUP: delete all existing data (FK-safe order) ──
  console.log('🗑️  Cleaning up existing data...');
  await prisma.costAllocation.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.billingEntity.deleteMany({});
  await prisma.notificationLog.deleteMany({});
  await prisma.notificationConfig.deleteMany({});
  await prisma.attachment.deleteMany({});
  await prisma.taskComment.deleteMany({});
  await prisma.taskChecklistItem.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.photo.deleteMany({});
  await prisma.externalRef.deleteMany({});
  await prisma.integrationMapping.deleteMany({});
  await prisma.pin.deleteMany({});
  await prisma.floorPlan.deleteMany({});
  await prisma.assetMovement.deleteMany({});
  await prisma.asset.deleteMany({});
  await prisma.rack.deleteMany({});
  await prisma.contact.deleteMany({});
  await prisma.contactType.deleteMany({});
  await prisma.accessGrant.deleteMany({});
  await prisma.userDelegation.deleteMany({});
  await prisma.authProvider.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.enumLabel.deleteMany({});
  await prisma.casbinRule.deleteMany({});
  await prisma.site.deleteMany({});
  await prisma.delegation.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.tenant.deleteMany({});
  console.log('✅ Cleanup complete');

  // 1. Create default tenant
  const tenant = await prisma.tenant.upsert({
    where: { subdomain: 'demo' },
    update: {
      name: 'EONCOM - Délégation Île-de-France',
      config: {
        domain: 'eoncom.io',
        timezone: 'Europe/Paris',
        language: 'Français',
      },
    },
    create: {
      id: 'tenant_default',
      name: 'EONCOM - Délégation Île-de-France',
      subdomain: 'demo',
      status: 'ACTIVE',
      primaryColor: '#0070f3',
      config: {
        domain: 'eoncom.io',
        timezone: 'Europe/Paris',
        language: 'Français',
      },
    },
  });
  console.log('✅ Tenant created:', tenant.name);

  // 2. Create users (5 total: 1 admin, 1 manager, 2 techs, 1 viewer)
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
      name: 'Sophie Administrateur',
      role: UserRole.ADMIN, // DEPRECATED — local role comes from UserDelegation
      isSuperAdmin: true,
      active: true,
      phone: '+33 6 12 34 56 78',
    },
  });

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
      name: 'Marc Chef de Projet',
      role: UserRole.MANAGER, // DEPRECATED — local role comes from UserDelegation
      active: true,
      phone: '+33 6 23 45 67 89',
    },
  });

  const techPassword = await bcrypt.hash('tech123', 10);
  const tech1 = await prisma.user.upsert({
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
      name: 'Julie Technicien Réseau',
      role: UserRole.TECHNICIEN, // DEPRECATED — local role comes from UserDelegation
      active: true,
      phone: '+33 6 34 56 78 90',
    },
  });

  const tech2 = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'tech2@xch.demo'
      }
    },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'tech2@xch.demo',
      passwordHash: techPassword,
      name: 'Thomas Technicien Support',
      role: UserRole.TECHNICIEN, // DEPRECATED — local role comes from UserDelegation
      active: true,
      phone: '+33 6 45 67 89 01',
    },
  });

  const viewerPassword = await bcrypt.hash('viewer123', 10);
  const viewer = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'viewer@xch.demo'
      }
    },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'viewer@xch.demo',
      passwordHash: viewerPassword,
      name: 'Observateur Client',
      role: UserRole.VIEWER, // DEPRECATED — local role comes from UserDelegation
      active: true,
      phone: '+33 6 56 78 90 12',
    },
  });

  console.log('✅ Users created: 5 total (1 admin, 1 manager, 2 techs, 1 viewer)');

  // 2b. Create organizational structure: Delegations (with groupLabel for visual grouping)
  const delParisOuest = await prisma.delegation.create({
    data: {
      tenantId: tenant.id,
      name: 'Paris Ouest',
      code: 'PAR-O',
      notes: 'Délégation couvrant Paris ouest et La Défense',
      groupLabel: 'Île-de-France',
      groupColor: '#0070f3',
    },
  });

  const delLyon = await prisma.delegation.create({
    data: {
      tenantId: tenant.id,
      name: 'Lyon Métropole',
      code: 'LYN-M',
      notes: 'Délégation Grand Lyon',
      groupLabel: 'Rhône-Alpes',
      groupColor: '#10b981',
    },
  });

  const delMarseille = await prisma.delegation.create({
    data: {
      tenantId: tenant.id,
      name: 'Marseille',
      code: 'MRS',
      notes: 'Délégation Marseille et environs',
      groupLabel: 'PACA',
      groupColor: '#f59e0b',
    },
  });

  const delBordeaux = await prisma.delegation.create({
    data: {
      tenantId: tenant.id,
      name: 'Bordeaux',
      code: 'BDX',
      notes: 'Délégation Bordeaux Métropole',
      groupLabel: 'Sud-Ouest',
      groupColor: '#8b5cf6',
    },
  });

  const delToulouse = await prisma.delegation.create({
    data: {
      tenantId: tenant.id,
      name: 'Toulouse',
      code: 'TLS',
      notes: 'Délégation Toulouse Métropole',
      groupLabel: 'Sud-Ouest',
      groupColor: '#8b5cf6',
    },
  });

  console.log('✅ Delegations created: 5 (PAR-O, LYN-M, MRS, BDX, TLS)');

  // 3. Create 5 demo sites with realistic data
  const site1 = await prisma.site.create({
    data: {
      tenantId: tenant.id,
      delegationId: delParisOuest.id,
      code: 'PAR-001',
      name: 'Site Paris La Défense',
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
          role: 'Chef de site',
          isPrimary: true
        },
        {
          name: 'Claire Dubois',
          phone: '+33 6 11 22 33 45',
          email: 'claire.dubois@defense.fr',
          role: 'Coordinatrice IT',
          isPrimary: false
        }
      ],
      healthStatus: 'HEALTHY',
      lastHealthCheck: new Date(),
      notes: 'Site principal - Tour de bureaux 15 étages - Déploiement complet',
    },
  });

  const site2 = await prisma.site.create({
    data: {
      tenantId: tenant.id,
      delegationId: delLyon.id,
      code: 'LYN-002',
      name: 'Site Lyon Part-Dieu',
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
      notes: 'Site secondaire - Centre commercial rénové - Quelques alertes réseau',
    },
  });

  const site3 = await prisma.site.create({
    data: {
      tenantId: tenant.id,
      delegationId: delMarseille.id,
      code: 'MRS-003',
      name: 'Site Marseille Vieux-Port',
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

  const site4 = await prisma.site.create({
    data: {
      tenantId: tenant.id,
      delegationId: delBordeaux.id,
      code: 'BDX-004',
      name: 'Datacenter Bordeaux Mérignac',
      status: SiteStatus.ACTIVE,
      address: '15 Avenue de l\'Aéropostale',
      city: 'Mérignac',
      postalCode: '33700',
      country: 'France',
      contacts: [
        {
          name: 'François Lefebvre',
          phone: '+33 6 77 88 99 00',
          email: 'francois.lefebvre@datacenter-bdx.fr',
          role: 'Responsable Datacenter',
          isPrimary: true
        }
      ],
      healthStatus: 'HEALTHY',
      lastHealthCheck: new Date(),
      notes: 'Datacenter Tier 3 - Infrastructure critique - 24/7',
    },
  });

  const site5 = await prisma.site.create({
    data: {
      tenantId: tenant.id,
      delegationId: delToulouse.id,
      code: 'TLS-005',
      name: 'Bureau Toulouse Aerospace',
      status: SiteStatus.ACTIVE,
      address: '8 Rue de la Cité Spatiale',
      city: 'Toulouse',
      postalCode: '31500',
      country: 'France',
      contacts: [
        {
          name: 'Isabelle Moreau',
          phone: '+33 6 88 99 00 11',
          email: 'isabelle.moreau@aerospace-tls.fr',
          role: 'IT Manager',
          isPrimary: true
        }
      ],
      healthStatus: 'HEALTHY',
      lastHealthCheck: new Date(),
      notes: 'Site tertiaire - R&D aérospatiale',
    },
  });

  // Update coordinates using raw SQL (PostGIS)
  const siteCoordinates = [
    { id: site1.id, latitude: 48.8919, longitude: 2.2372 },   // Paris La Défense
    { id: site2.id, latitude: 45.7602, longitude: 4.8594 },   // Lyon Part-Dieu
    { id: site3.id, latitude: 43.2954, longitude: 5.3730 },   // Marseille Vieux-Port
    { id: site4.id, latitude: 44.8364, longitude: -0.6874 },  // Bordeaux Mérignac
    { id: site5.id, latitude: 43.6108, longitude: 1.4397 },   // Toulouse Aerospace
  ];

  for (const coord of siteCoordinates) {
    await prisma.$executeRawUnsafe(
      `UPDATE "sites" SET coordinates = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id = $3`,
      coord.longitude,
      coord.latitude,
      coord.id
    );
  }

  console.log('✅ Sites created: 5 total (with GPS coordinates)');

  // 3b. Create UserDelegations (who can access where, with local role)
  // Super admin → ADMIN on ALL delegations (R7: super admin has full access everywhere)
  const allDelegations = [delParisOuest, delLyon, delMarseille, delBordeaux, delToulouse];
  for (const del of allDelegations) {
    await prisma.userDelegation.create({
      data: { tenantId: tenant.id, userId: admin.id, delegationId: del.id, role: 'ADMIN', grantedBy: admin.id },
    });
  }
  // Manager → MANAGER on Paris Ouest + MANAGER on Bordeaux
  await prisma.userDelegation.create({
    data: { tenantId: tenant.id, userId: manager.id, delegationId: delParisOuest.id, role: 'MANAGER', grantedBy: admin.id },
  });
  await prisma.userDelegation.create({
    data: { tenantId: tenant.id, userId: manager.id, delegationId: delBordeaux.id, role: 'MANAGER', grantedBy: admin.id },
  });
  // Tech1 → TECHNICIEN on Lyon + Marseille
  await prisma.userDelegation.create({
    data: { tenantId: tenant.id, userId: tech1.id, delegationId: delLyon.id, role: 'TECHNICIEN', grantedBy: admin.id },
  });
  await prisma.userDelegation.create({
    data: { tenantId: tenant.id, userId: tech1.id, delegationId: delMarseille.id, role: 'TECHNICIEN', grantedBy: admin.id },
  });
  // Tech2 → TECHNICIEN on Bordeaux + Toulouse
  await prisma.userDelegation.create({
    data: { tenantId: tenant.id, userId: tech2.id, delegationId: delBordeaux.id, role: 'TECHNICIEN', grantedBy: admin.id },
  });
  await prisma.userDelegation.create({
    data: { tenantId: tenant.id, userId: tech2.id, delegationId: delToulouse.id, role: 'TECHNICIEN', grantedBy: admin.id },
  });
  // Viewer → VIEWER on all delegations
  await prisma.userDelegation.create({
    data: { tenantId: tenant.id, userId: viewer.id, delegationId: delParisOuest.id, role: 'VIEWER', grantedBy: admin.id },
  });
  await prisma.userDelegation.create({
    data: { tenantId: tenant.id, userId: viewer.id, delegationId: delLyon.id, role: 'VIEWER', grantedBy: admin.id },
  });
  await prisma.userDelegation.create({
    data: { tenantId: tenant.id, userId: viewer.id, delegationId: delMarseille.id, role: 'VIEWER', grantedBy: admin.id },
  });
  await prisma.userDelegation.create({
    data: { tenantId: tenant.id, userId: viewer.id, delegationId: delBordeaux.id, role: 'VIEWER', grantedBy: admin.id },
  });
  await prisma.userDelegation.create({
    data: { tenantId: tenant.id, userId: viewer.id, delegationId: delToulouse.id, role: 'VIEWER', grantedBy: admin.id },
  });

  console.log('✅ UserDelegations created: 16 (superAdmin=ALL 5, manager=PAR-O+BDX, tech1=LYN+MRS, tech2=BDX+TLS, viewer=ALL 5)');

  // 3c. Create BillingEntities (cost centers)
  const beDSI = await prisma.billingEntity.create({
    data: { tenantId: tenant.id, name: 'DSI Centrale', code: 'DSI', type: 'DIRECTION', description: 'Direction des Systèmes d\'Information' },
  });
  const beDOP = await prisma.billingEntity.create({
    data: { tenantId: tenant.id, name: 'Direction des Opérations', code: 'DOP', type: 'DIRECTION', description: 'Direction opérationnelle terrain' },
  });
  const beDelNord = await prisma.billingEntity.create({
    data: { tenantId: tenant.id, name: 'Délégation Paris Ouest', code: 'BE-PAR', type: 'DELEGATION', delegationId: delParisOuest.id },
  });
  const beDelLyon = await prisma.billingEntity.create({
    data: { tenantId: tenant.id, name: 'Délégation Lyon Métropole', code: 'BE-LYN', type: 'DELEGATION', delegationId: delLyon.id },
  });
  const beSiteBDX = await prisma.billingEntity.create({
    data: { tenantId: tenant.id, name: 'Site Bordeaux', code: 'BE-BDX', type: 'SITE', delegationId: delBordeaux.id, siteId: site4.id },
  });
  const beBUIT = await prisma.billingEntity.create({
    data: { tenantId: tenant.id, name: 'BU IT Services', code: 'BU-IT', type: 'BU', description: 'Business Unit IT interne' },
  });

  // 3d. Create sample Expenses with CostAllocations
  const expense1 = await prisma.expense.create({
    data: {
      tenantId: tenant.id,
      label: 'Achat Switch Cisco 3850 x10',
      type: 'EQUIPMENT',
      totalAmount: 10000,
      currency: 'EUR',
      frequency: 'ONE_TIME',
      dateIncurred: new Date('2026-01-15'),
      bearerId: beDSI.id,
      delegationId: delParisOuest.id,
      siteId: site1.id,
      invoiceRef: 'FAC-2026-001',
      createdBy: admin.id,
      allocations: {
        create: [
          { targetId: beDelNord.id, percentage: 40, amount: 4000 },
          { targetId: beDelLyon.id, percentage: 30, amount: 3000 },
          { targetId: beSiteBDX.id, percentage: 30, amount: 3000 },
        ],
      },
    },
  });

  const expense2 = await prisma.expense.create({
    data: {
      tenantId: tenant.id,
      label: 'Contrat support réseau annuel',
      type: 'SERVICE',
      totalAmount: 24000,
      currency: 'EUR',
      frequency: 'YEARLY',
      dateIncurred: new Date('2026-01-01'),
      dateStart: new Date('2026-01-01'),
      dateEnd: new Date('2026-12-31'),
      bearerId: beDSI.id,
      delegationId: delParisOuest.id,
      externalRef: 'CTR-NET-2026',
      createdBy: admin.id,
      allocations: {
        create: [
          { targetId: beDelNord.id, percentage: 25, amount: 6000 },
          { targetId: beDelLyon.id, percentage: 25, amount: 6000 },
          { targetId: beSiteBDX.id, percentage: 25, amount: 6000 },
          { targetId: beBUIT.id, percentage: 25, amount: 6000 },
        ],
      },
    },
  });

  const expense3 = await prisma.expense.create({
    data: {
      tenantId: tenant.id,
      label: 'Licence monitoring Zabbix Enterprise',
      type: 'LICENSE',
      totalAmount: 5400,
      currency: 'EUR',
      frequency: 'YEARLY',
      dateIncurred: new Date('2026-02-01'),
      dateStart: new Date('2026-02-01'),
      dateEnd: new Date('2027-01-31'),
      bearerId: beBUIT.id,
      delegationId: delParisOuest.id,
      createdBy: admin.id,
      allocations: {
        create: [
          { targetId: beDSI.id, percentage: 50, amount: 2700 },
          { targetId: beDOP.id, percentage: 50, amount: 2700 },
        ],
      },
    },
  });

  const expense4 = await prisma.expense.create({
    data: {
      tenantId: tenant.id,
      label: 'Prestation câblage datacenter Bordeaux',
      type: 'PROJECT',
      totalAmount: 8500,
      currency: 'EUR',
      frequency: 'ONE_TIME',
      dateIncurred: new Date('2026-03-01'),
      bearerId: beDOP.id,
      delegationId: delBordeaux.id,
      siteId: site4.id,
      poNumber: 'PO-2026-042',
      createdBy: admin.id,
      allocations: {
        create: [
          { targetId: beSiteBDX.id, percentage: 70, amount: 5950 },
          { targetId: beDSI.id, percentage: 30, amount: 2550 },
        ],
      },
    },
  });

  console.log('✅ BillingEntities created: 6 (DSI, DOP, 2 delegations, 1 site, 1 BU)');
  console.log('✅ Expenses created: 4 with allocations');

  // 4. Create racks (6 total across sites)
  const rack1 = await prisma.rack.create({
    data: {
      tenantId: tenant.id,
      siteId: site1.id,
      name: 'RACK-PAR-A1',
      serialNumber: 'RK-PAR-001',
      model: 'Dell PowerEdge Rack 4210',
      manufacturer: 'Dell',
      heightU: 42,
      rackType: RackType.FLOOR_STANDING,
      status: RackStatus.IN_SERVICE,
      location: 'Salle serveur - Étage 1 - Zone A',
      notes: 'Baie principale - Serveurs applicatifs',
    },
  });

  const rack2 = await prisma.rack.create({
    data: {
      tenantId: tenant.id,
      siteId: site1.id,
      name: 'RACK-PAR-A2',
      serialNumber: 'RK-PAR-002',
      model: 'Dell PowerEdge Rack 4210',
      manufacturer: 'Dell',
      heightU: 42,
      rackType: RackType.FLOOR_STANDING,
      status: RackStatus.IN_SERVICE,
      location: 'Salle serveur - Étage 1 - Zone A',
      notes: 'Baie réseau - Switches et routeurs',
    },
  });

  const rack3 = await prisma.rack.create({
    data: {
      tenantId: tenant.id,
      siteId: site2.id,
      name: 'RACK-LYN-B1',
      serialNumber: 'RK-LYN-001',
      model: 'APC NetShelter SX',
      manufacturer: 'APC',
      heightU: 24,
      rackType: RackType.ENCLOSED_CABINET,
      status: RackStatus.IN_SERVICE,
      location: 'Local technique RDC',
      notes: 'Baie réseau principale Lyon',
    },
  });

  const rack4 = await prisma.rack.create({
    data: {
      tenantId: tenant.id,
      siteId: site4.id,
      name: 'RACK-BDX-DC1',
      serialNumber: 'RK-BDX-001',
      model: 'HP Rack 10642 G2',
      manufacturer: 'HP',
      heightU: 42,
      rackType: RackType.FLOOR_STANDING,
      status: RackStatus.IN_SERVICE,
      location: 'Datacenter - Row 1 - Pod A',
      notes: 'Rack production principal',
    },
  });

  const rack5 = await prisma.rack.create({
    data: {
      tenantId: tenant.id,
      siteId: site4.id,
      name: 'RACK-BDX-DC2',
      serialNumber: 'RK-BDX-002',
      model: 'HP Rack 10642 G2',
      manufacturer: 'HP',
      heightU: 42,
      rackType: RackType.FLOOR_STANDING,
      status: RackStatus.IN_SERVICE,
      location: 'Datacenter - Row 1 - Pod B',
      notes: 'Rack backup et stockage',
    },
  });

  const rack6 = await prisma.rack.create({
    data: {
      tenantId: tenant.id,
      siteId: site5.id,
      name: 'RACK-TLS-C1',
      serialNumber: 'RK-TLS-001',
      model: 'Legrand LCS³',
      manufacturer: 'Legrand',
      heightU: 24,
      rackType: RackType.WALL_MOUNTED,
      status: RackStatus.IN_SERVICE,
      location: 'Local technique Bâtiment C',
      notes: 'Rack mural - Réseau bureaux',
    },
  });

  console.log('✅ Racks created: 6 total');

  // 5. Create comprehensive assets (30+ total)

  // ===== SITE 1 - Paris La Défense (12 assets) =====
  const server1 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site1.id,
      rackId: rack1.id,
      type: AssetType.SERVER,
      model: 'Dell PowerEdge R740',
      manufacturer: 'Dell',
      serialNumber: 'SRV-PAR-001',
      inventoryTag: 'PAR-SRV-001',
      status: AssetStatus.IN_SERVICE,
      rackPositionU: 1,
      rackHeightU: 2,
      networkInfo: {
        ip: '10.1.1.10',
        mac: '00:1A:2B:3C:01:10',
        hostname: 'srv-par-app01',
        vlan: 'VLAN-20'
      },
      purchaseDate: new Date('2024-01-15'),
      warrantyEnd: new Date('2029-01-15'),
      powerConsumption: 550,
      weight: 28.5,
      notes: 'Serveur applicatif principal - Production',
    },
  });

  const server2 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site1.id,
      rackId: rack1.id,
      type: AssetType.SERVER,
      model: 'Dell PowerEdge R740',
      manufacturer: 'Dell',
      serialNumber: 'SRV-PAR-002',
      inventoryTag: 'PAR-SRV-002',
      status: AssetStatus.IN_SERVICE,
      rackPositionU: 4,
      rackHeightU: 2,
      networkInfo: {
        ip: '10.1.1.11',
        mac: '00:1A:2B:3C:01:11',
        hostname: 'srv-par-app02',
        vlan: 'VLAN-20'
      },
      purchaseDate: new Date('2024-01-15'),
      warrantyEnd: new Date('2029-01-15'),
      powerConsumption: 550,
      weight: 28.5,
      notes: 'Serveur applicatif secondaire - HA',
    },
  });

  const server3 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site1.id,
      rackId: rack1.id,
      type: AssetType.SERVER,
      model: 'HPE ProLiant DL380 Gen10',
      manufacturer: 'HPE',
      serialNumber: 'SRV-PAR-003',
      inventoryTag: 'PAR-SRV-003',
      status: AssetStatus.IN_SERVICE,
      rackPositionU: 7,
      rackHeightU: 2,
      networkInfo: {
        ip: '10.1.1.20',
        mac: '00:1A:2B:3C:01:20',
        hostname: 'srv-par-db01',
        vlan: 'VLAN-20'
      },
      purchaseDate: new Date('2024-02-01'),
      warrantyEnd: new Date('2029-02-01'),
      powerConsumption: 800,
      weight: 32.0,
      notes: 'Serveur base de données PostgreSQL',
    },
  });

  const switch1 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site1.id,
      rackId: rack2.id,
      type: AssetType.SWITCH,
      model: 'Cisco Catalyst 9300-48P',
      manufacturer: 'Cisco',
      serialNumber: 'SW-PAR-001',
      inventoryTag: 'PAR-SW-001',
      status: AssetStatus.IN_SERVICE,
      rackPositionU: 1,
      rackHeightU: 1,
      networkInfo: {
        ip: '10.1.1.1',
        mac: '00:1A:2B:3C:01:01',
        hostname: 'sw-par-core',
        vlan: 'VLAN-1'
      },
      purchaseDate: new Date('2024-01-10'),
      warrantyEnd: new Date('2029-01-10'),
      powerConsumption: 350,
      notes: 'Switch core 48 ports PoE+ - Stack master',
    },
  });

  const switch2 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site1.id,
      rackId: rack2.id,
      type: AssetType.SWITCH,
      model: 'Cisco Catalyst 9300-48P',
      manufacturer: 'Cisco',
      serialNumber: 'SW-PAR-002',
      inventoryTag: 'PAR-SW-002',
      status: AssetStatus.IN_SERVICE,
      rackPositionU: 2,
      rackHeightU: 1,
      networkInfo: {
        ip: '10.1.1.2',
        mac: '00:1A:2B:3C:01:02',
        hostname: 'sw-par-dist1',
        vlan: 'VLAN-1'
      },
      purchaseDate: new Date('2024-01-10'),
      warrantyEnd: new Date('2029-01-10'),
      powerConsumption: 350,
      notes: 'Switch distribution étage 1-5',
    },
  });

  const router1 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site1.id,
      rackId: rack2.id,
      type: AssetType.ROUTER,
      name: 'Routeur WAN Principal',
      model: 'Cisco ISR 4331',
      manufacturer: 'Cisco',
      serialNumber: 'RTR-PAR-001',
      inventoryTag: 'PAR-RTR-001',
      status: AssetStatus.IN_SERVICE,
      rackPositionU: 4,
      rackHeightU: 1,
      networkInfo: {
        ip: '10.1.1.254',
        mac: '00:1A:2B:3C:01:FE',
        hostname: 'rtr-par-wan',
        adminLinks: [
          { label: 'Interface Admin', url: 'https://10.1.1.254' },
        ],
      },
      purchaseDate: new Date('2024-01-05'),
      warrantyEnd: new Date('2029-01-05'),
      powerConsumption: 150,
      notes: 'Routeur WAN principal - Fibre 1Gbps',
    },
  });

  const firewall1 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site1.id,
      rackId: rack2.id,
      type: AssetType.FIREWALL,
      name: 'FortiGate Périmètre',
      model: 'Fortinet FortiGate 200F',
      manufacturer: 'Fortinet',
      serialNumber: 'FW-PAR-001',
      inventoryTag: 'PAR-FW-001',
      status: AssetStatus.IN_SERVICE,
      rackPositionU: 6,
      rackHeightU: 1,
      networkInfo: {
        ip: '10.1.1.253',
        mac: '00:1A:2B:3C:01:FD',
        hostname: 'fw-par-main',
        adminLinks: [
          { label: 'FortiGate Console', url: 'https://10.1.1.253' },
        ],
      },
      purchaseDate: new Date('2024-01-05'),
      warrantyEnd: new Date('2029-01-05'),
      powerConsumption: 100,
      notes: 'Firewall périmètre - UTM',
    },
  });

  const printer1 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site1.id,
      type: AssetType.PRINTER,
      model: 'HP LaserJet Pro M404dn',
      manufacturer: 'HP',
      serialNumber: 'PRINT-PAR-001',
      inventoryTag: 'PAR-PRINT-001',
      status: AssetStatus.IN_SERVICE,
      locationText: 'Bureau étage 3 - Salle 302',
      networkInfo: {
        ip: '10.1.3.50',
        mac: '00:1A:2B:3C:03:50',
        hostname: 'print-par-e3',
        vlan: 'VLAN-10'
      },
      purchaseDate: new Date('2024-02-20'),
      warrantyEnd: new Date('2027-02-20'),
      notes: 'Imprimante laser N&B - Étage 3',
    },
  });

  const printer2 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site1.id,
      type: AssetType.PRINTER,
      model: 'HP Color LaserJet Pro M479fdw',
      manufacturer: 'HP',
      serialNumber: 'PRINT-PAR-002',
      inventoryTag: 'PAR-PRINT-002',
      status: AssetStatus.IN_SERVICE,
      locationText: 'Bureau étage 5 - Open Space',
      networkInfo: {
        ip: '10.1.5.50',
        mac: '00:1A:2B:3C:05:50',
        hostname: 'print-par-e5',
        vlan: 'VLAN-10'
      },
      purchaseDate: new Date('2024-03-10'),
      warrantyEnd: new Date('2027-03-10'),
      notes: 'Imprimante multifonction couleur - Étage 5',
    },
  });

  const ipad1 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site1.id,
      type: AssetType.IPAD,
      model: 'iPad Pro 12.9" (6th gen)',
      manufacturer: 'Apple',
      serialNumber: 'IPAD-PAR-001',
      inventoryTag: 'PAR-IPAD-001',
      status: AssetStatus.IN_SERVICE,
      locationText: 'Accueil RDC',
      notes: 'Tablette contrôle accès visiteurs',
    },
  });

  const ipad2 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site1.id,
      type: AssetType.IPAD,
      model: 'iPad Air 5',
      manufacturer: 'Apple',
      serialNumber: 'IPAD-PAR-002',
      inventoryTag: 'PAR-IPAD-002',
      status: AssetStatus.IN_SERVICE,
      locationText: 'Salle de réunion 301',
      notes: 'Tablette visioconférence',
    },
  });

  const ap1 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site1.id,
      type: AssetType.WIFI_AP,
      model: 'Cisco Meraki MR46',
      manufacturer: 'Cisco',
      serialNumber: 'AP-PAR-001',
      inventoryTag: 'PAR-AP-001',
      status: AssetStatus.IN_SERVICE,
      locationText: 'Plafond Hall RDC',
      networkInfo: {
        ip: '10.1.1.101',
        mac: '00:1A:2B:3C:01:A1',
        hostname: 'ap-par-hall-rdc',
        vlan: 'VLAN-10'
      },
      purchaseDate: new Date('2024-02-15'),
      notes: 'WiFi 6 - Zone accueil',
    },
  });

  // ===== SITE 2 - Lyon Part-Dieu (8 assets) =====
  const server4 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site2.id,
      rackId: rack3.id,
      type: AssetType.SERVER,
      model: 'Supermicro SYS-5019S',
      manufacturer: 'Supermicro',
      serialNumber: 'SRV-LYN-001',
      inventoryTag: 'LYN-SRV-001',
      status: AssetStatus.IN_SERVICE,
      rackPositionU: 1,
      rackHeightU: 1,
      networkInfo: {
        ip: '10.2.1.10',
        mac: '00:1A:2B:3C:02:10',
        hostname: 'srv-lyn-local',
        vlan: 'VLAN-20'
      },
      purchaseDate: new Date('2024-03-01'),
      warrantyEnd: new Date('2027-03-01'),
      powerConsumption: 350,
      notes: 'Serveur local Lyon - Cache applicatif',
    },
  });

  const switch3 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site2.id,
      rackId: rack3.id,
      type: AssetType.SWITCH,
      model: 'HPE Aruba 2930F 48G PoE+',
      manufacturer: 'HPE',
      serialNumber: 'SW-LYN-001',
      inventoryTag: 'LYN-SW-001',
      status: AssetStatus.IN_SERVICE,
      rackPositionU: 3,
      rackHeightU: 1,
      networkInfo: {
        ip: '10.2.1.1',
        mac: '00:1A:2B:3C:02:01',
        hostname: 'sw-lyn-core',
        vlan: 'VLAN-1'
      },
      purchaseDate: new Date('2024-02-25'),
      warrantyEnd: new Date('2029-02-25'),
      powerConsumption: 300,
      notes: 'Switch principal Lyon - 48 ports PoE+',
    },
  });

  const router2 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site2.id,
      rackId: rack3.id,
      type: AssetType.ROUTER,
      name: 'Routeur WAN Lyon',
      model: 'MikroTik CCR1036',
      manufacturer: 'MikroTik',
      serialNumber: 'RTR-LYN-001',
      inventoryTag: 'LYN-RTR-001',
      status: AssetStatus.IN_SERVICE,
      rackPositionU: 5,
      rackHeightU: 1,
      networkInfo: {
        ip: '10.2.1.254',
        mac: '00:1A:2B:3C:02:FE',
        hostname: 'rtr-lyn-wan',
        adminLinks: [
          { label: 'WinBox / WebFig', url: 'https://10.2.1.254' },
        ],
      },
      purchaseDate: new Date('2024-02-20'),
      warrantyEnd: new Date('2027-02-20'),
      powerConsumption: 80,
      notes: 'Routeur WAN Lyon - VPN site-to-site',
    },
  });

  const printer3 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site2.id,
      type: AssetType.PRINTER,
      model: 'HP OfficeJet Pro 9025',
      manufacturer: 'HP',
      serialNumber: 'PRINT-LYN-001',
      inventoryTag: 'LYN-PRINT-001',
      status: AssetStatus.IN_SERVICE,
      locationText: 'Open space RDC',
      networkInfo: {
        ip: '10.2.1.50',
        mac: '00:1A:2B:3C:02:50',
        hostname: 'print-lyn-rdc',
        vlan: 'VLAN-10'
      },
      purchaseDate: new Date('2024-03-05'),
      warrantyEnd: new Date('2027-03-05'),
      notes: 'Imprimante multifonction jet d\'encre',
    },
  });

  const ap2 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site2.id,
      type: AssetType.WIFI_AP,
      model: 'Ubiquiti UniFi AP AC Pro',
      manufacturer: 'Ubiquiti',
      serialNumber: 'AP-LYN-001',
      inventoryTag: 'LYN-AP-001',
      status: AssetStatus.IN_SERVICE,
      locationText: 'Plafond Hall principal',
      networkInfo: {
        ip: '10.2.1.100',
        mac: '00:1A:2B:3C:02:A0',
        hostname: 'ap-lyn-hall',
        vlan: 'VLAN-10'
      },
      purchaseDate: new Date('2024-03-01'),
      notes: 'WiFi AC - Zone public',
    },
  });

  const ap3 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site2.id,
      type: AssetType.WIFI_AP,
      model: 'Ubiquiti UniFi AP AC Pro',
      manufacturer: 'Ubiquiti',
      serialNumber: 'AP-LYN-002',
      inventoryTag: 'LYN-AP-002',
      status: AssetStatus.IN_SERVICE,
      locationText: 'Couloir étage 1',
      networkInfo: {
        ip: '10.2.1.101',
        mac: '00:1A:2B:3C:02:A1',
        hostname: 'ap-lyn-e1',
        vlan: 'VLAN-10'
      },
      purchaseDate: new Date('2024-03-01'),
      notes: 'WiFi AC - Étage bureaux',
    },
  });

  const ipad3 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site2.id,
      type: AssetType.IPAD,
      model: 'iPad 10.2" (9th gen)',
      manufacturer: 'Apple',
      serialNumber: 'IPAD-LYN-001',
      inventoryTag: 'LYN-IPAD-001',
      status: AssetStatus.IN_SERVICE,
      locationText: 'Accueil',
      notes: 'Tablette gestion visiteurs',
    },
  });

  const visio1 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site2.id,
      type: AssetType.TEAMS_ROOM,
      model: 'Logitech Rally Plus',
      manufacturer: 'Logitech',
      serialNumber: 'VISIO-LYN-001',
      inventoryTag: 'LYN-VISIO-001',
      status: AssetStatus.IN_SERVICE,
      locationText: 'Salle réunion A',
      networkInfo: {
        ip: '10.2.1.120',
        mac: '00:1A:2B:3C:02:B0',
        hostname: 'visio-lyn-salleA',
        vlan: 'VLAN-10'
      },
      purchaseDate: new Date('2024-03-15'),
      warrantyEnd: new Date('2027-03-15'),
      notes: 'Système visioconférence HD - Salle 12 personnes',
    },
  });

  // ===== SITE 3 - Marseille (en préparation - 3 assets en transit) =====
  const ipad4 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site3.id,
      type: AssetType.IPAD,
      model: 'iPad Air 5',
      manufacturer: 'Apple',
      serialNumber: 'IPAD-MRS-001',
      inventoryTag: 'MRS-IPAD-001',
      status: AssetStatus.IN_TRANSIT,
      notes: 'En cours de livraison - ETA 15/01/2026',
    },
  });

  const printer4 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site3.id,
      type: AssetType.PRINTER,
      model: 'Canon imageRUNNER ADVANCE C3530i',
      manufacturer: 'Canon',
      serialNumber: 'PRINT-MRS-001',
      inventoryTag: 'MRS-PRINT-001',
      status: AssetStatus.STOCK,
      notes: 'En stock - Installation prévue mars 2026',
    },
  });

  const switch4 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site3.id,
      type: AssetType.SWITCH,
      model: 'Cisco Catalyst 2960-X',
      manufacturer: 'Cisco',
      serialNumber: 'SW-MRS-001',
      inventoryTag: 'MRS-SW-001',
      status: AssetStatus.STOCK,
      notes: 'En stock datacenter Bordeaux - À déployer',
    },
  });

  // ===== SITE 4 - Datacenter Bordeaux (8 assets - infrastructure critique) =====
  const server5 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site4.id,
      rackId: rack4.id,
      type: AssetType.SERVER,
      model: 'Dell PowerEdge R750',
      manufacturer: 'Dell',
      serialNumber: 'SRV-BDX-001',
      inventoryTag: 'BDX-SRV-001',
      status: AssetStatus.IN_SERVICE,
      rackPositionU: 1,
      rackHeightU: 2,
      networkInfo: {
        ip: '10.4.1.10',
        mac: '00:1A:2B:3C:04:10',
        hostname: 'srv-bdx-prod01',
        vlan: 'VLAN-100'
      },
      purchaseDate: new Date('2023-11-01'),
      warrantyEnd: new Date('2028-11-01'),
      powerConsumption: 750,
      weight: 35.0,
      notes: 'Serveur production principal - VM host ESXi',
    },
  });

  const server6 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site4.id,
      rackId: rack4.id,
      type: AssetType.SERVER,
      model: 'Dell PowerEdge R750',
      manufacturer: 'Dell',
      serialNumber: 'SRV-BDX-002',
      inventoryTag: 'BDX-SRV-002',
      status: AssetStatus.IN_SERVICE,
      rackPositionU: 4,
      rackHeightU: 2,
      networkInfo: {
        ip: '10.4.1.11',
        mac: '00:1A:2B:3C:04:11',
        hostname: 'srv-bdx-prod02',
        vlan: 'VLAN-100'
      },
      purchaseDate: new Date('2023-11-01'),
      warrantyEnd: new Date('2028-11-01'),
      powerConsumption: 750,
      weight: 35.0,
      notes: 'Serveur production secondaire - VM host ESXi - HA cluster',
    },
  });

  const storage1 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site4.id,
      rackId: rack5.id,
      type: AssetType.OTHER,
      model: 'Dell EMC PowerVault ME4084',
      manufacturer: 'Dell EMC',
      serialNumber: 'STO-BDX-001',
      inventoryTag: 'BDX-STO-001',
      status: AssetStatus.IN_SERVICE,
      rackPositionU: 1,
      rackHeightU: 2,
      networkInfo: {
        ip: '10.4.1.50',
        mac: '00:1A:2B:3C:04:50',
        hostname: 'san-bdx-prod',
        vlan: 'VLAN-101'
      },
      purchaseDate: new Date('2023-11-15'),
      warrantyEnd: new Date('2028-11-15'),
      powerConsumption: 850,
      weight: 45.0,
      notes: 'SAN iSCSI - 96TB usable - RAID6',
    },
  });

  const storage2 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site4.id,
      rackId: rack5.id,
      type: AssetType.OTHER,
      model: 'Synology RackStation RS4021xs+',
      manufacturer: 'Synology',
      serialNumber: 'STO-BDX-002',
      inventoryTag: 'BDX-STO-002',
      status: AssetStatus.IN_SERVICE,
      rackPositionU: 4,
      rackHeightU: 2,
      networkInfo: {
        ip: '10.4.1.51',
        mac: '00:1A:2B:3C:04:51',
        hostname: 'nas-bdx-backup',
        vlan: 'VLAN-101'
      },
      purchaseDate: new Date('2023-12-01'),
      warrantyEnd: new Date('2028-12-01'),
      powerConsumption: 350,
      notes: 'NAS backup - Snapshots quotidiens',
    },
  });

  const switch5 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site4.id,
      rackId: rack4.id,
      type: AssetType.SWITCH,
      model: 'Cisco Nexus 9300',
      manufacturer: 'Cisco',
      serialNumber: 'SW-BDX-001',
      inventoryTag: 'BDX-SW-001',
      status: AssetStatus.IN_SERVICE,
      rackPositionU: 10,
      rackHeightU: 1,
      networkInfo: {
        ip: '10.4.1.1',
        mac: '00:1A:2B:3C:04:01',
        hostname: 'sw-bdx-core',
      },
      purchaseDate: new Date('2023-10-15'),
      warrantyEnd: new Date('2028-10-15'),
      powerConsumption: 500,
      notes: 'Switch datacenter 10/25/40Gb - Spine',
    },
  });

  const firewall2 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site4.id,
      rackId: rack4.id,
      type: AssetType.FIREWALL,
      name: 'Palo Alto Datacenter',
      model: 'Palo Alto PA-3220',
      manufacturer: 'Palo Alto',
      serialNumber: 'FW-BDX-001',
      inventoryTag: 'BDX-FW-001',
      status: AssetStatus.IN_SERVICE,
      rackPositionU: 12,
      rackHeightU: 1,
      networkInfo: {
        ip: '10.4.1.253',
        mac: '00:1A:2B:3C:04:FD',
        hostname: 'fw-bdx-dc',
        adminLinks: [
          { label: 'Palo Alto Console', url: 'https://10.4.1.253' },
        ],
      },
      purchaseDate: new Date('2023-10-01'),
      warrantyEnd: new Date('2028-10-01'),
      powerConsumption: 200,
      notes: 'Firewall datacenter - HA active/passive',
    },
  });

  const ups1 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site4.id,
      type: AssetType.OTHER,
      model: 'APC Smart-UPS SRT 10kVA',
      manufacturer: 'APC',
      serialNumber: 'UPS-BDX-001',
      inventoryTag: 'BDX-UPS-001',
      status: AssetStatus.IN_SERVICE,
      locationText: 'Datacenter - Row 1 - Infrastructure',
      powerConsumption: 10000,
      weight: 120.0,
      purchaseDate: new Date('2023-09-01'),
      warrantyEnd: new Date('2028-09-01'),
      notes: 'Onduleur 10kVA - Runtime 15min charge complète',
    },
  });

  const pdu1 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site4.id,
      type: AssetType.OTHER,
      model: 'APC Rack PDU 2G Switched',
      manufacturer: 'APC',
      serialNumber: 'PDU-BDX-001',
      inventoryTag: 'BDX-PDU-001',
      status: AssetStatus.IN_SERVICE,
      locationText: 'Rack BDX-DC1 - Vertical mount',
      networkInfo: {
        ip: '10.4.1.200',
        mac: '00:1A:2B:3C:04:C0',
        hostname: 'pdu-bdx-dc1',
        vlan: 'VLAN-255'
      },
      purchaseDate: new Date('2023-10-01'),
      notes: 'PDU intelligent - 24 prises C13 + monitoring',
    },
  });

  // ===== SITE 5 - Toulouse (5 assets - bureau R&D) =====
  const server7 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site5.id,
      rackId: rack6.id,
      type: AssetType.SERVER,
      model: 'Intel NUC 12 Pro',
      manufacturer: 'Intel',
      serialNumber: 'SRV-TLS-001',
      inventoryTag: 'TLS-SRV-001',
      status: AssetStatus.IN_SERVICE,
      rackPositionU: 1,
      rackHeightU: 1,
      networkInfo: {
        ip: '10.5.1.10',
        mac: '00:1A:2B:3C:05:10',
        hostname: 'srv-tls-dev',
        vlan: 'VLAN-20'
      },
      purchaseDate: new Date('2024-04-01'),
      warrantyEnd: new Date('2027-04-01'),
      powerConsumption: 65,
      notes: 'Serveur développement local - Docker host',
    },
  });

  const switch6 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site5.id,
      rackId: rack6.id,
      type: AssetType.SWITCH,
      model: 'Netgear GS724T',
      manufacturer: 'Netgear',
      serialNumber: 'SW-TLS-001',
      inventoryTag: 'TLS-SW-001',
      status: AssetStatus.IN_SERVICE,
      rackPositionU: 3,
      rackHeightU: 1,
      networkInfo: {
        ip: '10.5.1.1',
        mac: '00:1A:2B:3C:05:01',
        hostname: 'sw-tls-main',
      },
      purchaseDate: new Date('2024-04-01'),
      warrantyEnd: new Date('2029-04-01'),
      powerConsumption: 50,
      notes: 'Switch 24 ports Gigabit manageable',
    },
  });

  const ap4 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site5.id,
      type: AssetType.WIFI_AP,
      model: 'TP-Link EAP660 HD',
      manufacturer: 'TP-Link',
      serialNumber: 'AP-TLS-001',
      inventoryTag: 'TLS-AP-001',
      status: AssetStatus.IN_SERVICE,
      locationText: 'Plafond Open Space',
      networkInfo: {
        ip: '10.5.1.100',
        mac: '00:1A:2B:3C:05:A0',
        hostname: 'ap-tls-openspace',
        vlan: 'VLAN-10'
      },
      purchaseDate: new Date('2024-04-10'),
      notes: 'WiFi 6 - Zone R&D',
    },
  });

  const printer5 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site5.id,
      type: AssetType.PRINTER,
      model: 'Epson EcoTank ET-5850',
      manufacturer: 'Epson',
      serialNumber: 'PRINT-TLS-001',
      inventoryTag: 'TLS-PRINT-001',
      status: AssetStatus.IN_SERVICE,
      locationText: 'Bureau R&D',
      networkInfo: {
        ip: '10.5.1.50',
        mac: '00:1A:2B:3C:05:50',
        hostname: 'print-tls-rd',
        vlan: 'VLAN-10'
      },
      purchaseDate: new Date('2024-04-15'),
      warrantyEnd: new Date('2027-04-15'),
      notes: 'Imprimante multifonction couleur - R&D',
    },
  });

  const visio2 = await prisma.asset.create({
    data: {
      tenantId: tenant.id,
      siteId: site5.id,
      type: AssetType.TEAMS_ROOM,
      model: 'Poly Studio X50',
      manufacturer: 'Poly',
      serialNumber: 'VISIO-TLS-001',
      inventoryTag: 'TLS-VISIO-001',
      status: AssetStatus.IN_SERVICE,
      locationText: 'Salle brainstorming',
      networkInfo: {
        ip: '10.5.1.120',
        mac: '00:1A:2B:3C:05:B0',
        hostname: 'visio-tls-brain',
        vlan: 'VLAN-10'
      },
      purchaseDate: new Date('2024-04-20'),
      warrantyEnd: new Date('2027-04-20'),
      notes: 'Système visio 4K - Salle créative',
    },
  });

  console.log('✅ Assets created: 36 total');

  // 5.1 Update sites with V2 connectivity
  console.log('\n🔌 Adding V2 connectivity to sites...');

  await prisma.site.update({
    where: { id: site1.id },
    data: {
      connectivity: {
        links: [
          { id: 'link-par-1', role: 'primary', type: 'Fibre optique', provider: 'Orange Business', ref: 'FTTO-PAR-001', bandwidth: '1 Gbps / 1 Gbps', assetId: router1.id },
          { id: 'link-par-2', role: 'backup', type: '4G', provider: 'Bouygues Telecom', ref: '4G-PAR-001', bandwidth: '150 Mbps' },
        ],
        sdwan: {
          enabled: true,
          provider: 'Fortinet SD-WAN',
          firewallIds: [firewall1.id],
        },
        cutProcedure: 'Contacter le NOC Orange au 0800 XX XX XX. Si coupure prolongée, basculer sur le lien 4G backup via interface FortiGate.',
      },
    },
  });

  await prisma.site.update({
    where: { id: site2.id },
    data: {
      connectivity: {
        links: [
          { id: 'link-lyn-1', role: 'primary', type: 'Fibre optique', provider: 'SFR Business', ref: 'FTTH-LYN-001', bandwidth: '500 Mbps / 200 Mbps', assetId: router2.id },
          { id: 'link-lyn-2', role: 'backup', type: '4G', provider: 'Orange', ref: '4G-LYN-001', bandwidth: '100 Mbps' },
        ],
        cutProcedure: 'Contacter SFR Business au 1023. Basculer sur 4G depuis interface MikroTik.',
      },
    },
  });

  // site3 (Marseille) - no connectivity yet (in preparation)

  await prisma.site.update({
    where: { id: site4.id },
    data: {
      connectivity: {
        links: [
          { id: 'link-bdx-1', role: 'primary', type: 'Fibre optique dédiée', provider: 'Orange Business', ref: 'FTTO-BDX-001', bandwidth: '10 Gbps / 10 Gbps' },
          { id: 'link-bdx-2', role: 'backup', type: 'Fibre optique', provider: 'SFR Business', ref: 'FTTH-BDX-002', bandwidth: '1 Gbps / 1 Gbps' },
        ],
        sdwan: {
          enabled: true,
          provider: 'Palo Alto Prisma SD-WAN',
          firewallIds: [firewall2.id],
        },
        cutProcedure: 'DATACENTER CRITIQUE - Appeler immédiatement le NOC 24/7 au 01 XX XX XX XX. Procédure de failover automatique active.',
      },
    },
  });

  await prisma.site.update({
    where: { id: site5.id },
    data: {
      connectivity: {
        links: [
          { id: 'link-tls-1', role: 'primary', type: 'Fibre optique', provider: 'Orange', ref: 'FTTH-TLS-001', bandwidth: '300 Mbps / 100 Mbps' },
        ],
        cutProcedure: 'Contacter Orange support au 3900.',
      },
    },
  });

  console.log('✅ V2 connectivity added to 4 sites (Marseille excluded - in preparation)');

  // 6. Create comprehensive tasks (15 total)
  const task1 = await prisma.task.create({
    data: {
      tenantId: tenant.id,
      siteId: site1.id,
      assetId: switch1.id,
      title: 'Configuration VLAN switch core Paris',
      description: 'Configurer tous les VLANs sur le switch core Catalyst 9300 selon plan d\'adressage',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      assignedTo: tech1.id,
      createdBy: manager.id,
      dueDate: new Date('2026-01-15'),
    },
  });

  const task2 = await prisma.task.create({
    data: {
      tenantId: tenant.id,
      siteId: site1.id,
      assetId: server1.id,
      title: 'Patch sécurité serveur app01',
      description: 'Appliquer les mises à jour de sécurité critiques sur srv-par-app01',
      status: TaskStatus.TODO,
      priority: TaskPriority.URGENT,
      assignedTo: tech1.id,
      createdBy: admin.id,
      dueDate: new Date('2026-01-12'),
      ticketRef: 'JIRA-1234',
    },
  });

  const task3 = await prisma.task.create({
    data: {
      tenantId: tenant.id,
      siteId: site1.id,
      assetId: printer1.id,
      title: 'Installer drivers imprimante étage 3',
      description: 'Déployer les drivers HP LaserJet sur les 15 postes de l\'étage 3',
      status: TaskStatus.DONE,
      priority: TaskPriority.MEDIUM,
      assignedTo: tech2.id,
      createdBy: manager.id,
      dueDate: new Date('2026-01-10'),
      completedAt: new Date('2026-01-09'),
    },
  });

  const task4 = await prisma.task.create({
    data: {
      tenantId: tenant.id,
      siteId: site1.id,
      assetId: firewall1.id,
      title: 'Audit règles firewall Paris',
      description: 'Revue complète des règles FortiGate et suppression des règles obsolètes',
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      assignedTo: tech1.id,
      createdBy: admin.id,
      dueDate: new Date('2026-01-20'),
      ticketRef: 'SEC-789',
    },
  });

  const task5 = await prisma.task.create({
    data: {
      tenantId: tenant.id,
      siteId: site2.id,
      assetId: switch3.id,
      title: 'Vérification câblage réseau Lyon',
      description: 'Contrôler tous les ports du switch Aruba et identifier ports non utilisés',
      status: TaskStatus.TODO,
      priority: TaskPriority.LOW,
      assignedTo: tech2.id,
      createdBy: manager.id,
      dueDate: new Date('2026-01-25'),
    },
  });

  const task6 = await prisma.task.create({
    data: {
      tenantId: tenant.id,
      siteId: site2.id,
      assetId: server4.id,
      title: 'Mise à jour cache applicatif Lyon',
      description: 'Upgrade Redis sur serveur local Lyon vers dernière version stable',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.MEDIUM,
      assignedTo: tech1.id,
      createdBy: manager.id,
      dueDate: new Date('2026-01-18'),
    },
  });

  const task7 = await prisma.task.create({
    data: {
      tenantId: tenant.id,
      siteId: site2.id,
      assetId: visio1.id,
      title: 'Configuration Logitech Rally Plus',
      description: 'Configurer et calibrer caméra + micros visioconférence salle A',
      status: TaskStatus.DONE,
      priority: TaskPriority.MEDIUM,
      assignedTo: tech2.id,
      createdBy: manager.id,
      dueDate: new Date('2026-01-08'),
      completedAt: new Date('2026-01-07'),
    },
  });

  const task8 = await prisma.task.create({
    data: {
      tenantId: tenant.id,
      siteId: site3.id,
      title: 'Préparation site Marseille',
      description: 'Inventaire complet du matériel à déployer sur le nouveau site Vieux-Port',
      status: TaskStatus.TODO,
      priority: TaskPriority.URGENT,
      assignedTo: manager.id,
      createdBy: admin.id,
      dueDate: new Date('2026-01-12'),
      ticketRef: 'PROJ-MRS-001',
    },
  });

  const task9 = await prisma.task.create({
    data: {
      tenantId: tenant.id,
      siteId: site4.id,
      assetId: storage1.id,
      title: 'Extension stockage SAN Bordeaux',
      description: 'Ajout disques SSD dans baie PowerVault pour augmenter capacité',
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      assignedTo: tech1.id,
      createdBy: admin.id,
      dueDate: new Date('2026-01-22'),
      ticketRef: 'INFRA-456',
    },
  });

  const task10 = await prisma.task.create({
    data: {
      tenantId: tenant.id,
      siteId: site4.id,
      assetId: server5.id,
      title: 'Migration VM vers cluster HA',
      description: 'Migrer VMs critiques vers cluster ESXi HA sur srv-bdx-prod01/02',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      assignedTo: tech1.id,
      createdBy: manager.id,
      dueDate: new Date('2026-01-16'),
    },
  });

  const task11 = await prisma.task.create({
    data: {
      tenantId: tenant.id,
      siteId: site4.id,
      assetId: ups1.id,
      title: 'Test onduleur datacenter',
      description: 'Test charge batterie UPS et simulation coupure électrique',
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      assignedTo: tech1.id,
      createdBy: admin.id,
      dueDate: new Date('2026-01-30'),
      ticketRef: 'MAINT-UPS-01',
    },
  });

  const task12 = await prisma.task.create({
    data: {
      tenantId: tenant.id,
      siteId: site5.id,
      assetId: server7.id,
      title: 'Déploiement environnement Docker dev',
      description: 'Installation Docker Swarm sur serveur dev Toulouse pour équipe R&D',
      status: TaskStatus.DONE,
      priority: TaskPriority.MEDIUM,
      assignedTo: tech1.id,
      createdBy: manager.id,
      dueDate: new Date('2026-01-05'),
      completedAt: new Date('2026-01-04'),
    },
  });

  const task13 = await prisma.task.create({
    data: {
      tenantId: tenant.id,
      siteId: site5.id,
      assetId: visio2.id,
      title: 'Formation utilisation Poly Studio X50',
      description: 'Former équipe R&D à l\'utilisation du système visio salle brainstorming',
      status: TaskStatus.TODO,
      priority: TaskPriority.LOW,
      assignedTo: tech2.id,
      createdBy: manager.id,
      dueDate: new Date('2026-01-28'),
    },
  });

  const task14 = await prisma.task.create({
    data: {
      tenantId: tenant.id,
      siteId: site1.id,
      assetId: ap1.id,
      title: 'Optimisation couverture WiFi accueil',
      description: 'Ajuster puissance et canaux AP Meraki pour réduire interférences',
      status: TaskStatus.TODO,
      priority: TaskPriority.LOW,
      assignedTo: tech2.id,
      createdBy: manager.id,
      dueDate: new Date('2026-02-05'),
    },
  });

  const task15 = await prisma.task.create({
    data: {
      tenantId: tenant.id,
      siteId: site1.id,
      title: 'Audit annuel inventaire Paris',
      description: 'Contrôle physique de tous les équipements site Paris avec scan QR codes',
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      assignedTo: tech2.id,
      createdBy: admin.id,
      dueDate: new Date('2026-01-31'),
      ticketRef: 'AUDIT-2026-PAR',
    },
  });

  console.log('✅ Tasks created: 15 total');

  // 7. Create contact types (10 total: 8 system + 2 custom)
  const systemTypes = [
    { name: 'Télécommunications', slug: 'telecommunications', category: ContactCategory.PROVIDER, color: '#3B82F6', icon: 'Phone' },
    { name: 'Internet & Réseau', slug: 'internet-reseau', category: ContactCategory.PROVIDER, color: '#8B5CF6', icon: 'Wifi' },
    { name: 'Cloud & Hosting', slug: 'cloud-hosting', category: ContactCategory.PROVIDER, color: '#06B6D4', icon: 'Cloud' },
    { name: 'Hébergement', slug: 'hebergement', category: ContactCategory.PROVIDER, color: '#14B8A6', icon: 'Server' },
    { name: 'Sécurité', slug: 'securite', category: ContactCategory.PROVIDER, color: '#EF4444', icon: 'Shield' },
    { name: 'Réseau & Infra', slug: 'reseau-infra', category: ContactCategory.TECHNICAL, color: '#F59E0B', icon: 'Network' },
    { name: 'Maintenance', slug: 'maintenance', category: ContactCategory.TECHNICAL, color: '#10B981', icon: 'Wrench' },
    { name: 'Énergie', slug: 'energie', category: ContactCategory.PROVIDER, color: '#F97316', icon: 'Zap' },
  ];

  const contactTypes: any[] = [];
  for (const t of systemTypes) {
    const ct = await prisma.contactType.create({
      data: {
        tenantId: tenant.id,
        name: t.name,
        slug: t.slug,
        category: t.category,
        color: t.color,
        icon: t.icon,
        isSystem: true,
        isActive: true,
      },
    });
    contactTypes.push(ct);
  }

  const customTypes = [
    { name: 'Climatisation', slug: 'climatisation', category: ContactCategory.TECHNICAL, color: '#0EA5E9', icon: 'Wind' },
    { name: 'Plomberie', slug: 'plomberie', category: ContactCategory.TECHNICAL, color: '#6366F1', icon: 'Droplets' },
  ];

  for (const t of customTypes) {
    const ct = await prisma.contactType.create({
      data: {
        tenantId: tenant.id,
        name: t.name,
        slug: t.slug,
        category: t.category,
        color: t.color,
        icon: t.icon,
        isSystem: false,
        isActive: true,
      },
    });
    contactTypes.push(ct);
  }

  console.log('✅ Contact types created: 10 total (8 system + 2 custom)');

  // 8. Create contacts (8 total)
  const telecomType = contactTypes.find((t) => t.slug === 'telecommunications');
  const cloudType = contactTypes.find((t) => t.slug === 'cloud-hosting');
  const securiteType = contactTypes.find((t) => t.slug === 'securite');
  const reseauType = contactTypes.find((t) => t.slug === 'reseau-infra');
  const energieType = contactTypes.find((t) => t.slug === 'energie');
  const maintenanceType = contactTypes.find((t) => t.slug === 'maintenance');
  const climatisationType = contactTypes.find((t) => t.slug === 'climatisation');
  const internetType = contactTypes.find((t) => t.slug === 'internet-reseau');

  const contactsData = [
    { name: 'Orange Business Services', typeId: telecomType.id, email: 'contact@orange-business.com', phone: '3900', company: 'Orange', role: 'Opérateur principal', notes: 'Opérateur principal pour les liaisons FTTH et 4G backup' },
    { name: 'OVHcloud', typeId: cloudType.id, email: 'support@ovhcloud.com', phone: '+33 9 72 10 10 07', company: 'OVH', role: 'Hébergement cloud', notes: 'Hébergement cloud et serveurs dédiés' },
    { name: 'Prosegur', typeId: securiteType.id, email: 'contact@prosegur.fr', phone: '0 800 20 22 23', company: 'Prosegur', role: 'Sécurité physique', notes: 'Sécurité physique et vidéosurveillance sites' },
    { name: 'Cisco TAC France', typeId: reseauType.id, email: 'tac@cisco.com', phone: '+33 1 58 04 60 00', company: 'Cisco', role: 'Support technique', notes: 'Équipements réseau (switches, routeurs, access points)' },
    { name: 'Engie Solutions', typeId: energieType.id, email: 'contact@engie.com', phone: '09 69 39 99 93', company: 'Engie', role: 'Fournisseur énergie', notes: 'Fourniture électrique et groupes électrogènes' },
    { name: 'Dalkia CVC', typeId: climatisationType.id, email: 'support@dalkia.fr', phone: '01 55 60 29 29', company: 'Dalkia', role: 'Maintenance CVC', notes: 'Maintenance CVC (chauffage, ventilation, climatisation)' },
    { name: 'TechNet Solutions', typeId: maintenanceType.id, email: 'sophie.leroy@technet.fr', phone: '+33 1 23 45 67 89', company: 'TechNet', role: 'Intégrateur réseau', notes: 'Prestataire principal pour intégration matériel réseau et serveurs' },
    { name: 'Bouygues Telecom Entreprises', typeId: internetType.id, email: 'btpro@bouyguestelecom.fr', phone: '1064', company: 'Bouygues Telecom', role: 'FAI backup', notes: 'Opérateur secondaire pour liaisons 4G/5G et SDWAN' },
  ];

  for (const c of contactsData) {
    await prisma.contact.create({
      data: { tenantId: tenant.id, ...c, isActive: true },
    });
  }

  console.log('✅ Contacts created: 8 total');

  // 9. Create demo attachments (simulated file uploads)
  console.log('\n📎 Creating demo attachments...');

  // Note: In production, files would be uploaded to MinIO
  // For demo, we create DB entries with simulated paths

  const attachment1 = await prisma.attachment.create({
    data: {
      id: 'attach_asset_server1_spec',
      tenantId: tenant.id,
      assetId: server1.id,
      filename: '1738158600000_dell_poweredge_r740_specs.pdf',
      originalFilename: 'dell_poweredge_r740_specs.pdf',
      size: 2456789,
      mimetype: 'application/pdf',
      path: `attachments/${tenant.id}/assets/${server1.id}/1738158600000_dell_poweredge_r740_specs.pdf`,
      description: 'Spécifications techniques détaillées du serveur',
      category: 'spec',
      uploadedBy: admin.id,
    },
  });

  const attachment2 = await prisma.attachment.create({
    data: {
      id: 'attach_asset_server1_invoice',
      tenantId: tenant.id,
      assetId: server1.id,
      filename: '1738158700000_facture_dell_2024_001.pdf',
      originalFilename: 'facture_dell_2024_001.pdf',
      size: 856234,
      mimetype: 'application/pdf',
      path: `attachments/${tenant.id}/assets/${server1.id}/1738158700000_facture_dell_2024_001.pdf`,
      description: 'Facture d\'achat du serveur Dell',
      category: 'invoice',
      uploadedBy: manager.id,
    },
  });

  const attachment3 = await prisma.attachment.create({
    data: {
      id: 'attach_task1_report',
      tenantId: tenant.id,
      taskId: task1.id,
      filename: '1738158800000_rapport_installation_firewall.pdf',
      originalFilename: 'rapport_installation_firewall.pdf',
      size: 1234567,
      mimetype: 'application/pdf',
      path: `attachments/${tenant.id}/tasks/${task1.id}/1738158800000_rapport_installation_firewall.pdf`,
      description: 'Rapport d\'installation du firewall avec tests de sécurité',
      category: 'report',
      uploadedBy: tech1.id,
    },
  });

  const attachment4 = await prisma.attachment.create({
    data: {
      id: 'attach_task1_photo',
      tenantId: tenant.id,
      taskId: task1.id,
      filename: '1738158900000_photo_installation.jpg',
      originalFilename: 'photo_installation.jpg',
      size: 3456789,
      mimetype: 'image/jpeg',
      path: `attachments/${tenant.id}/tasks/${task1.id}/1738158900000_photo_installation.jpg`,
      description: 'Photo du firewall installé dans le rack',
      category: 'photo',
      uploadedBy: tech1.id,
    },
  });

  const attachment5 = await prisma.attachment.create({
    data: {
      id: 'attach_asset_switch1_manual',
      tenantId: tenant.id,
      assetId: switch1.id,
      filename: '1738159000000_cisco_catalyst_manual.pdf',
      originalFilename: 'cisco_catalyst_manual.pdf',
      size: 5678901,
      mimetype: 'application/pdf',
      path: `attachments/${tenant.id}/assets/${switch1.id}/1738159000000_cisco_catalyst_manual.pdf`,
      description: 'Manuel d\'utilisation Cisco Catalyst',
      category: 'manual',
      uploadedBy: tech2.id,
    },
  });

  console.log('✅ Attachments created: 5 total (3 assets, 2 tasks)');

  // Summary
  console.log('\n🎉 COMPREHENSIVE DEMO SEED COMPLETED SUCCESSFULLY!\n');

  console.log('═══════════════════════════════════════════════════════════');
  console.log('                    XCH DEMO CREDENTIALS                   ');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔐 Admin:       admin@xch.demo / admin123');
  console.log('👔 Manager:     manager@xch.demo / manager123');
  console.log('🔧 Technician:  tech@xch.demo / tech123');
  console.log('🔧 Technician2: tech2@xch.demo / tech123');
  console.log('👁️  Viewer:      viewer@xch.demo / viewer123');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📊 DEMO DATA SUMMARY:');
  console.log('  👥 Users: 5 (1 admin, 1 manager, 2 techs, 1 viewer)');
  console.log('  📍 Sites: 5 (3 ACTIVE, 1 PREPARATION, 1 DATACENTER)');
  console.log('  🗄️  Racks: 6 (Paris x2, Lyon x1, Bordeaux x2, Toulouse x1)');
  console.log('  💻 Assets: 36 total');
  console.log('      • Servers: 7');
  console.log('      • Switches: 6');
  console.log('      • Routers: 2');
  console.log('      • Firewalls: 2');
  console.log('      • Storage: 2 (SAN + NAS)');
  console.log('      • Printers: 5');
  console.log('      • iPads: 4');
  console.log('      • Access Points: 4');
  console.log('      • Visioconference: 2');
  console.log('      • UPS: 1');
  console.log('      • PDU: 1');
  console.log('  📋 Tasks: 15 (3 TODO, 5 IN_PROGRESS, 4 DONE, 3 URGENT)');
  console.log('  📇 Contact Types: 10 (8 system, 2 custom)');
  console.log('  🏢 Contacts: 8 (telecom, cloud, security, network, energy, CVC, integrator, FAI)');
  console.log('  📎 Attachments: 5 (3 on assets, 2 on tasks)\n');

  console.log('🏢 ORGANISATION:');
  console.log('  Délégation Paris Ouest [IDF] → PAR-001');
  console.log('  Délégation Lyon Métropole [RA] → LYN-002');
  console.log('  Délégation Marseille [PACA] → MRS-003');
  console.log('  Délégation Bordeaux [SO] → BDX-004');
  console.log('  Délégation Toulouse [SO] → TLS-005\n');
  console.log('📍 SITES DETAILS:');
  console.log('  1. Paris La Défense (PAR-001) - ACTIVE');
  console.log('     → 12 assets, 2 racks, 6 tasks');
  console.log('  2. Lyon Part-Dieu (LYN-002) - ACTIVE');
  console.log('     → 8 assets, 1 rack, 3 tasks');
  console.log('  3. Marseille Vieux-Port (MRS-003) - PREPARATION');
  console.log('     → 3 assets (in transit/storage), 1 task');
  console.log('  4. Datacenter Bordeaux (BDX-004) - ACTIVE');
  console.log('     → 8 assets, 2 racks, 3 tasks (critical infra)');
  console.log('  5. Bureau Toulouse (TLS-005) - ACTIVE');
  console.log('     → 5 assets, 1 rack, 2 tasks (R&D)\n');

  console.log('💰 BILLING:');
  console.log('  6 BillingEntities: DSI, DOP, BE-PAR, BE-LYN, BE-BDX, BU-IT');
  console.log('  4 Expenses with CostAllocations');
  console.log('    - Switch Cisco 10000€ (DSI→PAR 40%, LYN 30%, BDX 30%)');
  console.log('    - Support réseau 24000€/an (DSI→PAR/LYN/BDX/BU-IT 25% each)');
  console.log('    - Licence Zabbix 5400€/an (BU-IT→DSI 50%, DOP 50%)');
  console.log('    - Câblage BDX 8500€ (DOP→BDX 70%, DSI 30%)\n');
  console.log('✨ Ready for comprehensive demo and testing!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
