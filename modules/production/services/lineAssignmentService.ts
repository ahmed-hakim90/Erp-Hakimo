import type { LineWorkerAssignment } from '../../../types';
import { apiRequest } from './apiClient';

export const lineAssignmentService = {
  async getByLineAndDate(lineId: string, date: string): Promise<LineWorkerAssignment[]> {
    return apiRequest<LineWorkerAssignment[]>('GET', '/production/line-assignments/by-line-date', {
      query: { lineId, date },
    });
  },

  async getByDate(date: string): Promise<LineWorkerAssignment[]> {
    return apiRequest<LineWorkerAssignment[]>('GET', `/production/line-assignments/by-date/${date}`);
  },

  async create(data: Omit<LineWorkerAssignment, 'id' | 'assignedAt'>): Promise<string | null> {
    const result = await apiRequest<{ id: string | null }>('POST', '/production/line-assignments', {
      body: { ...data, assignedAt: new Date().toISOString() },
    });
    return result.id;
  },

  async delete(id: string): Promise<void> {
    await apiRequest<void>('DELETE', `/production/line-assignments/${id}`);
  },

  async deleteByLineAndDate(lineId: string, date: string): Promise<void> {
    await apiRequest<void>('DELETE', '/production/line-assignments/delete-by-line-date', {
      query: { lineId, date },
    });
  },

  async copyFromDate(
    sourceDate: string,
    targetDate: string,
    lineId?: string,
    assignedBy?: string,
    activeEmployeeIds?: Set<string>,
  ): Promise<number> {
    // Preserve frontend compatibility for active-employee filtering until backend owns HR domain too.
    if (!activeEmployeeIds || activeEmployeeIds.size === 0) {
      const result = await apiRequest<{ copied: number }>('POST', '/production/line-assignments/copy-from-date', {
        body: { sourceDate, targetDate, lineId, assignedBy },
      });
      return result.copied || 0;
    }

    const sourceAssignments = lineId
      ? await this.getByLineAndDate(lineId, sourceDate)
      : await this.getByDate(sourceDate);
    const existingToday = lineId
      ? await this.getByLineAndDate(lineId, targetDate)
      : await this.getByDate(targetDate);
    const existingKeys = new Set(existingToday.map((a) => `${a.lineId}_${a.employeeId}`));

    let count = 0;
    for (const a of sourceAssignments) {
      const key = `${a.lineId}_${a.employeeId}`;
      if (existingKeys.has(key)) continue;
      if (!activeEmployeeIds.has(a.employeeId)) continue;
      await this.create({
        lineId: a.lineId,
        employeeId: a.employeeId,
        employeeCode: a.employeeCode,
        employeeName: a.employeeName,
        date: targetDate,
        assignedBy: assignedBy || '',
      });
      count += 1;
    }
    return count;
  },
};
