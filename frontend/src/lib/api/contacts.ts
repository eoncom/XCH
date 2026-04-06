import { apiClient } from '../api-client';
import type { Contact, ContactType, CreateContactDto, UpdateContactDto, CreateContactTypeDto, UpdateContactTypeDto } from '@/types';

function buildContactParams(params?: {
  typeId?: string;
  category?: string;
  search?: string;
  isActive?: boolean;
  scopeType?: string;
  scopeId?: string;
  forScopeType?: string;
  forScopeId?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.typeId) searchParams.append('typeId', params.typeId);
  if (params?.category) searchParams.append('category', params.category);
  if (params?.search) searchParams.append('search', params.search);
  if (params?.isActive !== undefined) searchParams.append('isActive', String(params.isActive));
  if (params?.scopeType) searchParams.append('scopeType', params.scopeType);
  if (params?.scopeId) searchParams.append('scopeId', params.scopeId);
  if (params?.forScopeType) searchParams.append('forScopeType', params.forScopeType);
  if (params?.forScopeId) searchParams.append('forScopeId', params.forScopeId);
  return searchParams;
}

export const contactsApi = {
  getAll: async (params?: {
    typeId?: string;
    category?: string;
    search?: string;
    isActive?: boolean;
    scopeType?: string;
    scopeId?: string;
    forScopeType?: string;
    forScopeId?: string;
  }): Promise<Contact[]> => {
    const searchParams = buildContactParams(params);
    const query = searchParams.toString();
    const res = await apiClient.get<{ data: Contact[]; meta: any }>(`/api/contacts${query ? `?${query}` : ''}`);
    return res.data;
  },

  getAllPaginated: (params?: {
    typeId?: string;
    category?: string;
    search?: string;
    isActive?: boolean;
    scopeType?: string;
    scopeId?: string;
    forScopeType?: string;
    forScopeId?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const searchParams = buildContactParams(params);
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.pageSize) searchParams.append('pageSize', String(params.pageSize));
    const query = searchParams.toString();
    return apiClient.get<{ data: Contact[]; meta: { total: number; page: number; pageSize: number; totalPages: number } }>(`/api/contacts${query ? `?${query}` : ''}`);
  },

  getById: (id: string) => apiClient.get<Contact>(`/api/contacts/${id}`),

  create: (data: CreateContactDto) => apiClient.post<Contact>('/api/contacts', data),

  update: (id: string, data: UpdateContactDto) =>
    apiClient.patch<Contact>(`/api/contacts/${id}`, data),

  delete: (id: string) => apiClient.delete(`/api/contacts/${id}`),

  setActive: (id: string, isActive: boolean) =>
    apiClient.patch<Contact>(`/api/contacts/${id}`, { isActive }),
};

export const contactTypesApi = {
  getAll: (params?: {
    category?: string;
    isActive?: boolean;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.append('category', params.category);
    if (params?.isActive !== undefined) searchParams.append('isActive', String(params.isActive));

    const query = searchParams.toString();
    return apiClient.get<ContactType[]>(`/api/contact-types${query ? `?${query}` : ''}`);
  },

  getById: (id: string) => apiClient.get<ContactType>(`/api/contact-types/${id}`),

  create: (data: CreateContactTypeDto) => apiClient.post<ContactType>('/api/contact-types', data),

  update: (id: string, data: UpdateContactTypeDto) =>
    apiClient.patch<ContactType>(`/api/contact-types/${id}`, data),

  delete: (id: string) => apiClient.delete(`/api/contact-types/${id}`),
};
