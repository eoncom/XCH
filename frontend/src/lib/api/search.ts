import { apiClient } from '../api-client';

export type SearchHitType = 'asset' | 'site' | 'rack' | 'task' | 'contact';

export interface SearchHit {
  type: SearchHitType;
  id: string;
  title: string;
  subtitle?: string;
  link: string;
}

export interface SearchResult {
  hits: SearchHit[];
  byType: Record<string, number>;
}

export const searchApi = {
  search: (q: string, limit = 10) =>
    apiClient.get<SearchResult>(`/api/search?q=${encodeURIComponent(q)}&limit=${limit}`),
};
