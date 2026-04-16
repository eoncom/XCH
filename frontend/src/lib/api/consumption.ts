import { apiClient } from '../api-client';

export interface ConsumptionData {
  totalWatts: number;
  kWhMonth: number;
  costMonth: number;
  currency: string;
  costPerKwh: number;
  assetCount: number;
  byType?: Record<string, { watts: number; count: number }>;
}

export interface SiteConsumption extends ConsumptionData {
  site: { id: string; name: string; code: string; autoGenerateElectricityExpense?: boolean };
}

export interface RackConsumption extends ConsumptionData {
  rack: { id: string; name: string; code: string; siteId: string };
}

export interface ConsumptionSummary {
  totals: {
    totalWatts: number;
    kWhMonth: number;
    costMonth: number;
    currency: string;
    costPerKwh: number;
  };
  sites: Array<{
    site: { id: string; name: string; code: string };
    totalWatts: number;
    kWhMonth: number;
    costMonth: number;
    assetCount: number;
  }>;
}

export const consumptionApi = {
  summary: () => apiClient.get<ConsumptionSummary>('/api/consumption/summary'),
  site: (siteId: string) => apiClient.get<SiteConsumption>(`/api/consumption?siteId=${siteId}`),
  rack: (rackId: string) => apiClient.get<RackConsumption>(`/api/consumption?rackId=${rackId}`),
};
