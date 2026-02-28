import { FirestoreProduct } from '../../../types';
import { apiRequest } from './apiClient';

export const productService = {
  async getAll(): Promise<FirestoreProduct[]> {
    return apiRequest<FirestoreProduct[]>('GET', '/production/products');
  },

  async getById(id: string): Promise<FirestoreProduct | null> {
    return apiRequest<FirestoreProduct>('GET', `/production/products/${id}`);
  },

  async create(data: Omit<FirestoreProduct, 'id'>): Promise<string | null> {
    const result = await apiRequest<{ id: string | null }>('POST', '/production/products', { body: data });
    return result.id;
  },

  async update(id: string, data: Partial<FirestoreProduct>): Promise<void> {
    await apiRequest<void>('PATCH', `/production/products/${id}`, { body: data });
  },

  async delete(id: string): Promise<void> {
    await apiRequest<void>('DELETE', `/production/products/${id}`);
  },
};
