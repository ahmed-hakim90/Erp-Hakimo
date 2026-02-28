import { ProductionPlan } from '../../../types';
import { apiRequest } from './apiClient';

export const productionPlanService = {
  async getAll(): Promise<ProductionPlan[]> {
    return apiRequest<ProductionPlan[]>('GET', '/production/production-plans');
  },

  async getById(id: string): Promise<ProductionPlan | null> {
    return apiRequest<ProductionPlan>('GET', `/production/production-plans/${id}`);
  },

  async getActiveByLine(lineId: string): Promise<ProductionPlan[]> {
    return apiRequest<ProductionPlan[]>('GET', `/production/production-plans/active/by-line/${lineId}`);
  },

  async create(data: Omit<ProductionPlan, 'id' | 'createdAt'>): Promise<string | null> {
    const result = await apiRequest<{ id: string | null }>('POST', '/production/production-plans', {
      body: { ...data, createdAt: new Date().toISOString() },
    });
    return result.id;
  },

  async update(id: string, data: Partial<ProductionPlan>): Promise<void> {
    await apiRequest<void>('PATCH', `/production/production-plans/${id}`, { body: data });
  },

  async delete(id: string): Promise<void> {
    await apiRequest<void>('DELETE', `/production/production-plans/${id}`);
  },

  async incrementProduced(id: string, quantityDelta: number, costDelta: number): Promise<void> {
    await apiRequest<void>('POST', `/production/production-plans/${id}/increment-produced`, {
      body: { quantityDelta, costDelta },
    });
  },

  async getActiveByLineAndProduct(lineId: string, productId: string): Promise<ProductionPlan[]> {
    return apiRequest<ProductionPlan[]>('GET', '/production/production-plans/active/by-line-product', {
      query: { lineId, productId },
    });
  },
};
