import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UptimeKumaProvider } from '../interfaces/integration-provider.interface';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class UptimeKumaProviderService implements UptimeKumaProvider {
  private readonly logger = new Logger(UptimeKumaProviderService.name);
  private client: AxiosInstance;
  private enabled: boolean;
  private status: 'connected' | 'disconnected' | 'error' = 'disconnected';

  constructor(private configService: ConfigService) {
    const baseURL = this.configService.get<string>('UPTIME_KUMA_URL');
    const username = this.configService.get<string>('UPTIME_KUMA_USERNAME');
    const password = this.configService.get<string>('UPTIME_KUMA_PASSWORD');

    this.enabled = !!(baseURL && username && password);

    if (this.enabled) {
      this.client = axios.create({
        baseURL,
        auth: {
          username: username!,
          password: password!,
        },
        timeout: 10000,
      });

      this.logger.log('Uptime Kuma provider initialized');
    } else {
      this.logger.warn(
        'Uptime Kuma provider disabled (missing UPTIME_KUMA_URL, USERNAME, or PASSWORD)',
      );
    }
  }

  getName(): string {
    return 'Uptime Kuma';
  }

  getStatus(): 'connected' | 'disconnected' | 'error' {
    return this.status;
  }

  /**
   * Test connection to Uptime Kuma
   * Note: Uptime Kuma API is limited, this uses a simple GET to check availability
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    if (!this.enabled) {
      return {
        success: false,
        message: 'Uptime Kuma provider is disabled (missing configuration)',
      };
    }

    try {
      // Uptime Kuma doesn't have a standard /status endpoint
      // Try to fetch monitors as a health check
      const response = await this.client.get('/api/status-page/heartbeat');
      this.status = 'connected';

      return {
        success: true,
        message: 'Connected to Uptime Kuma successfully',
        details: {
          endpoint: this.client.defaults.baseURL,
        },
      };
    } catch (error: unknown) {
      // If 401/403, credentials are wrong but service is reachable
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
        this.status = 'error';
        return {
          success: false,
          message: 'Authentication failed (check credentials)',
        };
      }

      this.status = 'error';
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Uptime Kuma connection test failed', errorMessage);

      return {
        success: false,
        message: `Connection failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Fetch all monitors from Uptime Kuma
   * Note: This is a simplified implementation
   * Real implementation depends on Uptime Kuma API version and availability
   */
  async fetchMonitors(): Promise<any[]> {
    if (!this.enabled) {
      throw new Error('Uptime Kuma provider is disabled');
    }

    try {
      // Uptime Kuma API structure varies by version
      // This is a generic approach - adapt based on your Uptime Kuma setup
      const response = await this.client.get('/api/monitors');

      this.logger.log(`Fetched ${response.data?.length || 0} monitors from Uptime Kuma`);
      return response.data || [];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to fetch monitors from Uptime Kuma', errorMessage);

      // Return empty array instead of throwing (circuit breaker pattern)
      this.logger.warn('Returning empty monitors list due to API error');
      return [];
    }
  }

  /**
   * Get monitor status by identifier (tag or name)
   */
  async getMonitorStatus(
    identifier: string,
  ): Promise<{ status: 'up' | 'down' | 'unknown'; uptime: number; lastCheck: Date } | null> {
    if (!this.enabled) {
      throw new Error('Uptime Kuma provider is disabled');
    }

    try {
      const monitors = await this.fetchMonitors();

      // Search by name or tag
      const monitor = monitors.find(
        (m) =>
          m.name === identifier ||
          m.tags?.some((tag: any) => tag.name === identifier || tag.tag_id === identifier),
      );

      if (!monitor) {
        return null;
      }

      return {
        status: monitor.status === 1 ? 'up' : monitor.status === 0 ? 'down' : 'unknown',
        uptime: monitor.uptime || 0,
        lastCheck: new Date(monitor.last_check || Date.now()),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get monitor status for ${identifier}`, errorMessage);
      return null;
    }
  }

  /**
   * Get heartbeats for a monitor
   */
  async getHeartbeats(monitorId: number, limit: number = 100): Promise<any[]> {
    if (!this.enabled) {
      throw new Error('Uptime Kuma provider is disabled');
    }

    try {
      const response = await this.client.get(`/api/monitors/${monitorId}/heartbeats`, {
        params: { limit },
      });

      return response.data || [];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get heartbeats for monitor ${monitorId}`, errorMessage);
      return [];
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
}
