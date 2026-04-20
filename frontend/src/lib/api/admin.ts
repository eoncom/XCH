import { apiClient } from '../api-client';

export interface EnumLabelItem {
  id?: string;
  enumType: string;
  enumValue: string;
  label: string;
  color: string | null;
  icon: string | null;
  sortOrder: number;
  isHidden: boolean;
  isBuiltIn: boolean;
  isActive: boolean;
  // AssetType-only flag. True = eligible to terminate a ConnectivityLink.
  isConnectivityCapable: boolean;
}

export type EnumLabelsResponse = Record<string, EnumLabelItem[]>;

export interface UpdateEnumLabelData {
  enumType: string;
  enumValue: string;
  label: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
  isHidden?: boolean;
  isConnectivityCapable?: boolean;
}

export interface CreateEnumValueData {
  enumType: string;
  enumValue: string;
  label: string;
  icon?: string;
  color?: string;
}

export const adminApi = {
  getEnumLabels: (type?: string) =>
    apiClient.get<EnumLabelsResponse>(`/api/admin/enum-labels${type ? `?type=${type}` : ''}`),

  updateEnumLabel: (data: UpdateEnumLabelData) =>
    apiClient.put('/api/admin/enum-labels', data),

  createEnumValue: (data: CreateEnumValueData) =>
    apiClient.post<EnumLabelItem>('/api/admin/enum-labels', data),

  deleteEnumValue: (id: string) =>
    apiClient.delete(`/api/admin/enum-labels/${id}`),

  resetEnumLabels: (type?: string) =>
    apiClient.post(`/api/admin/enum-labels/reset${type ? `?type=${type}` : ''}`),

  getDefaults: (type?: string) =>
    apiClient.get(`/api/admin/enum-labels/defaults${type ? `?type=${type}` : ''}`),
};
