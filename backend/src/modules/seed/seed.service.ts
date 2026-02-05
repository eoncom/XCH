import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient, UserRole, SiteStatus, HealthStatus, AssetType, AssetStatus, RackType, RackStatus, TaskStatus, TaskPriority, ContactCategory } from '@prisma/client';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async loadDemo(tenantId: string) {
    this.logger.log(`Loading demo data for tenant ${tenantId}`);

    const sites = await this.createSites(tenantId);
    const users = await this.createUsers(tenantId);
    const assets = await this.createAssets(tenantId, sites);
    const racks = await this.createRacks(tenantId, sites);
    const tasks = await this.createTasks(tenantId, sites, users);
    const contactTypes = await this.createContactTypes(tenantId);
    const contacts = await this.createContacts(tenantId, contactTypes);

    this.logger.log(`Demo data loaded successfully`);

    return {
      message: 'Données démo chargées avec succès',
      stats: {
        sites: sites.length,
        users: users.length,
        assets: assets.length,
        racks: racks.length,
        tasks: tasks.length,
        contactTypes: contactTypes.length,
        contacts: contacts.length,
      },
    };
  }

  async resetData(tenantId: string, adminUserId: string) {
    this.logger.warn(`Resetting all data for tenant ${tenantId} (preserving admin ${adminUserId})`);

    try {
      // Delete in correct order due to foreign key constraints
      await this.prisma.pin.deleteMany({ where: { floorPlan: { site: { tenantId } } } });
      await this.prisma.floorPlan.deleteMany({ where: { site: { tenantId } } });
      await this.prisma.asset.deleteMany({ where: { tenantId } });
      await this.prisma.rack.deleteMany({ where: { tenantId } });
      await this.prisma.task.deleteMany({ where: { tenantId } });
      await this.prisma.site.deleteMany({ where: { tenantId } });
      await this.prisma.contact.deleteMany({ where: { tenantId } });
      await this.prisma.contactType.deleteMany({ where: { tenantId } });
      await this.prisma.integrationMapping.deleteMany({ where: { tenantId } });
      // Photo is polymorphic - delete by entity relations
      // AuditLog has userId, not direct tenantId relation
      await this.prisma.auditLog.deleteMany({ where: { tenantId } });

      // Delete non-admin users
      await this.prisma.user.deleteMany({
        where: {
          tenantId,
          id: { not: adminUserId },
        },
      });

      this.logger.log(`All data deleted for tenant ${tenantId}`);
      return { message: 'Toutes les données ont été supprimées' };
    } catch (error) {
      this.logger.error(`Failed to reset data: ${error.message}`);
      throw error;
    }
  }

  private async createSites(tenantId: string) {
    const sites = [];

    const paris = await this.prisma.site.upsert({
      where: { id: `demo-site-paris-${tenantId}` },
      update: {},
      create: {
        id: `demo-site-paris-${tenantId}`,
        tenantId,
        code: 'PAR-01',
        name: 'Paris - Tour Montparnasse',
        status: SiteStatus.ACTIVE,
        healthStatus: HealthStatus.HEALTHY,
        address: '33 Avenue du Maine',
        city: 'Paris',
        postalCode: '75015',
        country: 'France',
        contacts: [
          { name: 'Jean Dupont', phone: '+33 1 23 45 67 89', email: 'j.dupont@demo.fr', role: 'Responsable site', isPrimary: true },
        ],
        connectivity: {
          primary: { type: 'Fibre optique', provider: 'Orange', ref: 'FTTH-PAR-001' },
          backup: { type: '4G', provider: 'Bouygues', ref: '4G-BCK-001' },
        },
        notes: 'Site de démonstration - Paris',
      },
    });
    sites.push(paris);

    const lyon = await this.prisma.site.upsert({
      where: { id: `demo-site-lyon-${tenantId}` },
      update: {},
      create: {
        id: `demo-site-lyon-${tenantId}`,
        tenantId,
        code: 'LYO-01',
        name: 'Lyon - Part-Dieu',
        status: SiteStatus.ACTIVE,
        healthStatus: HealthStatus.WARNING,
        address: '129 Rue Servient',
        city: 'Lyon',
        postalCode: '69003',
        country: 'France',
        notes: 'Site de démonstration - Lyon',
      },
    });
    sites.push(lyon);

    return sites;
  }

  private async createUsers(tenantId: string) {
    const users = [];

    const manager = await this.prisma.user.upsert({
      where: { id: `demo-user-manager-${tenantId}` },
      update: {},
      create: {
        id: `demo-user-manager-${tenantId}`,
        tenantId,
        email: 'manager@demo.fr',
        passwordHash: '$2b$10$dummyhashfordemopurposes', // Not valid, just for demo
        name: 'Sophie Martin',
        role: UserRole.MANAGER,
        phone: '+33 6 12 34 56 78',
      },
    });
    users.push(manager);

    const tech = await this.prisma.user.upsert({
      where: { id: `demo-user-tech-${tenantId}` },
      update: {},
      create: {
        id: `demo-user-tech-${tenantId}`,
        tenantId,
        email: 'technicien@demo.fr',
        passwordHash: '$2b$10$dummyhashfordemopurposes',
        name: 'Marc Leroy',
        role: UserRole.TECHNICIEN,
        phone: '+33 6 98 76 54 32',
      },
    });
    users.push(tech);

    return users;
  }

  private async createAssets(tenantId: string, sites: any[]) {
    const assets = [];
    const paris = sites[0];

    // Create 5 demo assets
    for (let i = 1; i <= 5; i++) {
      const asset = await this.prisma.asset.create({
        data: {
          tenantId,
          siteId: paris.id,
          type: i <= 2 ? AssetType.SWITCH : i <= 4 ? AssetType.PRINTER : AssetType.IPAD,
          manufacturer: i <= 2 ? 'Cisco' : i <= 4 ? 'HP' : 'Apple',
          model: i <= 2 ? `Switch C9300-${i}` : i <= 4 ? `LaserJet Pro ${i}` : `iPad Air ${i}`,
          serialNumber: `DEMO-${paris.code}-${i.toString().padStart(3, '0')}`,
          status: AssetStatus.IN_SERVICE,
          notes: `Demo asset for ${paris.name}`,
        },
      });
      assets.push(asset);
    }

    return assets;
  }

  private async createRacks(tenantId: string, sites: any[]) {
    const racks = [];
    const paris = sites[0];

    const rack1 = await this.prisma.rack.create({
      data: {
        tenantId,
        siteId: paris.id,
        name: 'Rack A1',
        location: 'Salle serveur - Étage 2',
        rackType: RackType.FLOOR_STANDING,
        heightU: 42,
        status: RackStatus.IN_SERVICE,
        notes: 'Rack principal réseau',
      },
    });
    racks.push(rack1);

    return racks;
  }

  private async createTasks(tenantId: string, sites: any[], users: any[]) {
    const tasks = [];
    const paris = sites[0];
    const manager = users.find((u) => u.role === UserRole.MANAGER);
    const tech = users.find((u) => u.role === UserRole.TECHNICIEN);

    const task1 = await this.prisma.task.create({
      data: {
        tenantId,
        siteId: paris.id,
        title: 'Installation switches réseau',
        description: 'Installer les 3 switches Cisco dans le rack A1',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH,
        assignedTo: tech?.id,
        createdBy: manager?.id || tech?.id,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 days
      },
    });
    tasks.push(task1);

    const task2 = await this.prisma.task.create({
      data: {
        tenantId,
        siteId: paris.id,
        title: 'Configuration imprimante',
        description: 'Configurer et tester l\'imprimante réseau',
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        assignedTo: tech?.id,
        createdBy: manager?.id || tech?.id,
      },
    });
    tasks.push(task2);

    return tasks;
  }

  private async createContactTypes(tenantId: string) {
    const types = [];

    // 8 system types
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

    for (const t of systemTypes) {
      const ct = await this.prisma.contactType.upsert({
        where: {
          tenantId_slug: { tenantId, slug: t.slug },
        },
        update: {},
        create: {
          tenantId,
          name: t.name,
          slug: t.slug,
          category: t.category,
          color: t.color,
          icon: t.icon,
          isSystem: true,
          isActive: true,
        },
      });
      types.push(ct);
    }

    // 2 custom types
    const customTypes = [
      { name: 'Climatisation', slug: 'climatisation', category: ContactCategory.TECHNICAL, color: '#0EA5E9', icon: 'Wind' },
      { name: 'Plomberie', slug: 'plomberie', category: ContactCategory.TECHNICAL, color: '#6366F1', icon: 'Droplets' },
    ];

    for (const t of customTypes) {
      const ct = await this.prisma.contactType.upsert({
        where: {
          tenantId_slug: { tenantId, slug: t.slug },
        },
        update: {},
        create: {
          tenantId,
          name: t.name,
          slug: t.slug,
          category: t.category,
          color: t.color,
          icon: t.icon,
          isSystem: false,
          isActive: true,
        },
      });
      types.push(ct);
    }

    return types;
  }

  private async createContacts(tenantId: string, contactTypes: any[]) {
    const contacts = [];

    const telecom = contactTypes.find((t) => t.slug === 'telecommunications');
    const cloud = contactTypes.find((t) => t.slug === 'cloud-hosting');
    const securite = contactTypes.find((t) => t.slug === 'securite');
    const reseau = contactTypes.find((t) => t.slug === 'reseau-infra');
    const energie = contactTypes.find((t) => t.slug === 'energie');
    const climatisation = contactTypes.find((t) => t.slug === 'climatisation');

    const contactData = [
      {
        name: 'Orange Business Services',
        typeId: telecom.id,
        email: 'contact@orange-business.com',
        phone: '3900',
        company: 'Orange',
        role: 'Opérateur principal',
        notes: 'Opérateur principal pour les liaisons FTTH et 4G backup',
      },
      {
        name: 'OVHcloud',
        typeId: cloud.id,
        email: 'support@ovhcloud.com',
        phone: '+33 9 72 10 10 07',
        company: 'OVH',
        role: 'Hébergement cloud',
        notes: 'Hébergement cloud et serveurs dédiés',
      },
      {
        name: 'Prosegur',
        typeId: securite.id,
        email: 'contact@prosegur.fr',
        phone: '0 800 20 22 23',
        company: 'Prosegur',
        role: 'Sécurité physique',
        notes: 'Sécurité physique et vidéosurveillance chantiers',
      },
      {
        name: 'Cisco TAC France',
        typeId: reseau.id,
        email: 'tac@cisco.com',
        phone: '+33 1 58 04 60 00',
        company: 'Cisco',
        role: 'Support technique',
        notes: 'Équipements réseau (switches, routeurs, access points)',
      },
      {
        name: 'Engie Solutions',
        typeId: energie.id,
        email: 'contact@engie.com',
        phone: '09 69 39 99 93',
        company: 'Engie',
        role: 'Fournisseur énergie',
        notes: 'Fourniture électrique et groupes électrogènes',
      },
      {
        name: 'Dalkia CVC',
        typeId: climatisation.id,
        email: 'support@dalkia.fr',
        phone: '01 55 60 29 29',
        company: 'Dalkia',
        role: 'Maintenance CVC',
        notes: 'Maintenance CVC (chauffage, ventilation, climatisation)',
      },
    ];

    for (const c of contactData) {
      const contact = await this.prisma.contact.create({
        data: {
          tenantId,
          ...c,
          isActive: true,
        },
      });
      contacts.push(contact);
    }

    return contacts;
  }
}
