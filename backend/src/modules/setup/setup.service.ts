import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as net from 'net';
import { SetupDto } from './dto/setup.dto';
import { SeedService } from '../seed/seed.service';

interface ServiceHealth {
  name: string;
  status: 'ok' | 'error';
  message?: string;
}

export interface SetupStatus {
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

    // PostgreSQL
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      services.push({ name: 'PostgreSQL', status: 'ok' });
    } catch {
      services.push({ name: 'PostgreSQL', status: 'error', message: 'Cannot connect to database' });
    }

    // Redis (TCP ping)
    const redisHost = process.env.REDIS_HOST || 'redis';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
    services.push(await this.probeTcp('Redis', redisHost, redisPort));

    // MinIO (HTTP health endpoint)
    const minioEndpoint = process.env.MINIO_ENDPOINT || 'minio';
    const minioPort = parseInt(process.env.MINIO_PORT || '9000', 10);
    services.push(await this.probeMinio('MinIO', minioEndpoint, minioPort));

    // Setup needed?
    const tenantCount = await this.prisma.tenant.count();
    const needsSetup = tenantCount === 0;

    return { needsSetup, services };
  }

  private probeTcp(name: string, host: string, port: number, timeoutMs = 1500): Promise<ServiceHealth> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const done = (ok: boolean, msg?: string) => {
        socket.destroy();
        resolve(ok ? { name, status: 'ok' } : { name, status: 'error', message: msg });
      };
      socket.setTimeout(timeoutMs);
      socket.once('connect', () => done(true));
      socket.once('timeout', () => done(false, `Timeout connecting to ${host}:${port}`));
      socket.once('error', (err: any) => done(false, err?.code || err?.message || 'connection error'));
      socket.connect(port, host);
    });
  }

  private async probeMinio(name: string, host: string, port: number): Promise<ServiceHealth> {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(`http://${host}:${port}/minio/health/live`, { signal: controller.signal });
      clearTimeout(t);
      return res.ok ? { name, status: 'ok' } : { name, status: 'error', message: `HTTP ${res.status}` };
    } catch (err: any) {
      return { name, status: 'error', message: err?.name === 'AbortError' ? 'Timeout' : (err?.message || 'fetch failed') };
    }
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
            monitoring: true,
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
        isSuperAdmin: true,
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
