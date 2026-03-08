/**
 * Base interface for all integration providers
 */
export interface IntegrationProvider {
  /**
   * Test connection to external system
   */
  testConnection(): Promise<{ success: boolean; message: string; details?: any }>;

  /**
   * Get provider name
   */
  getName(): string;

  /**
   * Get provider status
   */
  getStatus(): 'connected' | 'disconnected' | 'error';
}

/**
 * NetBox-specific provider interface
 */
export interface NetBoxProvider extends IntegrationProvider {
  /**
   * Fetch all sites from NetBox
   */
  fetchSites(): Promise<any[]>;

  /**
   * Fetch devices for a specific NetBox site
   */
  fetchDevicesForSite(siteId: number): Promise<any[]>;

  /**
   * Search device by serial number
   */
  searchDeviceBySerial(serialNumber: string): Promise<any | null>;

  /**
   * Map NetBox site to XCH site
   */
  mapSiteToXCH(netboxSite: any): Promise<any>;

  /**
   * Map NetBox device to XCH asset
   */
  mapDeviceToXCH(netboxDevice: any): Promise<any>;
}

/**
 * Generic monitoring provider interface.
 * Any monitoring engine (Uptime Kuma, Gatus, etc.) must implement this.
 */
export interface MonitoringProvider extends IntegrationProvider {
  /** Fetch all monitors, normalized to a common format */
  fetchMonitors(): Promise<NormalizedMonitor[]>;

  /** Get a single monitor's status by name or identifier */
  getMonitorStatus(identifier: string): Promise<NormalizedMonitorStatus | null>;

  /** Map raw monitor status to XCH health status string */
  mapToHealthStatus(monitorStatus: 'up' | 'down' | 'unknown'): string;

  /** Check if this provider is enabled/configured */
  isEnabled(): boolean;

  /** Reconfigure the provider at runtime (e.g. from tenant config) */
  reconfigure(config: MonitoringProviderConfig): void;
}

/** Normalized monitor data returned by any provider */
export interface NormalizedMonitor {
  id: string | number;
  name: string;
  type: string;
  status: 'up' | 'down' | 'unknown';
  responseTime?: number;
  url?: string;
}

/** Normalized status for a single monitor */
export interface NormalizedMonitorStatus {
  status: 'up' | 'down' | 'unknown';
  uptime?: number;
  lastCheck: Date;
  responseTime?: number;
}

/** Configuration passed to reconfigure() */
export interface MonitoringProviderConfig {
  url: string;
  apiKey?: string;
  username?: string;
  password?: string;
}

/** Normalized webhook event from any monitoring engine */
export interface NormalizedWebhookEvent {
  monitorName: string;
  status: 'up' | 'down' | 'unknown' | 'maintenance';
  message?: string;
  timestamp: Date;
  responseTime?: number;
}

/**
 * @deprecated Use MonitoringProvider instead. Kept for backward compatibility.
 */
export type UptimeKumaProvider = MonitoringProvider;
