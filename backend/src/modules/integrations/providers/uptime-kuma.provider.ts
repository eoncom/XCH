import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UptimeKumaProvider } from '../interfaces/integration-provider.interface';
import axios, { AxiosInstance } from 'axios';

interface ParsedMonitor {
  id: number;
  name: string;
  type: string;
  status: 'up' | 'down' | 'unknown';
  responseTime: number;
  certExpiry?: number;
}

@Injectable()
export class UptimeKumaProviderService implements UptimeKumaProvider {
  private readonly logger = new Logger(UptimeKumaProviderService.name);
  private client: AxiosInstance;
  private enabled: boolean;
  private status: 'connected' | 'disconnected' | 'error' = 'disconnected';
  private lastError: string | null = null;
  private lastFetch: string | null = null;

  constructor(private configService: ConfigService) {
    const baseURL = this.configService.get<string>('UPTIME_KUMA_URL');

    // Uptime Kuma's /metrics endpoint doesn't require authentication
    // Username/password are optional (kept for backward compatibility)
    this.enabled = !!baseURL;

    if (this.enabled) {
      const username = this.configService.get<string>('UPTIME_KUMA_USERNAME') || '';
      const password = this.configService.get<string>('UPTIME_KUMA_PASSWORD');

      this.client = axios.create({
        baseURL,
        timeout: 15000,
        // Support API key auth: empty username + API key as password
        ...(password ? { auth: { username, password } } : {}),
      });

      this.logger.log('Uptime Kuma provider initialized');
    } else {
      this.logger.warn(
        'Uptime Kuma provider disabled (missing UPTIME_KUMA_URL)',
      );
    }
  }

  /**
   * Reconfigure provider at runtime (e.g. from DB config)
   */
  reconfigure(url: string, username?: string, password?: string) {
    if (!url) {
      this.enabled = false;
      return;
    }
    this.enabled = true;
    this.client = axios.create({
      baseURL: url,
      timeout: 15000,
      // Support API key auth: empty username + API key as password
      ...(password ? { auth: { username: username || '', password } } : {}),
    });
    this.logger.log(`Uptime Kuma provider reconfigured: ${url}`);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getName(): string {
    return 'Uptime Kuma';
  }

  getStatus(): 'connected' | 'disconnected' | 'error' {
    return this.status;
  }

  getDetailedStatus(): {
    enabled: boolean;
    status: 'connected' | 'disconnected' | 'error';
    lastError: string | null;
    lastFetch: string | null;
  } {
    return {
      enabled: this.enabled,
      status: this.status,
      lastError: this.lastError,
      lastFetch: this.lastFetch,
    };
  }

  /**
   * Test connection to Uptime Kuma using /metrics endpoint (Prometheus format)
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    if (!this.enabled) {
      return {
        success: false,
        message: 'Uptime Kuma provider is disabled (missing UPTIME_KUMA_URL)',
      };
    }

    try {
      const response = await this.client.get('/metrics');
      const monitors = this.parsePrometheusMetrics(response.data);
      this.status = 'connected';

      return {
        success: true,
        message: `Connected to Uptime Kuma — ${monitors.length} monitors detected`,
        details: {
          endpoint: this.client.defaults.baseURL,
          monitorCount: monitors.length,
          monitors: monitors.map((m) => ({
            id: m.id,
            name: m.name,
            status: m.status,
          })),
        },
      };
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number }; code?: string };

      if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
        this.status = 'error';
        return {
          success: false,
          message: 'Authentication failed (check credentials)',
        };
      }

      if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ENOTFOUND') {
        this.status = 'error';
        return {
          success: false,
          message: `Cannot reach Uptime Kuma at ${this.client.defaults.baseURL}`,
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
   * Parse Prometheus metrics from /metrics endpoint
   * Extracts monitor_status, monitor_response_time, monitor_cert_days_remaining
   */
  private parsePrometheusMetrics(metricsText: string): ParsedMonitor[] {
    const monitors = new Map<number, ParsedMonitor>();

    // Parse monitor_status{monitor_name="...",monitor_type="...",monitor_url="...",monitor_hostname="...",monitor_port=""} 1
    const statusRegex = /monitor_status\{[^}]*monitor_name="([^"]*)"[^}]*\}\s+(\d+)/g;
    let match;
    while ((match = statusRegex.exec(metricsText)) !== null) {
      const name = match[1];
      const statusValue = parseInt(match[2]);

      // Extract monitor_id from the line if available, or use name hash
      const idMatch = metricsText.match(
        new RegExp(`monitor_status\\{[^}]*monitor_name="${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^}]*\\}`)
      );

      // Try to extract ID from nearby lines
      const idRegex = new RegExp(`monitor_response_time\\{[^}]*monitor_name="${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^}]*\\}\\s+([\\d.]+)`);
      const rtMatch = idRegex.exec(metricsText);

      // Use name-based hash as ID since Prometheus metrics don't include monitor_id
      const id = this.hashName(name);

      if (!monitors.has(id)) {
        // Extract type from the metrics
        const typeMatch = metricsText.match(
          new RegExp(`monitor_status\\{[^}]*monitor_name="${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^}]*monitor_type="([^"]*)"`)
        );

        monitors.set(id, {
          id,
          name,
          type: typeMatch ? typeMatch[1] : 'http',
          status: statusValue === 1 ? 'up' : statusValue === 0 ? 'down' : 'unknown',
          responseTime: 0,
        });
      }
    }

    // Parse response times
    const rtRegex = /monitor_response_time\{[^}]*monitor_name="([^"]*)"[^}]*\}\s+([\d.]+)/g;
    while ((match = rtRegex.exec(metricsText)) !== null) {
      const name = match[1];
      const responseTime = parseFloat(match[2]);
      const id = this.hashName(name);
      const monitor = monitors.get(id);
      if (monitor) {
        monitor.responseTime = responseTime;
      }
    }

    // Parse cert expiry
    const certRegex = /monitor_cert_days_remaining\{[^}]*monitor_name="([^"]*)"[^}]*\}\s+([\d.]+)/g;
    while ((match = certRegex.exec(metricsText)) !== null) {
      const name = match[1];
      const certExpiry = parseFloat(match[2]);
      const id = this.hashName(name);
      const monitor = monitors.get(id);
      if (monitor) {
        monitor.certExpiry = certExpiry;
      }
    }

    return Array.from(monitors.values());
  }

  /**
   * Simple hash for monitor name -> numeric ID
   */
  private hashName(name: string): number {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      const char = name.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Fetch all monitors from Uptime Kuma via /metrics
   */
  async fetchMonitors(): Promise<ParsedMonitor[]> {
    if (!this.enabled) {
      return [];
    }

    try {
      const response = await this.client.get('/metrics');
      const monitors = this.parsePrometheusMetrics(response.data);

      this.status = 'connected';
      this.lastError = null;
      this.lastFetch = new Date().toISOString();
      this.logger.log(`Fetched ${monitors.length} monitors from Uptime Kuma`);
      return monitors;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to fetch monitors from Uptime Kuma', errorMessage);
      this.status = 'error';
      this.lastError = errorMessage;

      // Return empty array instead of throwing (circuit breaker pattern)
      return [];
    }
  }

  /**
   * Get monitor status by name identifier
   */
  async getMonitorStatus(
    identifier: string,
  ): Promise<{ status: 'up' | 'down' | 'unknown'; uptime: number; lastCheck: Date; responseTime: number } | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      const monitors = await this.fetchMonitors();

      // Search by exact name or partial match (case insensitive)
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
}
