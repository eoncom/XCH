import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient, UserRole, SiteStatus, AssetType, AssetStatus, TaskStatus, TaskPriority, RackType, RackStatus, HealthStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(private prisma: PrismaClient) {}

  /**
   * Load comprehensive demo data
   * Idempotent - can be run multiple times
   */
  async loadDemoData(tenantId: string) {
    this.logger.log(`Loading demo data for tenant ${tenantId}`);

    try {
      // Create demo users if they don't exist
      const users = await this.createUsers(tenantId);
      this.logger.log(`Created/verified ${users.length} users`);

      // Create demo sites
      const sites = await this.createSites(tenantId);
      this.logger.log(`Created ${sites.length} sites`);

      // Create demo assets
      const assets = await this.createAssets(tenantId, sites);
      this.logger.log(`Created ${assets.length} assets`);

      // Create demo racks
      const racks = await this.createRacks(tenantId, sites);
      this.logger.log(`Created ${racks.length} racks`);

      // Create demo tasks
      const tasks = await this.createTasks(tenantId, sites, users);
      this.logger.log(`Created ${tasks.length} tasks`);

      // Create demo providers
      const providers = await this.createProviders(tenantId);
      this.logger.log(`Created ${providers.length} providers`);

      return {
        message: 'Demo data loaded successfully',
        stats: {
          users: users.length,
          sites: sites.length,
          assets: assets.length,
          racks: racks.length,
          tasks: tasks.length,
          providers: providers.length,
        },
      };
    } catch (error) {
      this.logger.error('Failed to load demo data', error);
      throw error;
    }
  }

  /**
   * Reset all data except admin user and tenant
   */
  async resetData(tenantId: string, adminUserId: string) {
    this.logger.warn(`Resetting all data for tenant ${tenantId} (preserving admin ${adminUserId})`);

    try {
      // Delete in correct order due to foreign key constraints
      await this.prisma.floorPlanPin.deleteMany({ where: { floorPlan: { site: { tenantId } } } });
      await this.prisma.floorPlan.deleteMany({ where: { site: { tenantId } } });
      await this.prisma.asset.deleteMany({ where: { tenantId } });
      await this.prisma.rack.deleteMany({ where: { tenantId } });
      await this.prisma.task.deleteMany({ where: { tenantId } });
      await this.prisma.site.deleteMany({ where: { tenantId } });
      await this.prisma.provider.deleteMany({ where: { tenantId } });
      await this.prisma.externalRef.deleteMany({ where: { tenantId } });
      await this.prisma.photo.deleteMany({ where: { tenantId } });
      await this.prisma.auditLog.deleteMany({ where: { tenantId } });

      // Delete non-admin users
      await this.prisma.user.deleteMany({
        where: {
          tenantId,
          id: { not: adminUserId },
        },
      });

      this.logger.log('Data reset completed successfully');

      return {
        message: 'All data reset successfully (admin user and tenant preserved)',
      };
    } catch (error) {
      this.logger.error('Failed to reset data', error);
      throw error;
    }
  }

  // Private helper methods

  private async createUsers(tenantId: string) {
    const users = [];

    const managerPassword = await bcrypt.hash('manager123', 10);
    const manager = await this.prisma.user.upsert({
      where: { tenantId_email: { tenantId, email: 'manager@xch.demo' } },
      update: {},
      create: {
        tenantId,
        email: 'manager@xch.demo',
        passwordHash: managerPassword,
        name: 'Marc Manager',
        role: UserRole.MANAGER,
        active: true,
        phone: '+33 6 23 45 67 89',
      },
    });
    users.push(manager);

    const techPassword = await bcrypt.hash('tech123', 10);
    const tech1 = await this.prisma.user.upsert({
      where: { tenantId_email: { tenantId, email: 'tech@xch.demo' } },
      update: {},
      create: {
        tenantId,
        email: 'tech@xch.demo',
        passwordHash: techPassword,
        name: 'Thomas Technicien',
        role: UserRole.TECHNICIEN,
        active: true,
        phone: '+33 6 34 56 78 90',
      },
    });
    users.push(tech1);

    const tech2 = await this.prisma.user.upsert({
      where: { tenantId_email: { tenantId, email: 'tech2@xch.demo' } },
      update: {},
      create: {
        tenantId,
        email: 'tech2@xch.demo',
        passwordHash: techPassword,
        name: 'Julie Technicienne',
        role: UserRole.TECHNICIEN,
        active: true,
        phone: '+33 6 45 67 89 01',
      },
    });
    users.push(tech2);

    const viewerPassword = await bcrypt.hash('viewer123', 10);
    const viewer = await this.prisma.user.upsert({
      where: { tenantId_email: { tenantId, email: 'viewer@xch.demo' } },
      update: {},
      create: {
        tenantId,
        email: 'viewer@xch.demo',
        passwordHash: viewerPassword,
        name: 'Victor Viewer',
        role: UserRole.VIEWER,
        active: true,
      },
    });
    users.push(viewer);

    return users;
  }

  private async createSites(tenantId: string) {
    const sites = [];

    // Site 1: Paris La Défense
    const paris = await this.prisma.site.upsert({
      where: { tenantId_code: { tenantId, code: 'PAR-LD-001' } },
      update: {},
      create: {
        tenantId,
        code: 'PAR-LD-001',
        name: 'Paris La Défense',
        status: SiteStatus.ACTIVE,
        address: '20 Place de la Défense',
        city: 'Paris',
        postalCode: '92400',
        country: 'France',
        healthStatus: HealthStatus.HEALTHY,
        notes: 'Chantier de bureau principal - 3 étages',
      },
    });
    sites.push(paris);

    // Site 2: Lyon Part-Dieu
    const lyon = await this.prisma.site.upsert({
      where: { tenantId_code: { tenantId, code: 'LYO-PD-002' } },
      update: {},
      create: {
        tenantId,
        code: 'LYO-PD-002',
        name: 'Lyon Part-Dieu',
        status: SiteStatus.ACTIVE,
        address: '35 Rue de la Villette',
        city: 'Lyon',
        postalCode: '69003',
        country: 'France',
        healthStatus: HealthStatus.HEALTHY,
        notes: 'Bureaux régionaux - 2 étages',
      },
    });
    sites.push(lyon);

    // Site 3: Marseille Vieux-Port (transit)
    const marseille = await this.prisma.site.upsert({
      where: { tenantId_code: { tenantId, code: 'MAR-VP-003' } },
      update: {},
      create: {
        tenantId,
        code: 'MAR-VP-003',
        name: 'Marseille Vieux-Port',
        status: SiteStatus.PREPARATION,
        address: '12 Quai du Port',
        city: 'Marseille',
        postalCode: '13002',
        country: 'France',
        healthStatus: HealthStatus.UNKNOWN,
        notes: 'Chantier en préparation - équipement en transit',
      },
    });
    sites.push(marseille);

    return sites;
  }

  private async createAssets(tenantId: string, sites: any[]) {
    const assets = [];
    const paris = sites[0];
    const lyon = sites[1];

    // Paris assets
    for (let i = 1; i <= 5; i++) {
      const asset = await this.prisma.asset.create({
        data: {
          tenantId,
          siteId: paris.id,
          type: i <= 2 ? AssetType.NETWORK : i <= 4 ? AssetType.PRINTER : AssetType.IPAD,
          brand: i <= 2 ? 'Cisco' : i <= 4 ? 'HP' : 'Apple',
          model: i <= 2 ? `Switch C9300-${i}` : i <= 4 ? `LaserJet Pro ${i}` : `iPad Air ${i}`,
          serialNumber: `DEMO-${paris.code}-${i.toString().padStart(3, '0')}`,
          status: AssetStatus.IN_USE,
          notes: `Demo asset for ${paris.name}`,
        },
      });
      assets.push(asset);
    }

    // Lyon assets
    for (let i = 1; i <= 3; i++) {
      const asset = await this.prisma.asset.create({
        data: {
          tenantId,
          siteId: lyon.id,
          type: AssetType.VISIO,
          brand: 'Poly',
          model: `Studio X${30 + i * 10}`,
          serialNumber: `DEMO-${lyon.code}-${i.toString().padStart(3, '0')}`,
          status: AssetStatus.IN_USE,
          notes: `Demo visio for ${lyon.name}`,
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
        type: RackType.NETWORK,
        height: 42,
        status: RackStatus.IN_USE,
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
        assignedToId: tech?.id,
        createdById: manager?.id,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 days
        checklist: [
          { id: 1, label: 'Vérifier câblage électrique', completed: true },
          { id: 2, label: 'Monter switches en rack', completed: false },
          { id: 3, label: 'Configurer VLANs', completed: false },
        ],
      },
    });
    tasks.push(task1);

    const task2 = await this.prisma.task.create({
      data: {
        tenantId,
        siteId: paris.id,
        title: 'Configuration imprimantes',
        description: 'Configurer les imprimantes HP sur le réseau',
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        assignedToId: tech?.id,
        createdById: manager?.id,
        checklist: [
          { id: 1, label: 'Installer drivers', completed: false },
          { id: 2, label: 'Configurer IP statiques', completed: false },
        ],
      },
    });
    tasks.push(task2);

    return tasks;
  }

  private async createProviders(tenantId: string) {
    const providers = [];

    const provider1 = await this.prisma.provider.upsert({
      where: { tenantId_name: { tenantId, name: 'Tech Integration Solutions' } },
      update: {},
      create: {
        tenantId,
        name: 'Tech Integration Solutions',
        type: 'INTEGRATOR',
        contact: 'contact@tech-integration.fr',
        phone: '+33 1 23 45 67 89',
        notes: 'Intégrateur principal pour les projets réseau',
      },
    });
    providers.push(provider1);

    return providers;
  }
}
