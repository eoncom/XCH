import { apiClient } from '../api-client';

export interface SetupStatus {
  needsSetup: boolean;
  services: {
    name: string;
    status: 'ok' | 'error';
    message?: string;
  }[];
}

export interface SetupData {
  organizationName: string;
  subdomain: string;
  timezone?: string;
  language?: string;
  logoUrl?: string;
  primaryColor?: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  adminPhone?: string;
  loadDemoData?: boolean;
}

export interface SetupResult {
  success: boolean;
  tenant: { id: string; name: string; subdomain: string };
  admin: { id: string; email: string; name: string; role: string };
  demoData: any;
}

export const setupApi = {
  getStatus: () =>
    apiClient.get<SetupStatus>('/api/setup/status'),

  initialize: (data: SetupData) =>
    apiClient.post<SetupResult>('/api/setup/initialize', data),

  generateSecrets: () =>
    apiClient.get<Record<string, string>>('/api/setup/generate-secrets'),
};
