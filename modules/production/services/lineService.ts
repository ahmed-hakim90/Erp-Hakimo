import { FirestoreProductionLine } from '../../../types';
import { apiRequest } from './apiClient';

export const lineService = {
  async getAll(): Promise<FirestoreProductionLine[]> {
    return apiRequest<FirestoreProductionLine[]>('GET', '/production/lines');
  },

  async getById(id: string): Promise<FirestoreProductionLine | null> {
    return apiRequest<FirestoreProductionLine>('GET', `/production/lines/${id}`);
  },

  async create(data: Omit<FirestoreProductionLine, 'id'>): Promise<string | null> {
    const result = await apiRequest<{ id: string | null }>('POST', '/production/lines', { body: data });
    return result.id;
  },

  async update(id: string, data: Partial<FirestoreProductionLine>): Promise<void> {
    await apiRequest<void>('PATCH', `/production/lines/${id}`, { body: data });
  },

  async delete(id: string): Promise<void> {
    await apiRequest<void>('DELETE', `/production/lines/${id}`);
  },
};
