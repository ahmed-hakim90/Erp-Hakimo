import { LineStatus } from '../../../types';
import { apiRequest } from './apiClient';
import { startPolling, Unsubscribe } from './polling';

export const lineStatusService = {
  async getAll(): Promise<LineStatus[]> {
    return apiRequest<LineStatus[]>('GET', '/production/line-statuses');
  },

  async getById(id: string): Promise<LineStatus | null> {
    return apiRequest<LineStatus>('GET', `/production/line-statuses/${id}`);
  },

  async create(data: Omit<LineStatus, 'id' | 'updatedAt'>): Promise<string | null> {
    const result = await apiRequest<{ id: string | null }>('POST', '/production/line-statuses', {
      body: { ...data, updatedAt: new Date().toISOString() },
    });
    return result.id;
  },

  async update(id: string, data: Partial<LineStatus>): Promise<void> {
    await apiRequest<void>('PATCH', `/production/line-statuses/${id}`, {
      body: { ...data, updatedAt: new Date().toISOString() },
    });
  },

  async delete(id: string): Promise<void> {
    await apiRequest<void>('DELETE', `/production/line-statuses/${id}`);
  },

  subscribeAll(onData: (statuses: LineStatus[]) => void): Unsubscribe {
    return startPolling(() => this.getAll(), onData, 4000);
  },
};
