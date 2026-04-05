import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NetBoxProvider } from '../interfaces/integration-provider.interface';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class NetBoxProviderService implements NetBoxProvider {
  private readonly logger = new Logger(NetBoxProviderService.name);
  private client: AxiosInstance;
  private enabled: boolean;
  private status: 'connected' | 'disconnected' | 'error' = 'disconnected';

  constructor(private configService: ConfigService) {
    const baseURL = this.configService.get<string>('NETBOX_URL');
    const token = this.configService.get<string>('NETBOX_TOKEN');

    this.enabled = !!(baseURL && token);

    if (this.enabled) {
      this.client = axios.create({
        baseURL,
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      this.logger.log('NetBox provider initialized');
    } else {
      this.logger.warn('NetBox provider disabled (missing NETBOX_URL or NETBOX_TOKEN)');
    }
  }

  /**
   * Reconfigure provider at runtime (e.g. from DB config)
   */
  reconfigure(url: string, token: string) {
    if (!url || !token) {
      this.enabled = false;
      return;
    }
    this.enabled = true;
    this.client = axios.create({
      baseURL: url,
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    this.logger.log(`NetBox provider reconfigured: ${url}`);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getName(): string {
    return 'NetBox';
  }

  getStatus(): 'connected' | 'disconnected' | 'error' {
    return this.status;
  }

  /**
   * Test connection to NetBox
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    if (!this.enabled) {
      return {
        success: false,
        message: 'NetBox provider is disabled (missing configuration)',
      };
    }

    try {
      const response = await this.client.get('/api/status/');
      this.status = 'connected';

      return {
        success: true,
        message: 'Connected to NetBox successfully',
        details: {
          version: response.data?.netbox_version || 'unknown',
          djangoVersion: response.data?.django_version || 'unknown',
          pythonVersion: response.data?.python_version || 'unknown',
        },
      };
    } catch (error: unknown) {
      this.status = 'error';
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('NetBox connection test failed', errorMessage);

      return {
        success: false,
        message: `Connection failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Fetch all sites from NetBox
   */
  async fetchSites(): Promise<any[]> {
    if (!this.enabled) {
      return [];
    }

    try {
      const response = await this.client.get('/api/dcim/sites/', {
        params: { limit: 1000 },
      });

      this.logger.log(`Fetched ${response.data.results?.length || 0} sites from NetBox`);
      return response.data.results || [];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to fetch sites from NetBox', errorMessage);
      throw error;
    }
  }

  /**
   * Fetch devices for a NetBox site
   */
  async fetchDevicesForSite(siteId: number): Promise<any[]> {
    if (!this.enabled) {
      return [];
    }

    try {
      const response = await this.client.get('/api/dcim/devices/', {
        params: {
          site_id: siteId,
          limit: 1000,
        },
      });

      this.logger.log(
        `Fetched ${response.data.results?.length || 0} devices for NetBox site ${siteId}`,
      );
      return response.data.results || [];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to fetch devices for site ${siteId}`, errorMessage);
      throw error;
    }
  }

  /**
   * Search device by serial number
   */
  async searchDeviceBySerial(serialNumber: string): Promise<any | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      const response = await this.client.get('/api/dcim/devices/', {
        params: {
          serial: serialNumber,
        },
      });

      const devices = response.data.results || [];
      if (devices.length === 0) {
        return null;
      }

      if (devices.length > 1) {
        this.logger.warn(
          `Multiple devices found with serial ${serialNumber}, returning first`,
        );
      }

      return devices[0];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to search device by serial ${serialNumber}`, errorMessage);
      throw error;
    }
  }

  /**
   * Fetch contacts from NetBox
   */
  async fetchContacts(params?: {
    limit?: number;
    offset?: number;
    name?: string;
    group_id?: number;
  }): Promise<any> {
    if (!this.enabled) {
      return { count: 0, results: [] };
    }

    try {
      const queryParams: Record<string, any> = { limit: params?.limit || 1000 };
      if (params?.offset) queryParams.offset = params.offset;
      if (params?.name) queryParams.name__ic = params.name;
      if (params?.group_id) queryParams.group_id = params.group_id;

      const response = await this.client.get('/api/tenancy/contacts/', {
        params: queryParams,
      });

      this.logger.log(`Fetched ${response.data.results?.length || 0} contacts from NetBox`);
      return response.data;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to fetch contacts from NetBox', errorMessage);
      throw error;
    }
  }

  /**
   * Fetch contact groups from NetBox
   */
  async fetchContactGroups(params?: {
    limit?: number;
    offset?: number;
  }): Promise<any> {
    if (!this.enabled) {
      return { count: 0, results: [] };
    }

    try {
      const queryParams: Record<string, any> = { limit: params?.limit || 1000 };
      if (params?.offset) queryParams.offset = params.offset;

      const response = await this.client.get('/api/tenancy/contact-groups/', {
        params: queryParams,
      });

      this.logger.log(`Fetched ${response.data.results?.length || 0} contact groups from NetBox`);
      return response.data;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to fetch contact groups from NetBox', errorMessage);
      throw error;
    }
  }

  /**
   * Map NetBox contact to XCH contact format
   */
  async mapContactToXCH(netboxContact: any): Promise<any> {
    return {
      externalId: netboxContact.id.toString(),
      externalSystem: 'netbox',
      name: netboxContact.name,
      email: netboxContact.email || null,
      phone: netboxContact.phone || null,
      address: netboxContact.address || null,
      role: netboxContact.title || null,
      notes: netboxContact.comments || null,
      metadata: {
        netbox_id: netboxContact.id,
        netbox_url: netboxContact.url,
        group: netboxContact.group?.name || null,
        group_id: netboxContact.group?.id || null,
      },
    };
  }

  /**
   * Map NetBox site to XCH site format
   */
  async mapSiteToXCH(netboxSite: any): Promise<any> {
    return {
      externalId: netboxSite.id.toString(),
      externalSystem: 'netbox',
      name: netboxSite.name,
      code: netboxSite.slug || netboxSite.name.toLowerCase().replace(/\s+/g, '-'),
      status: netboxSite.status?.value === 'active' ? 'ACTIVE' : 'CLOSED',
      address: netboxSite.physical_address || null,
      // Map coordinates if available (NetBox custom fields or lat/long)
      latitude: netboxSite.latitude || netboxSite.custom_fields?.latitude || null,
      longitude: netboxSite.longitude || netboxSite.custom_fields?.longitude || null,
      metadata: {
        netbox_id: netboxSite.id,
        netbox_url: netboxSite.url,
        facility: netboxSite.facility || null,
        asn: netboxSite.asn || null,
        description: netboxSite.description || null,
      },
    };
  }

  /**
   * Map NetBox device to XCH asset format
   */
  async mapDeviceToXCH(netboxDevice: any): Promise<any> {
    // Map NetBox device type to XCH asset type
    const deviceRole = netboxDevice.device_role?.slug || 'other';
    let assetType = 'OTHER';

    if (deviceRole.includes('switch')) assetType = 'SWITCH';
    else if (deviceRole.includes('firewall') || deviceRole.includes('fw'))
      assetType = 'FIREWALL';
    else if (deviceRole.includes('router')) assetType = 'ROUTER';
    else if (deviceRole.includes('server')) assetType = 'SERVER';
    else if (deviceRole.includes('wifi') || deviceRole.includes('ap')) assetType = 'WIFI_AP';

    return {
      externalId: netboxDevice.id.toString(),
      externalSystem: 'netbox',
      type: assetType,
      brand: netboxDevice.device_type?.manufacturer?.name || null,
      model: netboxDevice.device_type?.model || null,
      serialNumber: netboxDevice.serial || null,
      status: netboxDevice.status?.value === 'active' ? 'IN_SERVICE' : 'OUT_OF_SERVICE',
      metadata: {
        netbox_id: netboxDevice.id,
        netbox_url: netboxDevice.url,
        device_role: netboxDevice.device_role?.name || null,
        platform: netboxDevice.platform?.name || null,
        primary_ip: netboxDevice.primary_ip?.address || null,
        rack: netboxDevice.rack?.name || null,
        position: netboxDevice.position || null,
        face: netboxDevice.face?.value || null,
      },
    };
  }
}
