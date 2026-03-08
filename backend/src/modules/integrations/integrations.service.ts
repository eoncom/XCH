import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { NetBoxProviderService } from './providers/netbox.provider';
import { HealthStatus } from '@prisma/client';
import { MonitoringProviderFactory } from './providers/monitoring-provider.factory';
import { MonitoringProvider } from './interfaces/integration-provider.interface';
import { HealthAggregationService } from './health-aggregation.service';
import { IntegrationMappingService } from './mapping/integration-mapping.service';
import { SyncNetBoxSitesDto, SyncNetBoxDevicesDto, MapAssetToNetBoxDto } from './dto/sync-netbox.dto';
import { normalizeConnectivity } from '../../common/utils/connectivity-migration';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private prisma: PrismaClient,
    private netboxProvider: NetBoxProviderService,
    private monitoringFactory: MonitoringProviderFactory,
    private healthAggregation: HealthAggregationService,
    private integrationMappingService: IntegrationMappingService,
  ) {}

  // ==================== INTEGRATION CONFIG ====================

  /**
   * Load integration config from tenant DB and reconfigure providers.
   * Returns the tenant config for use by callers that need it.
   */
  private async ensureProvidersConfigured(tenantId: string): Promise<Record<string, any> | null> {
    try {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) return null;
      const config = tenant.config as Record<string, any> | null;
      const integrations = config?.integrations;
      if (!integrations) return config;

      // Always reconfigure NetBox from DB config
      if (integrations.netbox?.url && integrations.netbox?.token) {
        this.netboxProvider.reconfigure(integrations.netbox.url, integrations.netbox.token);
      }

      // Reconfigure monitoring provider from DB config (new or legacy format)
      const monitoringConfig = integrations.monitoring;
      if (monitoringConfig?.type && monitoringConfig?.url) {
        const provider = this.monitoringFactory.getProvider(monitoringConfig.type);
        this.logger.log(`Reconfiguring ${monitoringConfig.type} provider from DB config: ${monitoringConfig.url}`);
        provider.reconfigure({
          url: monitoringConfig.url,
          apiKey: monitoringConfig.apiKey,
          username: monitoringConfig.username,
          password: monitoringConfig.password,
        });
      } else if (integrations.uptimeKuma?.url) {
        // Legacy format fallback
        this.logger.log(`Reconfiguring Uptime Kuma from legacy DB config: ${integrations.uptimeKuma.url}`);
        const kumaProvider = this.monitoringFactory.getProvider('uptime_kuma');
        kumaProvider.reconfigure({
          url: integrations.uptimeKuma.url,
          username: integrations.uptimeKuma.username,
          password: integrations.uptimeKuma.password,
        });
      } else {
        this.logger.log('No monitoring provider URL in tenant DB config');
      }

      return config;
    } catch (error) {
      this.logger.warn('Failed to load integration config from DB', error);
      return null;
    }
  }

  /**
   * Get the active monitoring provider for a tenant (loads config + resolves provider)
   */
  private async getMonitoringProvider(tenantId: string): Promise<MonitoringProvider | null> {
    const config = await this.ensureProvidersConfigured(tenantId);
    return this.monitoringFactory.getActiveProvider(config);
  }

  /**
   * Get integration config for a tenant (with masked secrets)
   */
  async getIntegrationConfig(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const config = tenant.config as Record<string, any> | null;
    const integrations = config?.integrations || {};

    const maskToken = (token?: string) => {
      if (!token) return '';
      if (token.length <= 4) return '****';
      return '****' + token.slice(-4);
    };

    // Build monitoring config from new format or legacy
    const monitoringConfig = integrations.monitoring || {};
    const legacyKuma = integrations.uptimeKuma || {};
    const monitoringType = monitoringConfig.type || (legacyKuma.url ? 'uptime_kuma' : '');
    const monitoringUrl = monitoringConfig.url || legacyKuma.url || '';

    return {
      netbox: {
        url: integrations.netbox?.url || '',
        tokenSet: !!integrations.netbox?.token,
        tokenHint: maskToken(integrations.netbox?.token),
      },
      monitoring: {
        type: monitoringType,
        url: monitoringUrl,
        username: monitoringConfig.username || legacyKuma.username || '',
        apiKeySet: !!monitoringConfig.apiKey,
        apiKeyHint: maskToken(monitoringConfig.apiKey),
        passwordSet: !!(monitoringConfig.password || legacyKuma.password),
        passwordHint: maskToken(monitoringConfig.password || legacyKuma.password),
        webhookSecret: monitoringConfig.webhookSecret ? '****' : '',
        webhookEnabled: !!monitoringConfig.webhookEnabled,
      },
      // Legacy field kept for backward compat with existing frontend
      uptimeKuma: {
        url: legacyKuma.url || monitoringUrl || '',
        username: legacyKuma.username || monitoringConfig.username || '',
        passwordSet: !!(legacyKuma.password || monitoringConfig.password),
        passwordHint: maskToken(legacyKuma.password || monitoringConfig.password),
      },
    };
  }

  /**
   * Update integration config for a tenant
   * Empty secrets are preserved (not overwritten)
   */
  async updateIntegrationConfig(tenantId: string, data: Record<string, any>) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const config = (tenant.config as Record<string, any>) || {};
    const existing = config.integrations || {};

    const updatedIntegrations: Record<string, any> = { ...existing };

    // Update NetBox config
    if (data.netbox) {
      updatedIntegrations.netbox = {
        url: data.netbox.url ?? existing.netbox?.url ?? '',
        // Only update token if a non-empty value is provided
        token: data.netbox.token || existing.netbox?.token || '',
      };

      // Reconfigure provider immediately
      if (updatedIntegrations.netbox.url && updatedIntegrations.netbox.token) {
        this.netboxProvider.reconfigure(updatedIntegrations.netbox.url, updatedIntegrations.netbox.token);
      }
    }

    // Update monitoring config (new generic format)
    if (data.monitoring) {
      updatedIntegrations.monitoring = {
        type: data.monitoring.type ?? existing.monitoring?.type ?? '',
        url: data.monitoring.url ?? existing.monitoring?.url ?? '',
        username: data.monitoring.username ?? existing.monitoring?.username ?? '',
        apiKey: data.monitoring.apiKey || existing.monitoring?.apiKey || '',
        password: data.monitoring.password || existing.monitoring?.password || '',
        webhookSecret: data.monitoring.webhookSecret || existing.monitoring?.webhookSecret || '',
        webhookEnabled: data.monitoring.webhookEnabled ?? existing.monitoring?.webhookEnabled ?? false,
      };

      // Reconfigure provider immediately
      const mc = updatedIntegrations.monitoring;
      if (mc.type && mc.url) {
        const provider = this.monitoringFactory.getProvider(mc.type);
        provider.reconfigure({
          url: mc.url,
          apiKey: mc.apiKey,
          username: mc.username,
          password: mc.password,
        });
      }

      // Also update legacy uptimeKuma field for backward compat
      if (mc.type === 'uptime_kuma') {
        updatedIntegrations.uptimeKuma = {
          url: mc.url,
          username: mc.username,
          password: mc.password,
        };
      }
    }

    // Legacy: Update Uptime Kuma config if sent directly (backward compat)
    if (data.uptimeKuma && !data.monitoring) {
      updatedIntegrations.uptimeKuma = {
        url: data.uptimeKuma.url ?? existing.uptimeKuma?.url ?? '',
        username: data.uptimeKuma.username ?? existing.uptimeKuma?.username ?? '',
        password: data.uptimeKuma.password || existing.uptimeKuma?.password || '',
      };

      // Also set new monitoring format
      updatedIntegrations.monitoring = {
        type: 'uptime_kuma',
        url: updatedIntegrations.uptimeKuma.url,
        username: updatedIntegrations.uptimeKuma.username,
        password: updatedIntegrations.uptimeKuma.password,
      };

      // Reconfigure provider immediately
      if (updatedIntegrations.uptimeKuma.url) {
        const provider = this.monitoringFactory.getProvider('uptime_kuma');
        provider.reconfigure({
          url: updatedIntegrations.uptimeKuma.url,
          username: updatedIntegrations.uptimeKuma.username,
          password: updatedIntegrations.uptimeKuma.password,
        });
      }
    }

    const updatedConfig = { ...config, integrations: updatedIntegrations };

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { config: updatedConfig },
    });

    return this.getIntegrationConfig(tenantId);
  }

  /**
   * Test all integrations connections
   */
  async testAllConnections(tenantId?: string) {
    const monitoringProvider = tenantId
      ? await this.getMonitoringProvider(tenantId)
      : this.monitoringFactory.getActiveProvider(null);

    const tests: Promise<any>[] = [this.netboxProvider.testConnection()];
    if (monitoringProvider) {
      tests.push(monitoringProvider.testConnection());
    }

    const results = await Promise.allSettled(tests);

    return {
      netbox: results[0].status === 'fulfilled' ? results[0].value : { success: false, message: 'Test failed' },
      monitoring: results[1]
        ? (results[1].status === 'fulfilled' ? results[1].value : { success: false, message: 'Test failed' })
        : { success: false, message: 'No monitoring provider configured' },
    };
  }

  /**
   * Test specific provider connection
   * If tenantId is provided, loads DB config first
   */
  async testConnection(provider: 'netbox' | 'uptime_kuma' | 'gatus' | 'monitoring', tenantId?: string) {
    if (tenantId) {
      await this.ensureProvidersConfigured(tenantId);
    }

    if (provider === 'netbox') {
      return await this.netboxProvider.testConnection();
    } else if (provider === 'uptime_kuma' || provider === 'gatus') {
      const monitoringProvider = this.monitoringFactory.getProvider(provider);
      return await monitoringProvider.testConnection();
    } else if (provider === 'monitoring') {
      // Test the currently active monitoring provider
      const activeProvider = tenantId
        ? await this.getMonitoringProvider(tenantId)
        : null;
      if (!activeProvider) {
        return { success: false, message: 'No monitoring provider configured' };
      }
      return await activeProvider.testConnection();
    } else {
      throw new BadRequestException('Invalid provider');
    }
  }

  /**
   * Get integration status
   */
  async getStatus(tenantId?: string) {
    const kumaProvider = this.monitoringFactory.getProvider('uptime_kuma');
    const gatusProvider = this.monitoringFactory.getProvider('gatus');

    return {
      netbox: {
        name: this.netboxProvider.getName(),
        status: this.netboxProvider.getStatus(),
      },
      monitoring: {
        uptimeKuma: {
          name: kumaProvider.getName(),
          status: kumaProvider.getStatus(),
          enabled: kumaProvider.isEnabled(),
        },
        gatus: {
          name: gatusProvider.getName(),
          status: gatusProvider.getStatus(),
          enabled: gatusProvider.isEnabled(),
        },
      },
      // Legacy field
      uptimeKuma: {
        name: kumaProvider.getName(),
        status: kumaProvider.getStatus(),
      },
    };
  }

  // ==================== NETBOX SYNC ====================

  /**
   * Sync sites from NetBox to XCH
   */
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

        // Check if site already exists (by externalId)
        const existingSite = await this.prisma.site.findFirst({
          where: {
            tenantId,
            externalRefs: {
              some: {
                externalId: mappedData.externalId,
                provider: 'netbox',
              },
            },
          },
        });

        if (existingSite) {
          if (syncDto.updateExisting) {
            // Update site metadata
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
          // Create new site
          const { externalId, externalSystem, metadata, ...siteData } = mappedData;

          const newSite = await this.prisma.site.create({
            data: {
              ...siteData,
              tenantId,
              healthStatus: 'UNKNOWN',
            },
          });

          // Create external reference with metadata
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

  /**
   * Sync devices from NetBox for a specific site
   */
  async syncNetBoxDevices(tenantId: string, syncDto: SyncNetBoxDevicesDto) {
    // Verify XCH site exists
    const site = await this.prisma.site.findFirst({
      where: { id: syncDto.siteId, tenantId },
      include: {
        externalRefs: {
          where: { provider: 'netbox' },
        },
      },
    });

    if (!site) {
      throw new NotFoundException('Site not found');
    }

    // Get NetBox site ID from external refs or use provided
    const netboxSiteId =
      syncDto.netboxSiteId || site.externalRefs[0]?.externalId;

    if (!netboxSiteId) {
      throw new BadRequestException(
        'No NetBox site mapping found. Please provide netboxSiteId or map the site first.',
      );
    }

    const netboxDevices = await this.netboxProvider.fetchDevicesForSite(
      parseInt(netboxSiteId),
    );

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

        // Check if asset already exists (by externalId)
        const existingAsset = await this.prisma.asset.findFirst({
          where: {
            tenantId,
            externalRefs: {
              some: {
                externalId: mappedData.externalId,
                provider: 'netbox',
              },
            },
          },
        });

        if (existingAsset) {
          results.skipped++;
        } else if (syncDto.autoCreate) {
          // Create new asset
          const { externalId, externalSystem, metadata, ...assetData } = mappedData;

          const newAsset = await this.prisma.asset.create({
            data: {
              ...assetData,
              tenantId,
              siteId: syncDto.siteId,
            },
          });

          // Create external reference with metadata
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
        this.logger.error(
          `Failed to sync NetBox device ${netboxDevice.name}`,
          errorMessage,
        );
        results.errors.push(`${netboxDevice.name}: ${errorMessage}`);
      }
    }

    this.logger.log(`NetBox devices sync completed: ${JSON.stringify(results)}`);
    return results;
  }

  /**
   * Manually map XCH asset to NetBox device (by serial number or manual ID)
   */
  async mapAssetToNetBox(tenantId: string, mapDto: MapAssetToNetBoxDto) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: mapDto.assetId, tenantId },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    let netboxDevice;

    if (mapDto.netboxDeviceId) {
      // Manual mapping by ID (fetch device to validate)
      const devices = await this.netboxProvider.fetchDevicesForSite(0); // Fetch all
      netboxDevice = devices.find((d) => d.id.toString() === mapDto.netboxDeviceId);
    } else if (asset.serialNumber) {
      // Auto-mapping by serial number
      netboxDevice = await this.netboxProvider.searchDeviceBySerial(asset.serialNumber);
    } else {
      throw new BadRequestException(
        'Asset has no serial number and no netboxDeviceId provided',
      );
    }

    if (!netboxDevice) {
      throw new NotFoundException('NetBox device not found');
    }

    // Create or update external reference
    const existingRef = await this.prisma.externalRef.findFirst({
      where: {
        entityType: 'ASSET',
        entityId: asset.id,
        provider: 'netbox',
      },
    });

    if (existingRef) {
      await this.prisma.externalRef.update({
        where: { id: existingRef.id },
        data: {
          externalId: netboxDevice.id.toString(),
          metadata: {
            netbox_url: netboxDevice.url,
            device_role: netboxDevice.device_role?.name,
            platform: netboxDevice.platform?.name,
          },
        },
      });
    } else {
      await this.prisma.externalRef.create({
        data: {
          entityType: 'ASSET',
          entityId: asset.id,
          provider: 'netbox',
          externalId: netboxDevice.id.toString(),
          metadata: {
            netbox_url: netboxDevice.url,
            device_role: netboxDevice.device_role?.name,
            platform: netboxDevice.platform?.name,
          },
        },
      });
    }

    this.logger.log(`Asset ${asset.id} mapped to NetBox device ${netboxDevice.id}`);
    return {
      message: 'Asset mapped successfully',
      netboxDevice: {
        id: netboxDevice.id,
        name: netboxDevice.name,
        url: netboxDevice.url,
      },
    };
  }

  // ==================== MONITORING ====================

  /**
   * Get all monitors from the active monitoring provider
   */
  async getMonitors(tenantId?: string) {
    const provider = tenantId
      ? await this.getMonitoringProvider(tenantId)
      : null;

    if (!provider) {
      this.logger.warn('No monitoring provider configured');
      return {
        monitors: [],
        status: 'not_configured' as const,
        message: 'Monitoring non configuré. Ajoutez la configuration dans Paramètres > Intégrations.',
      };
    }

    const isEnabled = provider.isEnabled();
    const providerStatus = (provider as any).getDetailedStatus?.() || {
      status: provider.getStatus(),
      lastError: null,
      lastFetch: null,
    };

    this.logger.log(`getMonitors: provider=${provider.getName()}, enabled=${isEnabled}, status=${providerStatus.status}`);

    if (!isEnabled) {
      return {
        monitors: [],
        status: 'not_configured' as const,
        provider: provider.getName(),
        message: `${provider.getName()} non configuré. Ajoutez l'URL dans Paramètres > Intégrations.`,
      };
    }

    const monitors = await provider.fetchMonitors();
    this.logger.log(`getMonitors: returned ${monitors.length} monitors from ${provider.getName()}`);

    if (providerStatus.status === 'error') {
      return {
        monitors,
        status: 'error' as const,
        provider: provider.getName(),
        message: providerStatus.lastError || `Erreur de connexion à ${provider.getName()}`,
        lastFetch: providerStatus.lastFetch,
      };
    }

    return {
      monitors,
      status: 'connected' as const,
      provider: provider.getName(),
      lastFetch: providerStatus.lastFetch,
    };
  }

  /**
   * @deprecated Use getMonitors() instead. Kept for backward compatibility.
   */
  async getUptimeKumaMonitors(tenantId?: string) {
    return this.getMonitors(tenantId);
  }

  /**
   * Update site health status from monitoring provider
   */
  async updateSiteHealthFromMonitor(siteId: string, tenantId: string, monitorIdentifier: string) {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, tenantId },
    });

    if (!site) {
      throw new NotFoundException('Site not found');
    }

    const provider = await this.getMonitoringProvider(tenantId);
    if (!provider) {
      throw new BadRequestException('No monitoring provider configured');
    }

    const monitorStatus = await provider.getMonitorStatus(monitorIdentifier);

    if (!monitorStatus) {
      throw new NotFoundException(`Monitor ${monitorIdentifier} not found in ${provider.getName()}`);
    }

    const healthStatus = provider.mapToHealthStatus(monitorStatus.status);

    await this.prisma.site.update({
      where: { id: siteId },
      data: {
        healthStatus: healthStatus as HealthStatus,
        lastHealthCheck: new Date(),
        connectivity: {
          ...((site.connectivity as any) || {}),
          monitoring: {
            source: 'monitoring',
            monitor: monitorIdentifier,
            lastCheck: monitorStatus.lastCheck,
            uptime: monitorStatus.uptime,
            responseTime: monitorStatus.responseTime,
          },
        },
      },
    });

    this.logger.log(`Site ${siteId} health updated to ${healthStatus} from ${provider.getName()}`);
    return {
      siteId,
      healthStatus: healthStatus as HealthStatus,
      monitor: monitorStatus,
    };
  }

  /**
   * Map an Uptime Kuma monitor to a site (or unmap)
   * Stores the monitor name in site.connectivity.monitoring.monitor
   */
  async mapMonitorToSite(
    siteId: string,
    tenantId: string,
    monitorName: string | null,
  ) {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, tenantId },
    });

    if (!site) {
      throw new NotFoundException('Site not found');
    }

    const connectivity = (site.connectivity as Record<string, any>) || {};

    if (monitorName) {
      // Assign monitor to site
      connectivity.monitoring = {
        ...(connectivity.monitoring || {}),
        source: 'monitoring',
        monitor: monitorName,
      };
    } else {
      // Unmap: remove monitoring
      delete connectivity.monitoring;
    }

    await this.prisma.site.update({
      where: { id: siteId },
      data: { connectivity },
    });

    this.logger.log(
      monitorName
        ? `Monitor "${monitorName}" mapped to site ${siteId}`
        : `Monitor unmapped from site ${siteId}`,
    );

    return { siteId, monitorName, mapped: !!monitorName };
  }

  /**
   * Get all monitor-to-site mappings (reverse lookup)
   */
  async getMonitorMappings(tenantId: string) {
    const sites = await this.prisma.site.findMany({
      where: { tenantId },
      select: { id: true, name: true, connectivity: true },
    });

    const mappings: Record<string, { siteId: string; siteName: string }> = {};

    for (const site of sites) {
      const monitorName = (site.connectivity as any)?.monitoring?.monitor;
      if (monitorName) {
        mappings[monitorName] = { siteId: site.id, siteName: site.name };
      }
    }

    return mappings;
  }

  /**
   * Sync all sites health from the active monitoring provider (intelligent aggregation)
   * 1. Fetch ALL monitors from the active provider in 1 call
   * 2. For each site: normalize connectivity V2, collect monitorNames from links+sdwan+assets
   * 3. Resolve each monitorName → status from fetched monitors
   * 4. Update cached statuses in connectivity and asset networkInfo
   * 5. Calculate intelligent health status → store healthStatus + healthBreakdown
   */
  async syncAllSitesHealth(tenantId: string) {
    const provider = await this.getMonitoringProvider(tenantId);
    if (!provider) {
      this.logger.warn('No monitoring provider configured, skipping health sync');
      return { total: 0, updated: 0, skipped: 0, errors: [] };
    }

    // 1. Fetch all monitors in a single call
    const allMonitors = await provider.fetchMonitors();
    const monitorStatusMap = this.healthAggregation.buildMonitorStatusMap(allMonitors);

    this.logger.log(`Fetched ${allMonitors.length} monitors for health sync`);

    // 2. Get all sites with their assets
    const sites = await this.prisma.site.findMany({
      where: { tenantId },
      include: {
        assets: {
          select: { id: true, name: true, type: true, networkInfo: true },
        },
      },
    });

    const results = {
      total: sites.length,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const site of sites) {
      try {
        const v2Connectivity = normalizeConnectivity(site.connectivity);

        // Check if there's any monitoring configured
        const hasLinkMonitors = v2Connectivity.links.some(l => l.monitorName);
        const hasSdwanMonitor = v2Connectivity.sdwan?.monitorName;
        const hasAssetMonitors = site.assets.some(
          a => (a.networkInfo as any)?.monitorName,
        );

        if (!hasLinkMonitors && !hasSdwanMonitor && !hasAssetMonitors) {
          results.skipped++;
          continue;
        }

        // 3. Update cached statuses in connectivity
        const updatedConnectivity = this.healthAggregation.updateCachedStatuses(
          site.connectivity,
          monitorStatusMap,
        );

        // 4. Update cached statuses in monitored assets
        for (const asset of site.assets) {
          const networkInfo = asset.networkInfo as any;
          if (networkInfo?.monitorName) {
            const updatedNetworkInfo = this.healthAggregation.updateAssetMonitorStatus(
              networkInfo,
              monitorStatusMap,
            );
            if (updatedNetworkInfo !== networkInfo) {
              await this.prisma.asset.update({
                where: { id: asset.id },
                data: { networkInfo: updatedNetworkInfo },
              });
            }
          }
        }

        // 5. Calculate intelligent health
        const assetsForHealth = site.assets.map((a) => ({
          id: a.id,
          name: a.name ?? undefined,
          type: a.type as string,
          networkInfo: a.networkInfo as any,
        }));
        const breakdown = this.healthAggregation.calculateSiteHealth(
          updatedConnectivity,
          assetsForHealth,
          monitorStatusMap,
        );

        // 6. Save health status + breakdown + updated connectivity
        const metadata = (site.metadata as Record<string, any>) || {};
        metadata.healthBreakdown = breakdown;

        await this.prisma.site.update({
          where: { id: site.id },
          data: {
            healthStatus: breakdown.overall as HealthStatus,
            lastHealthCheck: new Date(),
            connectivity: updatedConnectivity,
            metadata,
          },
        });

        results.updated++;
        this.logger.debug(`Site ${site.name}: health=${breakdown.overall}, components=${breakdown.components.length}`);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to update health for site ${site.id}`, errorMessage);
        results.errors.push(`${site.name}: ${errorMessage}`);
      }
    }

    this.logger.log(`Sites health sync V2 completed: ${JSON.stringify(results)}`);
    return results;
  }

  /**
   * Map an Uptime Kuma monitor to a specific asset
   * Stores monitor name in asset.networkInfo.monitorName
   */
  async mapMonitorToAsset(
    assetId: string,
    tenantId: string,
    monitorName: string | null,
  ) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    const networkInfo = (asset.networkInfo as Record<string, any>) || {};

    if (monitorName) {
      networkInfo.monitorName = monitorName;
    } else {
      delete networkInfo.monitorName;
      delete networkInfo.monitorStatus;
      delete networkInfo.lastHealthCheck;
    }

    await this.prisma.asset.update({
      where: { id: assetId },
      data: { networkInfo },
    });

    this.logger.log(
      monitorName
        ? `Monitor "${monitorName}" mapped to asset ${assetId}`
        : `Monitor unmapped from asset ${assetId}`,
    );

    return { assetId, monitorName, mapped: !!monitorName };
  }

  /**
   * Get health breakdown for a site
   */
  async getSiteHealthBreakdown(siteId: string, tenantId: string) {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, tenantId },
    });

    if (!site) {
      throw new NotFoundException('Site not found');
    }

    const metadata = site.metadata as Record<string, any>;
    return metadata?.healthBreakdown || {
      overall: site.healthStatus,
      timestamp: site.lastHealthCheck?.toISOString() || new Date().toISOString(),
      components: [],
    };
  }

  // ==================== NETBOX CONTACTS ====================

  /**
   * Get contacts from NetBox (proxy)
   */
  async getNetBoxContacts(params?: {
    limit?: number;
    offset?: number;
    name?: string;
    group_id?: number;
  }) {
    return this.netboxProvider.fetchContacts(params);
  }

  /**
   * Get contact groups from NetBox (proxy)
   */
  async getNetBoxContactGroups(params?: { limit?: number; offset?: number }) {
    return this.netboxProvider.fetchContactGroups(params);
  }

  /**
   * Sync contacts from NetBox to XCH
   * Uses IntegrationMapping to resolve contact_group -> ContactType mapping
   */
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

        // Check if contact already exists (by externalId)
        const existingContact = await this.prisma.contact.findFirst({
          where: {
            tenantId,
            externalRefs: {
              some: {
                externalId: mappedData.externalId,
                provider: 'netbox',
              },
            },
          },
        });

        if (existingContact) {
          // Update existing contact
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
          // Resolve ContactType via IntegrationMapping
          let typeId: string | null = null;

          if (netboxContact.group?.id) {
            const mapping = await this.integrationMappingService.getMappingByExternalId(
              tenantId,
              'netbox',
              'contact_group',
              netboxContact.group.id.toString(),
            );
            if (mapping) {
              typeId = mapping.targetId;
            }
          }

          // Fallback: find default contact type
          if (!typeId) {
            const defaultType = await this.prisma.contactType.findFirst({
              where: { tenantId, isSystem: true },
              orderBy: { createdAt: 'asc' },
            });
            if (defaultType) {
              typeId = defaultType.id;
            }
          }

          if (!typeId) {
            results.errors.push(`${netboxContact.name}: No ContactType found (create one or map contact groups)`);
            continue;
          }

          const { externalId, externalSystem, metadata, ...contactData } = mappedData;

          const newContact = await this.prisma.contact.create({
            data: {
              ...contactData,
              tenantId,
              typeId,
            },
          });

          // Create external reference
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
