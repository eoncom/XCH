import { apiClient } from '../api-client';

export interface EnumLabelItem {
  enumType: string;
  enumValue: string;
  label: string;
  color: string | null;
  icon: string | null;
  sortOrder: number;
  isHidden: boolean;
  isCustom: boolean;
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
}

export const adminApi = {
  getEnumLabels: (type?: string) =>
    apiClient.get<EnumLabelsResponse>(`/api/admin/enum-labels${type ? `?type=${type}` : ''}`),

  updateEnumLabel: (data: UpdateEnumLabelData) =>
    apiClient.put('/api/admin/enum-labels', data),

  resetEnumLabels: (type?: string) =>
    apiClient.post(`/api/admin/enum-labels/reset${type ? `?type=${type}` : ''}`),

  getDefaults: (type?: string) =>
    apiClient.get(`/api/admin/enum-labels/defaults${type ? `?type=${type}` : ''}`),
};
