import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { SetupDto } from './dto/setup.dto';
import { SeedService } from '../seed/seed.service';

interface ServiceHealth {
  name: string;
  status: 'ok' | 'error';
  message?: string;
}

interface SetupStatus {
  needsSetup: boolean;
  services: ServiceHealth[];
}

@Injectable()
export class SetupService {
  constructor(
    private prisma: PrismaClient,
    private seedService: SeedService,
  ) {}

  /**
   * Check if setup is needed (no tenant exists).
   * Also checks health of required services.
   */
  async getStatus(): Promise<SetupStatus> {
    const services: ServiceHealth[] = [];

    // Check PostgreSQL
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      services.push({ name: 'PostgreSQL', status: 'ok' });
    } catch (e) {
      services.push({ name: 'PostgreSQL', status: 'error', message: 'Cannot connect to database' });
    }

    // Check if any tenant exists
    const tenantCount = await this.prisma.tenant.count();
    const needsSetup = tenantCount === 0;

    return { needsSetup, services };
  }

  /**
   * Initialize the application: create tenant, admin user, and optionally load demo data.
   * Can only run once (when no tenant exists).
   */
  async initialize(dto: SetupDto) {
    // Check if already initialized
    const tenantCount = await this.prisma.tenant.count();
    if (tenantCount > 0) {
      throw new ConflictException('Application is already configured. Setup can only run once.');
    }

    // Check subdomain uniqueness
    const existing = await this.prisma.tenant.findUnique({
      where: { subdomain: dto.subdomain },
    });
    if (existing) {
      throw new ConflictException(`Subdomain "${dto.subdomain}" is already taken`);
    }

    // Create tenant
    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.organizationName,
        subdomain: dto.subdomain,
        logoUrl: dto.logoUrl || null,
        primaryColor: dto.primaryColor || '#0070f3',
        status: 'ACTIVE',
        config: {
          domain: dto.subdomain,
          timezone: dto.timezone || 'Europe/Paris',
          language: dto.language || 'Français',
          modules: {
            sites: true,
            assets: true,
            racks: true,
            tasks: true,
            floor_plans: true,
            contacts: true,
            integrations_netbox: true,
            integrations_monitoring: true,
            qr_codes: true,
          },
        },
      },
    });

    // Create admin user
    const passwordHash = await bcrypt.hash(dto.adminPassword, 10);
    const adminUser = await this.prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: dto.adminEmail,
        passwordHash,
        name: dto.adminName,
        phone: dto.adminPhone || null,
        role: 'ADMIN',
        active: true,
        authProvider: 'local',
      },
    });

    // Optionally load demo data
    let demoStats = null;
    if (dto.loadDemoData) {
      try {
        demoStats = await this.seedService.loadDemo(tenant.id);
      } catch (e) {
        // Non-fatal: demo data loading failure shouldn't block setup
        console.error('Failed to load demo data:', e);
        demoStats = { error: 'Failed to load demo data' };
      }
    }

    return {
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
      },
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
      },
      demoData: demoStats,
    };
  }

  /**
   * Generate cryptographically secure random secrets.
   */
  generateSecrets() {
    return {
      jwtSecret: crypto.randomBytes(32).toString('hex'),
      cookieSecret: crypto.randomBytes(16).toString('hex'),
      minioSecretKey: crypto.randomBytes(16).toString('hex'),
      postgresPassword: crypto.randomBytes(12).toString('hex'),
    };
  }
}
