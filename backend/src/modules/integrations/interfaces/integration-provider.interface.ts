/**
 * Base interface for all integration providers (NetBox today, more later).
 * Native monitoring (ADR-016) owns its data end-to-end; no adapter needed.
 */
export interface IntegrationProvider {
  /** Test connection to external system */
  testConnection(): Promise<{ success: boolean; message: string; details?: any }>;

  /** Get provider name */
  getName(): string;

  /** Get provider status */
  getStatus(): 'connected' | 'disconnected' | 'error';
}

/**
 * NetBox-specific provider interface.
 */
export interface NetBoxProvider extends IntegrationProvider {
  /** Fetch all sites from NetBox */
  fetchSites(): Promise<any[]>;

  /** Fetch devices for a specific NetBox site */
  fetchDevicesForSite(siteId: number): Promise<any[]>;

  /** Search device by serial number */
  searchDeviceBySerial(serialNumber: string): Promise<any | null>;

  /** Map NetBox site to XCH site */
  mapSiteToXCH(netboxSite: any): Promise<any>;

  /** Map NetBox device to XCH asset */
  mapDeviceToXCH(netboxDevice: any): Promise<any>;
}
