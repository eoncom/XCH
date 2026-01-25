import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { NetboxService, NetboxSite, NetboxDevice, NetboxRack } from './netbox.service';
import { SiteStatus, AssetType, AssetStatus, RackType, RackStatus } from '@prisma/client';

interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

interface SyncReport {
  timestamp: Date;
  sites: SyncResult;
  devices: SyncResult;
  racks: SyncResult;
  duration: number;
}

@Injectable()
export class NetboxSyncService {
  private readonly logger = new Logger(NetboxSyncService.name);

  constructor(
    private readonly netboxService: NetboxService,
    private readonly prisma: PrismaService,
  ) {}

  // ============================================================
  // STATUS MAPPING
  // ============================================================

  private mapNetboxSiteStatus(status: string): SiteStatus {
    const mapping: Record<string, SiteStatus> = {
      planned: 'PREPARATION',
      staging: 'PREPARATION',
      active: 'ACTIVE',
      decommissioning: 'CLOSED',
      retired: 'CLOSED',
    };
    return mapping[status] || 'ACTIVE';
  }

  private mapNetboxDeviceStatus(status: string): AssetStatus {
    const mapping: Record<string, AssetStatus> = {
      offline: 'OUT_OF_SERVICE',
      active: 'IN_SERVICE',
      planned: 'STOCK',
      staged: 'IN_TRANSIT',
      failed: 'OUT_OF_SERVICE',
      inventory: 'STOCK',
      decommissioning: 'RETIRED',
    };
    return mapping[status] || 'IN_SERVICE';
  }

  private mapNetboxRackStatus(status: string): RackStatus {
    const mapping: Record<string, RackStatus> = {
      reserved: 'PREPARATION',
      available: 'IN_SERVICE',
      planned: 'PREPARATION',
      active: 'IN_SERVICE',
      deprecated: 'OUT_OF_SERVICE',
    };
    return mapping[status] || 'IN_SERVICE';
  }

  private mapDeviceRoleToAssetType(role: string): AssetType {
    const roleLower = role.toLowerCase();
    if (roleLower.includes('switch')) return 'SWITCH';
    if (roleLower.includes('firewall')) return 'FIREWALL';
    if (roleLower.includes('access') || roleLower.includes('wifi') || roleLower.includes('ap'))
      return 'ACCESS_POINT';
    if (roleLower.includes('server')) return 'SERVER';
    if (roleLower.includes('pdu') || roleLower.includes('power')) return 'PDU';
    if (roleLower.includes('patch') || roleLower.includes('panel')) return 'PATCH_PANEL';
    if (roleLower.includes('camera')) return 'CAMERA';
    if (roleLower.includes('printer')) return 'PRINTER';
    return 'OTHER';
  }

  // ============================================================
  // SYNC SITES
  // ============================================================

  async syncSitesFromNetbox(tenantId: string): Promise<SyncResult> {
    const result: SyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };

    if (!this.netboxService.isEnabled()) {
      result.errors.push('NetBox integration not enabled');
      return result;
    }

    try {
      let offset = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const response = await this.netboxService.getSites({ limit, offset });

        for (const nbSite of response.results) {
          try {
            await this.syncSingleSite(tenantId, nbSite, result);
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            result.errors.push(`Site ${nbSite.name}: ${errorMessage}`);
          }
        }

        hasMore = response.next !== null;
        offset += limit;
      }

      this.logger.log(
        `Sites sync complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`,
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Sync failed: ${errorMessage}`);
      this.logger.error('Sites sync failed', error);
    }

    return result;
  }

  private async syncSingleSite(
    tenantId: string,
    nbSite: NetboxSite,
    result: SyncResult,
  ): Promise<void> {
    // Check if external ref exists
    const existingRef = await this.prisma.externalRef.findFirst({
      where: {
        provider: 'netbox',
        externalId: nbSite.id.toString(),
        entityType: 'SITE',
      },
    });

    const siteData = {
      code: nbSite.slug.toUpperCase(),
      name: nbSite.name,
      status: this.mapNetboxSiteStatus(nbSite.status.value),
      address: nbSite.physical_address || '',
      city: nbSite.facility || '',
      country: 'France',
      notes: nbSite.description || nbSite.comments,
    };

    if (existingRef) {
      // Update existing site
      await this.prisma.site.update({
        where: { id: existingRef.entityId },
        data: siteData,
      });
      result.updated++;
    } else {
      // Check if site with same code already exists
      const existingSite = await this.prisma.site.findFirst({
        where: { tenantId, code: siteData.code },
      });

      if (existingSite) {
        // Link existing site to NetBox
        await this.prisma.externalRef.create({
          data: {
            entityType: 'SITE',
            entityId: existingSite.id,
            provider: 'netbox',
            externalId: nbSite.id.toString(),
            externalUrl: nbSite.url,
            metadata: { netbox_slug: nbSite.slug },
            lastSync: new Date(),
          },
        });
        result.skipped++;
      } else {
        // Create new site
        const newSite = await this.prisma.site.create({
          data: {
            tenantId,
            ...siteData,
          },
        });

        // Create external ref
        await this.prisma.externalRef.create({
          data: {
            entityType: 'SITE',
            entityId: newSite.id,
            provider: 'netbox',
            externalId: nbSite.id.toString(),
            externalUrl: nbSite.url,
            metadata: { netbox_slug: nbSite.slug },
            lastSync: new Date(),
          },
        });
        result.created++;
      }
    }
  }

  // ============================================================
  // SYNC DEVICES (ASSETS)
  // ============================================================

  async syncDevicesFromNetbox(tenantId: string): Promise<SyncResult> {
    const result: SyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };

    if (!this.netboxService.isEnabled()) {
      result.errors.push('NetBox integration not enabled');
      return result;
    }

    try {
      let offset = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const response = await this.netboxService.getDevices({ limit, offset });

        for (const nbDevice of response.results) {
          try {
            await this.syncSingleDevice(tenantId, nbDevice, result);
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            result.errors.push(`Device ${nbDevice.name}: ${errorMessage}`);
          }
        }

        hasMore = response.next !== null;
        offset += limit;
      }

      this.logger.log(
        `Devices sync complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`,
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Sync failed: ${errorMessage}`);
      this.logger.error('Devices sync failed', error);
    }

    return result;
  }

  private async syncSingleDevice(
    tenantId: string,
    nbDevice: NetboxDevice,
    result: SyncResult,
  ): Promise<void> {
    // Find linked XCH site
    const siteRef = await this.prisma.externalRef.findFirst({
      where: {
        provider: 'netbox',
        externalId: nbDevice.site.id.toString(),
        entityType: 'SITE',
      },
    });

    if (!siteRef) {
      result.errors.push(`Device ${nbDevice.name}: No linked site found`);
      return;
    }

    // Check if external ref exists
    const existingRef = await this.prisma.externalRef.findFirst({
      where: {
        provider: 'netbox',
        externalId: nbDevice.id.toString(),
        entityType: 'ASSET',
      },
    });

    const assetData = {
      type: this.mapDeviceRoleToAssetType(nbDevice.role.name),
      manufacturer: nbDevice.device_type.manufacturer.name,
      model: nbDevice.device_type.model,
      serialNumber: nbDevice.serial || null,
      inventoryTag: nbDevice.asset_tag || null,
      status: this.mapNetboxDeviceStatus(nbDevice.status.value),
      networkInfo: nbDevice.primary_ip4
        ? { ip: nbDevice.primary_ip4.address.split('/')[0] }
        : undefined,
    };

    if (existingRef) {
      // Update existing asset
      await this.prisma.asset.update({
        where: { id: existingRef.entityId },
        data: assetData,
      });
      result.updated++;
    } else {
      // Create new asset
      const newAsset = await this.prisma.asset.create({
        data: {
          tenantId,
          siteId: siteRef.entityId,
          ...assetData,
        },
      });

      // Create external ref
      await this.prisma.externalRef.create({
        data: {
          entityType: 'ASSET',
          entityId: newAsset.id,
          provider: 'netbox',
          externalId: nbDevice.id.toString(),
          externalUrl: nbDevice.url,
          metadata: { netbox_name: nbDevice.name },
          lastSync: new Date(),
        },
      });
      result.created++;
    }
  }

  // ============================================================
  // SYNC RACKS
  // ============================================================

  async syncRacksFromNetbox(tenantId: string): Promise<SyncResult> {
    const result: SyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };

    if (!this.netboxService.isEnabled()) {
      result.errors.push('NetBox integration not enabled');
      return result;
    }

    try {
      let offset = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const response = await this.netboxService.getRacks({ limit, offset });

        for (const nbRack of response.results) {
          try {
            await this.syncSingleRack(tenantId, nbRack, result);
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            result.errors.push(`Rack ${nbRack.name}: ${errorMessage}`);
          }
        }

        hasMore = response.next !== null;
        offset += limit;
      }

      this.logger.log(
        `Racks sync complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`,
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Sync failed: ${errorMessage}`);
      this.logger.error('Racks sync failed', error);
    }

    return result;
  }

  private async syncSingleRack(
    tenantId: string,
    nbRack: NetboxRack,
    result: SyncResult,
  ): Promise<void> {
    // Find linked XCH site
    const siteRef = await this.prisma.externalRef.findFirst({
      where: {
        provider: 'netbox',
        externalId: nbRack.site.id.toString(),
        entityType: 'SITE',
      },
    });

    if (!siteRef) {
      result.errors.push(`Rack ${nbRack.name}: No linked site found`);
      return;
    }

    // Check if existing rack with same name in site
    const existingRack = await this.prisma.rack.findFirst({
      where: {
        tenantId,
        siteId: siteRef.entityId,
        name: nbRack.name,
      },
    });

    const rackData = {
      name: nbRack.name,
      serialNumber: nbRack.serial || null,
      heightU: nbRack.u_height,
      rackType: 'FLOOR_STANDING' as RackType,
      status: this.mapNetboxRackStatus(nbRack.status.value),
      notes: nbRack.comments,
    };

    if (existingRack) {
      // Update existing rack
      await this.prisma.rack.update({
        where: { id: existingRack.id },
        data: rackData,
      });
      result.updated++;
    } else {
      // Create new rack
      await this.prisma.rack.create({
        data: {
          tenantId,
          siteId: siteRef.entityId,
          ...rackData,
        },
      });
      result.created++;
    }
  }

  // ============================================================
  // FULL SYNC
  // ============================================================

  async fullSync(tenantId: string): Promise<SyncReport> {
    const startTime = Date.now();

    this.logger.log(`Starting full NetBox sync for tenant ${tenantId}`);

    const sites = await this.syncSitesFromNetbox(tenantId);
    const devices = await this.syncDevicesFromNetbox(tenantId);
    const racks = await this.syncRacksFromNetbox(tenantId);

    const report: SyncReport = {
      timestamp: new Date(),
      sites,
      devices,
      racks,
      duration: Date.now() - startTime,
    };

    this.logger.log(`Full sync completed in ${report.duration}ms`);

    return report;
  }
}
