import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

export interface NetboxSite {
  id: number;
  url: string;
  name: string;
  slug: string;
  status: {
    value: string;
    label: string;
  };
  region?: {
    id: number;
    name: string;
  };
  facility?: string;
  time_zone?: string;
  description?: string;
  physical_address?: string;
  shipping_address?: string;
  latitude?: number;
  longitude?: number;
  comments?: string;
  tags?: { id: number; name: string; slug: string }[];
  custom_fields?: Record<string, any>;
  created?: string;
  last_updated?: string;
}

export interface NetboxDevice {
  id: number;
  url: string;
  name: string;
  device_type: {
    id: number;
    manufacturer: { id: number; name: string; slug: string };
    model: string;
    slug: string;
  };
  role: {
    id: number;
    name: string;
    slug: string;
  };
  site: {
    id: number;
    name: string;
    slug: string;
  };
  rack?: {
    id: number;
    name: string;
  };
  position?: number;
  serial?: string;
  asset_tag?: string;
  status: {
    value: string;
    label: string;
  };
  primary_ip4?: {
    id: number;
    address: string;
  };
  primary_ip6?: {
    id: number;
    address: string;
  };
  tags?: { id: number; name: string; slug: string }[];
  custom_fields?: Record<string, any>;
  created?: string;
  last_updated?: string;
}

export interface NetboxRack {
  id: number;
  url: string;
  name: string;
  facility_id?: string;
  site: {
    id: number;
    name: string;
    slug: string;
  };
  status: {
    value: string;
    label: string;
  };
  role?: {
    id: number;
    name: string;
    slug: string;
  };
  serial?: string;
  asset_tag?: string;
  type?: {
    value: string;
    label: string;
  };
  width?: {
    value: number;
    label: string;
  };
  u_height: number;
  desc_units?: boolean;
  outer_width?: number;
  outer_depth?: number;
  outer_unit?: {
    value: string;
    label: string;
  };
  comments?: string;
  tags?: { id: number; name: string; slug: string }[];
  custom_fields?: Record<string, any>;
  created?: string;
  last_updated?: string;
}

export interface NetboxContact {
  id: number;
  url: string;
  name: string;
  title?: string;
  phone?: string;
  email?: string;
  address?: string;
  comments?: string;
  group?: {
    id: number;
    name: string;
    slug: string;
  };
  tags?: { id: number; name: string; slug: string }[];
  custom_fields?: Record<string, any>;
  created?: string;
  last_updated?: string;
}

export interface NetboxContactGroup {
  id: number;
  url: string;
  name: string;
  slug: string;
  parent?: {
    id: number;
    name: string;
    slug: string;
  };
  description?: string;
  contact_count?: number;
  tags?: { id: number; name: string; slug: string }[];
  created?: string;
  last_updated?: string;
}

export interface NetboxPaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

@Injectable()
export class NetboxService implements OnModuleInit {
  private readonly logger = new Logger(NetboxService.name);
  private baseUrl: string;
  private apiToken: string;
  private enabled: boolean;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    this.baseUrl = this.configService.get<string>('NETBOX_URL', '');
    this.apiToken = this.configService.get<string>('NETBOX_API_TOKEN', '');
    this.enabled = !!(this.baseUrl && this.apiToken);

    if (this.enabled) {
      this.logger.log(`NetBox integration enabled: ${this.baseUrl}`);
    } else {
      this.logger.warn('NetBox integration disabled: missing NETBOX_URL or NETBOX_API_TOKEN');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private getHeaders() {
    return {
      Authorization: `Token ${this.apiToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  private async request<T>(
    method: 'get' | 'post' | 'patch' | 'delete',
    endpoint: string,
    data?: any,
  ): Promise<T> {
    if (!this.enabled) {
      throw new Error('NetBox integration is not enabled');
    }

    const url = `${this.baseUrl}/api${endpoint}`;

    try {
      const response = await firstValueFrom(
        this.httpService.request<T>({
          method,
          url,
          headers: this.getHeaders(),
          data,
        }),
      );
      return response.data;
    } catch (error: unknown) {
      if (error instanceof AxiosError) {
        this.logger.error(
          `NetBox API error: ${error.response?.status} ${error.response?.statusText}`,
          error.response?.data,
        );
        throw new Error(`NetBox API error: ${error.message}`);
      }
      throw error;
    }
  }

  // ============================================================
  // SITES
  // ============================================================

  async getSites(params?: {
    limit?: number;
    offset?: number;
    name?: string;
    region_id?: number;
    status?: string;
  }): Promise<NetboxPaginatedResponse<NetboxSite>> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.name) queryParams.append('name__ic', params.name);
    if (params?.region_id) queryParams.append('region_id', params.region_id.toString());
    if (params?.status) queryParams.append('status', params.status);

    const query = queryParams.toString();
    return this.request<NetboxPaginatedResponse<NetboxSite>>(
      'get',
      `/dcim/sites/${query ? `?${query}` : ''}`,
    );
  }

  async getSiteById(id: number): Promise<NetboxSite> {
    return this.request<NetboxSite>('get', `/dcim/sites/${id}/`);
  }

  async createSite(data: Partial<NetboxSite>): Promise<NetboxSite> {
    return this.request<NetboxSite>('post', '/dcim/sites/', data);
  }

  async updateSite(id: number, data: Partial<NetboxSite>): Promise<NetboxSite> {
    return this.request<NetboxSite>('patch', `/dcim/sites/${id}/`, data);
  }

  async deleteSite(id: number): Promise<void> {
    return this.request<void>('delete', `/dcim/sites/${id}/`);
  }

  // ============================================================
  // DEVICES
  // ============================================================

  async getDevices(params?: {
    limit?: number;
    offset?: number;
    name?: string;
    site_id?: number;
    rack_id?: number;
    role_id?: number;
    status?: string;
  }): Promise<NetboxPaginatedResponse<NetboxDevice>> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.name) queryParams.append('name__ic', params.name);
    if (params?.site_id) queryParams.append('site_id', params.site_id.toString());
    if (params?.rack_id) queryParams.append('rack_id', params.rack_id.toString());
    if (params?.role_id) queryParams.append('role_id', params.role_id.toString());
    if (params?.status) queryParams.append('status', params.status);

    const query = queryParams.toString();
    return this.request<NetboxPaginatedResponse<NetboxDevice>>(
      'get',
      `/dcim/devices/${query ? `?${query}` : ''}`,
    );
  }

  async getDeviceById(id: number): Promise<NetboxDevice> {
    return this.request<NetboxDevice>('get', `/dcim/devices/${id}/`);
  }

  async createDevice(data: Partial<NetboxDevice>): Promise<NetboxDevice> {
    return this.request<NetboxDevice>('post', '/dcim/devices/', data);
  }

  async updateDevice(id: number, data: Partial<NetboxDevice>): Promise<NetboxDevice> {
    return this.request<NetboxDevice>('patch', `/dcim/devices/${id}/`, data);
  }

  async deleteDevice(id: number): Promise<void> {
    return this.request<void>('delete', `/dcim/devices/${id}/`);
  }

  // ============================================================
  // RACKS
  // ============================================================

  async getRacks(params?: {
    limit?: number;
    offset?: number;
    name?: string;
    site_id?: number;
    status?: string;
  }): Promise<NetboxPaginatedResponse<NetboxRack>> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.name) queryParams.append('name__ic', params.name);
    if (params?.site_id) queryParams.append('site_id', params.site_id.toString());
    if (params?.status) queryParams.append('status', params.status);

    const query = queryParams.toString();
    return this.request<NetboxPaginatedResponse<NetboxRack>>(
      'get',
      `/dcim/racks/${query ? `?${query}` : ''}`,
    );
  }

  async getRackById(id: number): Promise<NetboxRack> {
    return this.request<NetboxRack>('get', `/dcim/racks/${id}/`);
  }

  async createRack(data: Partial<NetboxRack>): Promise<NetboxRack> {
    return this.request<NetboxRack>('post', '/dcim/racks/', data);
  }

  async updateRack(id: number, data: Partial<NetboxRack>): Promise<NetboxRack> {
    return this.request<NetboxRack>('patch', `/dcim/racks/${id}/`, data);
  }

  async deleteRack(id: number): Promise<void> {
    return this.request<void>('delete', `/dcim/racks/${id}/`);
  }

  // ============================================================
  // CONTACTS
  // ============================================================

  async getContacts(params?: {
    limit?: number;
    offset?: number;
    name?: string;
    group_id?: number;
  }): Promise<NetboxPaginatedResponse<NetboxContact>> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.name) queryParams.append('name__ic', params.name);
    if (params?.group_id) queryParams.append('group_id', params.group_id.toString());

    const query = queryParams.toString();
    return this.request<NetboxPaginatedResponse<NetboxContact>>(
      'get',
      `/tenancy/contacts/${query ? `?${query}` : ''}`,
    );
  }

  async getContactById(id: number): Promise<NetboxContact> {
    return this.request<NetboxContact>('get', `/tenancy/contacts/${id}/`);
  }

  async getContactGroups(params?: {
    limit?: number;
    offset?: number;
  }): Promise<NetboxPaginatedResponse<NetboxContactGroup>> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const query = queryParams.toString();
    return this.request<NetboxPaginatedResponse<NetboxContactGroup>>(
      'get',
      `/tenancy/contact-groups/${query ? `?${query}` : ''}`,
    );
  }

  async getContactGroupById(id: number): Promise<NetboxContactGroup> {
    return this.request<NetboxContactGroup>('get', `/tenancy/contact-groups/${id}/`);
  }

  // ============================================================
  // HEALTH CHECK
  // ============================================================

  async healthCheck(): Promise<{ status: string; version?: string; error?: string }> {
    if (!this.enabled) {
      return { status: 'disabled', error: 'NetBox integration not configured' };
    }

    try {
      const response = await this.request<{ 'netbox-version': string }>('get', '/status/');
      return {
        status: 'healthy',
        version: response['netbox-version'],
      };
    } catch (error: unknown) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
