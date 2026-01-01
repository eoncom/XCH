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
 * Uptime Kuma-specific provider interface
 */
export interface UptimeKumaProvider extends IntegrationProvider {
  /**
   * Fetch all monitors
   */
  fetchMonitors(): Promise<any[]>;

  /**
   * Get monitor status by tag or name
   */
  getMonitorStatus(identifier: string): Promise<{
    status: 'up' | 'down' | 'unknown';
    uptime: number;
    lastCheck: Date;
  } | null>;

  /**
   * Get heartbeats for a monitor
   */
  getHeartbeats(monitorId: number, limit?: number): Promise<any[]>;
}
