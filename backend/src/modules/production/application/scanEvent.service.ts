import type { WorkOrderRepository } from "../domain/workOrder.repository.js";
import type { ScanEventQuery, WorkOrderScanEvent } from "../domain/types.js";

export class ScanEventService {
  constructor(private readonly repo: WorkOrderRepository) {}

  list(filters?: ScanEventQuery): Promise<WorkOrderScanEvent[]> {
    return this.repo.listScanEvents(filters);
  }

  async create(
    data: Omit<WorkOrderScanEvent, "id" | "timestamp"> & { timestamp?: string },
  ): Promise<string> {
    return this.repo.createScanEvent(data);
  }

  async deleteSession(workOrderId: string, sessionId: string): Promise<void> {
    await this.repo.deleteScanSession(workOrderId, sessionId);
  }
}

