import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { NetBoxProviderService } from './providers/netbox.provider';
import { IntegrationMappingService } from './mapping/integration-mapping.service';
import { SyncNetBoxSitesDto, SyncNetBoxDevicesDto, MapAssetToNetBoxDto } from './dto/sync-netbox.dto';
import { CryptoService } from '../../common/crypto/crypto.service';

/**
 * IntegrationsService — NetBox-only after ADR-016.
 *
 * Native monitoring (modules/monitoring/) runs ICMP/HTTP/TCP probes via
 * BullMQ and computes Site.healthStatus through HealthAggregationService.
 */
@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private prisma: PrismaClient,
    private netboxProvider: NetBoxProviderService,
    private integrationMappingService: IntegrationMappingService,
    private crypto: CryptoService,
  ) {}

  // ==================== INTEGRATION CONFIG ====================

  /**
   * Reconfigure NetBox provider from tenant DB config (ADR-018: typed table).
   */
  private async ensureNetBoxConfigured(tenantId: string): Promise<void> {
    try {
      const integration = await this.prisma.tenantIntegrationConfig.findUnique({
        where: { tenantId },
      });
      // ADR-019 — netboxToken stored encrypted-at-rest. Decrypt before
      // handing it to the axios provider.
      const plainToken = this.crypto.decryptOrLegacy(integration?.netboxToken);
      if (integration?.netboxUrl && plainToken) {
        this.netboxProvider.reconfigure(integration.netboxUrl, plainToken);
      }
    } catch (error) {
      this.logger.warn('Failed to load NetBox config from DB', error);
    }
  }

  /**
   * Get integration config for a tenant (with masked secrets).
   */
  async getIntegrationConfig(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const integration = await this.prisma.tenantIntegrationConfig.findUnique({
      where: { tenantId },
    });

    const maskToken = (token?: string | null) => {
      if (!token) return '';
      if (token.length <= 4) return '****';
      return '****' + token.slice(-4);
    };

    // ADR-019 — decrypt to derive the UI hint from the plaintext (last
    // 4 chars of ciphertext would be meaningless to the user).
    const plainToken = this.crypto.decryptOrLegacy(integration?.netboxToken);

    return {
      netbox: {
        url: integration?.netboxUrl || '',
        tokenSet: !!plainToken,
        tokenHint: maskToken(plainToken),
      },
    };
  }

  /**
   * Update integration config for a tenant. Empty secrets are preserved
   * (not overwritten with empty strings).
   */
  async updateIntegrationConfig(tenantId: string, data: Record<string, any>) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const existing = await this.prisma.tenantIntegrationConfig.findUnique({
      where: { tenantId },
    });

    const nextUrl = data.netbox?.url ?? existing?.netboxUrl ?? '';
    // ADR-019 — empty/undefined token preserves the (already encrypted)
    // existing value; a new non-empty plaintext is enveloped before persist.
    const newTokenPlain =
      data.netbox?.token && data.netbox.token !== '' ? data.netbox.token : null;
    const persistedToken = newTokenPlain
      ? this.crypto.encryptIfPlain(newTokenPlain)
      : existing?.netboxToken ?? '';

    await this.prisma.tenantIntegrationConfig.upsert({
      where: { tenantId },
      create: { tenantId, netboxUrl: nextUrl, netboxToken: persistedToken ?? '' },
      update: { netboxUrl: nextUrl, netboxToken: persistedToken ?? '' },
    });

    // Use plaintext for runtime reconfigure (newly provided OR decrypted
    // from the existing envelope).
    const runtimeToken = newTokenPlain ?? this.crypto.decryptOrLegacy(existing?.netboxToken);
    if (nextUrl && runtimeToken) {
      this.netboxProvider.reconfigure(nextUrl, runtimeToken);
    }

    return this.getIntegrationConfig(tenantId);
  }

  /**
   * Test all integrations (NetBox only today).
   */
  async testAllConnections(_tenantId?: string) {
    const netboxResult = await this.netboxProvider.testConnection().catch((err) => ({
      success: false,
      message: err?.message || 'Test failed',
    }));
    return { netbox: netboxResult };
  }

  /**
   * Test specific provider connection.
   */
  async testConnection(provider: 'netbox', tenantId?: string) {
    if (tenantId) await this.ensureNetBoxConfigured(tenantId);
    if (provider === 'netbox') return this.netboxProvider.testConnection();
    throw new BadRequestException('Invalid provider');
  }

  /**
   * Get integration status.
   */
  async getStatus() {
    return {
      netbox: {
        name: this.netboxProvider.getName(),
        status: this.netboxProvider.getStatus(),
      },
    };
  }

  // ==================== NETBOX SYNC ====================

  async syncNetBoxSites(tenantId: string, syncDto: SyncNetBoxSitesDto) {
    const netboxSites = await this.netboxProvider.fetchSites();
    const results = {
      fetched: netboxSites.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const netboxSite of netboxSites) {
      try {
        const mappedData = await this.netboxProvider.mapSiteToXCH(netboxSite);

        const existingSite = await this.prisma.site.findFirst({
          where: {
            tenantId,
            externalRefs: { some: { externalId: mappedData.externalId, provider: 'netbox' } },
          },
        });

        if (existingSite) {
          if (syncDto.updateExisting) {
            await this.prisma.site.update({
              where: { id: existingSite.id },
              data: {
                name: mappedData.name,
                status: mappedData.status,
                address: mappedData.address,
              },
            });
            results.updated++;
          } else {
            results.skipped++;
          }
        } else if (syncDto.autoCreate) {
          const { externalId, externalSystem, metadata, ...siteData } = mappedData;
          const newSite = await this.prisma.site.create({
            data: { ...siteData, tenantId, healthStatus: 'UNKNOWN' },
          });
          await this.prisma.externalRef.create({
            data: {
              entityType: 'SITE',
              entityId: newSite.id,
              provider: 'netbox',
              externalId: String(externalId),
              metadata,
            },
          });
          results.created++;
        } else {
          results.skipped++;
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to sync NetBox site ${netboxSite.name}`, errorMessage);
        results.errors.push(`${netboxSite.name}: ${errorMessage}`);
      }
    }

    this.logger.log(`NetBox sites sync completed: ${JSON.stringify(results)}`);
    return results;
  }

  async syncNetBoxDevices(tenantId: string, syncDto: SyncNetBoxDevicesDto) {
    const site = await this.prisma.site.findFirst({
      where: { id: syncDto.siteId, tenantId },
      include: { externalRefs: { where: { provider: 'netbox' } } },
    });
    if (!site) throw new NotFoundException('Site not found');

    const netboxSiteId = syncDto.netboxSiteId || site.externalRefs[0]?.externalId;
    if (!netboxSiteId) {
      throw new BadRequestException(
        'No NetBox site mapping found. Please provide netboxSiteId or map the site first.',
      );
    }

    const netboxDevices = await this.netboxProvider.fetchDevicesForSite(parseInt(netboxSiteId));
    const results = {
      fetched: netboxDevices.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const netboxDevice of netboxDevices) {
      try {
        const mappedData = await this.netboxProvider.mapDeviceToXCH(netboxDevice);
        const existingAsset = await this.prisma.asset.findFirst({
          where: {
            tenantId,
            externalRefs: { some: { externalId: mappedData.externalId, provider: 'netbox' } },
          },
        });
        if (existingAsset) {
          results.skipped++;
        } else if (syncDto.autoCreate) {
          const { externalId, externalSystem, metadata, ...assetData } = mappedData;
          const newAsset = await this.prisma.asset.create({
            data: { ...assetData, tenantId, siteId: syncDto.siteId },
          });
          await this.prisma.externalRef.create({
            data: {
              entityType: 'ASSET',
              entityId: newAsset.id,
              provider: 'netbox',
              externalId: String(externalId),
              metadata,
            },
          });
          results.created++;
        } else {
          results.skipped++;
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to sync NetBox device ${netboxDevice.name}`, errorMessage);
        results.errors.push(`${netboxDevice.name}: ${errorMessage}`);
      }
    }

    this.logger.log(`NetBox devices sync completed: ${JSON.stringify(results)}`);
    return results;
  }

  async mapAssetToNetBox(tenantId: string, mapDto: MapAssetToNetBoxDto) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: mapDto.assetId, tenantId },
    });
    if (!asset) throw new NotFoundException('Asset not found');

    let netboxDevice;
    if (mapDto.netboxDeviceId) {
      const devices = await this.netboxProvider.fetchDevicesForSite(0);
      netboxDevice = devices.find((d) => d.id.toString() === mapDto.netboxDeviceId);
    } else if (asset.serialNumber) {
      netboxDevice = await this.netboxProvider.searchDeviceBySerial(asset.serialNumber);
    } else {
      throw new BadRequestException('Asset has no serial number and no netboxDeviceId provided');
    }
    if (!netboxDevice) throw new NotFoundException('NetBox device not found');

    const existingRef = await this.prisma.externalRef.findFirst({
      where: { entityType: 'ASSET', entityId: asset.id, provider: 'netbox' },
    });

    const refData = {
      externalId: netboxDevice.id.toString(),
      metadata: {
        netbox_url: netboxDevice.url,
        device_role: netboxDevice.device_role?.name,
        platform: netboxDevice.platform?.name,
      },
    };
    if (existingRef) {
      await this.prisma.externalRef.update({ where: { id: existingRef.id }, data: refData });
    } else {
      await this.prisma.externalRef.create({
        data: {
          entityType: 'ASSET',
          entityId: asset.id,
          provider: 'netbox',
          ...refData,
        },
      });
    }

    this.logger.log(`Asset ${asset.id} mapped to NetBox device ${netboxDevice.id}`);
    return {
      message: 'Asset mapped successfully',
      netboxDevice: { id: netboxDevice.id, name: netboxDevice.name, url: netboxDevice.url },
    };
  }

  // ==================== NETBOX CONTACTS ====================

  async getNetBoxContacts(params?: {
    limit?: number;
    offset?: number;
    name?: string;
    group_id?: number;
  }) {
    return this.netboxProvider.fetchContacts(params);
  }

  async getNetBoxContactGroups(params?: { limit?: number; offset?: number }) {
    return this.netboxProvider.fetchContactGroups(params);
  }

  async syncNetBoxContacts(tenantId: string) {
    const contactsResponse = await this.netboxProvider.fetchContacts({ limit: 1000 });
    const netboxContacts = contactsResponse.results || [];
    const results = {
      fetched: netboxContacts.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const netboxContact of netboxContacts) {
      try {
        const mappedData = await this.netboxProvider.mapContactToXCH(netboxContact);
        const existingContact = await this.prisma.contact.findFirst({
          where: {
            tenantId,
            externalRefs: { some: { externalId: mappedData.externalId, provider: 'netbox' } },
          },
        });

        if (existingContact) {
          await this.prisma.contact.update({
            where: { id: existingContact.id },
            data: {
              name: mappedData.name,
              email: mappedData.email,
              phone: mappedData.phone,
              address: mappedData.address,
              role: mappedData.role,
              notes: mappedData.notes,
            },
          });
          results.updated++;
        } else {
          let typeId: string | null = null;
          if (netboxContact.group?.id) {
            const mapping = await this.integrationMappingService.getMappingByExternalId(
              tenantId,
              'netbox',
              'contact_group',
              netboxContact.group.id.toString(),
            );
            if (mapping) typeId = mapping.targetId;
          }
          if (!typeId) {
            const defaultType = await this.prisma.contactType.findFirst({
              where: { tenantId, isSystem: true },
              orderBy: { createdAt: 'asc' },
            });
            if (defaultType) typeId = defaultType.id;
          }
          if (!typeId) {
            results.errors.push(
              `${netboxContact.name}: No ContactType found (create one or map contact groups)`,
            );
            continue;
          }
          const { externalId, externalSystem, metadata, ...contactData } = mappedData;
          const newContact = await this.prisma.contact.create({
            data: { ...contactData, tenantId, typeId },
          });
          await this.prisma.externalRef.create({
            data: {
              entityType: 'CONTACT',
              entityId: newContact.id,
              provider: 'netbox',
              externalId: String(externalId),
              metadata,
            },
          });
          results.created++;
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to sync NetBox contact ${netboxContact.name}`, errorMessage);
        results.errors.push(`${netboxContact.name}: ${errorMessage}`);
      }
    }

    this.logger.log(`NetBox contacts sync completed: ${JSON.stringify(results)}`);
    return results;
  }
}
