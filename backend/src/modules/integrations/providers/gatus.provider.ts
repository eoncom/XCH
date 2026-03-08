import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MonitoringProvider,
  MonitoringProviderConfig,
  NormalizedMonitor,
  NormalizedMonitorStatus,
} from '../interfaces/integration-provider.interface';
import axios, { AxiosInstance } from 'axios';

/**
 * Gatus monitoring provider.
 * Polls Gatus REST API (/api/v1/endpoints/statuses) to fetch endpoint statuses.
 * Gatus uses Bearer token authentication (configurable via API key).
 */
@Injectable()
export class GatusProviderService implements MonitoringProvider {
  private readonly logger = new Logger(GatusProviderService.name);
  private client: AxiosInstance;
  private enabled: boolean;
  private providerStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';
  private lastError: string | null = null;
  private lastFetch: string | null = null;

  constructor(private configService: ConfigService) {
    const baseURL = this.configService.get<string>('GATUS_URL');
    const apiKey = this.configService.get<string>('GATUS_API_KEY');

    this.enabled = !!baseURL;

    if (this.enabled) {
      this.client = axios.create({
        baseURL,
        timeout: 15000,
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      });
      this.logger.log('Gatus provider initialized');
    } else {
      this.logger.warn('Gatus provider disabled (missing GATUS_URL)');
    }
  }

  reconfigure(config: MonitoringProviderConfig): void {
    if (!config.url) {
      this.enabled = false;
      return;
    }
    this.enabled = true;
    const token = config.apiKey || config.password;
    this.client = axios.create({
      baseURL: config.url,
      timeout: 15000,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    this.logger.log(`Gatus provider reconfigured: ${config.url}`);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getName(): string {
    return 'Gatus';
  }

  getStatus(): 'connected' | 'disconnected' | 'error' {
    return this.providerStatus;
  }

  getDetailedStatus(): {
    enabled: boolean;
    status: 'connected' | 'disconnected' | 'error';
    lastError: string | null;
    lastFetch: string | null;
  } {
    return {
      enabled: this.enabled,
      status: this.providerStatus,
      lastError: this.lastError,
      lastFetch: this.lastFetch,
    };
  }

  /**
   * Test connection to Gatus using /api/v1/endpoints/statuses
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    if (!this.enabled) {
      return {
        success: false,
        message: 'Gatus provider is disabled (missing GATUS_URL)',
      };
    }

    try {
      const response = await this.client.get('/api/v1/endpoints/statuses');
      const endpoints = Array.isArray(response.data) ? response.data : [];
      this.providerStatus = 'connected';

      return {
        success: true,
        message: `Connected to Gatus — ${endpoints.length} endpoints detected`,
        details: {
          endpoint: this.client.defaults.baseURL,
          endpointCount: endpoints.length,
          endpoints: endpoints.map((ep: any) => ({
            name: ep.name || ep.key,
            group: ep.group,
            status: this.resolveGatusStatus(ep),
          })),
        },
      };
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number }; code?: string };

      if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
        this.providerStatus = 'error';
        return {
          success: false,
          message: 'Authentication failed (check API key)',
        };
      }

      if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ENOTFOUND') {
        this.providerStatus = 'error';
        return {
          success: false,
          message: `Cannot reach Gatus at ${this.client.defaults.baseURL}`,
        };
      }

      this.providerStatus = 'error';
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Gatus connection test failed', errorMessage);

      return {
        success: false,
        message: `Connection failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Fetch all endpoints from Gatus as NormalizedMonitor[]
   */
  async fetchMonitors(): Promise<NormalizedMonitor[]> {
    if (!this.enabled) {
      return [];
    }

    try {
      const response = await this.client.get('/api/v1/endpoints/statuses');
      const endpoints = Array.isArray(response.data) ? response.data : [];

      this.providerStatus = 'connected';
      this.lastError = null;
      this.lastFetch = new Date().toISOString();

      const monitors: NormalizedMonitor[] = endpoints.map((ep: any) => ({
        id: ep.key || ep.name || '',
        name: ep.name || ep.key || '',
        type: ep.group || 'http',
        status: this.resolveGatusStatus(ep),
        responseTime: this.extractResponseTime(ep),
        url: ep.url,
      }));

      this.logger.log(`Fetched ${monitors.length} endpoints from Gatus`);
      return monitors;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to fetch endpoints from Gatus', errorMessage);
      this.providerStatus = 'error';
      this.lastError = errorMessage;
      return [];
    }
  }

  /**
   * Get monitor status by name identifier
   */
  async getMonitorStatus(identifier: string): Promise<NormalizedMonitorStatus | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      const monitors = await this.fetchMonitors();

      const monitor = monitors.find(
        (m) =>
          m.name === identifier ||
          m.name.toLowerCase() === identifier.toLowerCase() ||
          m.name.toLowerCase().includes(identifier.toLowerCase()),
      );

      if (!monitor) {
        return null;
      }

      return {
        status: monitor.status,
        uptime: monitor.status === 'up' ? 100 : 0,
        lastCheck: new Date(),
        responseTime: monitor.responseTime,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get monitor status for ${identifier}`, errorMessage);
      return null;
    }
  }

  /**
   * Map monitor status to XCH health status
   */
  mapToHealthStatus(monitorStatus: 'up' | 'down' | 'unknown'): string {
    switch (monitorStatus) {
      case 'up':
        return 'HEALTHY';
      case 'down':
        return 'CRITICAL';
      case 'unknown':
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * Resolve Gatus endpoint status to normalized status.
   * Gatus results array: last entry is most recent.
   * Each result has { status: number (200=ok), connected: boolean, success: boolean }
   */
  private resolveGatusStatus(endpoint: any): 'up' | 'down' | 'unknown' {
    const results = endpoint.results;
    if (!results || !Array.isArray(results) || results.length === 0) {
      return 'unknown';
    }
    // Most recent result is the last element
    const latest = results[results.length - 1];
    if (latest.success === true) return 'up';
    if (latest.success === false) return 'down';
    return 'unknown';
  }

  /**
   * Extract average response time from most recent Gatus result
   */
  private extractResponseTime(endpoint: any): number {
    const results = endpoint.results;
    if (!results || !Array.isArray(results) || results.length === 0) {
      return 0;
    }
    const latest = results[results.length - 1];
    // Gatus returns duration in nanoseconds — convert to ms
    if (latest.duration && typeof latest.duration === 'number') {
      return Math.round(latest.duration / 1_000_000);
    }
    return 0;
  }
}
