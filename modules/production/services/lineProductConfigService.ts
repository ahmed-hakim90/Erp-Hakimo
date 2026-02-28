import { LineProductConfig } from '../../../types';
import { apiRequest } from './apiClient';

export const lineProductConfigService = {
  async getAll(): Promise<LineProductConfig[]> {
    return apiRequest<LineProductConfig[]>('GET', '/production/line-product-configs');
  },

  async getById(id: string): Promise<LineProductConfig | null> {
    return apiRequest<LineProductConfig>('GET', `/production/line-product-configs/${id}`);
  },

  async create(data: Omit<LineProductConfig, 'id'>): Promise<string | null> {
    const result = await apiRequest<{ id: string | null }>('POST', '/production/line-product-configs', { body: data });
    return result.id;
  },

  async update(id: string, data: Partial<LineProductConfig>): Promise<void> {
    await apiRequest<void>('PATCH', `/production/line-product-configs/${id}`, { body: data });
  },

  async delete(id: string): Promise<void> {
    await apiRequest<void>('DELETE', `/production/line-product-configs/${id}`);
  },
};
