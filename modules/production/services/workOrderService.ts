import apiClient from '../../../services/api';
import type { WorkOrder } from '../../../types';
type Unsubscribe = () => void;

const POLL_MS = 5000;

export const workOrderService = {
  async getAll(): Promise<WorkOrder[]> {
    return apiClient.get<WorkOrder[]>('/production/work-orders');
  },

  async getById(id: string): Promise<WorkOrder | null> {
    return apiClient.get<WorkOrder>(`/production/work-orders/${id}`);
  },

  async getByLine(lineId: string): Promise<WorkOrder[]> {
    return apiClient.get<WorkOrder[]>('/production/work-orders', { lineId });
  },

  async getActiveByLine(lineId: string): Promise<WorkOrder[]> {
    return apiClient.get<WorkOrder[]>('/production/work-orders', {
      lineId,
      status: 'pending,in_progress',
    });
  },

  async getByPlan(planId: string): Promise<WorkOrder[]> {
    return apiClient.get<WorkOrder[]>('/production/work-orders', { planId });
  },

  async getBySupervisor(supervisorId: string): Promise<WorkOrder[]> {
    return apiClient.get<WorkOrder[]>('/production/work-orders', { supervisorId });
  },

  async getActiveByLineAndProduct(lineId: string, productId: string): Promise<WorkOrder[]> {
    return apiClient.get<WorkOrder[]>('/production/work-orders', {
      lineId,
      productId,
      status: 'pending,in_progress',
    });
  },

  async create(data: Omit<WorkOrder, 'id' | 'createdAt'>): Promise<string | null> {
    const res = await apiClient.post<{ id: string }>('/production/work-orders', data);
    return res.id;
  },

  async update(id: string, data: Partial<WorkOrder>): Promise<void> {
    await apiClient.put<void>(`/production/work-orders/${id}`, data);
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete<void>(`/production/work-orders/${id}`);
  },

  async incrementProduced(id: string, quantityDelta: number, costDelta: number): Promise<void> {
    await apiClient.post<void>(`/production/work-orders/${id}/increment-produced`, {
      quantityDelta,
      costDelta,
    });
  },

  async updateCompletionFromScans(
    id: string,
    payload: Pick<
      WorkOrder,
      'actualWorkersCount' | 'actualProducedFromScans' | 'scanSummary' | 'scanSessionClosedAt' | 'completedAt' | 'status'
    >,
  ): Promise<void> {
    await apiClient.post<void>(`/production/work-orders/${id}/completion-from-scans`, payload);
  },

  async generateNextNumber(): Promise<string> {
    const res = await apiClient.post<{ number: string }>('/production/work-orders/generate-number');
    return res.number;
  },

  subscribeAll(callback: (orders: WorkOrder[]) => void): Unsubscribe {
    let active = true;
    const pull = async () => {
      if (!active) return;
      try {
        const orders = await this.getAll();
        callback(orders);
      } catch {
        // Keep polling even if one request fails.
      }
    };
    pull();
    const timer = window.setInterval(pull, POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  },
};
