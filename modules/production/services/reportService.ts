import apiClient from '../../../services/api';
import { ProductionReport } from '../../../types';

type Unsubscribe = () => void;
const POLL_MS = 5000;

export const reportService = {
  async getAll(): Promise<ProductionReport[]> {
    return apiClient.get<ProductionReport[]>('/production/reports');
  },

  async getById(id: string): Promise<ProductionReport | null> {
    return apiClient.get<ProductionReport>(`/production/reports/${id}`);
  },

  async getByDateRange(startDate: string, endDate: string): Promise<ProductionReport[]> {
    return apiClient.get<ProductionReport[]>('/production/reports', { startDate, endDate });
  },

  async existsForLineAndDate(lineId: string, date: string): Promise<boolean> {
    const reports = await apiClient.get<ProductionReport[]>('/production/reports', {
      lineId,
      startDate: date,
      endDate: date,
    });
    return reports.length > 0;
  },

  async create(data: Omit<ProductionReport, 'id' | 'createdAt'>): Promise<string | null> {
    const required: (keyof typeof data)[] = [
      'employeeId',
      'productId',
      'lineId',
      'date',
      'quantityProduced',
      'workersCount',
      'workHours',
    ];
    for (const field of required) {
      if (data[field] === undefined || data[field] === null || data[field] === '') {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    const res = await apiClient.post<{ id: string }>('/production/reports', data);
    return res.id;
  },

  async update(id: string, data: Partial<ProductionReport>): Promise<void> {
    await apiClient.put<void>(`/production/reports/${id}`, data);
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete<void>(`/production/reports/${id}`);
  },

  async getByLineAndProduct(lineId: string, productId: string, fromDate?: string): Promise<ProductionReport[]> {
    const reports = await apiClient.get<ProductionReport[]>('/production/reports', { lineId, productId });
    if (!fromDate) return reports;
    return reports.filter((r) => r.date >= fromDate);
  },

  async getByProduct(productId: string): Promise<ProductionReport[]> {
    return apiClient.get<ProductionReport[]>('/production/reports', { productId });
  },

  async getByLine(lineId: string): Promise<ProductionReport[]> {
    return apiClient.get<ProductionReport[]>('/production/reports', { lineId });
  },

  async getByEmployee(employeeId: string): Promise<ProductionReport[]> {
    return apiClient.get<ProductionReport[]>('/production/reports', { employeeId });
  },

  async getByWorkOrderId(workOrderId: string): Promise<ProductionReport[]> {
    if (!workOrderId) return [];
    return apiClient.get<ProductionReport[]>('/production/reports', { workOrderId });
  },

  async backfillMissingReportCodes(): Promise<number> {
    const res = await apiClient.post<{ updated: number }>('/production/reports/backfill-missing-codes');
    return res.updated;
  },

  subscribeToday(todayStr: string, onData: (reports: ProductionReport[]) => void): Unsubscribe {
    let active = true;
    const pull = async () => {
      if (!active) return;
      try {
        const reports = await this.getByDateRange(todayStr, todayStr);
        onData(reports);
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
