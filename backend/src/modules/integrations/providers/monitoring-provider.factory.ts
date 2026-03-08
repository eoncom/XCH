import { Injectable, Logger } from '@nestjs/common';
import { MonitoringProvider } from '../interfaces/integration-provider.interface';
import { UptimeKumaProviderService } from './uptime-kuma.provider';
import { GatusProviderService } from './gatus.provider';

export type MonitoringProviderType = 'uptime_kuma' | 'gatus';

/**
 * Factory that selects the correct MonitoringProvider implementation
 * based on tenant configuration. Supports runtime switching between
 * Uptime Kuma and Gatus (or any future provider).
 */
@Injectable()
export class MonitoringProviderFactory {
  private readonly logger = new Logger(MonitoringProviderFactory.name);

  constructor(
    private readonly uptimeKuma: UptimeKumaProviderService,
    private readonly gatus: GatusProviderService,
  ) {}

  /**
   * Get a provider by its type identifier
   */
  getProvider(type: MonitoringProviderType): MonitoringProvider {
    switch (type) {
      case 'uptime_kuma':
        return this.uptimeKuma;
      case 'gatus':
        return this.gatus;
      default:
        this.logger.warn(`Unknown monitoring provider type: ${type}, falling back to Uptime Kuma`);
        return this.uptimeKuma;
    }
  }

  /**
   * Get the active provider from tenant config.
   * Supports both new format (monitoring.type) and legacy format (uptimeKuma.url).
   * Returns null if no monitoring is configured.
   */
  getActiveProvider(tenantConfig: Record<string, any> | null): MonitoringProvider | null {
    const integrations = tenantConfig?.integrations;
    if (!integrations) return null;

    // New format: integrations.monitoring.type
    const monitoringConfig = integrations.monitoring;
    if (monitoringConfig?.type) {
      const provider = this.getProvider(monitoringConfig.type);
      if (provider.isEnabled()) {
        return provider;
      }
      // Provider type is set but not yet configured — reconfigure from tenant config
      provider.reconfigure({
        url: monitoringConfig.url,
        apiKey: monitoringConfig.apiKey,
        username: monitoringConfig.username,
        password: monitoringConfig.password,
      });
      return provider.isEnabled() ? provider : null;
    }

    // Legacy format: integrations.uptimeKuma.url
    if (integrations.uptimeKuma?.url) {
      this.logger.debug('Using legacy uptimeKuma config format');
      const provider = this.uptimeKuma;
      if (!provider.isEnabled()) {
        provider.reconfigure({
          url: integrations.uptimeKuma.url,
          username: integrations.uptimeKuma.username,
          password: integrations.uptimeKuma.password,
        });
      }
      return provider.isEnabled() ? provider : null;
    }

    return null;
  }

  /**
   * Get list of supported provider types
   */
  getSupportedProviders(): { type: MonitoringProviderType; name: string }[] {
    return [
      { type: 'uptime_kuma', name: 'Uptime Kuma' },
      { type: 'gatus', name: 'Gatus' },
    ];
  }
}
