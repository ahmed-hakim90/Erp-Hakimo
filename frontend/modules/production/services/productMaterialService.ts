import { ProductMaterial } from '../../../types';
import { apiRequest } from './apiClient';

export const productMaterialService = {
  async getByProduct(productId: string): Promise<ProductMaterial[]> {
    return apiRequest<ProductMaterial[]>('GET', `/production/product-materials/by-product/${productId}`);
  },

  async create(data: Omit<ProductMaterial, 'id'>): Promise<string | null> {
    const result = await apiRequest<{ id: string | null }>('POST', '/production/product-materials', { body: data });
    return result.id;
  },

  async update(id: string, data: Partial<ProductMaterial>): Promise<void> {
    await apiRequest<void>('PATCH', `/production/product-materials/${id}`, { body: data });
  },

  async delete(id: string): Promise<void> {
    await apiRequest<void>('DELETE', `/production/product-materials/${id}`);
  },
};
